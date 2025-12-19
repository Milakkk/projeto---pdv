-- ============================================
-- Migration 0004: Fix kds_phase_times table
-- Adiciona coluna order_id para queries diretas
-- Execute este script no SQL Editor do Supabase
-- ============================================

-- Adicionar coluna order_id (UUID) se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'kds_phase_times' 
        AND column_name = 'order_id'
    ) THEN
        ALTER TABLE public.kds_phase_times 
        ADD COLUMN order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Tornar ticket_id opcional (permitir NULL)
ALTER TABLE public.kds_phase_times 
ALTER COLUMN ticket_id DROP NOT NULL;

-- Criar índice para order_id (performance)
CREATE INDEX IF NOT EXISTS idx_kds_phase_times_order_id 
ON public.kds_phase_times(order_id);

-- Adicionar constraint UNIQUE em order_id para permitir upsert com onConflict
-- (Apenas se não houver duplicatas; se já houver duplicatas, limpar primeiro)
DO $$
BEGIN
    -- Primeiro, verificar se já existe a constraint
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'kds_phase_times_order_id_key'
    ) THEN
        -- Tentar criar; se falhar por duplicatas, usuário precisa limpar manualmente
        ALTER TABLE public.kds_phase_times 
        ADD CONSTRAINT kds_phase_times_order_id_key UNIQUE (order_id);
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Não foi possível criar constraint UNIQUE em order_id. Verifique se há duplicatas.';
END $$;

-- Adicionar coluna updated_at se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'kds_phase_times' 
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE public.kds_phase_times 
        ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
    END IF;
END $$;

-- Adicionar colunas de tempo faltantes (new_start, preparing_start, ready_at, delivered_at)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'kds_phase_times' 
        AND column_name = 'new_start'
    ) THEN
        ALTER TABLE public.kds_phase_times ADD COLUMN new_start TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'kds_phase_times' 
        AND column_name = 'preparing_start'
    ) THEN
        ALTER TABLE public.kds_phase_times ADD COLUMN preparing_start TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'kds_phase_times' 
        AND column_name = 'ready_at'
    ) THEN
        ALTER TABLE public.kds_phase_times ADD COLUMN ready_at TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'kds_phase_times' 
        AND column_name = 'delivered_at'
    ) THEN
        ALTER TABLE public.kds_phase_times ADD COLUMN delivered_at TIMESTAMPTZ;
    END IF;
END $$;

-- Comentário
COMMENT ON TABLE public.kds_phase_times IS 'Tempos de cada fase KDS por pedido. Pode usar order_id diretamente ou via ticket_id.';
