import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";

async function load(path) {
  const { outputText } = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf-8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  return import("data:text/javascript;base64," + Buffer.from(outputText).toString("base64"));
}
const { getDashboardTurnAction, getDashboardPrimaryActionKind, startDashboardRefresh, readDashboardSnapshot } =
  await load("../src/lib/dashboard-refresh.ts");
const { filterShiftHistory, readShiftHistoryPages, isFullOccurrenceReference } = await load("../src/lib/shift-history.ts");

test("operational actions share the same closure and validation checks", () => {
  const normal = { shiftStatus: "known", hasShift: true, isOpener: true, validated: false, occurrences: 0, activePositions: 0 };
  const check = (overrides, href, expectedPrimary, facts = {}) => {
    const current = { ...normal, ...overrides };
    const turnAction = getDashboardTurnAction(current);
    assert.equal(turnAction.href, href);
    const checksUnknown = current.shiftStatus !== "known" || (current.hasShift &&
      (current.activePositions === null || (current.occurrences === null && !current.validated)));
    assert.equal(getDashboardPrimaryActionKind({ turnAction, hasOpenShift: current.hasShift,
      checksUnknown, hasAnyPositionLogs: true, hasActivePositionLogs: !!current.activePositions,
      canCreateOccurrence: !current.validated, canManagePositionLogs: true, ...facts,
    }), expectedPrimary);
  };
  check({ hasShift: false }, "/shifts/open", "open");
  check({ hasShift: false, shiftStatus: "checking" }, null, "refresh");
  check({ hasShift: false, shiftStatus: "unavailable" }, null, "refresh");
  check({}, "/shifts/close", "close");
  check({ activePositions: 1 }, null, "newOccurrence");
  check({ activePositions: 1, validated: true }, null, "managePositions");
  check({ occurrences: 1 }, null, "validate");
  check({ occurrences: 1, isOpener: false }, null, "history");
  check({ occurrences: null }, null, "refresh");
  check({ activePositions: null }, null, "refresh");
  check({ occurrences: null, validated: true }, "/shifts/close", "close");
  check({ occurrences: 1 }, null, "validate", { hasAnyPositionLogs: false });
});

test("refresh polls without overlap, refreshes on return, aborts in background and stops", async () => {
  let visible = true, wake, serial = 0;
  const timers = new Map();
  const requests = [];
  const flush = () => new Promise((resolve) => setImmediate(resolve));
  const refresh = startDashboardRefresh((signal) => new Promise((resolve) => requests.push({ signal, resolve })),
    { visible: () => visible, subscribe: (callback) => { wake = callback; return () => { wake = null; }; },
      setTimer: (callback, delay) => { timers.set(++serial, { callback, delay }); return serial; },
      clearTimer: (id) => timers.delete(id) });
  await flush();
  assert.equal(requests.length, 1);
  wake(); refresh.refresh(); await flush(); assert.equal(requests.length, 1);
  visible = false; wake(); assert.equal(requests[0].signal.aborted, true);
  visible = true; wake(); assert.equal(requests.length, 1);
  requests[0].resolve(); await flush();
  assert.equal([...timers.values()][0].delay, 0);
  [...timers.values()][0].callback(); await flush(); assert.equal(requests.length, 2);
  requests[1].resolve(); await flush();
  assert.equal([...timers.values()][0].delay, 15_000);
  wake(); await flush(); assert.equal(requests.length, 3);
  refresh.stop(); assert.equal(requests[2].signal.aborted, true); requests[2].resolve(); await flush();
  assert.equal(wake, null); assert.equal(timers.size, 0);
});

