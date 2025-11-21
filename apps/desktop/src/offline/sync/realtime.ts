import { supabase } from '@/utils/supabase'
import { db } from '@/offline/db/client'
import { ALL_TABLES } from '@/offline/db/schema'
import { eq } from 'drizzle-orm'

let channels: Array<ReturnType<typeof supabase.channel>> = []

function upsertLocal(tableKey: keyof typeof ALL_TABLES, payload: any) {
  // @ts-expect-error dynamic table
  const table = ALL_TABLES[tableKey]
  const row = payload?.new ?? payload?.record ?? payload
  if (!row || !row.id) return
  db
    .insert(table)
    .values({ ...row, pendingSync: 0 })
    .onConflictDoUpdate({ target: [table.id], set: { ...row, pendingSync: 0 } })
    .run?.()
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
