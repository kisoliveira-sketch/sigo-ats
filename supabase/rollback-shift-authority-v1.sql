begin;
set local lock_timeout = '3s';
set local statement_timeout = '15s';
drop trigger if exists zz_sigo_permissions on public.shift_position_logs;
drop trigger if exists zz_sigo_permissions on public.occurrences;
drop trigger if exists zz_sigo_staff on public.shift_staff;
drop trigger if exists zz_sigo_snapshot on public.shifts;
drop function if exists public.sigo_open_shift_with_staff_v2(text,date,timestamptz,text,uuid[],text[]);
drop function if exists public.sigo_shift_permissions_v1(bigint);
drop function if exists sigo_lifecycle_private.guard_child_permission();
drop function if exists sigo_lifecycle_private.guard_shift_staff_authority();
drop function if exists sigo_lifecycle_private.guard_roster_snapshot();
drop function if exists sigo_lifecycle_private.shift_authority(bigint);
drop function if exists sigo_lifecycle_private.roster_matches(bigint,bigint,jsonb);
-- Preserve snapshots on existing shifts for audit/retry; rollback must not discard saved IDs.
commit;
