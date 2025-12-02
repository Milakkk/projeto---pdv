# Executando o Sistema no Navegador

Este guia explica como executar o sistema apenas no navegador, sem usar o Electron.

## Limpar Pedidos do Banco de Dados

Para limpar todos os pedidos do banco de dados, mantendo apenas dados de configuração (categorias, produtos, cozinhas, etc.):

```bash
# Do diretório raiz do projeto
pnpm clear:orders
```

Ou diretamente do diretório desktop:

```bash
cd apps/desktop
pnpm clear:orders
```

**Nota:** Este comando requer que o Electron esteja instalado, pois usa `better-sqlite3` para acessar o banco de dados.

## Executar no Navegador

Para executar o sistema apenas no navegador (sem Electron):

```bash
# Do diretório raiz do projeto
pnpm dev:browser
```

Ou diretamente do diretório desktop:

```bash
cd apps/desktop
pnpm dev:browser
```

O sistema estará disponível em: `http://localhost:3001`

## Diferenças entre Electron e Navegador

### Electron (Modo Desktop)
- Acesso direto ao SQLite via `better-sqlite3`
- Dados armazenados localmente no sistema de arquivos
- Funcionalidades offline completas

### Navegador (Modo Web)
- Usa `localStorage` como fallback quando o SQLite não está disponível
- Dados armazenados no navegador
- Funcionalidades offline limitadas ao que o navegador suporta

## Importante

⚠️ **Atenção:** Ao executar no navegador, o sistema usará `localStorage` como armazenamento. Os dados não serão compartilhados com a instalação do Electron. Para limpar pedidos quando estiver usando apenas o navegador, você precisará limpar o `localStorage` manualmente ou usar as ferramentas de desenvolvedor do navegador.

