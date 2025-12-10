## Objetivo
- Garantir que todo pedido feito no Caixa seja enfileirado e visto na Cozinha, operando 100% via Vercel (Next.js) e Supabase (DB + Realtime), sem mudanças no front.

## Diagnóstico Atual
- POS Desktop usa SQLite local e um Hub LAN próprio: `POST /push` e `WS /realtime` (pacote `lan-sync`). O site (Next.js) tem poucas rotas (`/api/checklist/exec`, `/api/admin/create-user`).
- Supabase já é usado para sync e Realtime, porém o fluxo Caixa→Cozinha depende do Hub LAN e não existe versão equivalente em Vercel.

## Ajustes no Supabase
1. Schema padronizado (tabelas mínimas): `units`, `stations`, `categories`, `products`, `orders`, `order_items`, `payments`, `kds_tickets`, `cash_sessions`, `cash_movements`.
2. Triggers para `updated_at` e `version` em tabelas transacionais.
3. RLS:
   - Leitura pública controlada para catálogo (`products`, `categories`, `stations`), se necessário.
   - Escrita apenas via Service Role (rotas server-side) para transacionais (`orders`, `order_items`, `kds_tickets`, `payments`).
4. Realtime: habilitar publicações para `orders`, `order_items`, `kds_tickets` e `payments`.

## Endpoints no Vercel (Next.js, API Routes)
1. `POST /api/push` (Edge Runtime):
   - Autenticação por `Bearer LAN_SYNC_SECRET`.
   - Aceita o mesmo payload do Hub LAN atual (batelada de `events` por `unit_id`).
   - Persiste cada evento nas tabelas Supabase correspondentes, respeitando o `unit_id`.
   - Responde com relatório de sucesso por evento.
2. `GET /api/realtime` (WebSocket na Edge):
   - Protocolo compatível com o Hub LAN atual: handshake inicial com `{ unit_id, device_id }` e envio de `{ type: 'hello' }`.
   - Servidor assina Realtime do Supabase para a `unit_id` informada e repassa mudanças aos clientes conectados.
   - Formato de mensagem alinhado ao `packages/lan-sync/server` para zero mudanças no front.

## Mapeamento de Eventos Caixa→KDS
- `order:create` → cria `orders` com `status = 'NEW'` e itens em `order_items`.
- `kds:enqueue` → cria `kds_tickets` com `status = 'queued'` e linka itens/station quando aplicável.
- `kds:set-status` → atualiza `kds_tickets.status` (`prep|ready|done`) e reflete em `orders.status`.
- `payment:add` → registra em `payments` (fecha pedido quando critérios de quitação forem atendidos).

## Variáveis de Ambiente (Vercel)
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (server-side Admin).
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (cliente, se necessário).
- `LAN_SYNC_SECRET` (autenticação do `/api/push`).

## Verificação e Testes
- Teste de `POST /api/push` com carga real de pedido: conferir inserção em `orders`, `order_items`, `kds_tickets`.
- Conexão ao `GET /api/realtime` com `{ unit_id, device_id }`: receber eventos de Realtime ao criar/atualizar tickets.
- Fluxo end-to-end: Caixa cria pedido → ticket aparece em Cozinha sem nenhum ajuste no front.

## Publicação
- Subir o backend (novas rotas e configs) para o Git principal.
- Deploy automático no Vercel com envs corretas.
- Ajustar apontamento do front para usar o domínio do Vercel como `hubUrl` (via env existente), sem alterar código.

## Riscos e Mitigações
- WebSocket na Edge: usar suporte nativo do Vercel; se indisponível, fallback com SSE mantendo contrato.
- RLS: garantir apenas Service Role escreve; clientes leem via Realtime broadcast.
- Divergência de schema: unificar nomes de status e chaves para evitar conflitos na sincronização.

## Entregáveis
- SQL/Migrações Supabase para schema e policies.
- Rotas `POST /api/push` e `GET /api/realtime` compatíveis com o Hub LAN atual.
- Documentação curta de envs e mapeamento de eventos.
- Verificação do fluxo funcionando no ambiente `ia-sdr.vercel.app`.