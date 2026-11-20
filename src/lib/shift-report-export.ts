export const FULL_REPORT_SCOPE = "Turno completo — a pesquisa no ecrã não filtra este ficheiro.";
export const PRINT_REPORT_SCOPE = "Impressão da vista do ecrã — respeita a pesquisa e mostra o detalhe da ocorrência selecionada.";

export type RecordedValidation = {
  recorded: boolean;
  by: string;
  atUtc: string;
};

export function getRecordedValidation(timestamp: string | null, validatorName: string | null): RecordedValidation {
  if (!timestamp || !Number.isFinite(Date.parse(timestamp))) {
    return { recorded: false, by: "—", atUtc: "—" };
  }
  return {
    recorded: true,
    by: validatorName?.trim() || "Identidade indisponível",
    atUtc: new Date(timestamp).toISOString().slice(0, 19).replace("T", " ") + " UTC",
  };
}

export function isShiftReportReady(input: {
  isLoading: boolean; loadedShiftId: number | null; requestedShiftId: number; hasShift: boolean;
}) {
  return !input.isLoading && input.hasShift && input.loadedShiftId === input.requestedShiftId;
}

export function buildShiftReportCsv(header: string[], rows: unknown[][]) {
  const escapeCell = (value: unknown) => {
    const valueString = String(value ?? "");
    // Quoting alone does not prevent a spreadsheet from treating text as a formula.
    const spreadsheetText = /^[\s\p{Cf}]*[=+\-@]|^[\t\r\n]/u.test(valueString)
      ? "'" + valueString : valueString;
    return '"' + spreadsheetText.replace(/"/g, '""') + '"';
  };
  return [header, ...rows].map((row) => row.map(escapeCell).join(",")).join("\r\n");
}

export function shiftReportCsvName(shiftCode: string) {
  return shiftCode + "-turno-completo.csv";
}

export async function readCompleteReportRows<T extends { id: number }>(
  getPage: (before: number | null) => Promise<{ rows: T[]; remaining: number | null }>,
) {
  const rows: T[] = [];
  let before: number | null = null;
  let expected: number | null = null;
  while (true) {
    const result = await getPage(before);
    if (expected === null) expected = result.remaining;
    if (expected === null || result.remaining !== expected - rows.length
        || result.rows.length > result.remaining) throw new Error("Relatório com uma leitura incompleta");
    if (!result.rows.length) {
      if (rows.length !== expected) throw new Error("Relatório com uma leitura incompleta");
      return rows;
    }
    let last: number | null = before;
    for (const row of result.rows) {
      if (!Number.isSafeInteger(row.id) || (last !== null && row.id >= last)) {
        throw new Error("Ordem de paginação inesperada");
      }
      last = row.id;
    }
    before = last;
    rows.push(...result.rows);
  }
}
