import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAuthorizedAdminContext } from "@/lib/admin-server";

const selectionLimit = 20;

function resetEnabled() {
  return process.env.SIGO_ENABLE_OPERATIONAL_RESET === "true";
}

function exactCount(result: { count: number | null; error: unknown }) {
  if (result.error || result.count === null) throw new Error("count_unavailable");
  return result.count;
}

async function getOperationalCounts(adminClient: SupabaseClient) {
  const result = await Promise.all([
    adminClient.from("shifts").select("id", { count: "exact", head: true }),
    adminClient.from("occurrences").select("id", { count: "exact", head: true }),
    adminClient.from("shift_position_logs").select("id", { count: "exact", head: true }),
  ]);
  return {
    shifts: exactCount(result[0]),
    occurrences: exactCount(result[1]),
    positionLogs: exactCount(result[2]),
  };
}

function parseDate(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || !/^[1-9][0-9]{3}-[0-9]{2}-[0-9]{2}$/.test(value)) throw new Error("invalid_filter");
  const date = new Date(value + "T00:00:00Z");
  if (!Number.isFinite(date.valueOf()) || date.toISOString().slice(0, 10) !== value) throw new Error("invalid_filter");
  return value;
}

function parseFilters(body: Record<string, unknown>) {
  const dateFrom = parseDate(body.dateFrom);
  const dateTo = parseDate(body.dateTo);
  const unit = body.atsUnitId;
  const atsUnitId =
    unit === null || unit === undefined || unit === "" ? null :
      (typeof unit === "number" || (typeof unit === "string" && /^[1-9][0-9]*$/.test(unit))) ? Number(unit) : NaN;
  if ((dateFrom && dateTo && dateFrom > dateTo) ||
      (atsUnitId !== null && (!Number.isSafeInteger(atsUnitId) || atsUnitId < 1))) throw new Error("invalid_filter");
  return { dateFrom, dateTo, atsUnitId };
}

async function getFilteredPreview(
  adminClient: SupabaseClient,
  { dateFrom, dateTo, atsUnitId }: ReturnType<typeof parseFilters>,
) {
  let shiftsQuery = adminClient.from("shifts")
    .select("id,shift_code,operational_date,status,ats_unit_id,updated_at,ats_units(name,code)")
    .eq("status", "CLOSED")
    .order("operational_date", { ascending: false }).order("id", { ascending: false }).limit(selectionLimit);
  let countsQuery = adminClient.from("shifts").select("id", { count: "exact", head: true }).eq("status", "CLOSED");
  let occurrenceQuery = adminClient.from("occurrences").select("id,shifts!inner(id)", { count: "exact", head: true }).eq("shifts.status", "CLOSED");
  let logQuery = adminClient.from("shift_position_logs").select("id,shifts!inner(id)", { count: "exact", head: true }).eq("shifts.status", "CLOSED");
  if (dateFrom) {
    shiftsQuery = shiftsQuery.gte("operational_date", dateFrom);
    countsQuery = countsQuery.gte("operational_date", dateFrom);
    occurrenceQuery = occurrenceQuery.gte("shifts.operational_date", dateFrom);
    logQuery = logQuery.gte("shifts.operational_date", dateFrom);
  }
  if (dateTo) {
    shiftsQuery = shiftsQuery.lte("operational_date", dateTo);
    countsQuery = countsQuery.lte("operational_date", dateTo);
    occurrenceQuery = occurrenceQuery.lte("shifts.operational_date", dateTo);
    logQuery = logQuery.lte("shifts.operational_date", dateTo);
  }
  if (atsUnitId) {
    shiftsQuery = shiftsQuery.eq("ats_unit_id", atsUnitId);
    countsQuery = countsQuery.eq("ats_unit_id", atsUnitId);
    occurrenceQuery = occurrenceQuery.eq("shifts.ats_unit_id", atsUnitId);
    logQuery = logQuery.eq("shifts.ats_unit_id", atsUnitId);
  }
  const [shifts, counts, occurrences, logs] = await Promise.all([shiftsQuery, countsQuery, occurrenceQuery, logQuery]);
  if (shifts.error) throw shifts.error;
  return {
    counts: { shifts: exactCount(counts), occurrences: exactCount(occurrences), positionLogs: exactCount(logs) },
    shifts: shifts.data ?? [],
  };
}

