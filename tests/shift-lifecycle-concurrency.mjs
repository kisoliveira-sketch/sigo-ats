import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

// Run only after loading fixture.sql and the migration into a disposable DB.
function client() {
  const child = spawn('psql', ['-XAtq', '-v', 'ON_ERROR_STOP=off'], { stdio: ['pipe','pipe','pipe'] });
  let seq = 0, output = '', errors = '', waiting;
  child.stdout.setEncoding('utf8').on('data', (chunk) => {
    output += chunk;
    if (!waiting) return;
    const m = output.match(new RegExp('DONE_' + waiting.n + ' ([A-Z0-9]{5})\\r?\\n'));
    if (!m) return;
    const { resolve } = waiting;
    waiting = null;
    resolve({ code: m[1], data: output.slice(0,m.index).trim(), errors });
    output = ''; errors = '';
  });
  child.stderr.setEncoding('utf8').on('data', (chunk) => { errors += chunk; });
  child.on('exit', (code) => waiting?.reject(new Error('psql exited ' + code + ' ' + errors)));
  return {
    send(sql) {
      assert(!waiting, 'one command per client');
      return new Promise((resolve,reject) => {
        waiting = { n: ++seq, resolve, reject };
        child.stdin.write(sql + ';\n\\echo DONE_' + seq + ' :SQLSTATE\n');
      });
    },
    end() { child.stdin.end('\\q\n'); },
  };
}
const clients = [client(),client(),client()];
const [a,b,monitor] = clients;
const who = (i) => "'00000000-0000-0000-0000-00000000000" + i + "'";
const actor = (i) => "set role authenticated; set request.jwt.claim.sub = " + who(i);
const close = (id) => "update shifts set status='CLOSED', end_time_utc='1970-01-01' where id=" + id + " and status='OPEN'";
const validate = (id) => "update shifts set validated_by=auth.uid(), validated_at_utc='1970-01-01' where id=" + id + " and validated_at_utc is null";
const occurrence = (id,shift,author=2,unit=1) => 'insert into occurrences values ('+[id,shift,unit,who(author),"'fixture'"].join(',')+')';
const position = (id,shift,author=2,unit=1) => 'insert into shift_position_logs values ('+[id,shift,unit,who(author),who(author),'null'].join(',')+')';
let assertions = 0;
async function expect(connection,sql,code='00000',data) {
  const result = await connection.send(sql);
  assert.equal(result.code,code,sql + ': ' + JSON.stringify(result));
  if (data !== undefined) assert.equal(result.data,data,sql);
  assertions++;
  return result;
}
async function blocked(pid) {
  for (let i=0;i<200;i++) {
    const r=await monitor.send("select count(*) from pg_stat_activity where pid="+pid+" and wait_event_type='Lock'");
    if (r.data==='1') {assertions++;return;}
    await new Promise((resolve)=>setTimeout(resolve,12));
  }
  throw new Error('No live wait_event=Lock observed');
}
async function race(first,heldSql,second,waitingSql,secondPid,outcome,release='commit') {
  await expect(first,'begin');
  await expect(first,heldSql);
  const pending=second.send(waitingSql);
  await blocked(secondPid);
  await expect(first,release);
  const r=await pending;
  assert.equal(r.code,outcome,waitingSql+' '+JSON.stringify(r));
  assertions++;
}
const timeout=setTimeout(()=>{console.error('fixture timed out');process.exit(1)},35000);
try {
  const pidA=Number((await expect(a,'select pg_backend_pid()')).data);
  const pidB=Number((await expect(b,'select pg_backend_pid()')).data);
  assert.notEqual(pidA,pidB);
  for (const c of clients) await expect(c,"set lock_timeout='8s'");
  await expect(a,actor(1)); await expect(b,actor(2));
  await expect(a, 'select has_schema_privilege(current_user, \'sigo_lifecycle_private\', \'USAGE\')', '00000','f');
  await expect(b,close(1),'P7501');
  await expect(a,validate(1),'P7505');
  // Position commits first; stale close waits and sees hidden position.
  await race(b,position(201,1),a,close(1),pidA,'P7503');
  await expect(a,'select count(*) from shift_position_logs where shift_id=1','00000','0');
  await expect(b,"update shift_position_logs set left_at_utc=clock_timestamp() where id=201");
  await expect(a,close(1));
  await expect(a,"select (end_time_utc > '2026-01-01')::int from shifts where id=1",'00000','1');
  await expect(a,close(1)+' returning id','00000','');
  await expect(a,"update shifts set end_time_utc=clock_timestamp() where id=1",'P7502');
  // Close commits first; stale position or occurrence must be rejected.
  await race(a,close(2),b,position(202,2),pidB,'P7502');
  await race(a,close(3),b,occurrence(301,3),pidB,'P7502');
  await race(b,occurrence(302,4),a,close(4),pidA,'P7504');
  await expect(a,'select count(*) from occurrences where shift_id=4','00000','0');
  await expect(a,validate(4));
  await expect(a,"select (validated_at_utc > '2026-01-01')::int from shifts where id=4",'00000','1');
  await expect(b,occurrence(303,4),'P7506');
  await expect(b,"update occurrences set note='changed' where id=302",'P7506');
  await expect(b,"delete from occurrences where id=302",'P7506');
  await expect(b,position(204,4)); // validated but OPEN remains compatible
  await expect(a,close(4),'P7503');
  await expect(b,position(205,4),'23505'); // preserve duplicate index
  await expect(b,"update shift_position_logs set left_at_utc=clock_timestamp() where id=204");
  await expect(a,close(4));
  // Validation waits on a newly active position.
  await expect(b,occurrence(308,8));
  await race(b,position(208,8),a,validate(8),pidA,'P7503');
  // Validation wins; stale pending occurrence mutation sees frozen record.
  await expect(b,occurrence(305,5));
  await race(a,validate(5),b,"update occurrences set note='changed' where id=305",pidB,'P7506');
  // Last occurrence was deleted before validation acquired the lock.
  await expect(b,occurrence(306,6));
  await race(b,'delete from occurrences where id=306',a,validate(6),pidA,'P7505');
  // Child rolls back; parent can close, as no row becomes visible.
  await race(b,position(207,7),a,close(7),pidA,'00000','rollback');
  await expect(a,'begin isolation level repeatable read');
  await expect(a,close(10),'40001');
  await expect(a,'rollback');
  await expect(b,'begin isolation level serializable');
  await expect(b,occurrence(310,10),'40001');
  await expect(b,'rollback');
  await expect(b,occurrence(399,99,2,1),'P7501');
  await expect(b,position(299,99,2,2),'P7501');
  await expect(a,"update shifts set opened_by="+who(2)+" where id=9",'P7501');
  await expect(a,"update shifts set ats_unit_id=2 where id=9",'P7501');
  await expect(a,"insert into shifts (id,ats_unit_id,opened_by) values (201,1,"+who(1)+")");
  await expect(a,"insert into shifts (id,ats_unit_id,opened_by,status) values (202,1,"+who(1)+",'CLOSED')",'P7502');
  await expect(b,occurrence(311,11));
  await expect(b,"update occurrences set shift_id=12 where id=311",'P7501');
  await expect(a,validate(11));
  await expect(a,close(11));
  await expect(monitor,'set role service_role');
  await expect(monitor,'delete from occurrences where id=311 returning id','00000','311');
  await expect(monitor,position(211,11),'P7501');
  await expect(monitor,'delete from shifts where id=4'); // existing child FK cascade
  await expect(monitor,'reset role');
  await expect(monitor,'delete from profiles where id='+who(1)); // validated_by/opened_by FK SET NULL
  await expect(monitor,'select count(*) from shifts where validated_at_utc is not null and validated_by is null','00000','2');
  assert(assertions >= 80);
  console.log('NATIVE_LIFECYCLE_QA_PASS',assertions,'checks, distinct PostgreSQL backend PIDs',pidA,pidB);
} finally {
  clearTimeout(timeout);
  for (const c of clients) c.end();
}
