-- Disposable cluster only, never against a deployed database.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated, service_role;
create table public.profiles (id uuid primary key, ats_unit_id bigint not null);
create table public.shifts (
  id bigint primary key, ats_unit_id bigint not null,
  opened_by uuid references public.profiles on delete set null,
  validated_by uuid references public.profiles on delete set null,
  validated_at_utc timestamptz, status text not null default 'OPEN',
  end_time_utc timestamptz, handover_notes text, opening_notes text
);
create table public.occurrences (
  id bigint primary key, shift_id bigint not null references public.shifts on delete cascade,
  ats_unit_id bigint not null, created_by uuid references public.profiles on delete set null, note text
);
create table public.shift_position_logs (
  id bigint primary key, shift_id bigint not null references public.shifts on delete cascade,
  ats_unit_id bigint not null, user_id uuid not null,
  recorded_by uuid references public.profiles on delete set null, left_at_utc timestamptz
);
create unique index shift_position_logs_one_active_per_shift_cta
  on public.shift_position_logs(shift_id,user_id) where left_at_utc is null;
insert into public.profiles values
  ('00000000-0000-0000-0000-000000000001', 1), ('00000000-0000-0000-0000-000000000002', 1),
  ('00000000-0000-0000-0000-000000000003', 2), ('00000000-0000-0000-0000-000000000004', 1);
insert into public.shifts(id,ats_unit_id,opened_by)
select id,1,'00000000-0000-0000-0000-000000000001'::uuid from generate_series(1,20) id;
insert into public.shifts(id,ats_unit_id,opened_by) values
  (99,2,'00000000-0000-0000-0000-000000000003');
grant select,insert,update,delete on public.shifts, public.occurrences,
  public.shift_position_logs to authenticated, service_role;
grant select on public.profiles to authenticated;
alter table public.shifts enable row level security;
alter table public.occurrences enable row level security;
alter table public.shift_position_logs enable row level security;
-- RLS deliberately hides other actors' children, and allows UPDATE on the
-- parent so that opener/tenant checks exercised below come from the migration.
create policy shifts_fixture_member on public.shifts to authenticated using (true) with check(true);
create policy occ_fixture_read on public.occurrences for select to authenticated using (created_by = auth.uid());
create policy occ_fixture_write on public.occurrences for insert to authenticated with check (created_by = auth.uid());
create policy occ_fixture_update on public.occurrences for update to authenticated using (created_by = auth.uid());
create policy occ_fixture_delete on public.occurrences for delete to authenticated using (created_by = auth.uid());
create policy pos_fixture_read on public.shift_position_logs for select to authenticated using (recorded_by = auth.uid());
create policy pos_fixture_write on public.shift_position_logs for insert to authenticated with check (recorded_by = auth.uid());
create policy pos_fixture_update on public.shift_position_logs for update to authenticated using (recorded_by = auth.uid());
create policy pos_fixture_delete on public.shift_position_logs for delete to authenticated using (recorded_by = auth.uid());
