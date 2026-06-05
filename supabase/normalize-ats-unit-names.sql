-- Uniformização dos nomes visíveis das unidades ATS segundo o AIP
--
-- Correr este script no SQL Editor do Supabase para alinhar os nomes já existentes.

update public.ats_units
set name = 'SAN VICENTE TWR'
where code in ('AICE', 'AICE_TWR', 'TWR_AICE');

update public.ats_units
set name = 'PRAIA TOWER'
where code = 'TWR_AIPNM';

update public.ats_units
set name = 'AMILCABRAL TOWER'
where code = 'TWR_SAL';

update public.ats_units
set name = 'BOAVISTA TWR'
where code = 'TWR_BVC';

update public.ats_units
set name = 'SAL CONTROL'
where code = 'ACC_SAL';
