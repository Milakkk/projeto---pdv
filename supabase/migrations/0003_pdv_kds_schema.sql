-- ============================================
-- SCHEMA PRINCIPAL DO PDV/KDS
-- Execute este script no SQL Editor do Supabase
-- ============================================

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- TABELAS PRINCIPAIS
-- ============================================

-- Unidades (Lojas)
CREATE TABLE IF NOT EXISTS public.units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Estações
CREATE TABLE IF NOT EXISTS public.stations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID REFERENCES public.units(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(unit_id, name)
);

-- Cozinhas
CREATE TABLE IF NOT EXISTS public.kitchens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  unit_id UUID REFERENCES public.units(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  version INTEGER NOT NULL DEFAULT 1,
  pending_sync BOOLEAN NOT NULL DEFAULT false
);

-- Categorias
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  unit_id UUID REFERENCES public.units(id) ON DELETE SET NULL,
  default_station TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  version INTEGER NOT NULL DEFAULT 1,
  pending_sync BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(name)
);

-- Associação Categoria-Cozinha
CREATE TABLE IF NOT EXISTS public.category_kitchens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  kitchen_id UUID NOT NULL REFERENCES public.kitchens(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(category_id, kitchen_id)
);

-- Produtos
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT,
  name TEXT NOT NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  unit_id UUID REFERENCES public.units(id) ON DELETE SET NULL,
  price_cents INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  version INTEGER NOT NULL DEFAULT 1,
  pending_sync BOOLEAN NOT NULL DEFAULT false
);

-- Operadores de Cozinha
CREATE TABLE IF NOT EXISTS public.kitchen_operators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  role TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  version INTEGER NOT NULL DEFAULT 1,
  pending_sync BOOLEAN NOT NULL DEFAULT false
);

-- Pedidos
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pin INTEGER NOT NULL,
  password INTEGER NOT NULL,
  unit_id UUID REFERENCES public.units(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'NEW',
  total_cents INTEGER NOT NULL DEFAULT 0,
  discount_percent INTEGER NOT NULL DEFAULT 0,
  discount_cents INTEGER NOT NULL DEFAULT 0,
  observations TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  delivery_location TEXT,
  delivery_photo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1,
  pending_sync BOOLEAN NOT NULL DEFAULT false
);

-- Itens do Pedido
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL DEFAULT 0,
  observations TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  version INTEGER NOT NULL DEFAULT 1,
  pending_sync BOOLEAN NOT NULL DEFAULT false
);

-- Pagamentos
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  method TEXT NOT NULL,
  amount_cents INTEGER NOT NULL DEFAULT 0,
  change_cents INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  version INTEGER NOT NULL DEFAULT 1,
  pending_sync BOOLEAN NOT NULL DEFAULT false
);

-- Tickets KDS
CREATE TABLE IF NOT EXISTS public.kds_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  kitchen_id UUID REFERENCES public.kitchens(id) ON DELETE SET NULL,
  operator_id UUID REFERENCES public.kitchen_operators(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'NEW',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  version INTEGER NOT NULL DEFAULT 1,
  pending_sync BOOLEAN NOT NULL DEFAULT false
);

-- Estados de Unidades KDS
CREATE TABLE IF NOT EXISTS public.kds_unit_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.kds_tickets(id) ON DELETE CASCADE,
  order_item_id UUID NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'PENDING',
  operator_id UUID REFERENCES public.kitchen_operators(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  version INTEGER NOT NULL DEFAULT 1,
  pending_sync BOOLEAN NOT NULL DEFAULT false
);

-- Tempos de Fases KDS
CREATE TABLE IF NOT EXISTS public.kds_phase_times (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.kds_tickets(id) ON DELETE CASCADE,
  phase TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  version INTEGER NOT NULL DEFAULT 1,
  pending_sync BOOLEAN NOT NULL DEFAULT false
);

-- Sessões de Caixa
CREATE TABLE IF NOT EXISTS public.cash_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID REFERENCES public.units(id) ON DELETE SET NULL,
  operator_id UUID,
  operator_name TEXT,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  initial_amount_cents INTEGER NOT NULL DEFAULT 0,
  final_amount_cents INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  version INTEGER NOT NULL DEFAULT 1,
  pending_sync BOOLEAN NOT NULL DEFAULT false
);

