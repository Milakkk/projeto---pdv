-- RH Module: tables and RLS policies
-- Note: expects existing table public.user_units (user_id, unit_id, role)

create extension if not exists pgcrypto;

create table if not exists public.people (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null,
  full_name text not null,
  email text,
  phone text,
  document_id text,
  role_title text,
  weekly_hours int,
  status text not null default 'active',
  updated_at timestamptz not null default now()
);

create table if not exists public.people_units (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  unit_id uuid not null,
  role_title text,
  weekly_hours int,
  updated_at timestamptz not null default now(),
  unique (person_id, unit_id)
);

create table if not exists public.shift_templates (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null,
  name text not null,
  start_time text,
  end_time text,
  updated_at timestamptz not null default now()
);

create table if not exists public.schedules (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null,
  person_id uuid not null references public.people(id) on delete cascade,
  date date not null,
  label text,
  start_time text,
  end_time text,
  status text not null default 'scheduled',
  updated_at timestamptz not null default now()
);

create table if not exists public.holidays (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null,
  date date not null,
  name text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.person_users (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  user_id uuid not null,
  updated_at timestamptz not null default now(),
  unique (person_id, user_id)
);

-- RLS policies (examples)
alter table public.people enable row level security;
alter table public.people_units enable row level security;
alter table public.shift_templates enable row level security;
alter table public.schedules enable row level security;
alter table public.holidays enable row level security;
alter table public.person_users enable row level security;

-- Read: users can read rows for units they belong to
create policy people_read
  on public.people
  for select
  using (exists (select 1 from public.user_units uu where uu.user_id = auth.uid() and uu.unit_id = people.unit_id));

create policy people_units_read
  on public.people_units
  for select
  using (exists (select 1 from public.user_units uu where uu.user_id = auth.uid() and uu.unit_id = people_units.unit_id));

create policy schedules_read
  on public.schedules
  for select
  using (exists (select 1 from public.user_units uu where uu.user_id = auth.uid() and uu.unit_id = schedules.unit_id));

create policy holidays_read
  on public.holidays
  for select
  using (exists (select 1 from public.user_units uu where uu.user_id = auth.uid() and uu.unit_id = holidays.unit_id));

create policy shift_templates_read
  on public.shift_templates
  for select
  using (exists (select 1 from public.user_units uu where uu.user_id = auth.uid() and uu.unit_id = shift_templates.unit_id));

create policy person_users_read
  on public.person_users
  for select
  using (exists (
    select 1 from public.user_units uu
    where uu.user_id = auth.uid()
      and exists (
        select 1 from public.people p
        where p.id = person_users.person_id
          and p.unit_id = uu.unit_id
      )
  ));

-- Write policies (restricted to owner|manager|hr_manager roles)
create policy people_write
  on public.people
  for insert
  with check (exists (select 1 from public.user_units uu where uu.user_id = auth.uid() and uu.unit_id = people.unit_id and uu.role in ('owner','manager','hr_manager')));

create policy people_update
  on public.people
  for update
  using (exists (select 1 from public.user_units uu where uu.user_id = auth.uid() and uu.unit_id = people.unit_id and uu.role in ('owner','manager','hr_manager')));

create policy schedules_write
  on public.schedules
  for insert
  with check (exists (select 1 from public.user_units uu where uu.user_id = auth.uid() and uu.unit_id = schedules.unit_id and uu.role in ('owner','manager','hr_manager')));

create policy schedules_update
  on public.schedules
  for update
  using (exists (select 1 from public.user_units uu where uu.user_id = auth.uid() and uu.unit_id = schedules.unit_id and uu.role in ('owner','manager','hr_manager')));

-- Additional write policies can be added similarly for other tables.

