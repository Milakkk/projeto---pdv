# 🚀 Passo a Passo - Deploy no Vercel

## 📋 Pré-requisitos

Antes de começar, você precisa ter:
- ✅ Conta no [Vercel](https://vercel.com) (gratuita)
- ✅ Projeto no [Supabase](https://supabase.com) criado
- ✅ Repositório Git (GitHub, GitLab ou Bitbucket)

---

## 📝 PASSO 1: Preparar o Código no Git

### 1.1. Verificar se tudo está commitado

Abra o terminal na pasta do projeto e execute:

```bash
git status
```

### 1.2. Se houver arquivos não commitados, faça:

```bash
git add .
git commit -m "Preparar para deploy no Vercel"
git push
```

**✅ Objetivo:** Garantir que todo o código está no Git

---

## 🔑 PASSO 2: Obter Credenciais do Supabase

### 2.1. Acesse o Dashboard do Supabase

1. Vá para [https://app.supabase.com](https://app.supabase.com)
2. Faça login na sua conta
3. Selecione seu projeto (ou crie um novo)

### 2.2. Obter a URL do Projeto

1. No menu lateral, clique em **Settings** (⚙️)
2. Clique em **API**
3. Na seção **Project URL**, copie a URL
   - Exemplo: `https://abcdefghijklmnop.supabase.co`

### 2.3. Obter a Chave Anônima (Anon Key)

1. Ainda na página **API**
2. Na seção **Project API keys**
3. Copie a chave **anon public** (não a service_role!)
   - Exemplo: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

**✅ Objetivo:** Ter as credenciais do Supabase prontas

---

## 🌐 PASSO 3: Criar Conta/Login no Vercel

### 3.1. Acesse o Vercel

1. Vá para [https://vercel.com](https://vercel.com)
2. Clique em **Sign Up** (ou **Log In** se já tiver conta)
3. Faça login com GitHub, GitLab ou Bitbucket (recomendado)

**✅ Objetivo:** Ter conta no Vercel

---

## 📦 PASSO 4: Importar Projeto no Vercel

### 4.1. Adicionar Novo Projeto

1. No dashboard do Vercel, clique em **Add New...**
2. Selecione **Project**

### 4.2. Conectar Repositório

1. Se for a primeira vez, autorize o Vercel a acessar seus repositórios
2. Procure pelo repositório do seu projeto
3. Clique em **Import** ao lado do repositório

**✅ Objetivo:** Vercel conectado ao seu repositório Git

---

## ⚙️ PASSO 5: Configurar o Projeto

### 5.1. Configurações do Projeto

O Vercel deve detectar automaticamente:
- **Framework Preset:** Vite
- **Root Directory:** Deixe como está (raiz do projeto)
- **Build Command:** `cd apps/desktop && pnpm install && pnpm build`
- **Output Directory:** `apps/desktop/out`
- **Install Command:** `pnpm install --frozen-lockfile`

**Se não detectar automaticamente, configure manualmente:**

1. Clique em **Show Advanced Options**
2. Configure:
   - **Framework Preset:** Vite
   - **Build Command:** `cd apps/desktop && pnpm install && pnpm build`
   - **Output Directory:** `apps/desktop/out`
   - **Install Command:** `pnpm install --frozen-lockfile`

### 5.2. Adicionar Variáveis de Ambiente

1. Na seção **Environment Variables**, clique em **Add**
2. Adicione a primeira variável:
   - **Name:** `VITE_SUPABASE_URL`
   - **Value:** Cole a URL do Supabase que você copiou
   - **Environments:** Marque todas (Production, Preview, Development)
   - Clique em **Save**

3. Adicione a segunda variável:
   - **Name:** `VITE_SUPABASE_ANON_KEY`
   - **Value:** Cole a chave anon do Supabase que você copiou
   - **Environments:** Marque todas (Production, Preview, Development)
   - Clique em **Save**

**✅ Objetivo:** Projeto configurado com variáveis de ambiente

---

## 🚀 PASSO 6: Fazer o Deploy

### 6.1. Iniciar Deploy

1. Clique no botão **Deploy** (no final da página)
2. Aguarde o processo de build

### 6.2. Acompanhar o Build

Você verá os logs do build em tempo real:
- ✅ Installing dependencies
- ✅ Building project
- ✅ Deploying

**⏱️ Tempo estimado:** 2-5 minutos

**✅ Objetivo:** Deploy concluído com sucesso

---

## ✅ PASSO 7: Verificar o Deploy

### 7.1. Acessar o Site

Após o deploy, você verá:
- ✅ **Congratulations!** seu projeto foi deployado
- Um link do tipo: `https://seu-projeto.vercel.app`

### 7.2. Testar o Site

1. Clique no link ou copie e cole no navegador
2. O site deve carregar normalmente

### 7.3. Verificar Funcionalidades

Abra o Console do Navegador (F12) e verifique:

1. **Supabase conectado:**
   - Não deve aparecer erros de Supabase
   - Se aparecer "Supabase não disponível", verifique as variáveis de ambiente

2. **Testar criação de categoria:**
   - Vá em Configurações > Categorias
   - Tente criar uma nova categoria
   - Deve funcionar sem erros

3. **Testar associação categoria-cozinha:**
   - Edite uma categoria
   - Selecione cozinhas
   - Salve
   - Deve funcionar sem erros

**✅ Objetivo:** Site funcionando corretamente

---

## 🔧 PASSO 8: Configurações Adicionais (Opcional)

### 8.1. Domínio Personalizado

1. No dashboard do Vercel, vá em **Settings** > **Domains**
2. Adicione seu domínio personalizado (se tiver)

### 8.2. Atualizações Automáticas

O Vercel faz deploy automático quando você faz push no Git:
- Push na branch `main` → Deploy em produção
- Push em outras branches → Deploy de preview

**✅ Objetivo:** Configurações adicionais aplicadas

---

## 🐛 Resolução de Problemas

### ❌ Erro: "Build failed"

**Solução:**
1. Clique em **View Build Logs** para ver o erro
2. Verifique se as variáveis de ambiente estão corretas
3. Teste o build localmente: `cd apps/desktop && pnpm build`

### ❌ Erro: "Supabase não disponível"

**Solução:**
1. Vá em **Settings** > **Environment Variables**
2. Verifique se `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` estão configuradas
3. Verifique se estão marcadas para Production
4. Faça um novo deploy

### ❌ Erro: "Module not found: better-sqlite3"

**Solução:**
- Isso é normal! O `better-sqlite3` é apenas para Electron
- O código detecta automaticamente o ambiente
- Pode ignorar este aviso

### ❌ Site carrega mas não funciona

**Solução:**
1. Abra o Console do Navegador (F12)
2. Verifique se há erros
3. Verifique se o Supabase está conectado
4. Verifique as variáveis de ambiente no Vercel

---

## 📞 Suporte

Se ainda tiver problemas:

1. **Verifique os logs do build no Vercel**
2. **Verifique o console do navegador (F12)**
3. **Teste o build localmente primeiro**
4. **Verifique se as variáveis de ambiente estão corretas**

---

## ✅ Checklist Final

Antes de considerar o deploy completo, verifique:

- [ ] Site carrega corretamente
- [ ] Console do navegador não mostra erros críticos
- [ ] Supabase está conectado (verificar console)
- [ ] Criar categoria funciona
- [ ] Editar categoria funciona
- [ ] Associar categoria a cozinha funciona
- [ ] Todas as rotas funcionam (navegação)

---

## 🎉 Pronto!

Seu projeto está no ar! 🚀

O Vercel fará deploy automático sempre que você fizer push no Git.

**URL do seu site:** `https://seu-projeto.vercel.app`

