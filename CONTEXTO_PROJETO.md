# Contexto do Projeto - Sistema PDV/KDS

Este documento fornece um resumo completo do projeto para facilitar a continuidade do desenvolvimento.

---

## 1. Visão Geral

Sistema de **Ponto de Venda (PDV)** e **Kitchen Display System (KDS)** para restaurantes e estabelecimentos alimentícios. O sistema permite:

- **PDV (Caixa)**: Criação de pedidos, gerenciamento de carrinho, múltiplas formas de pagamento, sessões operacionais.
- **KDS (Cozinha)**: Visualização de pedidos em tempo real, atribuição de operadores, controle de status (NEW → PREPARING → READY → DELIVERED).
- **Configurações**: Gerenciamento de categorias, itens do cardápio, combos/promoções, formas de pagamento.
- **Relatórios**: Vendas, performance, itens vendidos, análise por categoria.

---

## 2. Stack Tecnológica

| Camada | Tecnologia |
|--------|------------|
| **Frontend** | React 19, TypeScript, Vite, TailwindCSS |
| **Desktop** | Electron (para versão offline) |
| **Backend/DB Cloud** | Supabase (PostgreSQL) |
| **DB Local** | SQLite (via better-sqlite3 no Electron) |
| **State** | React hooks + localStorage como fallback |
| **Deploy Web** | Vercel |
| **Monorepo** | pnpm workspaces + Turborepo |

---

## 3. Estrutura do Projeto

```
c:\00.PROJETOS\SISTEMA - PDV\
├── apps/
│   └── desktop/                    # App principal React + Electron
│       ├── electron/               # Código do processo main do Electron
│       ├── src/
│       │   ├── components/         # Componentes React reutilizáveis
│       │   │   ├── base/           # Button, Input, Modal, etc.
│       │   │   └── feature/        # Componentes de negócio
│       │   ├── contexts/           # React Contexts (Auth, etc.)
│       │   ├── mocks/              # Dados mockados para fallback
│       │   ├── offline/
│       │   │   ├── db/             # Schemas Drizzle ORM (SQLite)
│       │   │   └── services/       # Serviços de dados (ordersService, productsService, etc.)
│       │   ├── pages/
│       │   │   ├── caixa/          # PDV principal + componentes (Cart, OrderListTab)
│       │   │   ├── configuracoes/  # Página de configurações
│       │   │   ├── cozinha/        # KDS + componentes (OrderCard, ReadyOrderTable)
│       │   │   └── relatorios/     # Relatórios e análises
│       │   ├── types/              # Definições TypeScript (Order, MenuItem, etc.)
│       │   └── utils/              # Utilitários (supabase, uuid, etc.)
│       └── package.json
├── supabase/
│   └── migrations/
│       └── EXECUTE_ON_SUPABASE.sql # Script de migração manual para Supabase
├── .env                            # Variáveis de ambiente (Supabase keys)
└── package.json                    # Root do monorepo
```

---

## 4. Arquivos-Chave e Suas Funções

### 4.1 Serviços (apps/desktop/src/offline/services/)

| Arquivo | Descrição |
|---------|-----------|
| `ordersService.ts` | CRUD de pedidos, items, pagamentos. Função `listOrdersDetailed()` busca dados completos. |
| `productsService.ts` | CRUD de produtos e categorias. Inclui `comboConfig` para combos. |
| `kdsService.ts` | Gerencia status de tickets KDS, unit states, phase times. |
| `cashService.ts` | Sessões operacionais (abertura/fechamento de caixa). |
| `reportsService.ts` | Queries agregadas para relatórios. |

### 4.2 Páginas Principais

| Arquivo | Descrição |
|---------|-----------|
| `pages/caixa/page.tsx` | Tela principal do PDV com categorias, produtos, carrinho. |
| `pages/caixa/components/Cart.tsx` | Componente do carrinho de compras. |
| `pages/cozinha/page.tsx` | KDS principal com visualização de pedidos. |
| `pages/configuracoes/page.tsx` | Configurações do sistema (categorias, itens, combos, pagamentos). |
| `pages/relatorios/page.tsx` | Dashboard de relatórios e métricas. |

### 4.3 Schema do Banco (apps/desktop/src/offline/db/schema.ts)

