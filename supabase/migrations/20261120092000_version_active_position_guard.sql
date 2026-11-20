-- Reconcile the exact position guard already installed in production.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';
lock table public.shift_position_logs in share row exclusive mode;

do $guard$
begin
  if pg_catalog.to_regclass('public.shift_position_logs_one_active_per_shift_cta') is not null then
    if not exists (
      select 1 from pg_catalog.pg_index i
      join pg_catalog.pg_class idx on idx.oid = i.indexrelid
      join pg_catalog.pg_am am on am.oid = idx.relam
      join pg_catalog.pg_attribute s on s.attrelid = i.indrelid and s.attname = 'shift_id'
      join pg_catalog.pg_attribute u on u.attrelid = i.indrelid and u.attname = 'user_id'
      join pg_catalog.pg_opclass so on so.oid=i.indclass[0] and so.opcdefault
      join pg_catalog.pg_opclass uo on uo.oid=i.indclass[1] and uo.opcdefault
      where i.indexrelid = 'public.shift_position_logs_one_active_per_shift_cta'::regclass
        and i.indrelid = 'public.shift_position_logs'::regclass
        and am.amname = 'btree' and i.indisunique and i.indimmediate
        and i.indisvalid and i.indisready and i.indislive and not i.indnullsnotdistinct
        and i.indnkeyatts = 2 and i.indnatts = 2 and i.indexprs is null
        and i.indkey[0] = s.attnum and i.indkey[1] = u.attnum
        and i.indcollation[0] = s.attcollation and i.indcollation[1] = u.attcollation
        and i.indoption[0] = 0 and i.indoption[1] = 0
        and pg_catalog.pg_get_expr(i.indpred, i.indrelid) = '(left_at_utc IS NULL)'
    ) then raise exception 'sigo_active_position_index_definition_mismatch'; end if;
  else
    if exists (
      select 1 from public.shift_position_logs
      where left_at_utc is null and shift_id is not null and user_id is not null
      group by shift_id, user_id having count(*) > 1
    ) then raise exception 'sigo_active_position_existing_duplicates'; end if;
    create unique index shift_position_logs_one_active_per_shift_cta
      on public.shift_position_logs(shift_id,user_id) where left_at_utc is null;
  end if;
end
$guard$;
commit;
