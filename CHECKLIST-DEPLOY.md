# ✅ Checklist de Deploy no Vercel

## Antes de Fazer o Deploy

- [x] ✅ Arquivos organizados (pasta `_nao-usar-producao/` criada)
- [x] ✅ `.gitignore` atualizado
- [x] ✅ `vercel.json` configurado corretamente
- [x] ✅ `vite.config.ts` ajustado para produção
- [x] ✅ Build testado localmente (funcionando)
- [x] ✅ Código de Supabase corrigido (categorias e associações)
- [x] ✅ `.vercelignore` configurado

## Configurações no Vercel

### 1. Variáveis de Ambiente

Adicione em **Settings > Environment Variables**:

```
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon-aqui
```

**Configurar para:** Production, Preview, Development

### 2. Build Settings (Auto-detectado)

- Framework: Vite
- Build Command: `cd apps/desktop && pnpm install && pnpm build`
- Output Directory: `apps/desktop/out`
- Install Command: `pnpm install --frozen-lockfile`

### 3. Deploy

1. Conecte o repositório Git
2. Clique em **Deploy**
3. Aguarde o build completar

## Verificações Pós-Deploy

Após o deploy, verifique:

- [ ] Site carrega corretamente
- [ ] Console do navegador não mostra erros
- [ ] Supabase está conectado (verificar console)
- [ ] Criar categoria funciona
- [ ] Editar categoria funciona
- [ ] Associar categoria a cozinha funciona
- [ ] Todas as rotas funcionam (SPA routing)

## Arquivos de Referência

- `DEPLOY-VERCEL.md` - Guia completo detalhado
- `README-DEPLOY.md` - Resumo rápido
- `ENV_SETUP.md` - Configuração de variáveis de ambiente
- `vercel.json` - Configuração do Vercel

## Problemas Comuns

### Build falha
- Verifique os logs no Vercel
- Teste localmente: `cd apps/desktop && pnpm build`

### Supabase não conecta
- Verifique variáveis de ambiente no Vercel
- Verifique se está usando a chave **anon**, não service_role

### Erro: better-sqlite3
- Normal! É apenas para Electron, não usado no Vercel

## Comandos Úteis

```bash
# Build local
cd apps/desktop && pnpm build

# Preview do build
cd apps/desktop && pnpm preview

# Verificar estrutura
ls apps/desktop/out
```

## Status do Projeto

✅ **PRONTO PARA DEPLOY**

Todas as correções foram aplicadas:
- ✅ Lógica de salvamento de categorias corrigida
- ✅ Associações categoria-cozinha corrigidas
- ✅ Build funcionando
- ✅ Configurações do Vercel ajustadas
- ✅ Arquivos desnecessários organizados

