-- Roll back/disable the app calling this RPC first.
begin;
set local lock_timeout='3s';
set local statement_timeout='15s';
drop function public.sigo_open_shift_with_staff_v1(text,date,timestamptz,text,uuid[],text[]);
commit;