Tabelas principais definidas com Drizzle ORM:
- `orders` - Pedidos
- `order_items` - Itens dos pedidos
- `payments` - Pagamentos
- `products` - Produtos/itens do cardápio
- `categories` - Categorias de produtos
- `kds_tickets` - Tickets para a cozinha
- `kds_phase_times` - Tempos de cada fase (NEW, PREPARING, READY, DELIVERED)
- `kds_unit_states` - Estado de cada unidade de produção

---

## 5. Fluxo de Dados

### 5.1 Estratégia de Persistência

O sistema usa uma estratégia híbrida:

1. **Electron (Desktop)**: SQLite local com sync para Supabase
2. **Browser (Web/Vercel)**: Direto no Supabase
3. **Fallback**: localStorage quando nenhum DB está disponível

```typescript
// Padrão usado em todos os services:
const isElectron = () => typeof (window as any)?.api?.db?.query === 'function'

if (isElectron()) {
  // SQLite via IPC
} else if (supabase) {
  // Supabase direto
} else {
  // localStorage fallback
}
```

### 5.2 Fluxo de Pedido

```
PDV (Caixa)                    KDS (Cozinha)
    │                              │
    ├── createOrder() ────────────►┤ kds_tickets criado
    ├── addItem() ────────────────►┤ (status: NEW)
    ├── addPayment()               │
    ├── closeOrder() ─────────────►┤ 
    │                              │
    │                              ├── updateTicketStatus(PREPARING)
    │                              │   └── setPhaseTime(preparingStart)
    │                              ├── updateTicketStatus(READY)
    │                              │   └── setPhaseTime(readyAt)
    │                              ├── updateTicketStatus(DELIVERED)
    │                              │   └── setPhaseTime(deliveredAt)
```

---

## 6. Trabalho Recente (Dezembro 2024)

### 6.1 Implementações Concluídas

- ✅ **Persistência de Combos**: Adicionado `combo_config` (JSONB) para salvar detalhes dos combos
- ✅ **Ordem de Categorias**: Campo `display_order` para persistir ordem de drag-and-drop
- ✅ **Sessões Operacionais**: Controle de abertura/fechamento de caixa
- ✅ **PIN/Password em Pedidos**: Identificação única de pedidos
- ✅ **Phase Times**: Rastreamento detalhado de tempos (NEW → PREPARING → READY → DELIVERED)
- ✅ **Safeguards para Colunas Faltantes**: Fallbacks quando colunas não existem no DB

### 6.2 Correções de Bugs

- ✅ Erro de sintaxe em `configuracoes/page.tsx` (código duplicado)
- ✅ Duplicidade de categoria "Promoções / Combos"
- ✅ Cálculos de tempo de espera em relatórios
- ✅ Status KDS revertendo para NEW

---

## 7. Problema Atual Pendente

### 7.1 Relatório de Pedidos Vazio

**Sintoma**: A aba "Pedidos" em `/relatorios` mostra "Nenhum pedido encontrado" mesmo com pedidos no sistema.

**Investigação Necessária**:
1. Verificar se `listOrdersDetailed()` retorna dados
2. Checar filtro de datas (`dateFrom`, `dateTo`) em `filteredOrders`
3. Adicionar logs de debug para rastrear o fluxo de dados
4. Verificar se o status do pedido está sendo mapeado corretamente

**Código Relevante**:
- `apps/desktop/src/pages/relatorios/page.tsx` - linhas 237-346 (carrega dados)
- `apps/desktop/src/pages/relatorios/page.tsx` - linhas 444-468 (filtra por data)
- `apps/desktop/src/offline/services/ordersService.ts` - função `listOrdersDetailed()`

---

## 8. Schema do Supabase

### 8.1 Tabelas Principais

