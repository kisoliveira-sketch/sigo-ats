-- TWR AIPNM · Setup base do ambiente
--
-- 1. Criar primeiro os utilizadores em Authentication > Users no Supabase.
-- 2. Depois correr este script no SQL Editor para criar/atualizar a unidade ATS e os profiles.
--
do $$
declare
  target_ats_unit_id bigint;
  target_role text;
  unit_type_data_type text;
  unit_type_udt_schema text;
  unit_type_udt_name text;
  target_unit_type text;
begin
  select data_type, udt_schema, udt_name
  into unit_type_data_type, unit_type_udt_schema, unit_type_udt_name
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'ats_units'
    and column_name = 'unit_type'
  limit 1;

  if unit_type_data_type = 'USER-DEFINED' then
    execute format(
      $sql$
        select enumlabel
        from pg_enum
        where enumtypid = %L::regtype
          and enumlabel in (
            'TWR',
            'twr',
            'TOWER',
            'tower',
            'AERODROME_CONTROL_TOWER',
            'aerodrome_control_tower'
          )
        order by case enumlabel
          when 'TWR' then 1
          when 'twr' then 2
          when 'TOWER' then 3
          when 'tower' then 4
          when 'AERODROME_CONTROL_TOWER' then 5
          when 'aerodrome_control_tower' then 6
          else 99
        end
        limit 1
      $sql$,
      format('%I.%I', unit_type_udt_schema, unit_type_udt_name)
    )
    into target_unit_type;
  else
    target_unit_type := 'TWR';
  end if;

  if target_unit_type is null then
    raise exception
      'No supported TWR value was found for public.ats_units.unit_type. Check the column type/enum values first.';
  end if;

  if unit_type_data_type = 'USER-DEFINED' then
    execute format(
      $sql$
        insert into public.ats_units (name, code, unit_type)
        values ('PRAIA TOWER', 'TWR_AIPNM', %L::%I.%I)
        on conflict (code) do update
        set
          name = excluded.name,
          unit_type = excluded.unit_type
      $sql$,
      target_unit_type,
      unit_type_udt_schema,
      unit_type_udt_name
    );
  else
    insert into public.ats_units (name, code, unit_type)
    values ('PRAIA TOWER', 'TWR_AIPNM', target_unit_type)
    on conflict (code) do update
    set
      name = excluded.name,
      unit_type = excluded.unit_type;
  end if;

  select id
  into target_ats_unit_id
  from public.ats_units
  where code = 'TWR_AIPNM'
  limit 1;

  if target_ats_unit_id is null then
    raise exception 'ATS unit with code % was not found.', 'TWR_AIPNM';
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
    select enumlabel
    into target_role
    from pg_enum
    where enumtypid = 'public.user_role'::regtype
      and lower(enumlabel) not like '%admin%'
      and lower(enumlabel) not like '%super%'
      and lower(enumlabel) not like '%manager%'
      and lower(enumlabel) not like '%director%'
      and lower(enumlabel) not like '%chief%'
    order by enumsortorder
    limit 1;
  end if;

  if target_role is null then
    raise exception
      'No supported non-admin value was found in enum public.user_role. Check the enum values first.';
  end if;

  execute format(
    $sql$
      insert into public.profiles (id, full_name, email, role, ats_unit_id)
      select
        auth_user.id,
        case auth_user.email
          when 'abigail.fernandes@asa.cv' then 'Abigail Fernandes'
          when 'carlos.monteiro@asa.cv' then 'Carlos Monteiro'
          when 'jorge.semedo@asa.cv' then 'Jorge Semedo'
          when 'janito.carvalho@asa.cv' then 'Janito Carvalho'
          when 'adalberto.duarte@asa.cv' then 'Adalberto Duarte'
          when 'elisangelo.vicente@asa.cv' then 'Elisangelo Vicente'
          when 'marcelo.silva@asa.cv' then 'Marcelo Silva'
          when 'fabio.dias@asa.cv' then 'Fabio Dias'
          when 'janice.veiga@asa.cv' then 'Janice Veiga'
          when 'hamilton.graca@asa.cv' then 'Hamilton Graça'
          when 'jose.martins@asa.cv' then 'Jose Luis Martins'
          else split_part(auth_user.email, '@', 1)
        end as full_name,
        auth_user.email,
        %L::public.user_role,
        %s
      from auth.users as auth_user
      where auth_user.email in (
        'abigail.fernandes@asa.cv',
        'carlos.monteiro@asa.cv',
        'jorge.semedo@asa.cv',
        'janito.carvalho@asa.cv',
        'adalberto.duarte@asa.cv',
        'elisangelo.vicente@asa.cv',
        'marcelo.silva@asa.cv',
        'fabio.dias@asa.cv',
        'janice.veiga@asa.cv',
        'hamilton.graca@asa.cv',
        'jose.martins@asa.cv'
      )
      on conflict (id) do update
      set
        full_name = excluded.full_name,
        email = excluded.email,
        role = excluded.role,
        ats_unit_id = excluded.ats_unit_id;
    $sql$,
    target_role,
    target_ats_unit_id
  );
end $$;

-- Horários operacionais da TWR AIPNM (UTC)
-- 08:30 - 14:30
-- 14:30 - 20:30
-- 20:30 - 00:30
-- 00:30 - 08:30

-- Utilizadores de referência
-- Abigail Fernandes — Supervisora
-- Carlos Monteiro — Supervisor
-- Jorge Semedo — Supervisor
-- Janito Carvalho — Supervisor
-- Adalberto Duarte — Supervisor
-- Elisangelo Vicente — Supervisor
-- Marcelo Silva — CTA Operacional
-- Fabio Dias — CTA Operacional
-- Janice Veiga — CTA Operacional
-- Hamilton Graça — CTA Operacional
-- Jose Luis Martins — CTA Operacional
