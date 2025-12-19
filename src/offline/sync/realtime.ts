import { supabase } from '@/utils/supabase'
import { db } from '@/offline/db/client'
import { ALL_TABLES } from '@/offline/db/schema'

let channels: Array<ReturnType<typeof supabase.channel>> = []

// Helper to update LocalStorage and dispatch event
function updateLocalStorage(key: string, item: any) {
  try {
    if (typeof window === 'undefined') return;
    
    const raw = window.localStorage.getItem(key);
    let items = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(items)) items = [];

    // Se o item já existe, atualiza. Se não, adiciona.
    // Para pedidos, precisamos garantir que estamos mesclando corretamente
    // ou substituindo se o payload for completo.
    const index = items.findIndex((i: any) => i.id === item.id);
    
    if (index >= 0) {
      // Merge com o existente para preservar campos locais se necessário, 
      // mas priorizando o que veio do servidor
      items[index] = { ...items[index], ...item };
    } else {
      items.push(item);
    }

    const newValue = JSON.stringify(items);
    window.localStorage.setItem(key, newValue);

    // Dispatch event for useLocalStorage hook sync
    window.dispatchEvent(new StorageEvent('storage', {
      key: key,
      newValue: newValue,
      oldValue: raw,
      url: window.location.href,
      storageArea: window.localStorage
    }));
  } catch (err) {
    console.error(`[Realtime] Failed to update localStorage for ${key}`, err);
  }
}

