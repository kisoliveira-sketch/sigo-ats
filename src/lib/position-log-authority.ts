const UNITS_WITHOUT_SUPERVISION = new Set([
  "AICE",
  "AICE_TWR",
  "TWR_AICE",
  "TWR_BVC",
  "TWR_SAL",
]);

export function isUnitWithoutSupervision(unitCode?: string | null) {
  return UNITS_WITHOUT_SUPERVISION.has(unitCode?.trim().toUpperCase() ?? "");
}
