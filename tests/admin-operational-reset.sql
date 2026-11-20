\set ON_ERROR_STOP on
-- Disposable PostgreSQL only. Nothing below is suitable for production.
\ir sql/occurrence-references-fixture.sql
\ir ../supabase/migrations/20261120083330_authoritative_occurrence_references.sql
\ir ../supabase/migrations/20261120092000_version_active_position_guard.sql
\ir ../supabase/admin-reset-operational-v1.staged.sql

grant select on public.shift_staff,public.profiles to service_role;
update public.profiles set role='ADMIN' where id='00000000-0000-0000-0000-000000000033';
insert into public.shift_staff values (1,'00000000-0000-0000-0000-000000000031','CTA Operacional',true,null);
set role authenticated;
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000031';
update public.shifts set status='CLOSED', end_time_utc=now() where id in (1001,1050);
select public.sigo_open_shift_with_staff_v2('TWR_FIX-20261122-0700/1300','2026-11-22','2026-11-22 07:00Z',null,
  array[auth.uid()],array['Supervisor']) as log_shift_id \gset
insert into public.shift_position_logs(id,shift_id,ats_unit_id,user_id,recorded_by,left_at_utc)
  values (801,:log_shift_id,31,auth.uid(),auth.uid(),null);
update public.shift_position_logs set left_at_utc=now() where id=801;
update public.shifts set status='CLOSED', end_time_utc=now() where id=:log_shift_id;
select public.sigo_open_shift_with_staff_v2('TWR_FIX-20261123-0700/1300','2026-11-23','2026-11-23 07:00Z',null,array[auth.uid()],array['Supervisor']);
reset role;
reset request.jwt.claim.sub;

create function public.synthetic_reset(ids bigint[], versions timestamptz[] default null, actor uuid default '00000000-0000-0000-0000-000000000033')
returns jsonb language sql security invoker as $$
select public.sigo_reset_operational_v1(actor, ids,
  coalesce(versions,(select array_agg(s.updated_at order by chosen.ordinality)
    from unnest(ids) with ordinality chosen(id,ordinality) join public.shifts s using (id))),
  null,null,31);
$$;

do $test$
begin
  if has_function_privilege('authenticated','public.sigo_reset_operational_v1(uuid,bigint[],timestamptz[],date,date,bigint)','EXECUTE')
     or has_function_privilege('anon','public.sigo_reset_operational_v1(uuid,bigint[],timestamptz[],date,date,bigint)','EXECUTE')
     or has_schema_privilege('service_role','sigo_lifecycle_private','USAGE') then raise exception 'unexpected access'; end if;
end
$test$;

set role service_role;
do $test$
begin
  begin
    perform public.synthetic_reset(array[1]::bigint[]);
    raise exception 'must be disabled';
  exception when insufficient_privilege then
    if sqlerrm <> 'sigo_reset_disabled' then raise; end if;
  end;
end
$test$;
reset role;
-- This enablement is confined to this disposable LOCAL fixture.
update sigo_lifecycle_private.operational_reset_gate_v1 set enabled=true;

set role service_role;
do $test$
begin
  begin
    perform public.synthetic_reset(array[1]::bigint[], null, '00000000-0000-0000-0000-000000000031');
    raise exception 'non-admin unexpectedly allowed';
  exception when insufficient_privilege then
    if sqlerrm <> 'sigo_reset_forbidden' then raise; end if;
  end;
  begin
    perform public.synthetic_reset(array[1]::bigint[], array['2000-01-01'::timestamptz]);
    raise exception 'stale target unexpectedly allowed';
  exception when raise_exception then
    if sqlerrm <> 'sigo_reset_selection_changed' then raise; end if;
  end;
  begin
    perform public.synthetic_reset(array[1,1004]::bigint[]);
    raise exception 'open shift unexpectedly allowed';
  exception when raise_exception then
    if sqlerrm <> 'sigo_reset_selection_changed' then raise; end if;
  end;
  begin
    perform public.synthetic_reset(array[1,1]::bigint[]);
    raise exception 'duplicate ID unexpectedly allowed';
  exception when invalid_parameter_value then
    if sqlerrm <> 'sigo_reset_invalid_scope' then raise; end if;
  end;
end
$test$;
reset role;

create function public.synthetic_block_delete() returns trigger language plpgsql as $$
begin if old.id=1 then raise exception 'synthetic_failure_after_child_deletion'; end if; return old; end
$$;
create trigger synthetic_failure before delete on public.shifts for each row execute function public.synthetic_block_delete();

set role service_role;
do $test$
begin
  begin
    perform public.synthetic_reset(array[1,(select shift_id from public.shift_position_logs where id=801)]::bigint[]);
    raise exception 'fixture failure unexpectedly bypassed';
  exception when raise_exception then
    if sqlerrm <> 'synthetic_failure_after_child_deletion' then raise; end if;
  end;
end
$test$;
reset role;
do $test$
begin
  if not exists(select 1 from public.occurrences where shift_id=1)
    or not exists(select 1 from public.shift_staff where shift_id=1)
    or not exists(select 1 from public.shift_position_logs where id=801)
    or exists(select 1 from sigo_lifecycle_private.operational_reset_audit_v1)
  then raise exception 'partial rows or misleading audit after rollback'; end if;
end
$test$;
drop trigger synthetic_failure on public.shifts;

set role service_role;
do $test$
declare result jsonb;
begin
  result := public.synthetic_reset(array[1,1001,(select shift_id from public.shift_position_logs where id=801)]::bigint[]);
  if (result->>'shifts')::integer <> 3 or (result->>'occurrences')::integer <> 1 or (result->>'staff')::integer <> 3 or (result->>'positionLogs')::integer <> 1
  then raise exception 'wrong deletion counts: %',result; end if;
end
$test$;
reset role;

do $test$
begin
  if exists(select 1 from public.shifts where id in (1,1001))
    or exists(select 1 from public.occurrences where shift_id in (1,1001))
    or exists(select 1 from public.shift_staff where shift_id in (1,1001))
    or exists(select 1 from public.shift_position_logs where id=801)
    or not exists(select 1 from public.shifts where id=1004)
    or not exists(select 1 from public.occurrences where shift_id=2)
    or (select last_number from sigo_lifecycle_private.occurrence_reference_counters_v1 where shift_code='TWR_FIX-20261121-0700/1300') <> 999
    or (select count(*) from sigo_lifecycle_private.operational_reset_audit_v1 where shift_count=3 and occurrence_count=1 and staff_count=3 and position_log_count=1) <> 1
  then raise exception 'reset scope, private audit or retained allocator incorrect'; end if;
end
$test$;
select 'SIGO_ADMIN_ATOMIC_RESET_FIXTURE_PASS';
