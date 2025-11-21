
TEST_PLAN_PROMPT_2A.md

Plano de Testes — Integração da UI com os serviços offline (PROMPT 2A)

1. Ambiente
- Desktop: pnpm dev:desktop
- Web: pnpm dev:web
- Rota dev: /sync-status (conferir pendências)

2. Cozinha
- Abrir página e verificar:
  - Operadores carregados via kdsService.listOperators()
  - Tickets por status (queued, prep, ready)
- Trocar status de um ticket → refletir na lista sem recarregar a tela

3. Caixa
- Criar pedido a partir do carrinho:
  - Verificar que order.id veio do service (UUID)
  - Itens foram persistidos via ordersService.addItem()
  - Pagamento via ordersService.addPayment()
- Fechar pedido e verificar totals

4. Relatórios (Web)
- Carregar KPIs (faturamento, pedidos, ticket médio) via reportsService
- Ranking de itens mais vendidos via reportsService.itensMaisVendidos()

5. Offline/Online
- Desligar internet (modo avião ou desconectar)
- Criar pedido + avançar ticket no KDS
- Reconectar internet
- Ir em /sync-status → "Forçar Sync" e ver pendentes zerando
- Checar no Supabase se os dados chegaram (se políticas já estiverem aplicadas)

6. Regressão Visual
- Conferir que nenhum componente mudou de aparência ou comportamento externo
