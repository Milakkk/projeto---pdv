create extension if not exists pgcrypto;

create table if not exists public.checklist_masters (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null,
  name text not null,
  description text,
  frequency text not null,
  assigned_roles text[] not null default '{}',
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references public.checklist_masters(id) on delete cascade,
  description text not null,
  required_photo boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.checklist_schedules (
  id uuid primary key default gen_random_uuid(),
  master_id uuid not null references public.checklist_masters(id) on delete cascade,
  unit_id uuid not null,
  role_ids text[] not null default '{}',
  frequency text not null,
  time_of_day text not null,
  days_of_week int[],
  day_of_month int,
  enabled boolean not null default true,
  last_triggered_at timestamptz
);

create table if not exists public.checklist_executions (
  id uuid primary key default gen_random_uuid(),
  master_id uuid not null references public.checklist_masters(id) on delete set null,
  unit_id uuid not null,
  name text not null,
  started_at timestamptz not null default now(),
  started_by uuid,
  status text not null default 'IN_PROGRESS',
  completed_at timestamptz,
  completion_percentage int not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.checklist_execution_items (
  id uuid primary key default gen_random_uuid(),
  execution_id uuid not null references public.checklist_executions(id) on delete cascade,
  item_id uuid not null references public.checklist_items(id) on delete set null,
  description text not null,
  required_photo boolean not null default false,
  is_completed boolean not null default false,
  completed_at timestamptz,
  completed_by uuid,
  photo_url text,
  notes text
);

alter table public.checklist_masters enable row level security;
alter table public.checklist_items enable row level security;
alter table public.checklist_schedules enable row level security;
alter table public.checklist_executions enable row level security;
alter table public.checklist_execution_items enable row level security;

create policy checklist_masters_read
  on public.checklist_masters
  for select
  using (exists (select 1 from public.user_units uu where uu.user_id = auth.uid() and uu.unit_id = checklist_masters.unit_id));

create policy checklist_items_read
  on public.checklist_items
  for select
  using (exists (
    select 1 from public.checklist_masters m
    join public.user_units uu on uu.unit_id = m.unit_id
    where uu.user_id = auth.uid() and m.id = checklist_items.checklist_id
  ));

create policy checklist_schedules_read
  on public.checklist_schedules
  for select
  using (exists (
    select 1 from public.checklist_masters m
    join public.user_units uu on uu.unit_id = m.unit_id
    where uu.user_id = auth.uid() and m.id = checklist_schedules.master_id
  ));

create policy checklist_executions_read
  on public.checklist_executions
  for select
  using (exists (select 1 from public.user_units uu where uu.user_id = auth.uid() and uu.unit_id = checklist_executions.unit_id));

create policy checklist_execution_items_read
  on public.checklist_execution_items
  for select
  using (exists (
    select 1 from public.checklist_executions e
    join public.user_units uu on uu.unit_id = e.unit_id
    where uu.user_id = auth.uid() and e.id = checklist_execution_items.execution_id
  ));

create policy checklist_executions_insert
  on public.checklist_executions
  for insert
  with check (exists (
    select 1 from public.checklist_masters m
    join public.user_units uu on uu.unit_id = m.unit_id
    where uu.user_id = auth.uid() and uu.role = any(m.assigned_roles) and m.id = checklist_executions.master_id
  ));

create policy checklist_execution_items_insert
  on public.checklist_execution_items
  for insert
  with check (exists (
    select 1 from public.checklist_executions e
    join public.user_units uu on uu.unit_id = e.unit_id
    where uu.user_id = auth.uid() and e.id = checklist_execution_items.execution_id
  ));

