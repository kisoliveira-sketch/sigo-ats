-- Disposable isolated PostgreSQL only; never run against a deployed database.
\set ON_ERROR_STOP on
\ir shift-open-atomic.sql
-- Existing seed fixtures from point 2 contain OPEN rows. Leave only the historical closed fixture.
delete from public.shifts where id < 1000;
alter table public.profiles add column role text;
update public.ats_units set code='TWR_SAL' where id=31;
update public.ats_units set code='APP_SAL' where id=32;
update public.profiles set full_name='Membro com nome igual' where id in
 ('00000000-0000-0000-0000-000000000031','00000000-0000-0000-0000-000000000032');
grant select, update, delete on public.shift_staff to authenticated;
create policy staff_fixture_other on public.shift_staff for all to authenticated using(true) with check(true);
drop policy occ_fixture_read on public.occurrences;
drop policy occ_fixture_update on public.occurrences;
drop policy occ_fixture_delete on public.occurrences;
create policy authority_occ_read on public.occurrences to authenticated using(true);
create policy authority_occ_update on public.occurrences for update to authenticated using(true) with check(true);
create policy authority_occ_delete on public.occurrences for delete to authenticated using(true);
\ir ../supabase/preflight-shift-authority-v1.sql
\ir ../supabase/shift-authority-v1.sql

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000031';
select public.sigo_open_shift_with_staff_v2('TWR_SAL-20261121-0700/1300','2026-11-21','2026-11-21 07:00Z','Nota fictícia',
 array['00000000-0000-0000-0000-000000000032'::uuid,'00000000-0000-0000-0000-000000000036'::uuid,'00000000-0000-0000-0000-000000000031'::uuid],
 array['Supervisor','Supervisor','AFIS']);
do $$
declare k bigint;
begin
 select id into strict k from public.shifts where ats_unit_id=31 and status='OPEN';
 if public.sigo_shift_permissions_v1(k)->>'canManagePositions' is distinct from 'false'
    or public.sigo_shift_permissions_v1(k)->>'canCreateOccurrence' is distinct from 'true' then
   raise exception 'Opener must not outrank selected supervisor; opener belongs to team';
 end if;
 begin
   update public.shift_staff set role_in_shift='Supervisor · Membro inválido' where shift_id=k and user_id=auth.uid();
   raise exception 'Roster should not be mutable';
 exception when insufficient_privilege then null; end;
 begin
   update public.shifts set roster_authority_v1='[]' where id=k;
   raise exception 'Snapshot should not be mutable';
 exception when insufficient_privilege then null; end;
 begin
   insert into public.shift_position_logs values (80,k,31,auth.uid(),auth.uid(),null);
   raise exception 'Opener must not be able to insert a position when a supervisor exists';
 exception when insufficient_privilege then null; end;
 insert into public.occurrences values (7,k,31,auth.uid(),'fictícia');
end $$;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000032';
do $$
declare k bigint;
begin
 select id into strict k from public.shifts where ats_unit_id=31 and status='OPEN';
 if public.sigo_shift_permissions_v1(k)->>'canManagePositions' is distinct from 'true' then
   raise exception 'First supervisor alone must be the manager';
 end if;
 insert into public.shift_position_logs values (4,k,31,auth.uid(),auth.uid(),null);
 update public.shift_position_logs set left_at_utc=now() where id=4;
end $$;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000036';
do $$
declare k bigint;
begin
 select id into strict k from public.shifts where ats_unit_id=31 and status='OPEN';
 if public.sigo_shift_permissions_v1(k)->>'canManagePositions' is distinct from 'false' then
   raise exception 'Second supervisor must not outrank first';
 end if;
 begin
   update public.occurrences set note='fictícia' where id=7;
   raise exception 'Roster supervisor without profile role must not edit someone else occurrence';
 exception when insufficient_privilege then null; end;
end $$;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000040';
do $$
declare k bigint;
begin
 select id into strict k from public.shifts where ats_unit_id=31 and status='OPEN';
 if public.sigo_shift_permissions_v1(k)->>'canCreateOccurrence' is distinct from 'false' then
   raise exception 'Nonmember may not create occurrences';
 end if;
 begin
   insert into public.occurrences values (8,k,31,auth.uid(),'fictícia');
   raise exception 'Nonmember occurrence should be refused';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
