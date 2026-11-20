begin;
set local lock_timeout = '3s';
set local statement_timeout = '15s';
lock table public.shifts, public.shift_staff, public.occurrences, public.shift_position_logs in access exclusive mode;
do $$
begin
  if exists (select 1 from public.shifts where status = 'OPEN') then
    raise exception 'sigo_permissions_wait_for_handover';
  end if;
end $$;
alter table public.shifts add column if not exists roster_authority_v1 jsonb;

create function sigo_lifecycle_private.roster_matches(p_shift_id bigint, p_unit bigint, p_roster jsonb)
returns boolean language plpgsql stable security definer set search_path = '' set row_security = off
as $$
begin
  if pg_catalog.jsonb_typeof(p_roster) is distinct from 'array' then return false; end if;
  if pg_catalog.jsonb_array_length(p_roster) = 0 then return false; end if;
  if exists (
    select 1 from pg_catalog.jsonb_array_elements(p_roster) x(member)
    where pg_catalog.jsonb_typeof(x.member) <> 'object'
      or x.member->>'user_id' is null
      or x.member->>'user_id' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or x.member->>'role' is null
      or x.member->>'role' not in ('Supervisor', 'CTA Operacional', 'CTA OJT', 'OJTI', 'CTA Assistente', 'AFIS', 'Outro')
  ) then return false; end if;
  if (select count(distinct member->>'user_id') from pg_catalog.jsonb_array_elements(p_roster) x(member))
     <> pg_catalog.jsonb_array_length(p_roster) then return false; end if;
  if (select count(*) from public.shift_staff where shift_id = p_shift_id)
     <> pg_catalog.jsonb_array_length(p_roster) then return false; end if;
  return not exists (
    select 1 from pg_catalog.jsonb_array_elements(p_roster) x(member)
    where not exists (
      select 1 from public.shift_staff st join public.profiles p on p.id = st.user_id
      where st.shift_id = p_shift_id and st.user_id = (x.member->>'user_id')::uuid
        and p.ats_unit_id = p_unit
        and pg_catalog.split_part(st.role_in_shift, ' · ', 1) = x.member->>'role'
    )
  );
end $$;

create function sigo_lifecycle_private.shift_authority(p_shift_id bigint)
returns jsonb language plpgsql volatile security definer set search_path = '' set row_security = off
as $$
declare
  actor uuid := auth.uid();
  actor_unit bigint;
  shift_row public.shifts%rowtype;
  unit_code text;
  first_supervisor text;
  manager text;
  manager_kind text := 'none';
  member_role text;
  members jsonb;
  verified boolean;
begin
  if actor is null or pg_catalog.current_setting('role', true) is distinct from 'authenticated' then
    return null;
  end if;
  select ats_unit_id into actor_unit from public.profiles where id = actor;
  select * into shift_row from public.shifts where id = p_shift_id and ats_unit_id = actor_unit and status = 'OPEN';
  if not found then return null; end if;
  verified := sigo_lifecycle_private.roster_matches(p_shift_id, actor_unit, shift_row.roster_authority_v1);
  if verified then
    select member->>'user_id' into first_supervisor
      from pg_catalog.jsonb_array_elements(shift_row.roster_authority_v1) with ordinality x(member, n)
      where member->>'role' = 'Supervisor' order by n limit 1;
    select member->>'role' into member_role from pg_catalog.jsonb_array_elements(shift_row.roster_authority_v1) x(member)
      where member->>'user_id' = actor::text;
    select pg_catalog.jsonb_agg(member->>'user_id' order by n) into members
      from pg_catalog.jsonb_array_elements(shift_row.roster_authority_v1) with ordinality x(member, n);
    if first_supervisor is not null then
      manager := first_supervisor;
      manager_kind := 'supervisor';
    else
      select code::text into unit_code from public.ats_units where id = actor_unit;
      if pg_catalog.upper(pg_catalog.btrim(unit_code)) in ('AICE', 'AICE_TWR', 'TWR_AICE', 'TWR_BVC', 'TWR_SAL')
         and shift_row.opened_by is not null then
        manager := shift_row.opened_by::text;
        manager_kind := 'opener';
      end if;
    end if;
  end if;
  return pg_catalog.jsonb_build_object(
    'verified', verified, 'managerKind', manager_kind,
    'canManagePositions', coalesce(manager = actor::text, false),
    'canCreateOccurrence', verified and member_role is not null and shift_row.validated_at_utc is null,
    'managerLabel', (select p.full_name from public.profiles p where p.id::text = manager),
    'memberRole', member_role, 'memberIds',
      case when manager = actor::text then coalesce(members, '[]'::jsonb) else '[]'::jsonb end
  );
