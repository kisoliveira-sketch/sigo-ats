-- Renomear o código legado AICE_TWR para o padrão uniforme TWR_AICE
--
-- Correr este script no SQL Editor do Supabase, se a unidade ainda existir com o código antigo.

update public.ats_units
set code = 'TWR_AICE'
where code = 'AICE_TWR'
  and not exists (
    select 1
    from public.ats_units
    where code = 'TWR_AICE'
  );