```sql
-- orders
id UUID PRIMARY KEY
status TEXT (NEW, PREPARING, READY, DELIVERED, CANCELLED)
total_cents INTEGER
pin TEXT
password TEXT
operational_session_id UUID
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
completed_at TIMESTAMPTZ

-- order_items
id UUID PRIMARY KEY
order_id UUID REFERENCES orders(id)
product_id UUID REFERENCES products(id)
product_name TEXT
quantity INTEGER
unit_price_cents INTEGER

-- products
id UUID PRIMARY KEY
name TEXT
price_cents INTEGER
category_id UUID REFERENCES categories(id)
is_active BOOLEAN
combo_config JSONB  -- { items: [{ id, name, price, qty }] }

-- categories
id UUID PRIMARY KEY
name TEXT
icon TEXT
display_order INTEGER
is_active BOOLEAN

-- kds_phase_times
id UUID PRIMARY KEY
order_id UUID REFERENCES orders(id) UNIQUE
new_start TIMESTAMPTZ
preparing_start TIMESTAMPTZ
ready_at TIMESTAMPTZ
delivered_at TIMESTAMPTZ

-- kds_tickets
id UUID PRIMARY KEY
order_id UUID REFERENCES orders(id)
kitchen_id UUID
status TEXT
```

### 8.2 Migração Pendente

Arquivo: `supabase/migrations/EXECUTE_ON_SUPABASE.sql`

Deve ser executado manualmente no SQL Editor do Supabase.

---

## 9. Como Rodar o Projeto

### 9.1 Instalação

```bash
cd c:\00.PROJETOS\SISTEMA - PDV
pnpm install
```

### 9.2 Desenvolvimento

```bash
# Browser (conecta ao Supabase)
cd apps/desktop
pnpm dev:browser

# Electron PDV
pnpm dev:pdv

# Electron KDS
pnpm dev:kds

# Ambas janelas Electron
pnpm dev:both
```

### 9.3 Build para Produção

```bash
cd apps/desktop
pnpm build
```

---

## 10. Variáveis de Ambiente

Arquivo `.env` na raiz:

```env
VITE_SUPABASE_URL=https://xxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxxxxxxxxxxxxxxxx
```

---

## 11. Convenções de Código

### 11.1 Nomenclatura

- **Componentes**: PascalCase (ex: `OrderCard`, `Cart`)
- **Funções/variáveis**: camelCase (ex: `createOrder`, `handleSave`)
- **Arquivos**: lowercase com extensão `.tsx` para componentes

### 11.2 Padrões de Erro Handling

```typescript
try {
  // Tenta operação principal
} catch (err) {
  console.warn('[NomeService] Mensagem de erro:', err)
  // Tenta fallback
}
```

### 11.3 Logs de Debug

Prefixos usados:
- `[PDV->KDS]` - Comunicação PDV → Cozinha
- `[REPORTS-DEBUG]` - Debug de relatórios
- `[ordersService]` - Logs do serviço de pedidos

---

## 12. Tipos Principais (apps/desktop/src/types/index.ts)

```typescript
interface Order {
  id: string
  pin: string
  password: string
  items: OrderItem[]
  total: number
  status: 'NEW' | 'PREPARING' | 'READY' | 'DELIVERED' | 'CANCELLED'
  createdAt: Date
  preparingStartedAt?: Date  // Quando iniciou preparo
  readyAt?: Date             // Quando ficou pronto
  deliveredAt?: Date         // Quando foi entregue
  slaMinutes: number
  operationalSessionId?: string
}

interface MenuItem {
  id: string
  name: string
  price: number
  sla: number              // Tempo esperado de preparo (minutos)
  categoryId: string
  isPromo?: boolean
  comboItemIds?: string[]  // IDs dos itens do combo (legado)
  comboConfig?: { items: { id, name, price, qty }[] }  // Novo formato
}

interface Category {
  id: string
  name: string
  icon: string
  order: number
  active: boolean
}
```

---

## 13. Próximos Passos Sugeridos

1. **Debug do Relatório Vazio**
   - Adicionar `console.log` em `listOrdersDetailed()` para ver dados retornados
   - Verificar filtro de datas em `filteredOrders`
   - Checar se o mapeamento de status está correto

2. **Testes**
   - Testar criação de combo completo (salvar + recarregar)
   - Verificar se KDS recebe pedidos corretamente
   - Testar fluxo completo: PDV → KDS → Relatório

3. **Melhorias Futuras**
   - Implementar sync bidirecional SQLite ↔ Supabase
   - Adicionar testes automatizados
   - Melhorar tratamento de erros offline

---

## 14. Contatos e Recursos

- **Repositório**: https://github.com/Milakkk/projeto---pdv
- **Deploy Vercel**: https://pdr-nataji-milakk.vercel.app/
- **Supabase Dashboard**: (acessar via credenciais no .env)

---

*Documento gerado em: 28/12/2024*