export async function GET(request: NextRequest) {
  const auth = await getAuthorizedAdminContext(request, ["ADMIN"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });

  const params = request.nextUrl.searchParams;
  let filters;
  try {
    filters = parseFilters({ dateFrom: params.get("dateFrom"), dateTo: params.get("dateTo"), atsUnitId: params.get("atsUnitId") });
  } catch {
    return NextResponse.json({ error: "Datas ou órgão ATS inválidos." }, { status: 400 });
  }

  try {
    const [counts, units, preview] = await Promise.all([
      getOperationalCounts(auth.adminClient),
      auth.adminClient.from("ats_units").select("id,name,code").order("name", { ascending: true }),
      Object.values(filters).some((value) => value !== null) ? getFilteredPreview(auth.adminClient, filters) : null,
    ]);
    if (units.error) throw units.error;
    return NextResponse.json({
      counts, preview, units: units.data ?? [], resetEnabled: resetEnabled(),
      profile: { role: auth.profile.role, full_name: auth.profile.full_name },
    });
  } catch {
    return NextResponse.json({ error: "Não foi possível carregar o estado operacional." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  // Do not mask the disabled state behind an unavailable enrollment flow.
  const auth = await getAuthorizedAdminContext(request, ["ADMIN"], { requireMfa: resetEnabled() });
  if ("error" in auth) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  if (!resetEnabled()) return NextResponse.json({ error: "O apagamento está desativado. A pré-visualização continua disponível." }, { status: 503 });

  try {
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body || body.confirm !== true || !Array.isArray(body.selectedShiftIds) ||
        !body.selectedShiftIds.length || body.selectedShiftIds.length > selectionLimit ||
        !body.selectedShiftIds.every((id) => Number.isSafeInteger(id) && id > 0) ||
        new Set(body.selectedShiftIds).size !== body.selectedShiftIds.length ||
        !Array.isArray(body.selectedShiftVersions) || body.selectedShiftVersions.length !== body.selectedShiftIds.length ||
        !body.selectedShiftVersions.every((version) => typeof version === "string" && version.length <= 50 && Number.isFinite(Date.parse(version)))) {
      return NextResponse.json({ error: "Confirme a seleção explícita na pré-visualização mais recente." }, { status: 400 });
    }

    let filters;
    try {
      filters = parseFilters(body);
      if (Object.values(filters).every((value) => value === null)) throw new Error("missing_filter");
    } catch {
      return NextResponse.json({ error: "Indique um intervalo ou órgão ATS válido." }, { status: 400 });
    }
    const preview = await getFilteredPreview(auth.adminClient, filters);
    const versions = new Map(preview.shifts.map((shift) => [shift.id, shift.updated_at]));
    if (!body.selectedShiftIds.every((id, index) => versions.get(id) === (body.selectedShiftVersions as string[])[index])) {
      return NextResponse.json({ error: "A seleção mudou. Atualize a pré-visualização antes de confirmar." }, { status: 409 });
    }

    // One DB transaction. No fallback to individual DELETEs if unavailable.
    const result = await auth.adminClient.rpc("sigo_reset_operational_v1", {
      p_actor: auth.profile.id,
      p_shift_ids: body.selectedShiftIds,
      p_expected_versions: body.selectedShiftVersions,
      p_date_from: filters.dateFrom,
      p_date_to: filters.dateTo,
      p_ats_unit_id: filters.atsUnitId,
    });
    if (result.error) {
      if (result.error.message === "sigo_reset_selection_changed") {
        return NextResponse.json({ error: "A seleção mudou. Atualize a pré-visualização antes de confirmar." }, { status: 409 });
      }
      if (result.error.message === "sigo_reset_disabled") {
        return NextResponse.json({ error: "O apagamento está desativado na base de dados." }, { status: 503 });
      }
      return NextResponse.json({ error: "Não foi possível confirmar a limpeza. Consulte o estado e a auditoria antes de tentar novamente." }, { status: 500 });
    }
    return NextResponse.json({ success: true, message: "Registos operacionais selecionados removidos.", result: result.data });
  } catch {
    return NextResponse.json({ error: "Não foi possível confirmar a limpeza. Atualize a pré-visualização." }, { status: 500 });
  }
}
