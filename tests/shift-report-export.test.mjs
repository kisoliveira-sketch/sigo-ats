import test from "node:test";
import assert from "node:assert/strict";
import {
  FULL_REPORT_SCOPE, PRINT_REPORT_SCOPE, buildShiftReportCsv, getRecordedValidation,
  isShiftReportReady, readCompleteReportRows, shiftReportCsvName,
} from "../src/lib/shift-report-export.ts";

test("preserves CSV headers and quoted UTF-8 data, while preventing spreadsheet formulas", () => {
  assert.equal(buildShiftReportCsv(["entry_severity", "entry_facts"], []), '"entry_severity","entry_facts"');
  const csv = buildShiftReportCsv(["A", "B"], [
    ["Ônibus, Posição", 'Uma "nota"\ncontinua'], [" =1+2", "\t@HYPERLINK"], ["-90", null],
  ]);
  assert.equal(csv, [
    '"A","B"', '"Ônibus, Posição","Uma ""nota""\ncontinua"', '"\' =1+2","\'\t@HYPERLINK"', '"\'-90",""',
  ].join("\r\n"));
  assert.equal(Buffer.from(csv, "utf8").toString("utf8"), csv);
  assert.match(FULL_REPORT_SCOPE, /não filtra/);
  assert.match(PRINT_REPORT_SCOPE, /respeita a pesquisa/);
  assert.equal(shiftReportCsvName("T1"), "T1-turno-completo.csv");
});

test("export won't use loading, incomplete or another shift's report", () => {
  const facts = { isLoading: false, requestedShiftId: 2, loadedShiftId: 2, hasShift: true };
  assert.equal(isShiftReportReady(facts), true);
  for (const change of [
    { isLoading: true }, { loadedShiftId: null }, { loadedShiftId: 1 }, { hasShift: false },
  ]) assert.equal(isShiftReportReady({ ...facts, ...change }), false);
});

test("system validation is UTC and never fills a missing validator with a guess", () => {
  assert.deepEqual(getRecordedValidation("2026-11-20T02:08:10+02:00", null), {
    recorded: true, by: "Identidade indisponível", atUtc: "2026-11-20 00:08:10 UTC",
  });
  assert.deepEqual(getRecordedValidation("2026-11-20T00:00:00Z", " Validated "), {
    recorded: true, by: "Validated", atUtc: "2026-11-20 00:00:00 UTC",
  });
  assert.deepEqual(getRecordedValidation(null, "Unknown"), { recorded: false, by: "—", atUtc: "—" });
});

test("report pagination obeys server limit and blocks incomplete/unstable results", async () => {
  const ready = Array.from({ length: 1400 }, (_, i) => ({ id: 1400 - i }));
  const fetchPage = (before) => {
    const matching = ready.filter(({ id }) => before === null || id < before);
    return Promise.resolve({ rows: matching.slice(0, 131), remaining: matching.length });
  };
  assert.deepEqual(await readCompleteReportRows(fetchPage), ready);
  assert.deepEqual(await readCompleteReportRows(async () => ({ rows: [], remaining: 0 })), []);
  await assert.rejects(readCompleteReportRows(async () => ({ rows: [], remaining: 300 })), /incompleta/);
  await assert.rejects(readCompleteReportRows(async () => ({ rows: [], remaining: null })), /incompleta/);
  await assert.rejects(readCompleteReportRows(async () => ({ rows: [{ id: 1 }, { id: 1 }], remaining: 2 })), /Ordem/);
  await assert.rejects(readCompleteReportRows(async (before) => {
    if (before !== null) throw new Error("network timeout");
    return { rows: [{ id: 2 }], remaining: 2 };
  }), /network timeout/);
  await assert.rejects(readCompleteReportRows(async (before) =>
    before === null ? { rows: [{ id: 2 }], remaining: 2 } : { rows: [], remaining: 0 }), /incompleta/);
});
