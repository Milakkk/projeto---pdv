## Objetivos
- Unificar o fluxo entre Caixa (PDV) e Cozinha (KDS) no deploy web, usando apenas o Supabase.
- Garantir que pedidos e itens criados no Caixa gerem tickets de KDS direcionados para as cozinhas corretas.
- Assegurar que mudanças de status na Cozinha atualizem os pedidos e tempos de fase.
- Implementar atualizações em tempo real (Supabase Realtime) e filtros por cozinha selecionada.

## Diagnóstico Atual
- Variantes de serviços ainda assumem IPC/SQLite em partes do fluxo web.
- Inserts no Supabase precisam alinhar com colunas do schema (ex.: `order_items.product_name`, `quantity`, `total_cents`; tickets com `status: 'NEW'`, `kitchen_id`).
- Associação categoria→cozinhas (`category_kitchens`) salva, mas nem sempre é utilizada para roteamento ao criar tickets.
- KDS no web carece de seleção/filtragem plena por cozinha e de assinatura Realtime consistente.

## Alinhamento de Schema (Supabase)
- Revisar e confirmar tabelas e colunas usadas:
  - `categories(id,name,unit_id,updated_at,version,pending_sync)`
  - `kitchens(id,name,unit_id,is_active,display_order,updated_at)`
  - `category_kitchens(category_id,kitchen_id,updated_at)`
  - `orders(id,unit_id,status,total_cents,discount_percent,discount_cents,observations,created_at,updated_at,pin,password)`
  - `order_items(id,order_id,product_id,product_name,quantity,unit_price_cents,total_cents,observations,created_at,updated_at)`
  - `kds_tickets(id,order_id,kitchen_id,status,created_at,updated_at)`
  - `kds_unit_states(id,ticket_id,order_item_id,status,operator_id,started_at,completed_at,updated_at)`
  - `kds_phase_times(id,ticket_id,phase,started_at,completed_at)`
- Aplicar migrations faltantes e índices básicos em `orders(order_id,status,updated_at)`, `order_items(order_id)`, `kds_tickets(order_id,kitchen_id,status)`.

## Serviços (Web) — Implementações
- `ordersService.createOrder` (web):
  - Inserir `orders` com `unit_id`, `status: 'NEW'`, `pin/password` gerados, `created_at/updated_at`.
- `ordersService.addItem` (web):
  - Carregar produto (`name`, `category_id`).
  - Inserir `order_items` com `product_name`, `quantity`, `total_cents`.
  - Atualizar `orders.total_cents` acumulado.
  - Roteamento por cozinha: buscar `category_kitchens` e gerar um `kds_tickets` por cozinha mapeada (ou uma padrão). Preencher `kitchen_id` e `status: 'NEW'`.
- `kdsService` (web):
  - `listTicketsByStatus`: mapear `queued|prep|ready|done` → `NEW|PREPARING|READY|DELIVERED` e retornar itens com nomes/quantidades.
  - `setTicketStatus`: atualizar `kds_tickets.status` e refletir em `orders` (`DELIVERED`/`CANCELLED`) e em tempos de fase (`kds_phase_times`), conforme transições.
  - `setUnitOperator` / `setUnitStatus` / `setUnitDelivered`: gravar em `kds_unit_states` e atualizar tempos/estado.

## Cozinha (UI)
- Seleção de cozinha (modal):
  - Carregar cozinhas via Supabase em web; via IPC quando Electron.
  - Persistir `selectedKitchenId`/`selectedKitchenName` e filtrar listas/tickets.
- Filtro em tempo real:
  - Assinar canais Realtime (`kds_tickets`, `order_items`) e recarregar tickets filtrando por `selectedKitchenId`.

## Caixa (UI)
- Filtro “Filtrar por Cozinha”: refletir apenas itens de categorias associadas às cozinhas selecionadas.
- Ao fechar pedido, garantir broadcast de status (Realtime) e que o KDS receba atualização.

## Realtime
- KDS: canal `kds_tickets` com `event: '*'` → recarregar lista/filtros.
- Opcional: `orders` e `order_items` para refletir totais e novos itens.

## RBAC/RLS
- Policies mínimas para o papel anon (ou papel usado no cliente) permitir `select/insert/update` nas tabelas citadas, condicionadas por `unit_id`.
- Validar que `unit_id` é sempre preenchido (via `device_profile`); senão, recusar/gravar como `null` e ajustar policies.

## Validação
- Cenários:
  - Criar categoria e associar a 1+ cozinhas; verificar `category_kitchens`.
  - Criar pedido com itens dessas categorias; verificar `order_items` e criação de `kds_tickets` com `kitchen_id`.
  - No KDS, selecionar cozinha; visualizar apenas tickets daquela cozinha; mudar `status` para `PREPARING`/`READY`/`DELIVERED` e verificar atualizações em `orders` e `kds_phase_times`.
  - Realtime: abrir 2 abas (Caixa e Cozinha), conferir atualizações imediatas.

## Observabilidade
- Adicionar logs de erro (apenas DEV) nas operações Supabase.
- Retornos claros na UI quando policies/erros 401/403 ocorrerem.

## Entregáveis
- Código dos serviços web ajustado (Caixa/KDS) com Supabase e roteamento por cozinha.
- UI do KDS com seleção e filtro por cozinha e assinatura Realtime.
- Scripts SQL de migrations/policies aplicáveis.
- Checklist de testes e validação no Vercel.

## Próximos Passos
1) Confirmar que podemos aplicar ajustes nos serviços e telas conforme acima.
2) Eu implemento as mudanças, envio PR/commit e preparo um deploy de Preview.
3) Validamos juntos a Preview e, estando OK, promovemos para Production.