import { NextRequest, NextResponse } from "next/server";
import { getAuthorizedAdminContext } from "@/lib/admin-server";

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  ats_unit_id: number | null;
};

type AtsUnitRow = {
  id: number;
  name: string;
  code: string;
  is_active: boolean | null;
};

type ShiftRow = {
  id: number;
  shift_code: string;
  operational_date: string;
  status: string;
  ats_unit_id: number | null;
  opened_by: string | null;
  validated_by: string | null;
  validated_at_utc: string | null;
  start_time_utc: string | null;
  end_time_utc: string | null;
  opening_notes: string | null;
};

type OccurrenceRow = {
  id: number;
  occurrence_number: string | null;
  occurrence_at_utc: string | null;
  severity: string | null;
  created_by: string | null;
  ats_unit_id: number | null;
  shift_id: number | null;
};

type PositionLogRow = {
  id: number;
  user_id: string | null;
  shift_id: number | null;
  ats_unit_id: number | null;
  entered_at_utc: string;
  left_at_utc: string | null;
};

function extractShiftCompositionMembers(openingNotes: string | null) {
  if (!openingNotes) return [];

  const marker = "Composição do turno:";
  const idx = openingNotes.indexOf(marker);

  if (idx === -1) return [];

  return openingNotes
    .slice(idx + marker.length)
    .trim()
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => item.split(":").slice(1).join(":").trim())
    .filter(Boolean)
    .map((item) => item.toLowerCase());
}