update public.profiles set role='CHEFIA_ATS' where id='00000000-0000-0000-0000-000000000040';
set role authenticated;
do $$
begin
 update public.occurrences set note='alteração fictícia autorizada' where id=7;
 if not found then raise exception 'Existing profile role should retain edit permission'; end if;
end $$;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000031';
update public.shifts set validated_by=auth.uid(),validated_at_utc=now() where ats_unit_id=31 and status='OPEN';
update public.shifts set status='CLOSED',end_time_utc=now() where ats_unit_id=31 and status='OPEN';
select public.sigo_open_shift_with_staff_v2('TWR_SAL-20261121-1300/1900','2026-11-21','2026-11-21 13:00Z',null,
 array['00000000-0000-0000-0000-000000000032'::uuid],array['CTA Operacional']);
do $$
declare k bigint;
begin
 select id into strict k from public.shifts where ats_unit_id=31 and status='OPEN';
 if public.sigo_shift_permissions_v1(k)->>'managerKind' is distinct from 'opener'
   or public.sigo_shift_permissions_v1(k)->>'canManagePositions' is distinct from 'true'
   or public.sigo_shift_permissions_v1(k)->>'canCreateOccurrence' is distinct from 'false' then
   raise exception 'Opener fallback only governs positions and requires verified team';
 end if;
 begin
   insert into public.shift_position_logs values (5,k,31,auth.uid(),auth.uid(),null);
   raise exception 'Position target must be a member';
 exception when insufficient_privilege then null; end;
 begin
   insert into public.shifts (ats_unit_id,status,opened_by) values (31,'OPEN',auth.uid());
   raise exception 'Legacy unverified opening must fail';
 exception when raise_exception then
   if sqlerrm <> 'sigo_permissions_refresh_open' then raise; end if;
 end;
end $$;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000033';
select public.sigo_open_shift_with_staff_v2('APP_SAL-20261121-0700/1300','2026-11-21','2026-11-21 07:00Z',null,
 array['00000000-0000-0000-0000-000000000033'::uuid],array['CTA Assistente']);
do $$
declare k bigint;
begin
 select id into strict k from public.shifts where ats_unit_id=32 and status='OPEN';
 if public.sigo_shift_permissions_v1(k)->>'managerKind' is distinct from 'none'
   or public.sigo_shift_permissions_v1(k)->>'canManagePositions' is distinct from 'false' then
   raise exception 'APP Sal must not receive fallback';
 end if;
 if public.sigo_shift_permissions_v1(1001) is not null then
   raise exception 'Cross-unit permission summaries must not exist';
 end if;
end $$;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000034';
-- An incomplete structured roster does not accidentally become "no supervisor".
insert into public.shifts(id,ats_unit_id,opened_by,status,roster_authority_v1)
 values(1044,33,auth.uid(),'OPEN','[{"user_id":"00000000-0000-0000-0000-000000000034","role":"CTA Operacional"}]');
do $$
begin
 if public.sigo_shift_permissions_v1(1044)->>'verified' is distinct from 'false'
    or public.sigo_shift_permissions_v1(1044)->>'canCreateOccurrence' is distinct from 'false' then
   raise exception 'Incomplete roster must fail closed';
 end if;
 begin
   insert into public.shift_staff values (1044,auth.uid(),'Supervisor · Incorreto',true,null);
   raise exception 'Role not matching snapshot must be refused';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
set role service_role;
set request.jwt.claim.sub = '';
delete from public.shift_position_logs where id=4;
delete from public.occurrences where id=7;
delete from public.shifts where ats_unit_id=31 and status='OPEN';
reset role;
\ir ../supabase/rollback-shift-authority-v1.sql
do $$
begin
 if to_regprocedure('public.sigo_shift_permissions_v1(bigint)') is not null
   or to_regprocedure('public.sigo_open_shift_with_staff_v1(text,date,timestamptz,text,uuid[],text[])') is null
   or not exists(select 1 from public.shifts where roster_authority_v1 is not null)
   or not exists(select 1 from pg_indexes where indexname='shift_position_logs_one_active_per_shift_cta')
 then raise exception 'Rollback must retain #2/#3, duplicate index, and saved roster snapshots'; end if;
end $$;
select 'SHIFT_AUTHORITY_FIXTURE_PASS';
