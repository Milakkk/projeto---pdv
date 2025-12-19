## Escopo
- Validar o site em produção (`https://ia-sdr.vercel.app`) ponta a ponta: autenticação, Caixa, Cozinha (KDS), Configurações e Relatórios.
- Confirmar que pedidos são roteados por cozinha, aparecem na Cozinha em tempo real e ficam persistidos no Supabase para relatórios.

## Pré‑requisitos
- Credenciais de login válidas para o ambiente de produção.
- Variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` configuradas no projeto do Vercel.

## Passos de Verificação
1. Autenticação
- Acessar `https://ia-sdr.vercel.app` e realizar login.
- Verificar acesso à tela de seleção de módulos (`/module-selector`).

2. Configurações
- Abrir `Caixa → Configurações`.
- Criar/editar uma categoria de teste e associar à cozinha “Mexicano”.
- Confirmar que as associações são salvas (tabela `category_kitchens`).

3. Caixa (PDV)
- Selecionar a cozinha “Mexicano” no filtro (banner/controle de cozinha).
- Adicionar itens da categoria associada e fechar um pedido.
- Confirmar criação do pedido em `orders` e itens em `order_items`.
- Verificar que o sistema lança `kds_tickets` com `kitchen_id` correto baseado em `category_kitchens`.

4. Cozinha (KDS)
- Acessar o módulo Cozinha.
- Selecionar a mesma cozinha (“Mexicano”).
- Verificar chegada do ticket em tempo real e mudança de status (NEW → PREPARING → READY → DELIVERED).

5. Relatórios
- Acessar `/relatorios`.
- Verificar se o pedido aparece com totais, pagamentos e status.
- Confirmar que dados necessários estão persistidos: `orders`, `order_items`, `payments`, `kds_tickets` e tempos (`kds_phase_times`), além de detalhes em `orders_details` quando aplicável.

6. SPA/Rotas
- Recarregar páginas internas (por exemplo, `/cozinha`) e garantir que não ocorre 404 (rewrite do SPA ativo).

7. Teste de Conectividade (Opcional)
- No console do navegador (F12), executar `await window.testSupabaseKitchen()` para validar SELECT/INSERT/DELETE na tabela `kitchens`.

## Critérios de Aprovação
- Pedidos criados no Caixa aparecem na Cozinha correta (de acordo com `category_kitchens`).
- Mudanças de status refletem no PDV e no KDS em tempo real.
- Dados persistem no Supabase e são exibidos em Relatórios.
- Recarregar rotas não gera 404.

## Observações e Ajustes
- Caso alguma operação falhe, coletar o erro do console e o status HTTP da chamada ao Supabase, identificando se é schema/policy/variável de ambiente.
- Se necessário, ajustar associações ou fluxos (sem alterar o banco de produção) e repetir o teste.

## Entregáveis
- Relato objetivo do teste com resultados por módulo.
- Lista de eventuais correções necessárias (se houver).