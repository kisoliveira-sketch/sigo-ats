import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAuthorizedAdminContext } from "@/lib/admin-server";

const allowedRoles = new Set(["ADMIN"]);

async function getOperationalCounts(adminClient: SupabaseClient) {
  const [shifts, occurrences, logs] = await Promise.all([
    adminClient.from("shifts").select("*", { count: "exact", head: true }),
    adminClient.from("occurrences").select("*", { count: "exact", head: true }),
    adminClient
      .from("shift_position_logs")
      .select("*", { count: "exact", head: true }),
  ]);

  if (shifts.error) throw shifts.error;
  if (occurrences.error) throw occurrences.error;
  if (logs.error) throw logs.error;

  return {
    shifts: shifts.count ?? 0,
    occurrences: occurrences.count ?? 0,
    positionLogs: logs.count ?? 0,
  };
}

function getDateFilters(request: NextRequest, body?: Record<string, unknown>) {
  const dateFrom =
    typeof body?.dateFrom === "string"
      ? body.dateFrom
      : request.nextUrl.searchParams.get("dateFrom");
  const dateTo =
    typeof body?.dateTo === "string"
      ? body.dateTo
      : request.nextUrl.searchParams.get("dateTo");

  return {
    dateFrom: dateFrom?.trim() || null,
    dateTo: dateTo?.trim() || null,
  };
}

function getUnitFilter(request: NextRequest, body?: Record<string, unknown>) {
  const atsUnitId =
    typeof body?.atsUnitId === "number"
      ? body.atsUnitId
      : typeof body?.atsUnitId === "string" && body.atsUnitId.trim()
        ? Number(body.atsUnitId)
        : request.nextUrl.searchParams.get("atsUnitId")
          ? Number(request.nextUrl.searchParams.get("atsUnitId"))
          : null;

  return Number.isInteger(atsUnitId) ? atsUnitId : null;
}

async function getAvailableUnits(adminClient: SupabaseClient) {
  const { data, error } = await adminClient
    .from("ats_units")
    .select("id, name, code")
    .order("name", { ascending: true });

  if (error) throw error;

  return data ?? [];
}

async function getFilteredPreview(
  adminClient: SupabaseClient,
  dateFrom: string | null,
  dateTo: string | null,
  atsUnitId: number | null,
) {
  let shiftsQuery = adminClient
    .from("shifts")
    .select("id, shift_code, operational_date, status, ats_unit_id, ats_units(name, code)")
    .order("operational_date", { ascending: false });

  if (dateFrom) {
    shiftsQuery = shiftsQuery.gte("operational_date", dateFrom);
  }

  if (dateTo) {
    shiftsQuery = shiftsQuery.lte("operational_date", dateTo);
  }

  if (atsUnitId) {
    shiftsQuery = shiftsQuery.eq("ats_unit_id", atsUnitId);
  }

  const { data: shifts, error: shiftsError } = await shiftsQuery;
  if (shiftsError) throw shiftsError;

  const shiftIds = (shifts ?? []).map((item) => item.id);

  if (shiftIds.length === 0) {
    return {
      counts: {
        shifts: 0,
        occurrences: 0,
        positionLogs: 0,
      },
      shifts: [],
    };
  }

  const [occurrences, logs] = await Promise.all([
    adminClient
      .from("occurrences")
      .select("id", { count: "exact", head: true })
      .in("shift_id", shiftIds),
    adminClient
      .from("shift_position_logs")
      .select("id", { count: "exact", head: true })
      .in("shift_id", shiftIds),
  ]);

  if (occurrences.error) throw occurrences.error;
  if (logs.error) throw logs.error;

  return {
    counts: {
      shifts: shifts.length,
      occurrences: occurrences.count ?? 0,
      positionLogs: logs.count ?? 0,
    },
    shifts: shifts.slice(0, 20),
  };
}

export async function GET(request: NextRequest) {
  const auth = await getAuthorizedAdminContext(request, Array.from(allowedRoles));
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  }

  try {
    const [counts, units] = await Promise.all([
      getOperationalCounts(auth.adminClient),
      getAvailableUnits(auth.adminClient),
    ]);
    const { dateFrom, dateTo } = getDateFilters(request);
    const atsUnitId = getUnitFilter(request);
    const preview =
      dateFrom || dateTo || atsUnitId
        ? await getFilteredPreview(auth.adminClient, dateFrom, dateTo, atsUnitId)
        : null;

    return NextResponse.json({
      counts,
      preview,
      units,
      profile: {
        role: auth.profile.role,
        full_name: auth.profile.full_name,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível carregar o estado operacional." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await getAuthorizedAdminContext(request, Array.from(allowedRoles));
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { dateFrom, dateTo } = getDateFilters(request, body);
    const atsUnitId = getUnitFilter(request, body);
    const selectedShiftIds = Array.isArray(body?.selectedShiftIds)
      ? body.selectedShiftIds.filter(
          (value: unknown): value is number => Number.isInteger(value),
        )
      : [];

    if (body?.confirm !== true) {
      return NextResponse.json(
        { error: "Confirmação obrigatória para limpar registos." },
        { status: 400 },
      );
    }

    if (!dateFrom && !dateTo && !atsUnitId) {
      return NextResponse.json(
        {
          error:
            "Indique pelo menos uma data ou um órgão ATS para filtrar os registos a apagar.",
        },
        { status: 400 },
      );
    }

    if (selectedShiftIds.length === 0) {
      return NextResponse.json(
        { error: "Selecione pelo menos um turno para apagar." },
        { status: 400 },
      );
    }

    let shiftsQuery = auth.adminClient.from("shifts").select("id");

    if (dateFrom) {
      shiftsQuery = shiftsQuery.gte("operational_date", dateFrom);
    }

    if (dateTo) {
      shiftsQuery = shiftsQuery.lte("operational_date", dateTo);
    }

    if (atsUnitId) {
      shiftsQuery = shiftsQuery.eq("ats_unit_id", atsUnitId);
    }

    const { data: shifts, error: shiftsError } = await shiftsQuery;
    if (shiftsError) throw shiftsError;

    const previewShiftIds = new Set((shifts ?? []).map((item) => item.id));
    const shiftIds = selectedShiftIds.filter((id: number) => previewShiftIds.has(id));

    if (shiftIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: "Nenhum turno selecionado corresponde ao intervalo indicado.",
        counts: await getOperationalCounts(auth.adminClient),
      });
    }

    const { error: logsError } = await auth.adminClient
      .from("shift_position_logs")
      .delete()
      .in("shift_id", shiftIds);
    if (logsError) throw logsError;

    const { error: occurrencesError } = await auth.adminClient
      .from("occurrences")
      .delete()
      .in("shift_id", shiftIds);
    if (occurrencesError) throw occurrencesError;

    const { error: deleteShiftsError } = await auth.adminClient
      .from("shifts")
      .delete()
      .in("id", shiftIds);
    if (deleteShiftsError) throw deleteShiftsError;

    const counts = await getOperationalCounts(auth.adminClient);

    return NextResponse.json({
      success: true,
      message: "Registos operacionais filtrados removidos com sucesso.",
      counts,
    });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível limpar os registos operacionais." },
      { status: 500 },
    );
  }
}
