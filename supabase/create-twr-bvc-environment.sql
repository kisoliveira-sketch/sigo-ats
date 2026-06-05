-- TWR BVC · Setup base do ambiente
--
-- 1. Este script cria/atualiza a unidade ATS.
-- 2. Os utilizadores podem ser associados depois, quando já existirem em auth.users.
--
do $$
declare
  target_ats_unit_id bigint;
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
        values ('Boa Vista TWR', 'TWR_BVC', %L::%I.%I)
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
    values ('Boa Vista TWR', 'TWR_BVC', target_unit_type)
    on conflict (code) do update
    set
      name = excluded.name,
      unit_type = excluded.unit_type;
  end if;

  select id
  into target_ats_unit_id
  from public.ats_units
  where code = 'TWR_BVC'
  limit 1;

  if target_ats_unit_id is null then
    raise exception 'ATS unit with code % was not found.', 'TWR_BVC';
  end if;
end $$;

-- Horários operacionais da TWR BVC (UTC)
-- 08:00 - 13:00
-- 13:00 - 19:00

-- Nota
-- Este script cria apenas o ambiente base.
-- Os utilizadores podem ser associados mais tarde via painel admin ou SQL dedicado.
