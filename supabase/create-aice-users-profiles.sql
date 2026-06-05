-- 1. Criar primeiro os utilizadores em Authentication > Users no Supabase.
-- 2. Depois correr este script no SQL Editor para criar/atualizar os profiles.
--
-- O script tenta descobrir automaticamente um role "não-admin" válido no enum
-- public.user_role. A ordem de preferência é:
-- USER, user, OPERATOR, operator, CONTROLLER, controller.

do $$
declare
  target_ats_unit_id bigint;
  target_role text;
begin
  select id
  into target_ats_unit_id
  from public.ats_units
  where code in ('TWR_AICE', 'AICE_TWR', 'AICE')
  order by case code
    when 'TWR_AICE' then 1
    when 'AICE_TWR' then 2
    when 'AICE' then 3
    else 99
  end
  limit 1;

  if target_ats_unit_id is null then
    raise exception 'ATS unit with code % was not found.', 'TWR_AICE';
  end if;

  select enumlabel
  into target_role
  from pg_enum
  where enumtypid = 'public.user_role'::regtype
    and enumlabel in (
      'USER',
      'user',
      'OPERATOR',
      'operator',
      'CONTROLLER',
      'controller'
    )
  order by case enumlabel
    when 'USER' then 1
    when 'user' then 2
    when 'OPERATOR' then 3
    when 'operator' then 4
    when 'CONTROLLER' then 5
    when 'controller' then 6
    else 99
  end
  limit 1;

  if target_role is null then
    raise exception
      'No supported non-admin value was found in enum public.user_role. Check the enum values first.';
  end if;

  execute format(
    $sql$
      insert into public.profiles (id, email, role, ats_unit_id)
      select
        auth_user.id,
        auth_user.email,
        %L::public.user_role,
        %s
      from auth.users as auth_user
      where auth_user.email in (
        'kisoliveira@gmail.com',
        'leila.leite@asa.cv',
        'elton.delgado@asa.cv',
        'valerio.fonseca@asa.cv',
        'claudia.cruz@asa.cv'
      )
      on conflict (id) do update
      set
        email = excluded.email,
        role = excluded.role,
        ats_unit_id = excluded.ats_unit_id;
    $sql$,
    target_role,
    target_ats_unit_id
  );
end $$;
