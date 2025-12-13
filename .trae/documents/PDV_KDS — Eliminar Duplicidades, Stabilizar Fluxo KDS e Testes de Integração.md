## Escopo
- Resolver duplicação de pedidos e itens exibidos no PDV.
- Impedir desaparecimento de pedidos no KDS ao iniciar preparo e registrar tempos/operadores.
- Instrumentar logs, reconciliação e testes de carga/integração.

## Causas Prováveis
- PDV: dados com múltiplos registros distintos (IDs diferentes) para o mesmo `sku/name/category` oriundos de migrações anteriores; desduplicação apenas por `id` não resolve; filtros `.eq('is_active', true)` gerando 400 e interrompendo sync.
- KDS: no navegador os tickets chegam sem itens (joins via IPC/SQLite não funcionam na Web), e a lista descarta pedidos sem itens; persistência de timestamps usando `onConflict: 'orderId'` falha (deve ser `order_id`).

## Implementações

### 1) PDV — Prevenção e Reconciliação de Duplicidade
- Desduplicar catálogo no cliente por chave normalizada: `sku` (prioridade) ou `lower(name)+category_id`, mantendo o registro com `updated_at` mais recente.
- Adicionar verificação de duplicidade ao salvar/emitir pedido: antes de criar pedido, consultar Supabase usando `client-side idempotency-key` (hash de itens+sessão+timestamp truncado) e abortar se existir.
- Logs detalhados `[PDV]` com contagens: total recebidos, colapsados por `sku`, colapsados por `name+category`, ids mantidos/descartados.
- Criar script de reconciliação (read-only + relatório) que:
  - Lista grupos duplicados (`sku` ou `name+category_id`) e sugere merge (mantendo o mais recente).
  - Exporta relatório JSON (para aplicação manual do merge via SQL ou RPC administrado).

### 2) KDS — Fluxo Completo e Robustez
- Carregar itens dos pedidos diretamente do Supabase em modo Web (`order_items` com join em `products`), removendo dependência do IPC.
- Parar de descartar pedidos sem itens; garantir que sempre carregamos itens e os anexamos antes de renderizar.
- Persistir mudanças de status em `kds_tickets` e em `orders` e gravar timestamps em `kds_phase_times` usando coluna snake_case `order_id`.
- Tratar erros com retries exponenciais e fallback visual; logs `[KDS]` nas transições.
- Confirmações visuais (toasts) para cada etapa: Novo → Preparando → Pronto → Entregue.
- Correção da visão por operador: garantir que unidades em preparo de todos os pedidos apareçam (não filtrar inadvertidamente `skipKitchen` quando não aplicável).

### 3) Qualidade e Rastreamento
- Garantir timestamps exatos nas transições (newStart, preparingStart, readyAt, deliveredAt) e operador atribuído.
- Alertas para operadores quando uma transição falhar (toast + badge no card).

### 4) Testes
- Teste de carga: gerar 100–300 pedidos simultâneos (script) e validar que nenhum some e que o KDS exibe corretamente.
- Teste de integração PDV ↔ KDS: criar pedidos e avançar status, verificar persistência nos três tables (`kds_tickets`, `orders`, `kds_phase_times`).
- Validação da visão por operador: verificar contagens por operador em cenários com múltiplas unidades e mudanças de status.

## Entregáveis
- Código com desduplicação e robustez de fluxo KDS.
- Script de reconciliação/relatório de duplicados.
- Logs instrumentados.
- Testes automatizados de carga e integração.

## Observação
- Não haverá escrita em disco na Vercel para `console.txt`; os logs ficarão no console do navegador e no DevTools. Após aprovação, aplico as mudanças e faço o push para testar na Vercel.