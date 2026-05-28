-- ACC SAL · Setup base do ambiente
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
            'ACC',
            'acc',
            'AREA_CONTROL_CENTER',
            'area_control_center',
            'CONTROL_CENTER',
            'control_center'
          )
        order by case enumlabel
          when 'ACC' then 1
          when 'acc' then 2
          when 'AREA_CONTROL_CENTER' then 3
          when 'area_control_center' then 4
          when 'CONTROL_CENTER' then 5
          when 'control_center' then 6
          else 99
        end
        limit 1
      $sql$,
      format('%I.%I', unit_type_udt_schema, unit_type_udt_name)
    )
    into target_unit_type;
  else
    target_unit_type := 'ACC';
  end if;

  if target_unit_type is null then
    raise exception
      'No supported ACC value was found for public.ats_units.unit_type. Check the column type/enum values first.';
  end if;

  if unit_type_data_type = 'USER-DEFINED' then
    execute format(
      $sql$
        insert into public.ats_units (name, code, unit_type)
        values ('ACC Sal', 'ACC_SAL', %L::%I.%I)
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
    values ('ACC Sal', 'ACC_SAL', target_unit_type)
    on conflict (code) do update
    set
      name = excluded.name,
      unit_type = excluded.unit_type;
  end if;

  select id
  into target_ats_unit_id
  from public.ats_units
  where code = 'ACC_SAL'
  limit 1;

  if target_ats_unit_id is null then
    raise exception 'ATS unit with code % was not found.', 'ACC_SAL';
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
          when 'neusa.cardoso@asa.cv' then 'Neusa Cardoso'
          when 'belmira.santos@asa.cv' then 'Belmira dos Santos'
          when 'marius.anjos@asa.cv' then 'Marius dos Anjos'
          when 'carlos.modesto@asa.cv' then 'Carlos Modesto'
          when 'elio.barros@asa.cv' then 'Elio Barros'
          when 'francisco.ramos@asa.cv' then 'Francisco Ramos'
          when 'claudio.barros@asa.cv' then 'Claudio Barros'
          when 'valnir.morais@asa.cv' then 'Valnir Morais'
          else split_part(auth_user.email, '@', 1)
        end as full_name,
        auth_user.email,
        %L::public.user_role,
        %s
      from auth.users as auth_user
      where auth_user.email in (
        'neusa.cardoso@asa.cv',
        'belmira.santos@asa.cv',
        'marius.anjos@asa.cv',
        'carlos.modesto@asa.cv',
        'elio.barros@asa.cv',
        'francisco.ramos@asa.cv',
        'claudio.barros@asa.cv',
        'valnir.morais@asa.cv'
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

-- Composição de referência · Turno 1
-- Supervisor: Neusa Cardoso
-- CTA Operacional: Belmira dos Santos
-- CTA Operacional: Marius dos Anjos
-- CTA OJT: Carlos Modesto

-- Composição de referência · Turno 2
-- Supervisor: Elio Barros
-- CTA Operacional: Francisco Ramos
-- CTA Operacional: Claudio Barros
-- CTA OJT: Valnir Morais

-- Horários operacionais do ACC Sal
-- 07:30 - 13:30
-- 13:30 - 19:30
-- 19:30 - 23:30
-- 23:30 - 07:30
