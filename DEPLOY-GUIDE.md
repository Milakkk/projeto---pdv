# 🚀 Guia de Deploy - Vercel + Supabase

## ✅ Passo 1: Configurar Banco de Dados no Supabase

1. **Acesse o Dashboard do Supabase**: https://supabase.com/dashboard
2. **Vá em SQL Editor** (menu lateral esquerdo)
3. **Clique em "New Query"**
4. **Abra o arquivo** `supabase/migrations/0003_pdv_kds_schema.sql` e **cole todo o conteúdo** no editor
5. **Clique em "Run"** (ou pressione Ctrl+Enter)
6. **Aguarde a execução** - deve aparecer "Success. No rows returned"

✅ **Pronto!** Todas as tabelas foram criadas.

---

## ✅ Passo 2: Configurar Variáveis de Ambiente Local

1. **Crie um arquivo `.env` na raiz do projeto** (copie de `.env.example`):

```env
VITE_SUPABASE_URL=https://zwmiikhkmqmislowfsdb.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3bWlpa2hrbXFtaXNsb3dmc2RiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2MzA3MjgsImV4cCI6MjA4MDIwNjcyOH0.mlNaJnt_7ZPYbzclVaW_ozRS5XyloT4bI4-p_GITcNE

VITE_LAN_HUB_URL=http://localhost:4000
VITE_LAN_SYNC_SECRET=pdv-sync-secret-2024
```

2. **Teste localmente**:
```bash
pnpm dev:browser
```

Acesse `http://localhost:3001` e verifique se está funcionando.

---

## ✅ Passo 3: Deploy no Vercel

### 3.1. Instalar Vercel CLI

```bash
npm i -g vercel
```

### 3.2. Fazer Login

```bash
vercel login
```

Siga as instruções no navegador para autenticar.

### 3.3. Deploy Inicial

Na raiz do projeto, execute:

```bash
vercel
```

Responda às perguntas:
- **Link to existing project?** → `No` (primeira vez)
- **Project name?** → Escolha um nome (ex: `pdv-sistema`)
- **Directory?** → `.` (raiz)
- **Override settings?** → `No`

### 3.4. Configurar Variáveis de Ambiente no Vercel

**Opção A: Via CLI**
```bash
vercel env add VITE_SUPABASE_URL
# Cole: https://zwmiikhkmqmislowfsdb.supabase.co

vercel env add VITE_SUPABASE_ANON_KEY
# Cole: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3bWlpa2hrbXFtaXNsb3dmc2RiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2MzA3MjgsImV4cCI6MjA4MDIwNjcyOH0.mlNaJnt_7ZPYbzclVaW_ozRS5XyloT4bI4-p_GITcNE
```

**Opção B: Via Dashboard**
1. Acesse https://vercel.com/dashboard
2. Selecione seu projeto
3. Vá em **Settings** → **Environment Variables**
4. Adicione:
   - `VITE_SUPABASE_URL` = `https://zwmiikhkmqmislowfsdb.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3bWlpa2hrbXFtaXNsb3dmc2RiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2MzA3MjgsImV4cCI6MjA4MDIwNjcyOH0.mlNaJnt_7ZPYbzclVaW_ozRS5XyloT4bI4-p_GITcNE`
5. Selecione **Production**, **Preview** e **Development**
6. Clique em **Save**

### 3.5. Deploy de Produção

```bash
vercel --prod
```

Aguarde o deploy terminar. Você receberá uma URL como: `https://seu-projeto.vercel.app`

---

## ✅ Passo 4: Testar o Deploy

1. **Acesse a URL do Vercel** (ex: `https://seu-projeto.vercel.app`)
2. **Teste adicionar uma cozinha** no módulo Master
3. **Abra em outro navegador/dispositivo**
4. **Verifique se os dados sincronizam** em tempo real

---

## ✅ Passo 5: Configurar Domínio Personalizado (Opcional)

1. No Vercel Dashboard → **Settings** → **Domains**
2. Clique em **Add Domain**
3. Digite seu domínio (ex: `pdv.seudominio.com`)
4. Configure os DNS conforme instruções do Vercel
5. Aguarde a propagação (pode levar alguns minutos)

---

## 🔧 Comandos Úteis

```bash
# Deploy de produção
vercel --prod

# Deploy de preview (teste)
vercel

# Ver logs
vercel logs

# Listar variáveis de ambiente
vercel env ls

# Remover variável de ambiente
vercel env rm VITE_SUPABASE_URL
```

---

## 🐛 Solução de Problemas

### Erro: "Build failed"
- Verifique se todas as dependências estão instaladas
- Execute `pnpm install` localmente primeiro
- Verifique os logs: `vercel logs`

### Erro: "Environment variables not found"
- Certifique-se de que as variáveis foram adicionadas no Vercel
- Verifique se estão marcadas para **Production**, **Preview** e **Development**

### Dados não sincronizam
- Verifique se o Supabase está acessível
- Verifique se as políticas RLS estão configuradas corretamente
- Veja os logs do navegador (F12 → Console)

### Build muito lento
- O primeiro build pode demorar (instala dependências)
- Builds subsequentes são mais rápidos

---

## 📊 Monitoramento

- **Vercel Dashboard**: Veja métricas de uso, bandwidth, etc.
- **Supabase Dashboard**: Veja uso do banco, queries, etc.

---

## 🎉 Pronto!

Seu sistema está online e sincronizado! 🚀

Qualquer dúvida, consulte:
- [Documentação Vercel](https://vercel.com/docs)
- [Documentação Supabase](https://supabase.com/docs)



