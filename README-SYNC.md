# Sincronização em Tempo Real entre Navegadores

Este sistema suporta sincronização em tempo real de dados entre múltiplos navegadores e dispositivos.

## Como Funciona

O sistema usa **3 camadas de sincronização**:

1. **BroadcastChannel** - Sincroniza abas/janelas do **mesmo navegador** (Chrome, Firefox, Edge, etc.)
2. **WebSocket (Hub Server)** - Sincroniza entre **navegadores diferentes** na mesma rede
3. **localStorage** - Armazenamento local persistente

## Configuração

### 1. Iniciar o Hub Server

Para sincronizar entre navegadores diferentes, você precisa iniciar o hub server:

```bash
pnpm dev:hub
```

O hub server será iniciado em `http://localhost:4000` por padrão.

### 2. Configurar Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto ou configure as variáveis:

```env
VITE_LAN_HUB_URL=http://localhost:4000
VITE_LAN_SYNC_SECRET=sua-chave-secreta-aqui
```

**Importante**: Use a mesma `VITE_LAN_SYNC_SECRET` em todos os navegadores para que possam se comunicar.

### 3. Iniciar a Aplicação

```bash
# Terminal 1: Hub Server
pnpm dev:hub

# Terminal 2: Aplicação no navegador
pnpm dev:browser
```

## Comportamento

### ✅ Sincronização Funciona:

- **Abas do mesmo navegador** → Sincronização instantânea via BroadcastChannel
- **Navegadores diferentes** → Sincronização via WebSocket (se hub estiver rodando)
- **Mesma rede local** → Todos os navegadores sincronizam entre si

### ⚠️ Limitações:

- **Sem hub server**: Apenas abas do mesmo navegador sincronizam
- **Navegadores em redes diferentes**: Não sincronizam (precisa de backend na nuvem)
- **localStorage isolado**: Cada navegador tem seu próprio localStorage, mas o hub sincroniza

## Testando a Sincronização

1. Inicie o hub server: `pnpm dev:hub`
2. Abra a aplicação em múltiplos navegadores (Chrome, Firefox, Edge)
3. Adicione uma cozinha em um navegador
4. A cozinha deve aparecer automaticamente nos outros navegadores

## Dados Sincronizados

Atualmente, os seguintes dados são sincronizados:

- ✅ Cozinhas (`kitchens`)
- 🔄 Outras entidades podem ser adicionadas seguindo o mesmo padrão

## Arquitetura

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Chrome    │     │  Firefox    │     │    Edge     │
│  (Navegador)│     │  (Navegador)│     │  (Navegador)│
└─────┬───────┘     └─────┬───────┘     └─────┬───────┘
      │                   │                   │
      │  WebSocket        │  WebSocket        │  WebSocket
      │                   │                   │
      └───────────────────┴───────────────────┘
                         │
                    ┌────▼────┐
                    │  Hub   │
                    │ Server │
                    │ :4000  │
                    └────────┘
```

## Solução de Problemas

### Hub não conecta

1. Verifique se o hub está rodando: `pnpm dev:hub`
2. Verifique se `VITE_LAN_HUB_URL` está correto
3. Verifique se `VITE_LAN_SYNC_SECRET` está configurado
4. Abra o console do navegador para ver mensagens de erro

### Dados não sincronizam

1. Verifique se todos os navegadores têm a mesma `VITE_LAN_SYNC_SECRET`
2. Verifique se o hub server está acessível na rede
3. Verifique o console do navegador para erros de WebSocket

### Apenas abas do mesmo navegador sincronizam

- Isso é normal se o hub server não estiver rodando
- Inicie o hub server para sincronizar entre navegadores diferentes

