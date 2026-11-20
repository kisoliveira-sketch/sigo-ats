\set ON_ERROR_STOP on
-- Disposable PostgreSQL only. Never target production.
create table public.shift_position_logs(shift_id bigint,user_id uuid,left_at_utc timestamptz);
\ir ../supabase/migrations/20261120092000_version_active_position_guard.sql
select 'public.shift_position_logs_one_active_per_shift_cta'::regclass::oid as guard_id \gset
\ir ../supabase/migrations/20261120092000_version_active_position_guard.sql
select :'guard_id'::oid='public.shift_position_logs_one_active_per_shift_cta'::regclass::oid as untouched \gset
\if :untouched
\else
  \quit 1
\endif

-- The migration must leave an existing incompatible same-name object in place.
drop index public.shift_position_logs_one_active_per_shift_cta;
create index shift_position_logs_one_active_per_shift_cta on public.shift_position_logs(shift_id);
select 'public.shift_position_logs_one_active_per_shift_cta'::regclass::oid as guard_id \gset
\set ON_ERROR_STOP off
\ir ../supabase/migrations/20261120092000_version_active_position_guard.sql
\set ON_ERROR_STOP on
select :'guard_id'::oid='public.shift_position_logs_one_active_per_shift_cta'::regclass::oid
 and not (select indisunique from pg_index where indexrelid=:'guard_id'::oid) as untouched \gset
\if :untouched
\else
  \quit 1
\endif

drop index public.shift_position_logs_one_active_per_shift_cta;
insert into public.shift_position_logs values
  (31,'00000000-0000-0000-0000-000000000031',null),
  (31,'00000000-0000-0000-0000-000000000031',null);
\set ON_ERROR_STOP off
\ir ../supabase/migrations/20261120092000_version_active_position_guard.sql
\set ON_ERROR_STOP on
select count(*)=2 and to_regclass('public.shift_position_logs_one_active_per_shift_cta') is null as untouched from public.shift_position_logs \gset
\if :untouched
\else
  \quit 1
\endif
select 'SIGO_INDEX_CREATE_PRESERVE_REJECT_WITHOUT_DATA_CHANGE_PASS';
