-- ============================================
-- EXECUTE ESTE SCRIPT NO SQL EDITOR DO SUPABASE
-- Data: 2025-12-21
-- Descrição: Corrige tabela kds_phase_times e kds_unit_states
-- ============================================

-- ========== KDS_PHASE_TIMES ==========

-- 1. Adicionar coluna order_id (permite query direta por pedido)
ALTER TABLE public.kds_phase_times 
ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE;

-- 2. Adicionar colunas individuais de tempo (código usa essas ao invés de phase+started_at)
ALTER TABLE public.kds_phase_times ADD COLUMN IF NOT EXISTS new_start TIMESTAMPTZ;
ALTER TABLE public.kds_phase_times ADD COLUMN IF NOT EXISTS preparing_start TIMESTAMPTZ;
ALTER TABLE public.kds_phase_times ADD COLUMN IF NOT EXISTS ready_at TIMESTAMPTZ;
ALTER TABLE public.kds_phase_times ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
ALTER TABLE public.kds_phase_times ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 3. Tornar colunas antigas opcionais (ticket_id, phase, started_at)
ALTER TABLE public.kds_phase_times ALTER COLUMN ticket_id DROP NOT NULL;
ALTER TABLE public.kds_phase_times ALTER COLUMN phase DROP NOT NULL;
ALTER TABLE public.kds_phase_times ALTER COLUMN started_at DROP NOT NULL;

-- 4. Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_kds_phase_times_order_id ON public.kds_phase_times(order_id);

-- 5. Adicionar constraint UNIQUE para upsert (ignora erro se já existe)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'kds_phase_times_order_id_key'
    ) THEN
        -- Remove duplicatas antes de criar constraint (mantém mais recente)
        DELETE FROM public.kds_phase_times a
        USING public.kds_phase_times b
        WHERE a.order_id = b.order_id 
          AND a.order_id IS NOT NULL
          AND a.id < b.id;
        
        ALTER TABLE public.kds_phase_times 
        ADD CONSTRAINT kds_phase_times_order_id_key UNIQUE (order_id);
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Constraint já existe ou há duplicatas - continuando...';
END $$;

-- ========== KDS_UNIT_STATES ==========

-- 1. Adicionar operator_name (salva nome mesmo se operator_id falhar)
ALTER TABLE public.kds_unit_states ADD COLUMN IF NOT EXISTS operator_name TEXT;

-- 2. Adicionar production_unit_id (ID da unidade de produção)
ALTER TABLE public.kds_unit_states ADD COLUMN IF NOT EXISTS production_unit_id TEXT;

-- 3. Adicionar order_id para referência direta
ALTER TABLE public.kds_unit_states ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE;

-- 4. Tornar ticket_id opcional
ALTER TABLE public.kds_unit_states ALTER COLUMN ticket_id DROP NOT NULL;

-- 5. Criar índices
CREATE INDEX IF NOT EXISTS idx_kds_unit_states_order_id ON public.kds_unit_states(order_id);
CREATE INDEX IF NOT EXISTS idx_kds_unit_states_production_unit_id ON public.kds_unit_states(production_unit_id);

-- ========== KDS_TICKETS ==========

-- 1. Adicionar acknowledged_at para evitar reprocessamento
ALTER TABLE public.kds_tickets ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ;

-- ========== ORDER_ITEMS ==========

-- 1. Adicionar category_id para referência direta (evita "Sem Categoria")
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL;

-- ============================================
-- VERIFICAÇÃO
-- ============================================

-- Execute esta query para verificar se as colunas foram criadas:
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'kds_phase_times' 
-- ORDER BY ordinal_position;

-- ============================================
-- FIM DO SCRIPT
-- ============================================
