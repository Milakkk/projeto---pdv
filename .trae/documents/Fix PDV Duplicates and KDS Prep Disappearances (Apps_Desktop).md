# Diagnóstico

**PDV (duplicados):**
- A desduplicação por `id` não resolve quando o banco tem múltiplos registros com **IDs diferentes** mas mesmo `name/sku` (efeito da migração antiga).
- Além disso, o Supabase está retornando `400` na query com `.eq('is_active', true)` (rota REST gera `is_active=eq.true`), indicando possível coluna inexistente para `categories` ou projeção incompatível.

**KDS (iniciar preparo some):**
- Em `apps/desktop/src/pages/cozinha/page.tsx` os tickets mapeados no navegador **não possuem itens** (o join via IPC/SQLite só funciona no Electron).
- Depois a lista final faz `filter(o => (o.items || []).length > 0)` — pedidos sem itens **são descartados** e “somem”.

# Correções Planejadas

## 1) PDV — Sincronização e Desduplicação
- Atualizar `apps/desktop/src/hooks/useCatalogSync.ts`:
  - Remover `.eq('is_active', true)` das queries para evitar `400`; filtrar ativo no cliente.
  - Desduplicar **categorias** por `name` (lowercase/trim) e **produtos** por chave `sku` (preferência) ou `name+categoryId`.
  - Quando houver duplicidade, manter o registro com `updated_at` mais recente.
  - Logs `[CatalogSync]` com totais e quantos foram colapsados.

## 2) KDS — Carregar Itens no Navegador
- Em `apps/desktop/src/pages/cozinha/page.tsx`:
  - No modo Web, para cada `order_id` carregar `order_items` do Supabase com join em `products` (id, name, sla, skipKitchen, unitDeliveryCount, category_id).
  - Remover o filtro que descarta pedidos sem itens ou garantir que os itens sempre sejam carregados.
  - Ao mudar status, também persistir timestamps em `kds_phase_times` conforme a fase (newStart/preparingStart/readyAt/deliveredAt) para relatórios.
  - Logs `[KDS]` nas transições e no carregamento (quantidades por status).

## 3) Relatórios & Fonte Única
- Garantir que 100% das operações (PDV e KDS) leem e escrevem do Supabase.
- Eliminar dependências de IPC/SQLite no navegador; manter short-circuit para Electron apenas.

## 4) Logs
- Manter logs detalhados no console do navegador (`[PDV]`, `[KDS]`, `[CatalogSync]`).
- O arquivo local `console.txt` continuará como base para análise local; em Vercel não há escrita em disco.

# Arquivos Alvo
- `apps/desktop/src/hooks/useCatalogSync.ts`
- `apps/desktop/src/pages/cozinha/page.tsx`

# Resultado Esperado
- PDV sem itens duplicados e sem erro 400.
- KDS com fluxo estável: "Novos" → "Preparando" → "Pronto" → "Entregue", sem desaparecer, com itens carregados e timestamps salvos para relatórios.
