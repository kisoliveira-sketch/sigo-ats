-- Read-only, aggregate-only. Do not run against production until root schedules a permitted preflight.
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
select
  (select count(*) from classified) as historical_rows,
  (select count(*) from classified where valid is not true) as malformed_or_exhausted_references,
  (select count(*) from (
     select occurrence_number from public.occurrences group by occurrence_number having count(*) > 1
   ) d) as globally_duplicated_references,
  (select count(*) from (
     select shift_id, occurrence_number from public.occurrences
     group by shift_id, occurrence_number having count(*) > 1
   ) d) as same_shift_duplicate_references,
  (select count(*) from (
     select shift_code::text collate pg_catalog."C" from public.shifts
     where shift_code is not null group by shift_code::text collate pg_catalog."C" having count(*) > 1
   ) d) as repeated_shift_prefixes,
  (select count(*) from (
     select shift_code::text collate pg_catalog."C" from public.shifts
     where status::text = 'OPEN' and shift_code is not null
     group by shift_code::text collate pg_catalog."C" having count(*) > 1
   ) d) as repeated_open_shift_prefixes,
  (select coalesce(max(pg_catalog.char_length(shift_code::text)),0) from public.shifts) as max_saved_prefix_length,
  exists (select 1 from pg_catalog.pg_index i
    join pg_catalog.pg_attribute a on a.attrelid = i.indrelid and a.attname = 'occurrence_number'
    where i.indrelid = 'public.occurrences'::regclass and i.indisunique and i.indimmediate
      and i.indisvalid and i.indisready and i.indislive and i.indnkeyatts = 1
      and i.indpred is null and i.indexprs is null and i.indkey[0] = a.attnum
      and i.indcollation[0] = a.attcollation) as preexisting_global_unique,
  (select count(*) from pg_catalog.pg_trigger t
    join pg_catalog.pg_proc p on p.oid = t.tgfoid
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where t.tgrelid = 'public.occurrences'::regclass
    and not t.tgisinternal and t.tgenabled in ('O','A') and t.tgtype = 31
    and n.nspname = 'sigo_lifecycle_private'
    and ((t.tgname = 'z_sigo_lifecycle_occurrence' and p.proname = 'guard_child_write')
      or (t.tgname = 'zz_sigo_permissions' and p.proname = 'guard_child_permission'))) as expected_active_guard_count,
  (select pg_catalog.format_type(a.atttypid,a.atttypmod)
   from pg_catalog.pg_attribute a where a.attrelid='public.occurrences'::regclass
     and a.attname='occurrence_number' and a.attnum > 0 and not a.attisdropped) as reference_type,
  (select pg_catalog.format_type(a.atttypid,a.atttypmod)
   from pg_catalog.pg_attribute a where a.attrelid='public.shifts'::regclass
     and a.attname='shift_code' and a.attnum > 0 and not a.attisdropped) as prefix_type,
  pg_catalog.to_regclass('public.sigo_occurrences_reference_unique') is not null as reserved_index_name_present,
  pg_catalog.to_regclass('sigo_lifecycle_private.occurrence_reference_counters_v1') is not null as counter_already_present;
