# Guia de Deploy no Vercel

Este guia explica como fazer o deploy do projeto no Vercel.

## Pré-requisitos

1. Conta no [Vercel](https://vercel.com)
2. Projeto no [Supabase](https://supabase.com) configurado
3. Repositório Git (GitHub, GitLab ou Bitbucket)

## Passo a Passo

### 1. Preparar o Repositório

Certifique-se de que todos os arquivos estão commitados:

```bash
git add .
git commit -m "Preparar para deploy no Vercel"
git push
```

### 2. Conectar ao Vercel

1. Acesse [vercel.com](https://vercel.com) e faça login
2. Clique em **"Add New Project"**
3. Importe seu repositório Git
4. O Vercel detectará automaticamente o `vercel.json`

### 3. Configurar Variáveis de Ambiente

No painel do Vercel, vá em **Settings** > **Environment Variables** e adicione:

```
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon-aqui
```

**Importante:** 
- Use a chave **anon/public**, nunca a service_role
- Configure para todos os ambientes (Production, Preview, Development)

### 4. Configurar Build Settings

O Vercel deve detectar automaticamente:
- **Framework Preset:** Vite
- **Build Command:** `cd apps/desktop && pnpm install && pnpm build`
- **Output Directory:** `apps/desktop/out`
- **Install Command:** `pnpm install --frozen-lockfile`

Se não detectar, configure manualmente.

### 5. Deploy

1. Clique em **"Deploy"**
2. Aguarde o build completar
3. Seu site estará disponível em `https://seu-projeto.vercel.app`

## Estrutura do Projeto

O projeto está configurado para:
- **Aplicação principal:** `apps/desktop` (React + Vite)
- **Build output:** `apps/desktop/out`
- **Framework:** Vite (SPA)

## Troubleshooting

### Erro: "Module not found: better-sqlite3"

Isso é normal - o `better-sqlite3` é apenas para Electron e não será usado no Vercel. O código detecta automaticamente o ambiente.

### Erro: "Supabase não disponível"

Verifique se as variáveis de ambiente estão configuradas corretamente no Vercel.

### Build falha

1. Verifique os logs do build no Vercel
2. Teste o build localmente: `cd apps/desktop && pnpm build`
3. Verifique se todas as dependências estão no `package.json`

## Verificações Pós-Deploy

Após o deploy, verifique:

1. ✅ Site carrega corretamente
2. ✅ Supabase está conectado (verifique o console do navegador)
3. ✅ Criação/edição de categorias funciona
4. ✅ Associações categoria-cozinha funcionam
5. ✅ Todas as rotas funcionam (SPA routing)

## Comandos Úteis

### Build local para testar

```bash
cd apps/desktop
pnpm install
pnpm build
```

### Preview local do build

```bash
cd apps/desktop
pnpm preview
```

## Notas Importantes

- O projeto usa **SPA (Single Page Application)**, então todas as rotas são redirecionadas para `/index.html` via `vercel.json`
- O código detecta automaticamente se está rodando em Electron ou navegador
- Dependências do Electron (better-sqlite3, electron) não são necessárias no Vercel
- O Supabase é usado como banco de dados principal no ambiente web

## Suporte

Se encontrar problemas:
1. Verifique os logs do build no Vercel
2. Verifique o console do navegador (F12)
3. Verifique se as variáveis de ambiente estão configuradas

