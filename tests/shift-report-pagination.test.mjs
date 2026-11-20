import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";
import { exportShiftReportPdf } from "../src/lib/export-shift-report-pdf.ts";

// Run with: node --test tests/shift-report-pagination.test.mjs
// Requires Node 24+ (TypeScript stripping) and the Poppler pdftotext utility.
test("long shift notes and both copies of an occurrence stay on-page", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "sigo-shift-report-"));
  const previousDirectory = process.cwd();
  const outcomeMarker = "AFTERLONGFIELD";
  const noteMarker = "NOTELASTROW";
  const descriptionMarker = "DESCRIPTIONLASTROW";
  const createText = (prefix, count, end) =>
    [...Array.from({ length: count }, (_, i) => prefix + String(i + 1).padStart(3, "0")), end].join("\n");

  try {
    process.chdir(directory);
    exportShiftReportPdf({
      shift: {
        shift_code: "TEST-PAGINATION",
        operational_date: "2026-11-19",
        start_time_utc: "2026-11-19T09:00:00Z",
        end_time_utc: "2026-11-19T15:00:00Z",
        status: "CLOSED",
        opening_notes: null,
        handover_notes: null,
      },
      supervisor: "Pessoa de teste",
      composition: "Equipa de teste",
      notes: createText("OPNOTE", 175, noteMarker),
      weatherSummary: "—",
      equipmentSummary: "—",
      occurrenceLevelSummary: "Normal",
      pendingFollowupCount: 0,
      validation: { recorded: true, by: "VALIDATORCONFIRMED", atUtc: "2026-11-19 14:15:23 UTC" },
      entries: [{
        occurrence_number: "TEST-1",
        severity: "Normal",
        occurrence_at_utc: "2026-11-19T13:00:00Z",
        description_factual: createText("DESCR", 190, descriptionMarker),
        involved_entities: null,
        actions_taken: null,
        outcome: outcomeMarker,
        communications_made: null,
        documentary_reference: null,
        callsign: null,
        aircraft_registration: null,
        aircraft_type: null,
        equipment_reference: null,
        location_detail: null,
        weather_context: null,
        requires_followup: false,
        occurrence_categories: null,
      }],
    });

    const lines = execFileSync("pdftotext", ["-layout", "TEST-PAGINATION.pdf", "-"], { encoding: "utf8" });
    const pages = lines.split("\f").filter((page) => page.trim());
    assert.ok(pages.length >= 8, "the fixture must span multiple pages");
    for (let i = 1; i <= 175; i++) {
      const tag = "OPNOTE" + String(i).padStart(3, "0");
      assert.equal(lines.split(tag).length - 1, 1, tag + " must survive pagination");
    }
    for (let i = 1; i <= 190; i++) {
      const tag = "DESCR" + String(i).padStart(3, "0");
      assert.equal(lines.split(tag).length - 1, 2, tag + " must be present in summary and details");
    }
    assert.equal(lines.split(noteMarker).length - 1, 1);
    assert.equal(lines.split(descriptionMarker).length - 1, 2);
    assert.match(lines, /Resultado \/ consequência:[ \t]+AFTERLONGFIELD/);
    assert.match(lines, /9\. VALIDAÇÃO REGISTADA NO SISTEMA/);
    assert.match(lines, /Validação registada/);
    assert.match(lines, /Validado por:[ \t]+VALIDATORCONFIRMED/);
    assert.match(lines, /2026-11-19 14:15:23 UTC/);
    assert.match(lines, /ASSINATURA MANUSCRITA \(SE APLICÁVEL\)/);
    assert.match(lines, /Não aplica a pesquisa do ecrã/);
    assert.match(lines, /Não incluídos neste PDF/);
    assert.doesNotMatch(lines, /ANEXO. LOGS/);
    pages.forEach((page, i) => {
      assert.ok(page.includes("RELATÓRIO ATS"), "each page has a header");
      assert.ok(page.includes("Página " + (i + 1) + " de " + pages.length), "each page has its number");
    });

    const bounds = execFileSync("pdftotext", ["-bbox", "TEST-PAGINATION.pdf", "-"], { encoding: "utf8" });
    const bodyLimitPoints = (297 - 15) * (72 / 25.4);
    const bodyWords = [...bounds.matchAll(/<word [^>]*yMax="([^"]+)"[^>]*>((?:OPNOTE|DESCR|AFTERLONGFIELD|NOTELASTROW)[^<]*)<\/word>/g)];
    assert.ok(bodyWords.length >= 550, "bounding boxes include the body tokens");
    for (const [, yMax, word] of bodyWords) {
      assert.ok(Number(yMax) <= bodyLimitPoints + 2, word + " must not enter the footer margin");
    }
  } finally {
    process.chdir(previousDirectory);
    rmSync(directory, { recursive: true, force: true });
  }
});


test("empty report, optional position logs and long notes remain truthful in the PDF", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "sigo-report-logs-"));
  const previousDirectory = process.cwd();
  const lastNote = "FINAL-NOTE-MARKER";
  try {
    process.chdir(directory);
    const report = {
      shift: { shift_code: "TEST-LOGS", operational_date: "2026-11-19", status: "OPEN",
        start_time_utc: null, end_time_utc: null, opening_notes: null, handover_notes: null },
      supervisor: "Supervisor Example", entries: [], composition: "—", notes: "—",
      weatherSummary: "—", equipmentSummary: "—", occurrenceLevelSummary: "—",
      pendingFollowupCount: 0, validation: { recorded: false, by: "—", atUtc: "—" },
    };
    exportShiftReportPdf({ ...report, positionLogs: [] });
    const empty = execFileSync("pdftotext", ["-layout", "TEST-LOGS.pdf", "-"], { encoding: "utf8" });
    assert.match(empty, /Sem ocorrências registadas neste turno/);
    assert.match(empty, /Sem logs de posição registados neste turno/);
    assert.match(empty, /Sem validação registada/);
    assert.doesNotMatch(empty, /Validado por:/);

    exportShiftReportPdf({ ...report, positionLogs: [{
      name: "CTA-TESTE", enteredAt: "2026-11-19T23:58:00Z", leftAt: null,
      notes: [...Array.from({ length: 180 }, (_, i) => "LOGNOTE" + String(i).padStart(3, "0")), lastNote].join("\n"),
    }] });
    const lines = execFileSync("pdftotext", ["-layout", "TEST-LOGS.pdf", "-"], { encoding: "utf8" });
    assert.match(lines, /ANEXO. LOGS OPERACIONAIS DA POSIÇÃO/);
    assert.match(lines, /CTA-TESTE/);
    assert.match(lines, /2026-11-19 23:58 UTC/);
    assert.match(lines, /Ainda sem saída registada/);
    for (let i = 0; i < 180; i++) {
      const tag = "LOGNOTE" + String(i).padStart(3, "0");
      assert.equal(lines.split(tag).length - 1, 1);
    }
    assert.equal(lines.split(lastNote).length - 1, 1);
  } finally {
    process.chdir(previousDirectory);
    rmSync(directory, { recursive: true, force: true });
  }
});