export async function GET(request: NextRequest) {
  const auth = await getAuthorizedAdminContext(request, ["ADMIN"]);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });
  }

  try {
    const [profilesResult, unitsResult, shiftsResult, occurrencesResult, logsResult] =
      await Promise.all([
        auth.adminClient
          .from("profiles")
          .select("id, full_name, email, role, ats_unit_id")
          .order("full_name", { ascending: true }),
        auth.adminClient
          .from("ats_units")
          .select("id, name, code, is_active")
          .order("name", { ascending: true }),
        auth.adminClient
          .from("shifts")
          .select(
            "id, shift_code, operational_date, status, ats_unit_id, opened_by, validated_by, validated_at_utc, start_time_utc, end_time_utc, opening_notes",
          )
          .order("id", { ascending: false }),
        auth.adminClient
          .from("occurrences")
          .select(
            "id, occurrence_number, occurrence_at_utc, severity, created_by, ats_unit_id, shift_id",
          )
          .order("occurrence_at_utc", { ascending: false }),
        auth.adminClient
          .from("shift_position_logs")
          .select("id, user_id, shift_id, ats_unit_id, entered_at_utc, left_at_utc")
          .order("entered_at_utc", { ascending: false }),
      ]);

    if (profilesResult.error) throw profilesResult.error;
    if (unitsResult.error) throw unitsResult.error;
    if (shiftsResult.error) throw shiftsResult.error;
    if (occurrencesResult.error) throw occurrencesResult.error;
    if (logsResult.error) throw logsResult.error;

    const profiles = (profilesResult.data ?? []) as ProfileRow[];
    const units = (unitsResult.data ?? []) as AtsUnitRow[];
    const shifts = (shiftsResult.data ?? []) as ShiftRow[];
    const occurrences = (occurrencesResult.data ?? []) as OccurrenceRow[];
    const logs = (logsResult.data ?? []) as PositionLogRow[];

    const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));
    const unitsById = new Map(units.map((unit) => [unit.id, unit]));
    const shiftsById = new Map(shifts.map((shift) => [shift.id, shift]));

    const totalOpenShifts = shifts.filter((shift) => shift.status === "OPEN").length;
    const totalClosedShifts = shifts.filter((shift) => shift.status === "CLOSED").length;
    const totalValidatedShifts = shifts.filter((shift) => !!shift.validated_at_utc).length;
    const totalActiveLogs = logs.filter((log) => !log.left_at_utc).length;
    const roleOptions = Array.from(new Set(profiles.map((profile) => profile.role))).sort();

    const unitSummaries = units.map((unit) => {
      const unitUsers = profiles.filter((profile) => profile.ats_unit_id === unit.id);
      const unitShifts = shifts.filter((shift) => shift.ats_unit_id === unit.id);
      const unitOccurrences = occurrences.filter(
        (occurrence) => occurrence.ats_unit_id === unit.id,
      );
      const unitLogs = logs.filter((log) => log.ats_unit_id === unit.id);

      return {
        id: unit.id,
        name: unit.name,
        code: unit.code,
        is_active: unit.is_active ?? true,
        userCount: unitUsers.length,
        openShiftCount: unitShifts.filter((shift) => shift.status === "OPEN").length,
        closedShiftCount: unitShifts.filter((shift) => shift.status === "CLOSED").length,
        occurrenceCount: unitOccurrences.length,
        activeLogCount: unitLogs.filter((log) => !log.left_at_utc).length,
      };
    });

    const users = profiles.map((profile) => {
      const unit = profile.ats_unit_id ? unitsById.get(profile.ats_unit_id) : null;
      const openShift = shifts.find(
        (shift) => shift.ats_unit_id === profile.ats_unit_id && shift.status === "OPEN",
      );
      const profileName = (profile.full_name || profile.email || "").trim().toLowerCase();
      const shiftMembers = extractShiftCompositionMembers(openShift?.opening_notes ?? null);
      const isInShiftComposition = !!profileName && shiftMembers.includes(profileName);

      return {
        id: profile.id,
        full_name: profile.full_name,
        email: profile.email,
        role: profile.role,
        ats_unit: unit
          ? {
              id: unit.id,
              name: unit.name,
              code: unit.code,
            }
          : null,
        hasOpenShiftInUnit: !!openShift,
        isInShiftComposition,
        hasActivePosition: logs.some(
          (log) =>
            log.user_id === profile.id &&
            !log.left_at_utc &&
            (!!openShift ? log.shift_id === openShift.id : true),
        ),
        currentShiftCode: openShift?.shift_code || null,
      };
    });

    const recentShifts = shifts.slice(0, 10).map((shift) => {
      const unit = shift.ats_unit_id ? unitsById.get(shift.ats_unit_id) : null;
      const opener = shift.opened_by ? profilesById.get(shift.opened_by) : null;
      const validator = shift.validated_by ? profilesById.get(shift.validated_by) : null;

      return {
        id: shift.id,
        shift_code: shift.shift_code,
        operational_date: shift.operational_date,
        status: shift.status,
        start_time_utc: shift.start_time_utc,
        end_time_utc: shift.end_time_utc,
        validated_at_utc: shift.validated_at_utc,
        ats_unit: unit
          ? {
              id: unit.id,
              name: unit.name,
              code: unit.code,
            }
          : null,
        opened_by_name: opener?.full_name || opener?.email || "—",
        validated_by_name: validator?.full_name || validator?.email || "—",
      };
    });

    const recentOccurrences = occurrences.slice(0, 10).map((occurrence) => {
      const unit = occurrence.ats_unit_id ? unitsById.get(occurrence.ats_unit_id) : null;
      const shift = occurrence.shift_id ? shiftsById.get(occurrence.shift_id) : null;
      const author = occurrence.created_by ? profilesById.get(occurrence.created_by) : null;

      return {
        id: occurrence.id,
        occurrence_number: occurrence.occurrence_number,
        occurrence_at_utc: occurrence.occurrence_at_utc,
        severity: occurrence.severity,
        ats_unit: unit
          ? {
              id: unit.id,
              name: unit.name,
              code: unit.code,
            }
          : null,
        shift_code: shift?.shift_code || "—",
        author_name: author?.full_name || author?.email || "—",
      };
    });

    return NextResponse.json({
      generatedAtUtc: new Date().toISOString(),
      profile: {
        role: auth.profile.role,
        full_name: auth.profile.full_name,
      },
      system: {
        totalShifts: shifts.length,
        totalOccurrences: occurrences.length,
        totalPositionLogs: logs.length,
        totalOpenShifts,
        totalClosedShifts,
        totalValidatedShifts,
        totalActiveLogs,
        totalUnits: units.length,
        totalUsers: profiles.length,
      },
      roleOptions,
      units: unitSummaries,
      users,
      recentShifts,
      recentOccurrences,
    });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível carregar o resumo administrativo." },
      { status: 500 },
    );
  }
}