test("read refresh sees the same still-open prior-date turn, remote position exit, and close", async () => {
  let nowOpen = true, logActive = true, countError = false;
  const assertCount = (value) => ({ count: value, data: null, error: null });
  const good = (value) => ({ data: value, error: null });
  const client = { from(table) {
    let selected, head, eqs = new Map(), nulls = new Set();
    const builder = {
      select(columns, opts) { selected = columns; head = opts?.head; return this; },
      eq(key, val) { eqs.set(key, val); return this; },
      is(key) { nulls.add(key); return this; },
      order() { return this; }, limit() { return this; }, abortSignal() { return this; },
      in() { return this; }, not() { return this; }, returns() { return this; }, maybeSingle() { return this; },
      then(resolve) {
        if (table !== "profiles") assert.equal(eqs.get("ats_unit_id"), 7);
        if (table === "shifts" && eqs.get("status") === "OPEN") {
          assert.equal(eqs.has("operational_date"), false);
          return resolve(good(nowOpen ? { id: 5, shift_code: "TWR-20261119-1800/0600",
            operational_date: "2026-11-19", opened_by: "x", start_time_utc: "2026-11-19T18:00:00Z" } : null));
        }
        if (table === "shifts") return resolve(good(nowOpen ? null : { end_time_utc: "2026-11-20T00:03:00Z" }));
        if (table === "profiles") return resolve(good([{ id: "x", full_name: "CTA" }]));
        if (head) {
          assert.equal(eqs.get("shift_id"), 5);
          return resolve(table === "occurrences" && countError && !eqs.has("requires_followup")
            ? { count: null, error: {} } : assertCount(eqs.has("requires_followup") ? 0 : 1));
        }
        if (table === "shift_position_logs" && nulls.has("left_at_utc")) {
          assert.equal(eqs.get("shift_id"), 5);
          return resolve(good(logActive ? [{ id: 1, user_id: "x" }] : []));
        }
        if (selected === "occurrence_at_utc") return resolve(good({ occurrence_at_utc: "2026-11-20T00:00:00Z" }));
        if (selected === "left_at_utc" && !logActive) return resolve(good({ left_at_utc: "2026-11-20T00:02:00Z" }));
        return resolve(good(null));
      },
    }; return builder;
  } };
  const read = () => readDashboardSnapshot(client, 7, new AbortController().signal);
  let snapshot = await read();
  assert.equal(snapshot.shift.operational_date, "2026-11-19");
  assert.equal(snapshot.activePositions[0].user_name, "CTA");
  assert.equal(snapshot.latestEvent, "2026-11-20T00:00:00Z");
  logActive = false;
  snapshot = await read();
  assert.equal(snapshot.activePositions.length, 0);
  assert.equal(snapshot.latestEvent, "2026-11-20T00:02:00Z");
  countError = true;
  assert.equal((await read()).occurrencesCount, null);
  nowOpen = false;
  snapshot = await read();
  assert.equal(snapshot.shift, null);
  assert.equal(snapshot.latestEvent, "2026-11-20T00:03:00Z");
});

test("history spans shifts, includes both UTC date boundaries, and ignores position of midnight", () => {
  const rows = [
    { id: 1, shift_code: "NOITE", operational_date: "2026-11-19", status: "CLOSED", end_time_utc: "2026-11-20T01:00:00Z",
      shift_staff: [{ role_in_shift: "Supervisor · João" }] },
    { id: 2, shift_code: "DIA", operational_date: "2026-11-20", status: "OPEN" },
  ];
  const filter = (query, status, from, to, ids = []) => filterShiftHistory(rows, query, status, from, to, new Set(ids)).map((r) => r.id);
  assert.deepEqual(filter("", "", "2026-11-19", "2026-11-20"), [1, 2]);
  assert.deepEqual(filter("", "", "2026-11-19", "2026-11-19"), [1]);
  assert.deepEqual(filter(" joao ", "CLOSED", "", ""), [1]);
  assert.deepEqual(filter("encerrado", "OPEN", "", ""), []);
  assert.deepEqual(filter("NOITE-OCC-003", "", "", "", [1]), [1]);
  assert.deepEqual(filter("NOITE-OCC-003", "", "2026-11-20", "", [1]), []);
  assert.equal(isFullOccurrenceReference("TWR_AICE-20261120-0600/1200-OCC-1000"), true);
  assert.equal(isFullOccurrenceReference("BAD*-OCC-001"), false);
});

test("history paging continues past a smaller server cap and honors cancellation", async () => {
  const rows = [{ id: 4 }, { id: 3 }, { id: 2 }, { id: 1 }];
  const controller = new AbortController();
  assert.deepEqual(await readShiftHistoryPages(async (before) => rows.filter((row) => before === null || row.id < before).slice(0, 1), controller.signal), rows);
  await assert.rejects(readShiftHistoryPages(async () => {
    controller.abort(); return rows;
  }, controller.signal));
});
