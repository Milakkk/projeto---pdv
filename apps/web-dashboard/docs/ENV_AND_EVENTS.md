Env
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- LAN_SYNC_SECRET

Eventos
- order:create → orders + order_items
- kds:enqueue → kds_tickets(status=queued)
- kds:set-status → kds_tickets(status=prep|ready|done) e atualização de orders.status
- payment:add → payments