-- Movimentos de Caixa
CREATE TABLE IF NOT EXISTS public.cash_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.cash_sessions(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  amount_cents INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  version INTEGER NOT NULL DEFAULT 1,
  pending_sync BOOLEAN NOT NULL DEFAULT false
);

-- Pedidos Completos (Histórico)
CREATE TABLE IF NOT EXISTS public.orders_complete (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  pin INTEGER NOT NULL,
  password INTEGER NOT NULL,
  unit_id UUID,
  status TEXT NOT NULL,
  total_cents INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1,
  pending_sync BOOLEAN NOT NULL DEFAULT false
);

-- Detalhes de Pedidos
CREATE TABLE IF NOT EXISTS public.orders_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  version INTEGER NOT NULL DEFAULT 1,
  pending_sync BOOLEAN NOT NULL DEFAULT false
);

-- Carrinhos Salvos
CREATE TABLE IF NOT EXISTS public.saved_carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID REFERENCES public.units(id) ON DELETE SET NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  version INTEGER NOT NULL DEFAULT 1,
  pending_sync BOOLEAN NOT NULL DEFAULT false
);

-- Insumos (Ingredientes)
CREATE TABLE IF NOT EXISTS public.ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  out_of_stock BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Preços de Insumos
CREATE TABLE IF NOT EXISTS public.ingredient_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_id UUID NOT NULL REFERENCES public.ingredients(id) ON DELETE CASCADE,
  unit TEXT NOT NULL,
  price_per_unit_cents INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(ingredient_id, unit)
);

-- Histórico de Preços
CREATE TABLE IF NOT EXISTS public.ingredient_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_id UUID NOT NULL REFERENCES public.ingredients(id) ON DELETE CASCADE,
  unit TEXT NOT NULL,
  old_price_cents INTEGER NOT NULL,
  new_price_cents INTEGER NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Receitas (Fichas Técnicas)
CREATE TABLE IF NOT EXISTS public.recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES public.ingredients(id) ON DELETE CASCADE,
  quantity DECIMAL(10, 2) NOT NULL DEFAULT 0,
  unit TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(product_id, ingredient_id)
);

-- Configurações Globais
CREATE TABLE IF NOT EXISTS public.app_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Observações Globais
CREATE TABLE IF NOT EXISTS public.global_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  text TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  version INTEGER NOT NULL DEFAULT 1,
  pending_sync BOOLEAN NOT NULL DEFAULT false
);

-- Sessões Operacionais
CREATE TABLE IF NOT EXISTS public.operational_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kitchen_id UUID REFERENCES public.kitchens(id) ON DELETE SET NULL,
  operator_id UUID REFERENCES public.kitchen_operators(id) ON DELETE SET NULL,
  operator_name TEXT,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  version INTEGER NOT NULL DEFAULT 1,
  pending_sync BOOLEAN NOT NULL DEFAULT false
);

