import { db } from '@/offline/db/client'
import { ALL_TABLES, syncLog, deviceProfile } from '@/offline/db/schema'
import { eq, sql } from 'drizzle-orm'
import { supabase } from '@/utils/supabase'
import { showError } from '@/utils/toast'

type TableKey = keyof typeof ALL_TABLES

const TABLES_PUSH_ORDER: TableKey[] = [
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

export async function pushAll() {
  if (!supabase) {
    // Offline: sem Supabase configurado, nada a enviar
    return
  }
  const now = new Date().toISOString()
  const unitRow = (await db.select().from(deviceProfile))?.[0]
  const unitId: string | undefined = unitRow?.unitId ?? unitRow?.unit_id ?? undefined
  const REQUIRE_UNIT: TableKey[] = [
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
  ]
  for (const key of TABLES_PUSH_ORDER) {
    // @ts-expect-error generic table
    const table = ALL_TABLES[key]
    // Seleciona registros pendentes
    const pending = await db.select().from(table).where(sql`pending_sync = 1`)
    if (!pending.length) continue

    // Upsert em lotes
    const rows = (unitId && REQUIRE_UNIT.includes(key))
      ? (pending as any[]).map((r) => ({ ...r, unit_id: r.unit_id ?? unitId }))
      : pending
    const { error } = await supabase.from(key as string).upsert(rows, { onConflict: 'id' })
    if (error) {
      // Backoff simples (poderia ser exponencial)
      console.warn('Push error', key, error.message)
      const status = (error as any)?.status ?? undefined
      if (status === 401 || status === 403) {
        showError('Você não tem permissão para sincronizar estes dados (RBAC/RLS).')
      }
      continue
    }

    // Marca como sincronizado
    await db.update(table).set({ pendingSync: 0 }).where(sql`pending_sync = 1`).run?.()
    await updateSyncLog(key as string, { lastPushedAt: now })
  }
}

export async function pullAll() {
  if (!supabase) {
    // Offline: sem Supabase configurado, nada a puxar
    return
  }
  const unitRow = (await db.select().from(deviceProfile))?.[0]
  const unitId: string | undefined = unitRow?.unitId ?? unitRow?.unit_id ?? undefined
  const REQUIRE_UNIT: TableKey[] = [
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
  ]
  for (const key of TABLES_PUSH_ORDER) {
    // @ts-expect-error generic table
    const table = ALL_TABLES[key]
    // Obtém last_pulled_at
    const row = (await db.select().from(syncLog).where(eq(syncLog.tableName, key as string)))?.[0]
    const since = row?.lastPulledAt ?? '1970-01-01T00:00:00.000Z'

    let query = supabase
      .from(key as string)
      .select('*')
      .gte('updated_at', since)
    if (unitId && REQUIRE_UNIT.includes(key)) {
      query = query.eq('unit_id', unitId)
    }
    const { data, error } = await query

    if (error) {
      console.warn('Pull error', key, error.message)
      const status = (error as any)?.status ?? undefined
      if (status === 401 || status === 403) {
        showError('Você não tem permissão para sincronizar estes dados (RBAC/RLS).')
      }
      continue
    }
    if (!data || !data.length) {
      await updateSyncLog(key as string, { lastPulledAt: new Date().toISOString() })
      continue
    }

    // Conflitos
    // Catálogo: server-wins
    // Operacionais: maior updated_at vence; empate -> maior version
    await db.transaction(async (tx) => {
      for (const row of data as any[]) {
        // lê existente
        const existing = await tx.select().from(table).where(eq(table.id, row.id))
        const ex = existing[0]
        if (!ex) {
          await tx.insert(table).values({ ...row, pendingSync: 0 }).onConflictDoUpdate({ target: [table.id], set: { ...row, pendingSync: 0 } }).run?.()
          continue
        }

    const serverWins = key === 'products' || key === 'categories' || key === 'units' || key === 'stations'
    if (serverWins) {
      await tx.update(table).set({ ...row, pendingSync: 0 }).where(eq(table.id, row.id)).run?.()
      continue
    }

        const localUpdated = new Date(ex.updatedAt ?? 0).getTime()
        const remoteUpdated = new Date(row.updated_at ?? 0).getTime()
        if (remoteUpdated > localUpdated) {
          await tx.update(table).set({ ...row, pendingSync: 0 }).where(eq(table.id, row.id)).run?.()
        } else if (remoteUpdated === localUpdated) {
          const localVer = Number(ex.version ?? 1)
          const remoteVer = Number(row.version ?? 1)
          if (remoteVer >= localVer) {
            await tx.update(table).set({ ...row, pendingSync: 0 }).where(eq(table.id, row.id)).run?.()
          }
        }
      }
    })

    await updateSyncLog(key as string, { lastPulledAt: new Date().toISOString() })
  }
}

export async function updateSyncLog(tableName: string, fields: Partial<{ lastPulledAt: string; lastPushedAt: string }>) {
  const now = new Date().toISOString()
  await db
    .insert(syncLog)
    .values({ id: `${tableName}`, tableName, lastPulledAt: fields.lastPulledAt ?? null, lastPushedAt: fields.lastPushedAt ?? null })
    .onConflictDoUpdate({
      target: [syncLog.tableName],
      set: { lastPulledAt: fields.lastPulledAt ?? now, lastPushedAt: fields.lastPushedAt ?? now },
    })
    .run?.()
}
