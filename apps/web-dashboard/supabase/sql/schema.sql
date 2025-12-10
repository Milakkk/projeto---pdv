create table if not exists units (
  id uuid primary key,
  name text not null,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists stations (
  id uuid primary key,
  unit_id uuid references units(id) on delete cascade,
  name text not null,
  is_active boolean default true,
  updated_at timestamptz default now()
);

create table if not exists categories (
  id uuid primary key,
  unit_id uuid references units(id) on delete cascade,
  name text not null,
  default_station uuid references stations(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists products (
  id uuid primary key,
  unit_id uuid references units(id) on delete cascade,
  category_id uuid references categories(id),
  name text not null,
  price_cents integer not null,
  skip_kitchen boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create type order_status as enum ('NEW','PREPARING','READY','DELIVERED','CANCELLED');

create table if not exists orders (
  id uuid primary key,
  unit_id uuid references units(id) on delete cascade,
  status order_status default 'NEW',
  opened_at timestamptz default now(),
  closed_at timestamptz,
  updated_at timestamptz default now(),
  version integer default 1
);

create table if not exists order_items (
  id uuid primary key,
  order_id uuid references orders(id) on delete cascade,
  product_id uuid references products(id),
  qty integer not null,
  unit_price_cents integer not null,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  version integer default 1
);

create type kds_status as enum ('queued','prep','ready','done');

create table if not exists kds_tickets (
  id uuid primary key,
  order_id uuid references orders(id) on delete cascade,
  unit_id uuid references units(id) on delete cascade,
  station_id uuid references stations(id),
  status kds_status default 'queued',
  queued_at timestamptz default now(),
  prep_at timestamptz,
  ready_at timestamptz,
  done_at timestamptz,
  updated_at timestamptz default now(),
  version integer default 1
);

create type payment_method as enum ('cash','pix','debit','credit','voucher');

create table if not exists payments (
  id uuid primary key,
  order_id uuid references orders(id) on delete cascade,
  method payment_method not null,
  amount_cents integer not null,
  change_cents integer default 0,
  auth_code text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  version integer default 1
);

create table if not exists cash_sessions (
  id uuid primary key,
  unit_id uuid references units(id) on delete cascade,
  opened_at timestamptz default now(),
  closed_at timestamptz,
  status text default 'open',
  initial_amount_cents integer default 0,
  final_amount_cents integer
);

create table if not exists cash_movements (
  id uuid primary key,
  session_id uuid references cash_sessions(id) on delete cascade,
  type text not null,
  reason text,
  amount_cents integer not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create or replace function bump_version()
returns trigger as $$
begin
  new.version = coalesce(old.version, 1) + 1;
  return new;
end;
$$ language plpgsql;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'orders_set_updated_at') then
    create trigger orders_set_updated_at before update on orders for each row execute function set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'orders_bump_version') then
    create trigger orders_bump_version before update on orders for each row execute function bump_version();
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'order_items_set_updated_at') then
    create trigger order_items_set_updated_at before update on order_items for each row execute function set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'order_items_bump_version') then
    create trigger order_items_bump_version before update on order_items for each row execute function bump_version();
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'kds_tickets_set_updated_at') then
    create trigger kds_tickets_set_updated_at before update on kds_tickets for each row execute function set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'kds_tickets_bump_version') then
    create trigger kds_tickets_bump_version before update on kds_tickets for each row execute function bump_version();
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'payments_set_updated_at') then
    create trigger payments_set_updated_at before update on payments for each row execute function set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'payments_bump_version') then
    create trigger payments_bump_version before update on payments for each row execute function bump_version();
  end if;
end $$;

alter publication supabase_realtime add table orders;
alter publication supabase_realtime add table order_items;
alter publication supabase_realtime add table kds_tickets;
alter publication supabase_realtime add table payments;
