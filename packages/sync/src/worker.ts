import { db } from '@/offline/db/client'
import { ALL_TABLES, syncLog, units } from '@db/schema'
import { eq, sql } from 'drizzle-orm'
import { supabase } from '@/utils/supabase'

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
  if (!db || !supabase) return
  const now = new Date().toISOString()
  const unitRow = (await db.select().from(units))?.[0]
  const unitId: string | undefined = unitRow?.id ?? unitRow?.unitId ?? unitRow?.unit_id ?? undefined

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
    const pending = await db.select().from(table).where(sql`pending_sync = 1`)
    if (!pending.length) continue

    const rows = (unitId && REQUIRE_UNIT.includes(key))
      ? (pending as any[]).map((r) => ({ ...r, unit_id: r.unit_id ?? unitId }))
      : pending

    const { error } = await supabase.from(String(key)).upsert(rows, { onConflict: 'id' })
    if (error) {
      console.warn('Push error', key, error.message)
      continue
    }

    await db.update(table).set({ pendingSync: 0 }).where(sql`pending_sync = 1`).run?.()
    await updateSyncLog(String(key), { lastSyncedAt: now })
  }
}

export async function pullAll() {
  if (!db || !supabase) return
  const unitRow = (await db.select().from(units))?.[0]
  const unitId: string | undefined = unitRow?.id ?? unitRow?.unitId ?? unitRow?.unit_id ?? undefined
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
    const row = (await db.select().from(syncLog).where(eq(syncLog.table, String(key))))?.[0]
    const since = row?.lastSyncedAt ?? '1970-01-01T00:00:00.000Z'

    let query = supabase.from(String(key)).select('*').gte('updated_at', since)
    if (unitId && REQUIRE_UNIT.includes(key)) {
      query = query.eq('unit_id', unitId)
    }
    const { data, error } = await query
    if (error) {
      console.warn('Pull error', key, error.message)
      continue
    }
    if (!data || !data.length) {
      await updateSyncLog(String(key), { lastSyncedAt: new Date().toISOString() })
      continue
    }

    await db.transaction(async (tx) => {
      for (const r of data as any[]) {
        const existing = await tx.select().from(table).where(eq(table.id, r.id))
        const ex = existing[0]
        if (!ex) {
          await tx
            .insert(table)
            .values({ ...r, pendingSync: 0 })
            .onConflictDoUpdate({ target: [table.id], set: { ...r, pendingSync: 0 } })
            .run?.()
          continue
        }

        const serverWins = key === 'products' || key === 'categories' || key === 'units' || key === 'stations'
        if (serverWins) {
          await tx.update(table).set({ ...r, pendingSync: 0 }).where(eq(table.id, r.id)).run?.()
          continue
        }

        const localUpdated = new Date(ex.updatedAt ?? 0).getTime()
        const remoteUpdated = new Date(r.updated_at ?? 0).getTime()
        if (remoteUpdated > localUpdated) {
          await tx.update(table).set({ ...r, pendingSync: 0 }).where(eq(table.id, r.id)).run?.()
        } else if (remoteUpdated === localUpdated) {
          const localVer = Number((ex as any).version ?? 1)
          const remoteVer = Number((r as any).version ?? 1)
          if (remoteVer >= localVer) {
            await tx.update(table).set({ ...r, pendingSync: 0 }).where(eq(table.id, r.id)).run?.()
          }
        }
      }
    })

    await updateSyncLog(String(key), { lastSyncedAt: new Date().toISOString() })
  }
}

export async function updateSyncLog(
  tableName: string,
  fields: Partial<{ lastSyncedAt: string }>,
) {
  const now = new Date().toISOString()
  await db
    .insert(syncLog)
    .values({ id: `${tableName}`, table: tableName, lastSyncedAt: fields.lastSyncedAt ?? now })
    .onConflictDoUpdate({ target: [syncLog.table], set: { lastSyncedAt: fields.lastSyncedAt ?? now } })
    .run?.()
}

export function startSync(opts: { intervalBaseMs?: number; jitterMs?: number } = {}) {
  const intervalBaseMs = opts.intervalBaseMs ?? 3000
  const jitterMs = opts.jitterMs ?? 500
  let stopped = false

  async function loop() {
    if (stopped) return
    try {
      await pushAll()
      await pullAll()
    } catch (err) {
      console.warn('Sync loop error', (err as any)?.message ?? err)
    }
    const jitter = Math.floor(Math.random() * jitterMs)
    setTimeout(loop, intervalBaseMs + jitter)
  }

  // Não inicia se DB local indisponível
  if (db) loop()

  return { stop() { stopped = true } }
}
