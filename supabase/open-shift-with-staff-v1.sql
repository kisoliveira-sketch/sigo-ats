begin;
set local lock_timeout = '3s';
set local statement_timeout = '15s';

-- Keep the existing table privileges and RLS. This function must not bypass either.
create function public.sigo_open_shift_with_staff_v1(
  p_shift_code text,
  p_operational_date date,
  p_start_time_utc timestamptz,
  p_opening_notes text,
  p_member_ids uuid[],
  p_member_roles text[]
) returns bigint
language plpgsql volatile security invoker
set search_path = ''
as $fn$
declare
  v_actor uuid := auth.uid();
  v_unit public.shifts.ats_unit_id%type;
  v_unit_code public.ats_units.code%type;
  v_shift_id public.shifts.id%type;
  v_notes text;
  v_staff jsonb;
  v_composition text;
  v_count integer;
  v_staff_written integer;
begin
  if v_actor is null then
    raise exception 'sigo_open_denied' using errcode = '42501';
  end if;
  select p.ats_unit_id, u.code into v_unit, v_unit_code
  from public.profiles p join public.ats_units u on u.id = p.ats_unit_id
  where p.id = v_actor;
  if not found or v_unit is null or v_unit_code is null then
    raise exception 'sigo_open_denied' using errcode = '42501';
  end if;

  if p_operational_date is null or p_start_time_utc is null or p_shift_code is null
    or not pg_catalog.isfinite(p_operational_date)
    or not pg_catalog.isfinite(p_start_time_utc)
    or (p_start_time_utc at time zone 'UTC')::date <> p_operational_date
    or p_shift_code <> v_unit_code || '-' || pg_catalog.to_char(p_operational_date, 'YYYYMMDD')
      || '-' || pg_catalog.to_char(p_start_time_utc at time zone 'UTC', 'HH24MI') || '/' || pg_catalog.right(p_shift_code, 4)
    or pg_catalog.right(p_shift_code, 4) !~ '^([01][0-9]|2[0-3])[0-5][0-9]$'
  then
    raise exception 'sigo_open_invalid_shift' using errcode = '22023';
  end if;

  v_count := pg_catalog.cardinality(p_member_ids);
  if v_count is null or v_count = 0
      or pg_catalog.array_ndims(p_member_ids) is distinct from 1
      or pg_catalog.array_ndims(p_member_roles) is distinct from 1
      or pg_catalog.cardinality(p_member_roles) is distinct from v_count
      or exists (
        select 1 from pg_catalog.unnest(p_member_roles) as roles(role)
        where role is null or role not in ('Supervisor', 'CTA Operacional', 'CTA OJT', 'OJTI', 'CTA Assistente', 'AFIS', 'Outro')
      )
      or (select count(distinct member_id)
          from pg_catalog.unnest(p_member_ids) as ids(member_id)) <> v_count
  then
    raise exception 'sigo_open_invalid_staff' using errcode = '22023';
  end if;

  -- Serialize normal calls by unit. Other entry paths are not subject to this advisory lock.
  -- The subsequent probes must see the committed state after the lock wait.
  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'sigo_open_retry' using errcode = '40001';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('sigo_ats_open_shift_v1:' || v_unit::text, 0)
  );

  -- Mirror the existing opening form checks, without changing direct-write policy or global constraints.
  if exists (select 1 from public.shifts s where s.ats_unit_id = v_unit and s.status = 'OPEN') then
    raise exception 'sigo_open_existing_open' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.shifts s where s.ats_unit_id = v_unit
      and s.shift_code = p_shift_code and s.operational_date = p_operational_date) then
    raise exception 'sigo_open_existing_reference' using errcode = 'P0001';
  end if;

  -- Resolve labels server-side once, keeping input order and the current display format.
  select
    jsonb_agg(pg_catalog.jsonb_build_object('user_id', m.member_id, 'role', m.role, 'label', m.label) order by m.ordinality),
    string_agg(m.role || ': ' || m.label, ' | ' order by m.ordinality)
  into v_staff, v_composition
  from (
    select x.member_id, x.role, x.ordinality,
      coalesce(nullif(p.full_name, ''), nullif(p.email, ''), 'Utilizador') as label
    from rows from (pg_catalog.unnest(p_member_ids), pg_catalog.unnest(p_member_roles))
         with ordinality as x(member_id, role, ordinality)
    join public.profiles p on p.id = x.member_id and p.ats_unit_id = v_unit
  ) m;
  if pg_catalog.jsonb_array_length(v_staff) is distinct from v_count then
    raise exception 'sigo_open_unavailable_staff' using errcode = '22023';
  end if;
  v_notes := pg_catalog.concat_ws(E'\n\n', nullif(pg_catalog.btrim(p_opening_notes), ''),
    'Composição do turno: ' || v_composition);

  insert into public.shifts (
    ats_unit_id, shift_code, operational_date, start_time_utc, status, opening_notes, opened_by
  ) values (v_unit, p_shift_code, p_operational_date, p_start_time_utc, 'OPEN', v_notes, v_actor)
  returning id into v_shift_id;
  if v_shift_id is null then
    raise exception 'sigo_open_write_incomplete' using errcode = 'P0001';
  end if;

  insert into public.shift_staff (shift_id, user_id, role_in_shift, is_present, notes)
  select v_shift_id, item.user_id, item.role || ' · ' || item.label, true,
    case when item.role = 'Supervisor' then 'Supervisor autenticado no momento de abertura do turno.'
         else 'Membro registado na composição inicial do turno.' end
  from pg_catalog.jsonb_to_recordset(v_staff) as item(user_id uuid, role text, label text);
  get diagnostics v_staff_written = row_count;
  if v_staff_written <> v_count then
    raise exception 'sigo_open_write_incomplete' using errcode = 'P0001';
  end if;
  return v_shift_id;
end
$fn$;

revoke all on function public.sigo_open_shift_with_staff_v1(text, date, timestamptz, text, uuid[], text[])
from public, anon, authenticated, service_role;
grant execute on function public.sigo_open_shift_with_staff_v1(text, date, timestamptz, text, uuid[], text[])
to authenticated;

commit;
