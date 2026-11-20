begin read only;
select count(*) as open_shifts_requiring_handover from public.shifts where status = 'OPEN';
select c.relname, c.relrowsecurity, c.relforcerowsecurity, pg_get_userbyid(c.relowner) as owner_role
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in ('shifts','shift_staff','profiles','ats_units','shift_position_logs','occurrences');
select table_name,column_name,data_type,udt_name,is_nullable
from information_schema.columns where table_schema='public'
and table_name in ('shifts','shift_staff','profiles','ats_units','shift_position_logs','occurrences')
order by table_name,ordinal_position;
select tablename,policyname,roles,cmd,qual,with_check from pg_policies where schemaname='public'
and tablename in ('shifts','shift_staff','profiles','ats_units','shift_position_logs','occurrences');
select c.relname,t.tgname,t.tgenabled,pg_get_triggerdef(t.oid,true)
from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in ('shifts','shift_staff','profiles','ats_units','shift_position_logs','occurrences')
and not t.tgisinternal order by c.relname,t.tgname;
select c.relname,k.conname,pg_get_constraintdef(k.oid,true)
from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in ('shifts','shift_staff','profiles','ats_units','shift_position_logs','occurrences');
rollback;