-- Contadores
CREATE TABLE IF NOT EXISTS public.counters (
  key TEXT PRIMARY KEY,
  value INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- ÍNDICES PARA PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_kds_tickets_kitchen_id ON public.kds_tickets(kitchen_id);
CREATE INDEX IF NOT EXISTS idx_kds_tickets_status ON public.kds_tickets(status);
CREATE INDEX IF NOT EXISTS idx_kds_unit_states_ticket_id ON public.kds_unit_states(ticket_id);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_unit_id ON public.cash_sessions(unit_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_categories_unit_id ON public.categories(unit_id);
CREATE INDEX IF NOT EXISTS idx_pending_sync ON public.orders(pending_sync) WHERE pending_sync = true;

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kitchens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_kitchens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kitchen_operators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kds_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kds_unit_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kds_phase_times ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders_complete ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingredient_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingredient_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.global_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operational_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.counters ENABLE ROW LEVEL SECURITY;

-- Políticas: Permitir todas as operações para usuários autenticados
-- (Ajuste conforme sua necessidade de segurança)

-- Remove políticas existentes antes de criar (para permitir re-execução)
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Enable read access for all users" ON public.%I', r.tablename);
        EXECUTE format('DROP POLICY IF EXISTS "Enable insert for all users" ON public.%I', r.tablename);
        EXECUTE format('DROP POLICY IF EXISTS "Enable update for all users" ON public.%I', r.tablename);
        EXECUTE format('DROP POLICY IF EXISTS "Enable delete for all users" ON public.%I', r.tablename);
    END LOOP;
END $$;

-- Política para leitura pública (temporária - ajuste conforme necessário)
CREATE POLICY "Enable read access for all users" ON public.units FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON public.stations FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON public.kitchens FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON public.category_kitchens FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON public.products FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON public.kitchen_operators FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON public.orders FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON public.order_items FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON public.payments FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON public.kds_tickets FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON public.kds_unit_states FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON public.kds_phase_times FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON public.cash_sessions FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON public.cash_movements FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON public.orders_complete FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON public.orders_details FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON public.saved_carts FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON public.ingredients FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON public.ingredient_prices FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON public.ingredient_price_history FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON public.recipes FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON public.app_config FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON public.global_observations FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON public.operational_sessions FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON public.counters FOR SELECT USING (true);

-- Política para escrita pública (temporária - ajuste conforme sua necessidade de segurança)
CREATE POLICY "Enable insert for all users" ON public.units FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable insert for all users" ON public.stations FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable insert for all users" ON public.kitchens FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable insert for all users" ON public.categories FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable insert for all users" ON public.category_kitchens FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable insert for all users" ON public.products FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable insert for all users" ON public.kitchen_operators FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable insert for all users" ON public.orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable insert for all users" ON public.order_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable insert for all users" ON public.payments FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable insert for all users" ON public.kds_tickets FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable insert for all users" ON public.kds_unit_states FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable insert for all users" ON public.kds_phase_times FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable insert for all users" ON public.cash_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable insert for all users" ON public.cash_movements FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable insert for all users" ON public.orders_complete FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable insert for all users" ON public.orders_details FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable insert for all users" ON public.saved_carts FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable insert for all users" ON public.ingredients FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable insert for all users" ON public.ingredient_prices FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable insert for all users" ON public.ingredient_price_history FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable insert for all users" ON public.recipes FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable insert for all users" ON public.app_config FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable insert for all users" ON public.global_observations FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable insert for all users" ON public.operational_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable insert for all users" ON public.counters FOR INSERT WITH CHECK (true);

-- Política para atualização pública
CREATE POLICY "Enable update for all users" ON public.units FOR UPDATE USING (true);
CREATE POLICY "Enable update for all users" ON public.stations FOR UPDATE USING (true);
CREATE POLICY "Enable update for all users" ON public.kitchens FOR UPDATE USING (true);
CREATE POLICY "Enable update for all users" ON public.categories FOR UPDATE USING (true);
CREATE POLICY "Enable update for all users" ON public.category_kitchens FOR UPDATE USING (true);
CREATE POLICY "Enable update for all users" ON public.products FOR UPDATE USING (true);
CREATE POLICY "Enable update for all users" ON public.kitchen_operators FOR UPDATE USING (true);
CREATE POLICY "Enable update for all users" ON public.orders FOR UPDATE USING (true);
CREATE POLICY "Enable update for all users" ON public.order_items FOR UPDATE USING (true);
CREATE POLICY "Enable update for all users" ON public.payments FOR UPDATE USING (true);
CREATE POLICY "Enable update for all users" ON public.kds_tickets FOR UPDATE USING (true);
CREATE POLICY "Enable update for all users" ON public.kds_unit_states FOR UPDATE USING (true);
CREATE POLICY "Enable update for all users" ON public.kds_phase_times FOR UPDATE USING (true);
CREATE POLICY "Enable update for all users" ON public.cash_sessions FOR UPDATE USING (true);
CREATE POLICY "Enable update for all users" ON public.cash_movements FOR UPDATE USING (true);
CREATE POLICY "Enable update for all users" ON public.orders_complete FOR UPDATE USING (true);
CREATE POLICY "Enable update for all users" ON public.orders_details FOR UPDATE USING (true);
CREATE POLICY "Enable update for all users" ON public.saved_carts FOR UPDATE USING (true);
CREATE POLICY "Enable update for all users" ON public.ingredients FOR UPDATE USING (true);
CREATE POLICY "Enable update for all users" ON public.ingredient_prices FOR UPDATE USING (true);
CREATE POLICY "Enable update for all users" ON public.ingredient_price_history FOR UPDATE USING (true);
CREATE POLICY "Enable update for all users" ON public.recipes FOR UPDATE USING (true);
CREATE POLICY "Enable update for all users" ON public.app_config FOR UPDATE USING (true);
CREATE POLICY "Enable update for all users" ON public.global_observations FOR UPDATE USING (true);
CREATE POLICY "Enable update for all users" ON public.operational_sessions FOR UPDATE USING (true);
CREATE POLICY "Enable update for all users" ON public.counters FOR UPDATE USING (true);

-- Política para deleção pública
CREATE POLICY "Enable delete for all users" ON public.units FOR DELETE USING (true);
CREATE POLICY "Enable delete for all users" ON public.stations FOR DELETE USING (true);
CREATE POLICY "Enable delete for all users" ON public.kitchens FOR DELETE USING (true);
CREATE POLICY "Enable delete for all users" ON public.categories FOR DELETE USING (true);
CREATE POLICY "Enable delete for all users" ON public.category_kitchens FOR DELETE USING (true);
CREATE POLICY "Enable delete for all users" ON public.products FOR DELETE USING (true);
CREATE POLICY "Enable delete for all users" ON public.kitchen_operators FOR DELETE USING (true);
CREATE POLICY "Enable delete for all users" ON public.orders FOR DELETE USING (true);
CREATE POLICY "Enable delete for all users" ON public.order_items FOR DELETE USING (true);
CREATE POLICY "Enable delete for all users" ON public.payments FOR DELETE USING (true);
CREATE POLICY "Enable delete for all users" ON public.kds_tickets FOR DELETE USING (true);
CREATE POLICY "Enable delete for all users" ON public.kds_unit_states FOR DELETE USING (true);
CREATE POLICY "Enable delete for all users" ON public.kds_phase_times FOR DELETE USING (true);
CREATE POLICY "Enable delete for all users" ON public.cash_sessions FOR DELETE USING (true);
CREATE POLICY "Enable delete for all users" ON public.cash_movements FOR DELETE USING (true);
CREATE POLICY "Enable delete for all users" ON public.orders_complete FOR DELETE USING (true);
CREATE POLICY "Enable delete for all users" ON public.orders_details FOR DELETE USING (true);
CREATE POLICY "Enable delete for all users" ON public.saved_carts FOR DELETE USING (true);
CREATE POLICY "Enable delete for all users" ON public.ingredients FOR DELETE USING (true);
CREATE POLICY "Enable delete for all users" ON public.ingredient_prices FOR DELETE USING (true);
CREATE POLICY "Enable delete for all users" ON public.ingredient_price_history FOR DELETE USING (true);
CREATE POLICY "Enable delete for all users" ON public.recipes FOR DELETE USING (true);
CREATE POLICY "Enable delete for all users" ON public.app_config FOR DELETE USING (true);
CREATE POLICY "Enable delete for all users" ON public.global_observations FOR DELETE USING (true);
CREATE POLICY "Enable delete for all users" ON public.operational_sessions FOR DELETE USING (true);
CREATE POLICY "Enable delete for all users" ON public.counters FOR DELETE USING (true);

-- ============================================
-- FUNÇÕES ÚTEIS
-- ============================================

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para atualizar updated_at
CREATE TRIGGER update_units_updated_at BEFORE UPDATE ON public.units FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_stations_updated_at BEFORE UPDATE ON public.stations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_kitchens_updated_at BEFORE UPDATE ON public.kitchens FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_order_items_updated_at BEFORE UPDATE ON public.order_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_kds_tickets_updated_at BEFORE UPDATE ON public.kds_tickets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_kds_unit_states_updated_at BEFORE UPDATE ON public.kds_unit_states FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_cash_sessions_updated_at BEFORE UPDATE ON public.cash_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orders_details_updated_at BEFORE UPDATE ON public.orders_details FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_saved_carts_updated_at BEFORE UPDATE ON public.saved_carts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_operational_sessions_updated_at BEFORE UPDATE ON public.operational_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- DADOS INICIAIS
-- ============================================

-- Inserir unidade padrão
INSERT INTO public.units (id, name, is_active) 
VALUES ('00000000-0000-0000-0000-000000000001', 'Matriz', true)
ON CONFLICT (id) DO NOTHING;

-- Inserir contadores iniciais
INSERT INTO public.counters (key, value) 
VALUES ('orderCounter', 1), ('passwordCounter', 1)
ON CONFLICT (key) DO NOTHING;

-- Inserir configuração padrão
INSERT INTO public.app_config (key, value) 
VALUES ('maxKitchens', '10'::jsonb)
ON CONFLICT (key) DO NOTHING;

