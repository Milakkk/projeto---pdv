import { supabase } from '@/utils/supabase'
import { db } from '@/offline/db/client'
import { ALL_TABLES } from '@/offline/db/schema'
import { eq } from 'drizzle-orm'

let channels: Array<ReturnType<typeof supabase.channel>> = []

function upsertLocal(tableKey: keyof typeof ALL_TABLES, payload: any) {
  // @ts-expect-error dynamic table
  const table = ALL_TABLES[tableKey]
  const row = payload?.new ?? payload?.record ?? payload
  if (!row) return

  try {
    const conflictTarget = table.id || table.orderId || table.key;
    if (!conflictTarget) return;

    const cleanRow: any = { ...row, pendingSync: 0 };
    // Mapeamento de nomes de colunas se necessário (Supabase snake_case para Drizzle camelCase se não houver mapeamento automático)
    // O Drizzle costuma lidar com isso se as colunas forem definidas com o nome correto no DB.
    
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

export function startRealtime() {
  stopRealtime()
  if (!supabase) {
    // Offline: sem Supabase configurado
    return
  }
  const tables: (keyof typeof ALL_TABLES)[] = [
    'units',
    'stations',
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
        // INSERT/UPDATE server-wins update local copy
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          upsertLocal(key, payload)
        }
        // DELETE é bloqueado por RLS; ignorar
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
