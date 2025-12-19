-- Script para zerar pedidos e vendas (mantendo configurações)
-- Execute este script no SQL Editor do Supabase

BEGIN;

-- Desabilitar triggers se necessário (opcional, mas seguro)
-- SET session_replication_role = 'replica';

-- Limpar tabelas de KDS (dependentes de orders/items)
TRUNCATE TABLE public.kds_unit_states CASCADE;
TRUNCATE TABLE public.kds_tickets CASCADE;
TRUNCATE TABLE public.kds_phase_times CASCADE;

-- Limpar tabelas de pagamentos e detalhes
TRUNCATE TABLE public.payments CASCADE;
TRUNCATE TABLE public.orders_details CASCADE;
TRUNCATE TABLE public.order_items CASCADE;

-- Limpar tabelas principais de pedidos
TRUNCATE TABLE public.orders CASCADE;
TRUNCATE TABLE public.orders_complete CASCADE;

-- Limpar tabelas de caixa
TRUNCATE TABLE public.cash_movements CASCADE;
TRUNCATE TABLE public.cash_sessions CASCADE;

-- Limpar carrinhos salvos
TRUNCATE TABLE public.saved_carts CASCADE;

-- Opcional: Resetar sequências se houver (ex: pin)
-- ALTER SEQUENCE orders_pin_seq RESTART WITH 1; 

-- Reabilitar triggers
-- SET session_replication_role = 'origin';

COMMIT;

-- Verificação final
SELECT count(*) as orders_count FROM public.orders;
SELECT count(*) as kds_tickets_count FROM public.kds_tickets;
