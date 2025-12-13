# Correção de Duplicação no PDV e Travamento no KDS (Apps/Desktop)

Identifiquei que o Vercel está utilizando os arquivos em `apps/desktop/src` para o build, e não os arquivos na raiz `src` como assumido anteriormente. Isso explica por que as correções anteriores não surtiram efeito.

## 1. Corrigir Duplicação e Erros 400 (Products Service)

**Problema:** A função `migrateLocalStorageCatalog` está rodando em loop no navegador, gerando novos UUIDs para produtos a cada execução e tentando inseri-los no Supabase. Como alguns produtos têm IDs de categoria inválidos (ex: "cat_chopes"), o Supabase retorna erro 400, a migração falha (ou cai no catch), salva no localStorage, e o ciclo reinicia.

**Solução:**
*   **Desativar Migração na Web:** Adicionar verificação no início de `migrateLocalStorageCatalog` em `apps/desktop/src/offline/services/productsService.ts` para abortar se não estiver no Electron.
*   **Sanitizar IDs:** Em `upsertProduct`, verificar se `categoryId` é um UUID válido. Se não for, enviar `null` para o Supabase para evitar o erro 400 e permitir a sincronização.

## 2. Destravar Fluxo KDS (Cozinha Page)

**Problema:** O KDS reverte o status dos pedidos ("Preparando" -> "Novos") porque a atualização é feita apenas localmente e o listener `realtime` sobrescreve com o estado antigo do servidor antes que a mudança seja persistida.

**Solução:**
*   **Persistência Direta:** Atualizar `apps/desktop/src/pages/cozinha/page.tsx` para chamar `kdsService.setTicketStatus` (que deve suportar Supabase) ou implementar a chamada direta ao Supabase dentro da função `updateOrderStatus`, garantindo que o servidor receba o novo status imediatamente.

## 3. Prevenção de Conflitos

*   **Verificação de Arquivos:** Aplicarei as correções tanto em `apps/desktop/src` quanto na raiz `src` (se aplicável) para garantir cobertura total, independentemente de qual diretório o build esteja utilizando.

---

### Arquivos Alvo:
1.  `apps/desktop/src/offline/services/productsService.ts`
2.  `apps/desktop/src/pages/cozinha/page.tsx`
3.  `apps/desktop/src/offline/bootstrap/migrateFromLocalStorage.ts` (Desativar também)
