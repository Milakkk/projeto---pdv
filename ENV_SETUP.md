# Configuração de Variáveis de Ambiente

Para que o sistema funcione corretamente com Supabase, você precisa configurar as seguintes variáveis de ambiente:

## Variáveis Necessárias

Crie um arquivo `.env` na raiz do projeto com o seguinte conteúdo:

```env
# URL do projeto Supabase
VITE_SUPABASE_URL=https://seu-projeto.supabase.co

# Chave anônima (anon key) do Supabase
VITE_SUPABASE_ANON_KEY=sua-chave-anon-aqui
```

## Como Obter os Valores

1. Acesse o [Dashboard do Supabase](https://app.supabase.com)
2. Selecione seu projeto
3. Vá em **Settings** > **API**
4. Copie a **URL** do projeto (campo "Project URL")
5. Copie a **anon/public key** (campo "Project API keys" > "anon public")

## Configuração no Vercel

No Vercel, adicione as variáveis de ambiente nas configurações do projeto:

1. Acesse as configurações do projeto no Vercel
2. Vá em **Settings** > **Environment Variables**
3. Adicione:
   - `VITE_SUPABASE_URL` com a URL do seu projeto Supabase
   - `VITE_SUPABASE_ANON_KEY` com a chave anônima do Supabase

## Importante

- Nunca commite o arquivo `.env` no Git (já está no .gitignore)
- Use sempre a chave **anon/public**, nunca a chave **service_role** no frontend
- A chave anon é segura para uso no frontend pois as políticas RLS do Supabase controlam o acesso


