alter table orders enable row level security;
alter table order_items enable row level security;
alter table kds_tickets enable row level security;
alter table payments enable row level security;
alter table products enable row level security;
alter table categories enable row level security;
alter table stations enable row level security;
alter table units enable row level security;

drop policy if exists orders_select_all on orders;
drop policy if exists order_items_select_all on order_items;
drop policy if exists kds_tickets_select_all on kds_tickets;

create policy orders_select_all on orders for select to authenticated using (true);
create policy order_items_select_all on order_items for select to authenticated using (true);
create policy kds_tickets_select_all on kds_tickets for select to authenticated using (true);
