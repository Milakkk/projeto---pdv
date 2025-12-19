# Documentação Técnica: Integração PDV-KDS e Sincronização Supabase

## 1. Fluxo de Dados

O sistema opera em um modelo híbrido (Offline-First com Sincronização em Tempo Real).

### Criação de Pedido (PDV -> Supabase)
1. **Local**: O pedido é criado no banco SQLite local (ou LocalStorage no navegador).
2. **Remoto**: O utilitário `supabaseSync` tenta persistir no Supabase com retentativas automáticas (3 tentativas, delay de 1s).
3. **Tickets KDS**: Ao adicionar itens, tickets são gerados e roteados para as cozinhas correspondentes.

### Sincronização em Tempo Real (KDS)
1. **Assinatura**: O KDS assina canais do Supabase Realtime para as tabelas `orders`, `kds_tickets` e `kds_phase_times`.
2. **Polling Fallback**: Um intervalo de segurança (3s) busca atualizações caso o Realtime falhe.
3. **LAN Hub**: Em redes locais, o Hub atua como um relay via WebSocket para reduzir a dependência da internet.

### Confirmação de Recebimento
- O KDS envia um "Acknowledge" ao receber um ticket.
- O PDV monitora esse acknowledge e loga a latência em `kds_sync_logs`.

---

## 2. Estrutura do Banco de Dados (Principais Tabelas)

| Tabela | Descrição |
| :--- | :--- |
| `orders` | Cabeçalho do pedido (status, total, timestamps). |
| `order_items` | Itens vinculados aos pedidos. |
| `kds_tickets` | Controle de fila para a cozinha. |
| `kds_phase_times` | Registra tempos de Espera, Preparo e Entrega. |
| `kds_unit_states` | Status detalhado por item em cada unidade de produção. |
| `kds_sync_logs` | Logs de performance e latência de sincronização. |
| `integrity_logs` | Registro de inconsistências detectadas pelo script de integridade. |

---

## 3. Endpoints e Integrações

### Supabase
- **URL**: Definida em `VITE_SUPABASE_URL`
- **Auth**: JWT via `VITE_SUPABASE_ANON_KEY`
- **Realtime**: Habilitado para as tabelas críticas.

### LAN Hub (Opcional)
- `POST /push`: Envia eventos do PDV para a rede local.
- `GET /pull`: Recupera eventos pendentes para uma unidade.
- `WS /realtime`: Stream de eventos via WebSocket.

---

## 4. Mecanismos de Confiabilidade

### Retentativas (Retry Logic)
Implementado em `src/utils/supabaseSync.ts`. Garante que falhas intermitentes de rede não causem perda de dados.

### Verificação de Integridade
O script `src/utils/dataIntegrity.ts` roda em background a cada 5 minutos, comparando:
- Contagem de pedidos.
- Status entre local e remoto.
- Valores totais.
- Existência de tickets KDS.

### Tratamento de Erros
- Fallback automático para SQLite/LocalStorage.
- Logs detalhados no console e na tabela `integrity_logs`.
- Notificações via Toast para erros críticos.
