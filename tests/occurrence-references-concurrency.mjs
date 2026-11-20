import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const port = process.env.SIGO_OCCURRENCE_QA_PORT;
assert.match(port ?? "", /^[0-9]{4,5}$/, "Use the synthetic test cluster on loopback");
const env = {
  PATH: process.env.PATH, PGHOST: "127.0.0.1", PGPORT: port,
  PGDATABASE: "sigo_occurrence_fixture", PGCONNECT_TIMEOUT: "5",
};
function query(sql) {
  const r = spawnSync("psql", ["-XAtq", "-v", "ON_ERROR_STOP=1", "-c", sql], { env, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim();
}
assert.equal(query(`select count(*) from public.shifts
  where (id, shift_code) in ((1001,'TWR_FIX-20261121-0700/1300'),(1050,'TWR_FIX-20261121-0700/1300'),
                            (1002,'ACC_FIX-20261121-0700/1300'))`), "3");
assert.equal(query(`select last_number from sigo_lifecycle_private.occurrence_reference_counters_v1
  where shift_code='TWR_FIX-20261121-0700/1300'`), "999");

const pId = (id) => `00000000-0000-0000-0000-0000000000${id}`;
function insert(id, shift, actor = 31) {
  return `set role authenticated;
set request.jwt.claim.sub='${pId(actor)}';
insert into public.occurrences(id,shift_id,ats_unit_id,created_by)
  values(${id},${shift},${actor},auth.uid()) returning occurrence_number;`;
}
function session(name) {
  const p = spawn("psql", ["-XAtq", "-v", "ON_ERROR_STOP=1"], { env: { ...env, PGAPPNAME: name }, stdio: ["pipe", "pipe", "pipe"] });
  let out = "", err = "";
  p.stdout.on("data", chunk => { out += chunk; });
  p.stderr.on("data", chunk => { err += chunk; });
  p.stdin.on("error", () => {});
  const done = new Promise((resolve, reject) => {
    p.on("error", reject);
    p.on("close", code => resolve({ code, out, err }));
  });
  return { p, done, out: () => out };
}
async function until(pred, problem) {
  for (let i = 0; i < 150; i++) {
    if (pred()) return;
    await sleep(30);
  }
  throw new Error(problem);
}
async function race({ firstId, secondId, secondShift, expected, rollback = false, proveIndependent = false }) {
  const aName = `sigo_occ_fixture_a_${firstId}`, bName = `sigo_occ_fixture_b_${secondId}`;
  const a = session(aName), b = session(bName);
  try {
    a.p.stdin.write(`begin;\n${insert(firstId,1001)}\nselect 'FIXTURE_READY';\n`);
    await until(() => a.out().includes("FIXTURE_READY"), "First insert did not hold its lock");
    b.p.stdin.end(`${insert(secondId,secondShift)}\n`);
    await until(() => query(`select
      exists(select 1 from pg_stat_activity a, pg_stat_activity b
        where a.application_name='${aName}' and b.application_name='${bName}' and a.pid <> b.pid
          and a.pid = any(pg_blocking_pids(b.pid)))`) === "t", "Second backend did not wait on first");
    if (proveIndependent) {
      assert.equal(query(insert(203,1002,32)), "ACC_FIX-20261121-0700/1300-OCC-001");
    }
    a.p.stdin.end(rollback ? "rollback;\n" : "commit;\n");
    const [first, second] = await Promise.all([a.done, b.done]);
    assert.equal(first.code, 0, first.err);
    assert.equal(second.code, 0, second.err);
    assert.match(first.out, new RegExp(`OCC-${expected[0]}\\b`));
    assert.match(second.out, new RegExp(`OCC-${expected[1]}\\b`));
    if (rollback) assert.equal(query(`select count(*) from occurrences where id=${firstId}`), "0");
  } finally {
    a.p.kill();
    b.p.kill();
  }
}
await race({ firstId:201, secondId:202, secondShift:1001, expected:[1000,1001], proveIndependent:true });
await race({ firstId:204, secondId:205, secondShift:1050, expected:[1002,1003] });
await race({ firstId:206, secondId:207, secondShift:1050, expected:[1004,1004], rollback:true });
assert.equal(query("select count(*) - count(distinct occurrence_number) from occurrences"), "0");
console.log("OCCURRENCE_REFERENCES_TWO_SESSIONS_PASS");
