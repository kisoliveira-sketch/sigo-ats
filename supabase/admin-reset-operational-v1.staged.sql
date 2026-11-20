-- STAGED ONLY: not included in migrations; activating reset requires a
-- separate approved policy, backup verification, catalog check and deployment.
-- Safe by default even when installed: both application and DB gates are off.
begin;
create table sigo_lifecycle_private.operational_reset_gate_v1 (
  singleton boolean primary key check (singleton),
  enabled boolean not null default false
);
insert into sigo_lifecycle_private.operational_reset_gate_v1(singleton,enabled) values (true,false);
alter table sigo_lifecycle_private.operational_reset_gate_v1 enable row level security;
revoke all on sigo_lifecycle_private.operational_reset_gate_v1 from public,anon,authenticated,service_role;

create table sigo_lifecycle_private.operational_reset_audit_v1 (
  id bigint generated always as identity primary key,
  recorded_at_utc timestamptz not null default pg_catalog.clock_timestamp(),
  actor_id uuid not null,
  shift_ids bigint[] not null,
  date_from date,
  date_to date,
  ats_unit_id bigint,
  shift_count integer not null,
  occurrence_count bigint not null,
  position_log_count bigint not null,
  staff_count bigint not null
);
alter table sigo_lifecycle_private.operational_reset_audit_v1 enable row level security;
revoke all on sigo_lifecycle_private.operational_reset_audit_v1 from public,anon,authenticated,service_role;
revoke all on sequence sigo_lifecycle_private.operational_reset_audit_v1_id_seq from public,anon,authenticated,service_role;

create function public.sigo_reset_operational_v1(
  p_actor uuid,
  p_shift_ids bigint[],
  p_expected_versions timestamptz[],
  p_date_from date,
  p_date_to date,
  p_ats_unit_id bigint
) returns jsonb
language plpgsql volatile security definer
set search_path = '' set row_security = off
set lock_timeout = '2s'
as $reset$
declare
  n integer := pg_catalog.cardinality(p_shift_ids);
  matched integer;
  n_shifts integer;
  n_occurrences bigint;
  n_position_logs bigint;
  n_staff bigint;
  audit_id bigint;
begin
  if pg_catalog.current_setting('role',true) is distinct from 'service_role'
     or auth.uid() is not null or p_actor is null then
    raise exception 'sigo_reset_forbidden' using errcode='42501';
  end if;
  if not exists (select from sigo_lifecycle_private.operational_reset_gate_v1
      where singleton and enabled for share) then
    raise exception 'sigo_reset_disabled' using errcode='42501';
  end if;

  perform 1 from public.profiles where id = p_actor and role::text = 'ADMIN' for share;
  if not found then raise exception 'sigo_reset_forbidden' using errcode='42501'; end if;
  if n is null or n < 1 or n > 20 or pg_catalog.array_ndims(p_shift_ids) <> 1
    or pg_catalog.array_ndims(p_expected_versions) is distinct from 1
    or pg_catalog.cardinality(p_expected_versions) is distinct from n
    or (select count(distinct i) from pg_catalog.unnest(p_shift_ids) as v(i) where i > 0) <> n
    or exists(select from pg_catalog.unnest(p_expected_versions) as v(x) where x is null or not pg_catalog.isfinite(x))
    or (p_date_from is null and p_date_to is null and p_ats_unit_id is null)
    or (p_date_from is not null and not pg_catalog.isfinite(p_date_from))
    or (p_date_to is not null and not pg_catalog.isfinite(p_date_to))
    or (p_ats_unit_id is not null and p_ats_unit_id < 1)
    or p_date_from > p_date_to
  then raise exception 'sigo_reset_invalid_scope' using errcode='22023'; end if;

  -- Serialize with all normal operational writes in a consistent table order.
  -- Keep plain reads available; contention aborts atomically.
  lock table public.shifts, public.shift_staff, public.occurrences, public.shift_position_logs in share row exclusive mode;
  if not exists (select from pg_catalog.pg_constraint c
    join pg_catalog.pg_attribute a on a.attrelid=c.conrelid and a.attname='shift_id'
    join pg_catalog.pg_attribute k on k.attrelid=c.confrelid and k.attname='id'
    where c.contype='f' and c.convalidated and c.confdeltype='c'
      and c.conrelid='public.shift_staff'::regclass and c.confrelid='public.shifts'::regclass
      and c.conkey = array[a.attnum] and c.confkey = array[k.attnum])
  then raise exception 'sigo_reset_unreviewed_staff_fk'; end if;
  if exists (
    select from pg_catalog.pg_constraint c where c.contype='f'
      and c.confrelid in ('public.shifts'::regclass, 'public.shift_staff'::regclass,
        'public.occurrences'::regclass, 'public.shift_position_logs'::regclass)
      and c.confdeltype in ('c','n','d')
      and (c.confrelid, c.conrelid, c.confdeltype) not in (
        ('public.shifts'::regclass,'public.shift_staff'::regclass,'c'),
        ('public.shifts'::regclass,'public.shift_position_logs'::regclass,'c'),
        ('public.shifts'::regclass,'public.occurrences'::regclass,'c')
      )
  ) then raise exception 'sigo_reset_unreviewed_fk_effect'; end if;

  select count(*) into matched
  from rows from (pg_catalog.unnest(p_shift_ids),pg_catalog.unnest(p_expected_versions)) as x(id,version)
  join public.shifts s on s.id=x.id and s.updated_at=x.version
  where s.status::text='CLOSED'
    and (p_date_from is null or s.operational_date >= p_date_from)
    and (p_date_to is null or s.operational_date <= p_date_to)
    and (p_ats_unit_id is null or s.ats_unit_id=p_ats_unit_id);
  if matched <> n then raise exception 'sigo_reset_selection_changed'; end if;

  delete from public.shift_position_logs where shift_id=any(p_shift_ids);
  get diagnostics n_position_logs = row_count;
  delete from public.occurrences where shift_id=any(p_shift_ids);
  get diagnostics n_occurrences = row_count;
  -- Staff FK must cascade with its parent; the roster trigger is intentionally
  -- incompatible with direct changes to a managed shift's team.
  select count(*) into n_staff from public.shift_staff where shift_id=any(p_shift_ids);
  delete from public.shifts where id=any(p_shift_ids);
  get diagnostics n_shifts = row_count;
  if n_shifts <> n or exists (select from public.shift_staff where shift_id=any(p_shift_ids)) then raise exception 'sigo_reset_selection_changed'; end if;

  -- Deliberately no statement affecting the occurrence high-water counters.
  insert into sigo_lifecycle_private.operational_reset_audit_v1
    (actor_id,shift_ids,date_from,date_to,ats_unit_id,shift_count,occurrence_count,position_log_count,staff_count)
  values (p_actor,p_shift_ids,p_date_from,p_date_to,p_ats_unit_id,n_shifts,n_occurrences,n_position_logs,n_staff)
  returning id into audit_id;
  return pg_catalog.jsonb_build_object(
    'auditId',audit_id,'shifts',n_shifts,'occurrences',n_occurrences,
    'positionLogs',n_position_logs,'staff',n_staff);
end
$reset$;
revoke all on function public.sigo_reset_operational_v1(uuid,bigint[],timestamptz[],date,date,bigint)
from public,anon,authenticated,service_role;
grant execute on function public.sigo_reset_operational_v1(uuid,bigint[],timestamptz[],date,date,bigint)
to service_role;
commit;
