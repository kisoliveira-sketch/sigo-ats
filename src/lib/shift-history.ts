export type ShiftHistoryRow = {
  id: number;
  shift_code: string;
  operational_date: string;
  start_time_utc: string | null;
  end_time_utc: string | null;
  status: string;
  opening_notes: string | null;
  handover_notes: string | null;
  shift_staff?: { role_in_shift: string | null }[] | null;
};

export function getSupervisorName(row: ShiftHistoryRow) {
  const role = row.shift_staff?.find((item) =>
    (item.role_in_shift || "").toLowerCase().startsWith("supervisor"),
  )?.role_in_shift;
  if (!role) return "Supervisor não indicado";
  const parts = role.split("·");
  return (parts.length > 1 ? parts.slice(1).join("·").trim() : role.trim()) || "Supervisor não indicado";
}

function normalize(text: string | null | undefined) {
  return (text ?? "").trim().toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
}

// A full occurrence reference can resolve a turn, including a turn from another day.
export function isFullOccurrenceReference(query: string) {
  return /^\S+-OCC-\d{3,19}$/i.test(query) && !/[\x00-\x1f*]/.test(query);
}

export function filterShiftHistory(
  rows: ShiftHistoryRow[], query: string, status: string, after: string, before: string, occurrenceShiftIds: ReadonlySet<number>,
) {
  const needle = normalize(query);
  return rows.filter((row) =>
    (!status || status === row.status) && (!after || row.operational_date >= after) &&
    (!before || row.operational_date <= before) &&
    (!needle || occurrenceShiftIds.has(row.id) || [
      row.shift_code, row.operational_date, row.status, row.status === "OPEN" ? "Aberto" : "Encerrado",
      row.opening_notes, row.handover_notes, getSupervisorName(row),
    ].some((value) => normalize(value).includes(needle))),
  );
}

export async function readShiftHistoryPages<T extends { id: number }>(
  page: (before: number | null) => Promise<T[]>,
  signal: AbortSignal,
) {
  const rows: T[] = [];
  let before: number | null = null;
  // Keyset walks the entire unit-specific result even if PostgREST caps a page.
  // Stop on an empty result, not on a short one: a server cap may be lower than requested.
  while (!signal.aborted) {
    const batch = await page(before);
    if (signal.aborted) break;
    if (!batch.length) return rows;
    const last = batch[batch.length - 1].id;
    if (before !== null && last >= before) throw new Error("Invalid pagination cursor");
    rows.push(...batch);
    before = last;
  }
  throw new Error("Cancelled");
}
