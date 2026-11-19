const UNITS_WITHOUT_SUPERVISION = new Set([
  "AICE",
  "AICE_TWR",
  "TWR_AICE",
  "TWR_BVC",
  "TWR_SAL",
]);

type Shift = {
  status: string;
  opening_notes?: string | null;
  opened_by?: string | null;
};

type Profile = {
  id: string;
  full_name?: string | null;
  email?: string | null;
};

type PositionLogAuthority =
  | { kind: "supervisor"; label: string }
  | { kind: "opener"; userId: string }
  | { kind: "none" };

export function isUnitWithoutSupervision(unitCode?: string | null) {
  return UNITS_WITHOUT_SUPERVISION.has(unitCode?.trim().toUpperCase() ?? "");
}

function getSupervisorLabel(notes?: string | null) {
  const marker = "Composição do turno:";
  const markerIndex = notes?.indexOf(marker) ?? -1;
  if (!notes || markerIndex < 0) return null;

  const supervisorLine = notes
    .slice(markerIndex + marker.length)
    .split("|")
    .map((line) => line.trim())
    .find((line) => line.toLowerCase().startsWith("supervisor:"));

  return supervisorLine?.slice("supervisor:".length).trim() || null;
}

export function getPositionLogAuthority(
  shift?: Shift | null,
  unitCode?: string | null,
): PositionLogAuthority {
  if (!shift || shift.status !== "OPEN") return { kind: "none" };

  const namedSupervisor = getSupervisorLabel(shift.opening_notes);
  if (namedSupervisor) return { kind: "supervisor", label: namedSupervisor };

  if (isUnitWithoutSupervision(unitCode) && shift.opened_by) {
    return { kind: "opener", userId: shift.opened_by };
  }

  return { kind: "none" };
}

export function canManagePositionLogs(
  authority: PositionLogAuthority,
  profile?: Profile | null,
) {
  if (!profile) return false;
  if (authority.kind === "opener") return profile.id === authority.userId;
  if (authority.kind !== "supervisor") return false;

  const label = authority.label.toLowerCase();
  return (
    profile.full_name?.trim().toLowerCase() === label ||
    profile.email?.trim().toLowerCase() === label
  );
}
