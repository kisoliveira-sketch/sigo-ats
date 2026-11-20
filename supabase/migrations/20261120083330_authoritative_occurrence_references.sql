-- Point 5; coordinated with points 2 and 4. Back up and run aggregate-only preflight first.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';

-- Freeze occurrence writes (including deletions) and changes to the parent reference
-- for the historical checks, seed and activation. Plain history reads can continue.
lock table public.shifts, public.occurrences in share row exclusive mode;

do $guard$
declare
  guard_count integer;
begin
  select count(*) into guard_count
  from pg_catalog.pg_trigger t join pg_catalog.pg_proc p on p.oid = t.tgfoid
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where t.tgrelid = 'public.occurrences'::regclass
    and not t.tgisinternal and t.tgenabled in ('O','A') and t.tgtype = 31
    and n.nspname = 'sigo_lifecycle_private'
    and ((t.tgname = 'z_sigo_lifecycle_occurrence' and p.proname = 'guard_child_write')
      or (t.tgname = 'zz_sigo_permissions' and p.proname = 'guard_child_permission'));
  if guard_count <> 2 then
    raise exception 'sigo_occurrence_reference_requires_active_guards';
  end if;
  if exists (
    select 1 from pg_catalog.pg_trigger t
    where t.tgrelid = 'public.occurrences'::regclass and not t.tgisinternal
      and (t.tgtype::integer & 3) = 3 and (t.tgtype::integer & 20) <> 0
      and t.tgenabled <> 'D'
      and t.tgname::text collate pg_catalog."C" >= 'zzz_sigo_occurrence_reference'
  ) then raise exception 'sigo_occurrence_reference_unexpected_trigger_order'; end if;

  if (select count(*) from pg_catalog.pg_attribute a where a.attnum > 0 and not a.attisdropped
      and a.atttypid in ('text'::regtype,'varchar'::regtype) and
      ((a.attrelid = 'public.occurrences'::regclass and a.attname = 'occurrence_number' and a.attgenerated = '')
        or (a.attrelid = 'public.shifts'::regclass and a.attname = 'shift_code'))) <> 2 then
    raise exception 'sigo_occurrence_reference_unexpected_column_types';
  end if;
  if pg_catalog.to_regclass('public.sigo_occurrences_reference_unique') is not null then
    raise exception 'sigo_occurrence_reference_index_name_already_exists';
  end if;

  if exists (select 1 from public.occurrences group by occurrence_number having count(*) > 1) then
    raise exception 'sigo_occurrence_reference_historical_duplicates';
  end if;
  if exists (
with suffixes as (
  select s.shift_code::text as prefix, o.occurrence_number::text as code,
    case when s.shift_code is not null and s.shift_code::text <> ''
      and (pg_catalog.left(o.occurrence_number::text, pg_catalog.char_length(s.shift_code::text) + 5) collate pg_catalog."C")
        = ((s.shift_code::text || '-OCC-') collate pg_catalog."C")
    then pg_catalog.substr(o.occurrence_number::text, pg_catalog.char_length(s.shift_code::text) + 6)
    end as suffix
  from public.occurrences o left join public.shifts s on s.id = o.shift_id
), parsed as (
  select *, case when suffix collate pg_catalog."C" ~ '^[0-9]{3,19}$' then suffix::numeric end as amount
  from suffixes
), classified as (
  select *, amount > 0 and amount < 9223372036854775807::numeric
    and suffix = case when amount < 1000 then pg_catalog.lpad(amount::text, 3, '0') else amount::text end as valid
  from parsed
)
    select 1 from classified where valid is not true
  ) then raise exception 'sigo_occurrence_reference_historical_format'; end if;
end
$guard$;

-- Keys match the exact printed code namespace. Two legacy shift IDs can have the
-- same prefix; sharing a high-water mark avoids recycling a visible reference.
-- Intentionally no FK or delete cascade: even resetting/recreating a shift cannot
-- make already saved references reusable after activation.
create table sigo_lifecycle_private.occurrence_reference_counters_v1 (
  shift_code text collate pg_catalog."C" primary key,
  last_number bigint not null check (last_number > 0)
);
alter table sigo_lifecycle_private.occurrence_reference_counters_v1 enable row level security;
revoke all on table sigo_lifecycle_private.occurrence_reference_counters_v1
  from public, anon, authenticated, service_role;

