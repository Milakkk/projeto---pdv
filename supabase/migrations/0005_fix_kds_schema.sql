-- Migration 0005: Fix KDS schema issues (Phase Times 400 error & Persistent Operators)

-- 1. Fix kds_phase_times (400 Bad Request)
-- Make legacy columns nullable since we now use new_start, preparing_start etc.
ALTER TABLE public.kds_phase_times ALTER COLUMN phase DROP NOT NULL;
ALTER TABLE public.kds_phase_times ALTER COLUMN started_at DROP NOT NULL;

-- 2. Fix kds_unit_states (Persistent Operators & Split Units)
-- Add operator_name to store operator even if ID lookup fails
ALTER TABLE public.kds_unit_states ADD COLUMN IF NOT EXISTS operator_name TEXT;

-- Add production_unit_id (renamed from unit_id to avoid confusion with store unit_id)
ALTER TABLE public.kds_unit_states ADD COLUMN IF NOT EXISTS production_unit_id TEXT;

-- Add order_id to allow direct reference without ticket
ALTER TABLE public.kds_unit_states ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE;

-- Make ticket_id optional
ALTER TABLE public.kds_unit_states ALTER COLUMN ticket_id DROP NOT NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_kds_unit_states_order_id ON public.kds_unit_states(order_id);
CREATE INDEX IF NOT EXISTS idx_kds_unit_states_production_unit_id ON public.kds_unit_states(production_unit_id);
