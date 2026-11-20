\set ON_ERROR_STOP on
-- Disposable fixture server only. SQL test runs the committed migration.
\ir sql/occurrence-references-fixture.sql
\ir ../supabase/preflight-occurrence-references-v1.sql
\ir ../supabase/migrations/20261120083330_authoritative_occurrence_references.sql

do $$
begin
  if (select array_agg(occurrence_number order by id) from public.occurrences)
     is distinct from array['TWR_FIX-20261121-0700/1300-OCC-002','TWR_FIX-20261121-0700/1300-OCC-999','TWR_FIX-legacy-archive-OCC-007']::varchar[]
  then raise exception 'Existing references changed'; end if;
  if (select last_number from sigo_lifecycle_private.occurrence_reference_counters_v1
      where shift_code='TWR_FIX-20261121-0700/1300') <> 999
  then raise exception 'Counter must use maximum, not count or most recent row'; end if;
  if has_table_privilege('authenticated','sigo_lifecycle_private.occurrence_reference_counters_v1','SELECT, INSERT, UPDATE, DELETE')
     or has_table_privilege('anon','sigo_lifecycle_private.occurrence_reference_counters_v1','SELECT, INSERT, UPDATE, DELETE')
     or has_table_privilege('service_role','sigo_lifecycle_private.occurrence_reference_counters_v1','SELECT, INSERT, UPDATE, DELETE')
     or exists(select 1 from pg_catalog.pg_roles where rolname in ('anon','authenticated','service_role')
       and has_function_privilege(oid,'sigo_lifecycle_private.assign_occurrence_reference_v1()','EXECUTE'))
  then raise exception 'Private counter or trigger exposed'; end if;
end $$;

set role authenticated;
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000031';
do $$
declare got text;
begin
  insert into public.occurrences (id,shift_id,ats_unit_id,created_by,note,occurrence_number)
    values (20,1001,31,auth.uid(),'legacy client','arbitrary provisional text') returning occurrence_number into got;
  if got is distinct from 'TWR_FIX-20261121-0700/1300-OCC-1000' then raise exception 'Bad legacy-client code: %', got; end if;
  begin
    insert into public.occurrences(id,shift_id,ats_unit_id,created_by,note)
      values (21,1001,31,auth.uid(),'synthetic invalid');
    raise exception 'Expected later CHECK failure';
  exception when check_violation then null; end;
  insert into public.occurrences(id,shift_id,ats_unit_id,created_by,note)
    values (21,1001,31,auth.uid(),'works after failure') returning occurrence_number into got;
  if got is distinct from 'TWR_FIX-20261121-0700/1300-OCC-1001' then raise exception 'Rejected transaction advanced counter: %', got; end if;
  delete from public.occurrences where id=21;
  if not found then raise exception 'Fixture delete did not happen'; end if;
  insert into public.occurrences(id,shift_id,ats_unit_id,created_by,note)
    values (22,1050,31,auth.uid(),'same prefix, distinct shift') returning occurrence_number into got;
  if got is distinct from 'TWR_FIX-20261121-0700/1300-OCC-1002' then raise exception 'Reused deleted number: %', got; end if;
  begin
    update public.occurrences set occurrence_number='rewritten' where id=20;
    raise exception 'Renumbering should be refused';
  exception when insufficient_privilege then
    if sqlerrm <> 'sigo_occurrence_reference_immutable' then raise; end if;
  end;
  update public.occurrences set note='ordinary edit' where id=20;
  if not found then raise exception 'Ordinary edits should still work'; end if;
end $$;
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000033';
do $$
begin
  begin
    insert into public.occurrences(id,shift_id,ats_unit_id,created_by)
      values (23,1001,31,auth.uid());
    raise exception 'Nonmember must be rejected';
  exception when insufficient_privilege then null; end;
end $$;
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000031';
update public.shifts set validated_by=auth.uid(),validated_at_utc=now() where id=1001;
do $$
begin
  begin
    insert into public.occurrences(id,shift_id,ats_unit_id,created_by) values (23,1001,31,auth.uid());
    raise exception 'Validated shift must be rejected';
  exception when sqlstate 'P7506' then null; end;
end $$;
update public.shifts set status='CLOSED',end_time_utc=now() where id=1001;
do $$
begin
  begin
    insert into public.occurrences(id,shift_id,ats_unit_id,created_by) values (23,1001,31,auth.uid());
    raise exception 'Closed shift must be rejected';
  exception when sqlstate 'P7502' then null; end;
end $$;

set request.jwt.claim.sub='00000000-0000-0000-0000-000000000032';
do $$
declare got text;
begin
  insert into public.occurrences(id,shift_id,ats_unit_id,created_by) values (24,1002,32,auth.uid()) returning occurrence_number into got;
  if got is distinct from 'ACC_FIX-20261121-0700/1300-OCC-001' then raise exception 'Unexpected independent counter: %',got; end if;
end $$;
reset role;
set role service_role;
reset request.jwt.claim.sub;
delete from public.occurrences where id=22;
delete from public.shifts where id=1050;
reset role;

do $$
begin
  if (select last_number from sigo_lifecycle_private.occurrence_reference_counters_v1
      where shift_code='TWR_FIX-20261121-0700/1300') <> 1002
    then raise exception 'Counter dropped/regressed after service deletions'; end if;
  if exists(select 1 from public.occurrences where id in (21,22,23)) then
    raise exception 'Deleted/rejected records are unexpectedly present';
  end if;
end $$;

-- Deliberately rewinding the storage is not supported. Exercise the finite
-- limit as fixture owner without touching occurrence rows.
update sigo_lifecycle_private.occurrence_reference_counters_v1
  set last_number=9223372036854775807 where shift_code='ACC_FIX-20261121-0700/1300';
set role authenticated;
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000032';
do $$
begin
  begin
    insert into public.occurrences(id,shift_id,ats_unit_id,created_by) values (25,1002,32,auth.uid());
    raise exception 'Bigint overflow must be rejected';
  exception when numeric_value_out_of_range then
    if sqlerrm <> 'sigo_occurrence_reference_exhausted' then raise; end if;
  end;
end $$;
reset role;
select 'OCCURRENCE_REFERENCES_FIXTURE_PASS';
