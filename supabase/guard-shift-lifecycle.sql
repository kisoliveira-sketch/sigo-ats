-- Install only after catalog preflight and isolated PostgreSQL tests.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '15s';
create schema sigo_lifecycle_private;
revoke all on schema sigo_lifecycle_private from public, anon, authenticated, service_role;

-- UPDATE holds the row lock; child writes take the same lock explicitly.
-- Volatile queries after acquiring it see new commits under READ COMMITTED.
create function sigo_lifecycle_private.guard_shift_update() returns trigger
language plpgsql volatile security definer
set search_path = ''
set row_security = off
as $$
declare
  actor uuid := auth.uid();
  actor_unit bigint;
  closing boolean := new.status is distinct from old.status;
  validating boolean := new.validated_at_utc is distinct from old.validated_at_utc
                        or new.validated_by is distinct from old.validated_by;
begin
  -- Preserve genuine nested FK SET NULL, not direct authority rewrites.
  if pg_catalog.pg_trigger_depth() > 1 and (
    (old.validated_by is not null and new.validated_by is null
      and (pg_catalog.to_jsonb(new) - 'validated_by') = (pg_catalog.to_jsonb(old) - 'validated_by')
      and not exists (select 1 from public.profiles where id = old.validated_by))
    or
    (old.opened_by is not null and new.opened_by is null
      and (pg_catalog.to_jsonb(new) - 'opened_by') = (pg_catalog.to_jsonb(old) - 'opened_by')
      and not exists (select 1 from public.profiles where id = old.opened_by))
  ) then return new; end if;

  if new.id is distinct from old.id or new.opened_by is distinct from old.opened_by
     or new.ats_unit_id is distinct from old.ats_unit_id then
    raise exception using errcode = 'P7501', message = 'SIGO_LIFECYCLE_DENIED';
  end if;
  if not (closing or validating) then
    if new.end_time_utc is distinct from old.end_time_utc
       or new.handover_notes is distinct from old.handover_notes then
      raise exception using errcode = 'P7502', message = 'SIGO_LIFECYCLE_STATE_CHANGED';
    end if;
    return new;
  end if;
  if pg_catalog.current_setting('role', true) is distinct from 'authenticated'
     or actor is null or actor is distinct from old.opened_by then
    raise exception using errcode = 'P7501', message = 'SIGO_LIFECYCLE_DENIED';
  end if;
  select p.ats_unit_id into actor_unit from public.profiles p where p.id = actor;
  if actor_unit is null or actor_unit is distinct from old.ats_unit_id then
    raise exception using errcode = 'P7501', message = 'SIGO_LIFECYCLE_DENIED';
  end if;
  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then
    raise exception using errcode = '40001', message = 'SIGO_LIFECYCLE_RETRY';
  end if;
  if old.status::text is distinct from 'OPEN' or (closing and validating) then
    raise exception using errcode = 'P7502', message = 'SIGO_LIFECYCLE_STATE_CHANGED';
  end if;
  if closing then
    if new.status::text is distinct from 'CLOSED' or new.end_time_utc is null
       or (pg_catalog.to_jsonb(new) - array['status','end_time_utc','handover_notes','updated_at'])
          <> (pg_catalog.to_jsonb(old) - array['status','end_time_utc','handover_notes','updated_at']) then
      raise exception using errcode = 'P7502', message = 'SIGO_LIFECYCLE_STATE_CHANGED';
    end if;
  else
    if old.validated_at_utc is not null or old.validated_by is not null
       or new.validated_at_utc is null or new.validated_by is distinct from actor
       or (pg_catalog.to_jsonb(new) - array['validated_by','validated_at_utc','updated_at'])
          <> (pg_catalog.to_jsonb(old) - array['validated_by','validated_at_utc','updated_at']) then
      raise exception using errcode = 'P7502', message = 'SIGO_LIFECYCLE_STATE_CHANGED';
    end if;
  end if;
  if exists (select 1 from public.shift_position_logs l where l.shift_id = old.id and l.left_at_utc is null) then
    raise exception using errcode = 'P7503', message = 'SIGO_LIFECYCLE_ACTIVE_POSITIONS';
  end if;
  if closing then
    if old.validated_at_utc is null and exists (select 1 from public.occurrences o where o.shift_id = old.id) then
      raise exception using errcode = 'P7504', message = 'SIGO_LIFECYCLE_NEEDS_VALIDATION';
    end if;
    new.end_time_utc := pg_catalog.clock_timestamp();
  else
    if not exists (select 1 from public.occurrences o where o.shift_id = old.id) then
      raise exception using errcode = 'P7505', message = 'SIGO_LIFECYCLE_NO_OCCURRENCES';
    end if;
    new.validated_at_utc := pg_catalog.clock_timestamp();
  end if;
  return new;
