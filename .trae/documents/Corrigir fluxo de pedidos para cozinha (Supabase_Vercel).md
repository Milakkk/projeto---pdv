## Diagnóstico
- O pedido é criado no Caixa e persiste via serviços offline (`createOrder`, `addItem`, `addPayment`) e depois tenta enfileirar ticket no KDS (`enqueueTicket`). Referências:
  - apps/desktop/src/pages/caixa/components/Cart.tsx:577-601
  - apps/desktop/src/offline/services/ordersService.ts:101-144 (Supabase: cria tickets por categoria)
  - apps/desktop/src/offline/services/kdsService.ts:299-326 (enqueueTicket)
- No Supabase, `enqueueTicket` está gravando `status: "queued"` em `kds_tickets`, mas a leitura mapeia para `NEW/PREPARING/READY/DELIVERED`. Isso faz os tickets não aparecerem na Cozinha. Referências:
  - apps/desktop/src/offline/services/kdsService.ts:304-307 (inserção com `queued`)
  - apps/desktop/src/offline/services/kdsService.ts:420-426 (leitura filtra `status` = `NEW/PREPARING/...`)
- O Caixa também chama `enqueueTicket` além de `ordersService.addItem` (que já cria tickets por cozinha quando em Supabase), potencialmente gerando tickets duplicados e, no caso atual, com status inconsistente.
- Se não houver associação em `category_kitchens`, os tickets ficam com `kitchen_id = null`. Com KDS filtrando por uma cozinha específica, esses tickets não aparecem.

## Correções
1. Ajustar `enqueueTicket` (Supabase) para usar `status: "NEW"` em vez de `"queued"`.
2. Evitar duplicidade de tickets no Supabase:
   - No Caixa, só chamar `enqueueTicket` quando não estivermos em Supabase, ou quando o pedido for de entrega direta (sem cozinha).
3. Garantir visibilidade dos tickets no KDS quando não houver associação:
   - Manter criação de ticket com `kitchen_id = null` e orientar KDS a selecionar "Todas" as cozinhas, ou
   - Opcional: criar uma associação padrão de categorias para a cozinha "Mexicano" no Supabase.
4. Adicionar logs discretos no fluxo de criação (Caixa) e de leitura (KDS) para rastrear `order_id`, `ticket_id`, `status` e `kitchen_id`.

## Validações
- Criar pedido com item de comida (não `skipKitchen`) e verificar:
  - Supabase `kds_tickets.status` = `NEW` e `kitchen_id` correto quando houver associação.
  - Cozinha carrega tickets com `listTicketsByStatus('queued')` e mostra na UI.
- Criar pedido só com bebidas (itens `skipKitchen`) e confirmar que não há ticket KDS e pedido é fechado.
- Testar KDS com filtro por cozinha e com "Todas".

## Deploy e Testes
- Subir alterações para o Git no branch em uso.
- Redeploy no Vercel.
- Teste no site `https://ia-sdr.vercel.app/` criando pedidos:
  - Um com categoria associada à cozinha (ex: "Mexicano").
  - Um sem associação para confirmar visibilidade com "Todas".

Confirma proceder com estas correções? Vou aplicar, validar e te enviar os resultados imediatamente após o deploy.