import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const socket = process.env.SIGO_OPEN_QA_SOCKET;
assert.ok(socket && /^\/tmp\/[a-zA-Z0-9_-]+$/.test(socket), "Use a disposable local Unix socket under /tmp");
const env = {
  PATH: process.env.PATH, PGHOST: socket, PGPORT: process.env.PGPORT || "55433",
  PGDATABASE: "postgres",
};
const query = (sql) => {
  const result = spawnSync("psql", ["-XAtq", "-v", "ON_ERROR_STOP=1", "-c", sql], { env, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
};
assert.equal(query("select to_regclass('public.shift_staff') is not null and exists(select 1 from public.ats_units where id=33 and code='TWR_RACE')"), "t");
assert.equal(query("select count(*) from public.shifts where ats_unit_id=33"), "0");
const call = (id, start, end) => `set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000${id}';
select public.sigo_open_shift_with_staff_v1('TWR_RACE-20261120-${start.replace(":", "")}/${end}','2026-11-20','2026-11-20 ${start}Z',null,
  array['00000000-0000-0000-0000-0000000000${id}'::uuid],array['CTA Operacional']);`;
function session(app) {
  const p = spawn("psql", ["-XAtq", "-v", "ON_ERROR_STOP=1"], { env: { ...env, PGAPPNAME: app }, stdio: ["pipe", "pipe", "pipe"] });
  let out = "", err = "";
  p.stdout.on("data", chunk => { out += chunk; });
  p.stderr.on("data", chunk => { err += chunk; });
  p.stdin.on("error", () => {});
  const done = new Promise((resolve, reject) => { p.on("error", reject); p.on("close", code => resolve({ code, out, err })); });
  return { p, done, out: () => out };
}
async function until(pred) {
  for (let i = 0; i < 200; i++) { if (pred()) return; await sleep(30); }
  throw new Error("Timed out waiting for fixture session");
}
const first = session("sigo_open_fixture_first"), second = session("sigo_open_fixture_waiter");
try {
  first.p.stdin.write(`begin;\n${call("34","07:00","1300")}\nselect 'READY_TO_COMMIT';\n`);
  await until(() => first.out().includes("READY_TO_COMMIT"));
  second.p.stdin.end(`${call("35","13:00","1900")}\n`);
  await until(() => query("select count(*) from pg_stat_activity where application_name='sigo_open_fixture_waiter' and wait_event_type='Lock' and wait_event='advisory'") === "1");
  first.p.stdin.end("commit;\n");
  const a = await first.done, b = await second.done;
  assert.equal(a.code, 0, a.err);
  assert.notEqual(b.code, 0);
  assert.match(b.err, /sigo_open_existing_open/);
  assert.equal(query("select count(*) from public.shifts s join public.shift_staff f on f.shift_id=s.id where s.ats_unit_id=33"), "1");
  console.log("OPEN_ATOMIC_TWO_SESSIONS_PASS");
} finally {
  first.p.kill(); second.p.kill();
}
