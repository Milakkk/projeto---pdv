# Correção e Otimização do Sistema de Caixa

## 1. Otimizar Gerenciamento de Caixa (Configurações)

**Problema:** A tela fica "carregando eterno" porque tenta buscar movimentos de todas as sessões sequencialmente.
**Solução:**

* Alterar `GerenciamentoCaixaPage` para carregar apenas as sessões inicialmente.

* Carregar os detalhes (movimentos) **sob demanda** (quando o usuário expandir a sessão) ou em paralelo limitado.

* Adicionar paginação ou limite na busca inicial (ex: últimas 50 sessões).

## 2. Implementar Troca de Caixa/Estação

**Problema:** Usuário não consegue trocar de caixa facilmente na tela de vendas.
**Solução:**

* Adicionar botão **"Trocar Caixa"** no cabeçalho da página `CaixaPage`.

* Criar um Modal simples que lista as estações (usando `stationsService`).

* Ao selecionar, atualizar `currentStationId` no `localStorage` e recarregar a sessão.

## 3. Correção na Exibição de Produtos

**Problema:** Produtos podem não aparecer devido a erros de validação de ID ou filtragem.
**Solução:**

* (Já aplicada parcialmente) Garantir que `productsService` valide UUIDs.

* Verificar se o filtro de categoria na `CaixaPage` está funcionando corretamente com os dados do Supabase.

## 4. Testes e Validação

* Criar script de teste para validar o fluxo de sessão e listagem de produtos.

* Verificar logs do console para garantir que erros de `unitId` sumiram.

***

### Ordem de Execução:

1. Modificar `GerenciamentoCaixaPage.tsx` para otimizar o carregamento.
2. Criar componente `StationSelectorModal` e adicionar à `CaixaPage`.
3. Validar e ajustar `CaixaPage` para garantir exibição de produtos.
4. Rodar testes de verificação.