async function fetchFullOrder(orderId: string) {
  try {
    // Busca o pedido completo com itens e produtos
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        items:order_items (
          *,
          menuItem:products (*)
        )
      `)
      .eq('id', orderId)
      .single();
      
    if (error) {
      console.error('[Realtime] Erro ao buscar pedido completo:', error);
      return null;
    }
    
    // Mapeamento para o formato da UI (Order type)
    if (data) {
       // Normalizar dados se necessário (ex: converter snake_case para camelCase se o tipo exigir)
       // O tipo Order espera: id, pin, status, items[], total...
       // Supabase retorna snake_case por padrão? Depende da configuração, mas geralmente sim.
       // Vamos assumir que precisamos converter ou que o código já lida com isso.
       // Dado o código existente, parece que o projeto usa objetos compatíveis.
       // Mas o DB usa snake_case (schema.ts). O tipo usa camelCase.
       
       const mapItem = (item: any) => ({
         id: item.id,
         quantity: item.qty || item.quantity,
         unitPrice: (item.unit_price_cents || 0) / 100,
         notes: item.notes,
         menuItem: {
           ...item.menuItem,
           id: item.menuItem?.id,
           name: item.menuItem?.name,
           price: (item.menuItem?.price_cents || 0) / 100,
           categoryId: item.menuItem?.category_id,
           // Outros campos de MenuItem...
         },
         productionUnits: [], // Será preenchido/mantido pela lógica de migração do frontend se vazio
         // Se houver dados de productionUnits no banco (tabela kds_unit_states), teríamos que buscar também.
         // Por enquanto, enviamos o básico e deixamos o frontend reconstruir ou manter o estado local.
       });

       const mappedOrder = {
         id: data.id,
         pin: data.pin || (data.orders_details && data.orders_details[0]?.pin) || '000', // Se houver join
         status: data.status ? data.status.toUpperCase() : 'NEW',
         total: (data.total_cents || 0) / 100,
         createdAt: data.created_at,
         updatedAt: data.updated_at,
         items: (data.items || []).map(mapItem),
         // Campos faltantes podem ser preenchidos com defaults
         slaMinutes: 15, // Default
         paymentMethod: 'Dinheiro', // Default ou buscar de payments
         createdBy: 'Sistema',
       };
       
       return mappedOrder;
    }
    return null;
  } catch (e) {
    console.error('[Realtime] Exception fetching full order:', e);
    return null;
  }
}

async function upsertLocal(tableKey: keyof typeof ALL_TABLES, payload: any) {
  const row = payload?.new ?? payload?.record ?? payload
  if (!row) return

  // 1. Electron / DB Mode
  if (db) {
    // @ts-expect-error dynamic table
    const table = ALL_TABLES[tableKey]
    try {
        // Encontrar a coluna de ID correta para o onConflict
        // A maioria usa 'id', mas alguns usam 'orderId'
        const conflictTarget = table.id || table.orderId || table.key;
        
        if (!conflictTarget) {
            console.warn(`[Realtime] No primary key found for table ${String(tableKey)}`);
            return;
        }

        // Remover campos que não existem no schema local para evitar erros de inserção
        const cleanRow: any = { ...row, pendingSync: 0 };
        
        // Se a tabela local não tem 'id' mas o payload tem, e o PK local é outro (ex: order_id)
        if (row.id && !table.id && table.orderId && row.order_id) {
            delete cleanRow.id;
        }

        db
        .insert(table)
        .values(cleanRow)
        .onConflictDoUpdate({ target: [conflictTarget], set: cleanRow })
        .run?.()
    } catch (e) {
        console.error(`[Realtime] DB Insert failed for ${String(tableKey)}`, e)
    }
  } 
  
  // 2. Web / LocalStorage Mode
  if (typeof window !== 'undefined') {
      const storageMap: Record<string, string> = {
        'orders': 'orders',
        'categories': 'categories',
        'products': 'menuItems',
        'kitchenOperators': 'kitchenOperators',
        'kdsUnitStates': 'kdsUnitStates',
      };

      const storageKey = storageMap[tableKey as string];
      
      if (storageKey) {
          if (tableKey === 'orders') {
              // Para pedidos, precisamos buscar o objeto completo para não quebrar a UI
              // que espera 'items'. Apenas atualizar o status é seguro, mas um INSERT precisa de tudo.
              if (payload.eventType === 'INSERT' || !row.items) {
                 // Buscar pedido completo (exige lógica complexa de fetch, simplificado aqui)
                 // Como fallback, atualizamos apenas campos de topo se o pedido já existir
                 updateLocalStorage(storageKey, {
                     id: row.id,
                     status: row.status ? row.status.toUpperCase() : undefined,
                     updatedAt: row.updated_at,
                     // Se for novo, vai ficar incompleto até recarregar, 
                     // mas o ideal seria fetchFullOrder(row.id).
                 });
                 // TODO: Implementar fetchFullOrder se crítico
              } else {
                 updateLocalStorage(storageKey, row);
              }
          } else if (tableKey === 'products') {
              const menuItem = {
                id: row.id,
                name: row.name,
                price: (row.price_cents || 0) / 100,
                sla: row.sla_minutes || 15,
                categoryId: row.category_id,
                active: row.is_active !== false,
                code: row.sku,
                skipKitchen: row.skip_kitchen || false,
              };
              updateLocalStorage(storageKey, menuItem);
          } else if (tableKey === 'categories') {
              const category = {
                  id: row.id,
                  name: row.name,
                  order: row.display_order || 0,
                  active: row.is_active !== false,
                  // Preservar outros campos
              };
              updateLocalStorage(storageKey, category);
          } else {
              updateLocalStorage(storageKey, row);
          }
      }
  }
}

export function startRealtime() {
  stopRealtime()
  if (!supabase) {
    return
  }
  const tables: (keyof typeof ALL_TABLES)[] = [
    'categories',
    'products',
    'orders',
    'orderItems',
    'payments',
    'kdsTickets',
    'cashSessions',
    'cashMovements',
    'savedCarts',
    'kitchenOperators',
    'globalObservations',
    'kdsUnitStates',
    'kdsPhaseTimes',
  ]

  for (const key of tables) {
    const ch = supabase
      .channel(`realtime:${String(key)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: String(key) }, (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          upsertLocal(key, payload)
        }
      })
      .subscribe()
    channels.push(ch)
  }
}

export function stopRealtime() {
  if (supabase) {
    for (const ch of channels) {
      supabase.removeChannel(ch)
    }
  }
  channels = []
}