with suffixes as (
  select s.shift_code::text as prefix, o.occurrence_number::text as code,
    case when s.shift_code is not null and s.shift_code::text <> ''
      and (pg_catalog.left(o.occurrence_number::text, pg_catalog.char_length(s.shift_code::text) + 5) collate pg_catalog."C")
        = ((s.shift_code::text || '-OCC-') collate pg_catalog."C")
    then pg_catalog.substr(o.occurrence_number::text, pg_catalog.char_length(s.shift_code::text) + 6)
    end as suffix
  from public.occurrences o left join public.shifts s on s.id = o.shift_id
), parsed as (
  select *, case when suffix collate pg_catalog."C" ~ '^[0-9]{3,19}$' then suffix::numeric end as amount
  from suffixes
), classified as (
  select *, amount > 0 and amount < 9223372036854775807::numeric
    and suffix = case when amount < 1000 then pg_catalog.lpad(amount::text, 3, '0') else amount::text end as valid
  from parsed
)
insert into sigo_lifecycle_private.occurrence_reference_counters_v1 (shift_code,last_number)
select prefix collate pg_catalog."C", pg_catalog.max(amount)::bigint
from classified where valid group by prefix collate pg_catalog."C";

-- Keep a suitable pre-existing global constraint if present. Do not interpret
-- a scoped, expression, invalid, partial or deferred index as equivalent.
do $index$
begin
  if not exists (
    select 1 from pg_catalog.pg_index i
    join pg_catalog.pg_attribute a on a.attrelid = i.indrelid and a.attname = 'occurrence_number'
    where i.indrelid = 'public.occurrences'::regclass and i.indisunique and i.indimmediate
      and i.indisvalid and i.indisready and i.indislive and i.indnkeyatts = 1
      and i.indpred is null and i.indexprs is null and i.indkey[0] = a.attnum
      and i.indcollation[0] = a.attcollation
  ) then
    execute 'create unique index sigo_occurrences_reference_unique on public.occurrences(occurrence_number)';
  end if;
end
$index$;

create function sigo_lifecycle_private.assign_occurrence_reference_v1()
returns trigger language plpgsql volatile security definer
set search_path = '' set row_security = off
as $number$
declare
  prefix text;
  next_number bigint;
  actor uuid := auth.uid();
begin
  if tg_op = 'UPDATE' then
    if (new.occurrence_number collate pg_catalog."C")
       is distinct from (old.occurrence_number collate pg_catalog."C") then
      raise exception 'sigo_occurrence_reference_immutable' using errcode = '42501';
    end if;
    return new;
  end if;
  if pg_catalog.current_setting('role', true) is distinct from 'authenticated'
     or actor is null or new.created_by is distinct from actor then
    raise exception 'sigo_permissions_denied' using errcode = '42501';
  end if;

  -- Point 2 has already locked this parent and point 4 has checked membership.
  -- Reacquire the same lock before touching the counter; never the reverse.
  select s.shift_code::text into prefix from public.shifts s
  where s.id = new.shift_id and s.ats_unit_id = new.ats_unit_id
    and s.status::text = 'OPEN' and s.validated_at_utc is null
  for no key update;
  if prefix is null or prefix = '' then
    raise exception 'sigo_occurrence_reference_unavailable' using errcode = '22023';
  end if;

  insert into sigo_lifecycle_private.occurrence_reference_counters_v1 as c (shift_code,last_number)
    values (prefix,1)
  on conflict (shift_code) do update set last_number = c.last_number + 1
    where c.last_number < 9223372036854775807::bigint
  returning c.last_number into next_number;
  if next_number is null then
    raise exception 'sigo_occurrence_reference_exhausted' using errcode = '22003';
  end if;
  -- Replace even provisionally supplied references from older UI clients.
  new.occurrence_number := prefix || '-OCC-' ||
    case when next_number < 1000 then pg_catalog.lpad(next_number::text, 3, '0')
      else next_number::text end;
  return new;
end
$number$;

revoke all on function sigo_lifecycle_private.assign_occurrence_reference_v1()
  from public, anon, authenticated, service_role;
create trigger zzz_sigo_occurrence_reference
  before insert or update on public.occurrences for each row
  execute function sigo_lifecycle_private.assign_occurrence_reference_v1();
commit;
