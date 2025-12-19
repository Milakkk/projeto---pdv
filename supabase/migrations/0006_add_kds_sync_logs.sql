-- Migration 0006: Add KDS sync logs and acknowledged_at
-- This aligns the Supabase schema with the local SQLite schema for KDS tracking.

-- 1. Add acknowledged_at to kds_tickets
ALTER TABLE public.kds_tickets ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ;

-- 2. Create kds_sync_logs table
CREATE TABLE IF NOT EXISTS public.kds_sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID REFERENCES public.kds_tickets(id) ON DELETE CASCADE,
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL, -- 'RECEIVED', 'SYNC_DELAY', etc.
    latency_ms INTEGER,
    payload TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Enable RLS
ALTER TABLE public.kds_sync_logs ENABLE ROW LEVEL SECURITY;

-- 4. Create permissive policies for kds_sync_logs (consistent with existing schema)
CREATE POLICY "Enable read access for all users" ON public.kds_sync_logs FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON public.kds_sync_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON public.kds_sync_logs FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON public.kds_sync_logs FOR DELETE USING (true);

-- 5. Add index for performance
CREATE INDEX IF NOT EXISTS idx_kds_sync_logs_ticket_id ON public.kds_sync_logs(ticket_id);
CREATE INDEX IF NOT EXISTS idx_kds_sync_logs_order_id ON public.kds_sync_logs(order_id);
