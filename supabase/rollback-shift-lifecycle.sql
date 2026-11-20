-- SIGO-ATS point 2 rollback. No data, policies, or duplicate indexes are changed.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '15s';
drop trigger if exists z_sigo_lifecycle_position on public.shift_position_logs;
drop trigger if exists z_sigo_lifecycle_occurrence on public.occurrences;
drop trigger if exists z_sigo_lifecycle_shift_insert on public.shifts;
drop trigger if exists z_sigo_lifecycle_shift_update on public.shifts;
drop function if exists sigo_lifecycle_private.guard_child_write();
drop function if exists sigo_lifecycle_private.guard_shift_insert();
drop function if exists sigo_lifecycle_private.guard_shift_update();
drop schema if exists sigo_lifecycle_private;
commit;