end $$;

create function public.sigo_shift_permissions_v1(p_shift_id bigint)
returns jsonb language sql volatile security definer set search_path = '' set row_security = off
as $$ select sigo_lifecycle_private.shift_authority(p_shift_id) $$;

create function sigo_lifecycle_private.guard_roster_snapshot()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.roster_authority_v1 is distinct from old.roster_authority_v1 then
      raise exception 'sigo_permissions_denied' using errcode = '42501';
    end if;
  else
    if pg_catalog.jsonb_typeof(new.roster_authority_v1) is distinct from 'array' then
      raise exception 'sigo_permissions_refresh_open';
    end if;
    if pg_catalog.current_setting('role', true) is distinct from 'authenticated'
       or auth.uid() is null or new.opened_by is distinct from auth.uid()
       or not exists (select 1 from public.profiles where id = auth.uid() and ats_unit_id = new.ats_unit_id) then
      raise exception 'sigo_permissions_denied' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

create function sigo_lifecycle_private.guard_shift_staff_authority()
returns trigger language plpgsql security definer set search_path = '' set row_security = off
as $$
declare
  shift_key bigint;
  parent_row public.shifts%rowtype;
  actor_unit bigint;
  ordinary_access boolean := pg_catalog.current_setting('role', true) = 'authenticated'
    and pg_catalog.pg_trigger_depth() = 1;
begin
  if tg_op = 'INSERT' then shift_key := new.shift_id; else shift_key := old.shift_id; end if;
  if tg_op = 'UPDATE' and new.shift_id is distinct from old.shift_id then
    raise exception 'sigo_permissions_denied' using errcode = '42501';
  end if;
  if ordinary_access then
    select ats_unit_id into actor_unit from public.profiles where id = auth.uid();
    if actor_unit is null then raise exception 'sigo_permissions_denied' using errcode = '42501'; end if;
  end if;
  select * into parent_row from public.shifts
    where id = shift_key and (not ordinary_access or ats_unit_id = actor_unit)
    for no key update;
  if ordinary_access and not found then
    raise exception 'sigo_permissions_denied' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' and not found and pg_catalog.pg_trigger_depth() > 1 then return old; end if;
  if parent_row.roster_authority_v1 is null then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  if tg_op = 'DELETE' and pg_catalog.pg_trigger_depth() > 1
     and not exists (select 1 from public.profiles where id = old.user_id) then return old; end if;
  if tg_op <> 'INSERT'
     or pg_catalog.current_setting('role', true) is distinct from 'authenticated'
     or auth.uid() is null or auth.uid() is distinct from parent_row.opened_by
     or parent_row.status::text is distinct from 'OPEN' or parent_row.validated_at_utc is not null
     or not exists (select 1 from public.profiles where id = auth.uid() and ats_unit_id = parent_row.ats_unit_id)
     or not exists (select 1 from public.profiles where id = new.user_id and ats_unit_id = parent_row.ats_unit_id)
     or not exists (
       select 1 from pg_catalog.jsonb_array_elements(parent_row.roster_authority_v1) x(member)
       where member->>'user_id' = new.user_id::text
         and member->>'role' = pg_catalog.split_part(new.role_in_shift, ' · ', 1)
     )
     or exists (select 1 from public.shift_staff where shift_id = shift_key and user_id = new.user_id) then
    raise exception 'sigo_permissions_denied' using errcode = '42501';
  end if;
  return new;
end $$;

create function sigo_lifecycle_private.guard_child_permission()
returns trigger language plpgsql volatile security definer set search_path = '' set row_security = off
as $$
declare
  actor uuid := auth.uid();
  authority jsonb;
  shift_key bigint;
