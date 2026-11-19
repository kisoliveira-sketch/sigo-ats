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
    assert.match(lines, /9\. VALIDAÇÃO/);
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