end
$$;

create function sigo_lifecycle_private.guard_shift_insert() returns trigger
language plpgsql volatile security invoker set search_path = ''
as $$
begin
  if new.status::text is distinct from 'OPEN' or new.validated_by is not null
     or new.validated_at_utc is not null or new.end_time_utc is not null then
    raise exception using errcode = 'P7502', message = 'SIGO_LIFECYCLE_STATE_CHANGED';
  end if;
  return new;
end
$$;

create function sigo_lifecycle_private.guard_child_write() returns trigger
language plpgsql volatile security definer
set search_path = ''
set row_security = off
as $$
declare
  actor uuid := auth.uid();
  actor_unit bigint;
  request_role text := pg_catalog.current_setting('role', true);
  current_shift_id bigint;
  current_unit bigint;
  parent_status text;
  parent_validated timestamptz;
  reset_delete boolean := tg_op = 'DELETE' and request_role = 'service_role' and actor is null;
  old_profile uuid;
  profile_column text;
begin
  if tg_op = 'DELETE' then
    current_shift_id := old.shift_id;
    current_unit := old.ats_unit_id;
    -- A genuine cascading child delete occurs after the parent is gone.
    if pg_catalog.pg_trigger_depth() > 1
       and not exists (select 1 from public.shifts where id = current_shift_id) then
      return old;
    end if;
  else
    current_shift_id := new.shift_id;
    current_unit := new.ats_unit_id;
  end if;
  if tg_op = 'UPDATE' then
    if new.shift_id is distinct from old.shift_id or new.ats_unit_id is distinct from old.ats_unit_id then
      raise exception using errcode = 'P7501', message = 'SIGO_LIFECYCLE_DENIED';
    end if;
    if pg_catalog.pg_trigger_depth() > 1 then
      profile_column := case when tg_table_name = 'occurrences' then 'created_by' else 'recorded_by' end;
      old_profile := (pg_catalog.to_jsonb(old) ->> profile_column)::uuid;
      if old_profile is not null and (pg_catalog.to_jsonb(new) ->> profile_column) is null
         and (pg_catalog.to_jsonb(new) - profile_column) = (pg_catalog.to_jsonb(old) - profile_column)
         and not exists (select 1 from public.profiles where id = old_profile) then
        return new;
      end if;
    end if;
  end if;
  if not reset_delete then
    if request_role is distinct from 'authenticated' or actor is null then
      raise exception using errcode = 'P7501', message = 'SIGO_LIFECYCLE_DENIED';
    end if;
    select p.ats_unit_id into actor_unit from public.profiles p where p.id = actor;
    if actor_unit is null or actor_unit is distinct from current_unit then
      raise exception using errcode = 'P7501', message = 'SIGO_LIFECYCLE_DENIED';
    end if;
  end if;
  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then
    raise exception using errcode = '40001', message = 'SIGO_LIFECYCLE_RETRY';
  end if;
  select s.status::text, s.validated_at_utc into parent_status, parent_validated
    from public.shifts s where s.id = current_shift_id and (reset_delete or s.ats_unit_id = current_unit)
    for no key update;
  if not found then
    raise exception using errcode = 'P7501', message = 'SIGO_LIFECYCLE_DENIED';
  end if;
  -- The existing authenticated service-backed administrative reset can still
  -- delete children. It acquires the same lock and cannot insert/edit/transition.
  if reset_delete then return old; end if;
  if parent_status is distinct from 'OPEN' then
    raise exception using errcode = 'P7502', message = 'SIGO_LIFECYCLE_STATE_CHANGED';
  end if;
  if tg_table_name = 'occurrences' and parent_validated is not null then
    raise exception using errcode = 'P7506', message = 'SIGO_LIFECYCLE_OCCURRENCES_VALIDATED';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end
$$;

revoke all on function sigo_lifecycle_private.guard_shift_update() from public, anon, authenticated, service_role;
revoke all on function sigo_lifecycle_private.guard_shift_insert() from public, anon, authenticated, service_role;
revoke all on function sigo_lifecycle_private.guard_child_write() from public, anon, authenticated, service_role;
create trigger z_sigo_lifecycle_shift_update before update on public.shifts
  for each row execute function sigo_lifecycle_private.guard_shift_update();
create trigger z_sigo_lifecycle_shift_insert before insert on public.shifts
  for each row execute function sigo_lifecycle_private.guard_shift_insert();
create trigger z_sigo_lifecycle_occurrence before insert or update or delete on public.occurrences
  for each row execute function sigo_lifecycle_private.guard_child_write();
create trigger z_sigo_lifecycle_position before insert or update or delete on public.shift_position_logs
  for each row execute function sigo_lifecycle_private.guard_child_write();
commit;
