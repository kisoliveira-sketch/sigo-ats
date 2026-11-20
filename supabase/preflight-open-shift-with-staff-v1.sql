-- Read-only catalog inspection; no operational rows. Review before submitting deployment.
begin read only;
select current_setting('transaction_isolation') as transaction_isolation;
select to_regprocedure('public.sigo_open_shift_with_staff_v1(text,date,timestamptz,text,uuid[],text[])') as current_rpc;
select to_regprocedure('auth.uid()') as auth_uid;
select c.relname, c.relkind, c.relrowsecurity, c.relforcerowsecurity,
  has_table_privilege('authenticated',c.oid,'SELECT') as authenticated_select,
  has_table_privilege('authenticated',c.oid,'INSERT') as authenticated_insert
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in ('ats_units','profiles','shifts','shift_staff')
order by c.relname;
select table_name,column_name,data_type,udt_name,is_nullable,column_default,is_identity,identity_generation
from information_schema.columns where table_schema='public' and table_name in ('ats_units','profiles','shifts','shift_staff')
order by table_name,ordinal_position;
select tablename, policyname, roles, cmd, qual, with_check from pg_policies
where schemaname='public' and tablename in ('ats_units','profiles','shifts','shift_staff');
select a.relname, c.conname, pg_get_constraintdef(c.oid,true) as definition
from pg_constraint c join pg_class a on a.oid=c.conrelid join pg_namespace n on n.oid=a.relnamespace
where n.nspname='public' and a.relname in ('ats_units','profiles','shifts','shift_staff');
select c.relname, t.tgname, t.tgenabled, pg_get_triggerdef(t.oid, true)
from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in ('ats_units','profiles','shifts','shift_staff') and not t.tgisinternal;
select c.relname, has_sequence_privilege('authenticated', c.oid, 'USAGE') as authenticated_usage
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='S' and c.relname in ('shifts_id_seq','shift_staff_id_seq');
rollback;