begin
  -- The preceding lifecycle trigger validates unit/state and locks the parent.
  if tg_op = 'DELETE' then
    shift_key := old.shift_id;
    if (pg_catalog.current_setting('role', true) = 'service_role' and actor is null)
       or (pg_catalog.pg_trigger_depth() > 1 and
           not exists (select 1 from public.shifts where id = shift_key)) then return old; end if;
  else
    shift_key := new.shift_id;
  end if;
  if tg_op = 'UPDATE' and pg_catalog.pg_trigger_depth() > 1 then
    if tg_table_name = 'occurrences' then
      if old.created_by is not null and new.created_by is null and
         not exists (select 1 from public.profiles where id = old.created_by) and
         (pg_catalog.to_jsonb(old) - 'created_by') = (pg_catalog.to_jsonb(new) - 'created_by') then return new; end if;
    else
      if old.recorded_by is not null and new.recorded_by is null and
         not exists (select 1 from public.profiles where id = old.recorded_by) and
         (pg_catalog.to_jsonb(old) - 'recorded_by') = (pg_catalog.to_jsonb(new) - 'recorded_by') then return new; end if;
    end if;
  end if;
  authority := sigo_lifecycle_private.shift_authority(shift_key);
  if authority is null then raise exception 'sigo_permissions_denied' using errcode = '42501'; end if;
  if tg_table_name = 'shift_position_logs' then
    if tg_op = 'DELETE' or authority->>'canManagePositions' is distinct from 'true' then
      raise exception 'sigo_permissions_denied' using errcode = '42501';
    end if;
    if tg_op = 'INSERT' then
      if new.recorded_by is distinct from actor
         or not ((authority->'memberIds') ? (new.user_id::text)) then
        raise exception 'sigo_permissions_denied' using errcode = '42501';
      end if;
    elsif new.user_id is distinct from old.user_id or new.recorded_by is distinct from old.recorded_by then
      raise exception 'sigo_permissions_denied' using errcode = '42501';
    end if;
  elsif tg_op = 'INSERT' then
    if new.created_by is distinct from actor or authority->>'canCreateOccurrence' is distinct from 'true' then
      raise exception 'sigo_permissions_denied' using errcode = '42501';
    end if;
  else
    if (tg_op = 'UPDATE' and new.created_by is distinct from old.created_by)
       or (actor is distinct from old.created_by and not exists
         (select 1 from public.profiles where id = actor and role::text in ('SUPERVISOR','CHEFIA_ATS','ADMIN'))) then
      raise exception 'sigo_permissions_denied' using errcode = '42501';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

revoke all on function sigo_lifecycle_private.roster_matches(bigint,bigint,jsonb) from public, anon, authenticated, service_role;
revoke all on function sigo_lifecycle_private.shift_authority(bigint) from public, anon, authenticated, service_role;
revoke all on function sigo_lifecycle_private.guard_roster_snapshot() from public, anon, authenticated, service_role;
revoke all on function sigo_lifecycle_private.guard_shift_staff_authority() from public, anon, authenticated, service_role;
revoke all on function sigo_lifecycle_private.guard_child_permission() from public, anon, authenticated, service_role;
revoke all on function public.sigo_shift_permissions_v1(bigint) from public, anon, authenticated, service_role;
grant execute on function public.sigo_shift_permissions_v1(bigint) to authenticated;

create trigger zz_sigo_snapshot before insert or update on public.shifts
  for each row execute function sigo_lifecycle_private.guard_roster_snapshot();
create trigger zz_sigo_staff before insert or update or delete on public.shift_staff
  for each row execute function sigo_lifecycle_private.guard_shift_staff_authority();
create trigger zz_sigo_permissions before insert or update or delete on public.occurrences
  for each row execute function sigo_lifecycle_private.guard_child_permission();
create trigger zz_sigo_permissions before insert or update or delete on public.shift_position_logs
  for each row execute function sigo_lifecycle_private.guard_child_permission();
-- Keep the existing table privileges and RLS. This function must not bypass either.
create function public.sigo_open_shift_with_staff_v2(
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
    ats_unit_id, shift_code, operational_date, start_time_utc, status, opening_notes, opened_by, roster_authority_v1
  ) values (v_unit, p_shift_code, p_operational_date, p_start_time_utc, 'OPEN', v_notes, v_actor,
    (select jsonb_agg(item.value - 'label' order by item.n) from pg_catalog.jsonb_array_elements(v_staff) with ordinality item(value,n)))
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

revoke all on function public.sigo_open_shift_with_staff_v2(text, date, timestamptz, text, uuid[], text[])
from public, anon, authenticated, service_role;
grant execute on function public.sigo_open_shift_with_staff_v2(text, date, timestamptz, text, uuid[], text[])
to authenticated;

commit;
