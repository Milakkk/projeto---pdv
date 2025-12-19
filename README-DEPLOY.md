# 🚀 Deploy no Vercel - Resumo Rápido

## Configuração Rápida

### 1. Variáveis de Ambiente no Vercel

Adicione estas variáveis em **Settings > Environment Variables**:

```
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon-aqui
```

### 2. Deploy

1. Conecte seu repositório Git ao Vercel
2. O Vercel detectará automaticamente o `vercel.json`
3. Clique em **Deploy**

### 3. Verificação

Após o deploy, acesse seu site e verifique:
- ✅ Site carrega
- ✅ Console do navegador não mostra erros do Supabase
- ✅ Criação de categorias funciona
- ✅ Associações categoria-cozinha funcionam

## Arquivos Importantes

- `vercel.json` - Configuração do Vercel
- `apps/desktop/vite.config.ts` - Configuração do Vite
- `DEPLOY-VERCEL.md` - Guia completo detalhado

## Build Local (Teste)

```bash
cd apps/desktop
pnpm install
pnpm build
```

O build será gerado em `apps/desktop/out`

## Problemas Comuns

**Erro: better-sqlite3 não encontrado**
- Normal! É apenas para Electron, não usado no Vercel

**Erro: Supabase não disponível**
- Verifique as variáveis de ambiente no Vercel

**Build falha**
- Verifique os logs no Vercel
- Teste o build localmente primeiro

