-- SIGO-ATS: catalog preflight. Read-only; output contains metadata, no operational rows.
begin read only;
select current_setting('server_version') as pg_version,
       current_setting('default_transaction_isolation') as session_default,
       current_setting('transaction_isolation') as check_isolation;
select coalesce(r.rolname,'(all roles)') as role_name,
       coalesce(d.datname,'(all databases)') as database_name, entry.setting
from pg_catalog.pg_db_role_setting s
left join pg_catalog.pg_roles r on r.oid=s.setrole
left join pg_catalog.pg_database d on d.oid=s.setdatabase
cross join lateral unnest(s.setconfig) as entry(setting)
where entry.setting like 'default_transaction_isolation=%'
  and (s.setdatabase=0 or d.datname=current_database())
  and (s.setrole=0 or r.rolname in ('authenticator','authenticated','service_role'));
select a.table_name,a.column_name,a.data_type,a.udt_name,a.is_nullable
from information_schema.columns a
where a.table_schema='public' and a.table_name in ('shifts','profiles','occurrences','shift_position_logs')
order by a.table_name,a.ordinal_position;
select c.relname, c.relrowsecurity, c.relforcerowsecurity, pg_catalog.pg_get_userbyid(c.relowner) as owner_role,
       pg_catalog.has_table_privilege('authenticated',c.oid,'SELECT') as authenticated_select,
       pg_catalog.has_table_privilege('authenticated',c.oid,'UPDATE') as authenticated_update,
       pg_catalog.has_table_privilege('service_role',c.oid,'DELETE') as service_delete
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in ('shifts','profiles','occurrences','shift_position_logs');
select tablename, policyname, cmd, permissive, roles
from pg_catalog.pg_policies
where schemaname='public' and tablename in ('shifts','profiles','occurrences','shift_position_logs')
order by tablename,policyname;
select c.relname, k.conname, k.contype, k.convalidated,
       case when k.contype='f' then pg_catalog.pg_get_constraintdef(k.oid,true) end as foreign_key
from pg_catalog.pg_constraint k join pg_catalog.pg_class c on c.oid=k.conrelid
where c.oid in ('public.shifts'::regclass,'public.profiles'::regclass,'public.occurrences'::regclass,'public.shift_position_logs'::regclass)
order by c.relname,k.conname;
select c.relname,t.tgname,t.tgenabled,t.tgtype,p.proname,n.nspname
from pg_catalog.pg_trigger t join pg_catalog.pg_class c on c.oid=t.tgrelid
join pg_catalog.pg_proc p on p.oid=t.tgfoid join pg_catalog.pg_namespace n on n.oid=p.pronamespace
where not t.tgisinternal and c.oid in ('public.shifts'::regclass,'public.profiles'::regclass,'public.occurrences'::regclass,'public.shift_position_logs'::regclass)
order by c.relname,t.tgname;
select c.relname as table_name,i.relname as index_name,x.indisvalid,x.indisready
from pg_catalog.pg_index x join pg_catalog.pg_class c on c.oid=x.indrelid
join pg_catalog.pg_class i on i.oid=x.indexrelid
where c.oid in ('public.occurrences'::regclass,'public.shift_position_logs'::regclass) order by c.relname,i.relname;
select rolname, rolbypassrls, rolsuper from pg_catalog.pg_roles
where rolname=current_user or rolname in ('authenticated','service_role','authenticator');
commit;
