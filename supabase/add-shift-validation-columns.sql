alter table public.shifts
  add column if not exists validated_by uuid references public.profiles(id) on delete set null,
  add column if not exists validated_at_utc timestamptz;
