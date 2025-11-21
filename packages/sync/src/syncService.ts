import { db } from '@/offline/db/client'
import { ALL_TABLES, deviceProfile, syncMeta } from '@/offline/db/schema'
import { eq, sql } from 'drizzle-orm'
import { startSync as startCloudLoop, pushAll as cloudPushAll, pullAll as cloudPullAll } from './worker'
import { LanClient } from '../../lan-sync/client'

export enum TransportMode {
  CLOUD = 'cloud',
  LAN = 'lan',
  BOTH = 'both',
}

function getEnv(key: string, def?: string) {
  const v = (typeof process !== 'undefined' ? (process.env as any)[key] : undefined) as string | undefined
  return v ?? def
}

async function getDeviceProfile() {
  const rows = await db?.select().from(deviceProfile)
  return rows?.[0]
}

async function getLanLastSync(): Promise<string | undefined> {
  const rows = await db?.select().from(syncMeta).where(eq(syncMeta.key, 'lastSyncLanAt'))
  return rows?.[0]?.value ?? undefined
}

async function setLanLastSync(iso: string) {
  await db
    ?.insert(syncMeta)
    .values({ key: 'lastSyncLanAt', value: iso })
    .onConflictDoUpdate({ target: [syncMeta.key], set: { value: iso, updatedAt: sql`CURRENT_TIMESTAMP` } })
    .run?.()
}

type TableKey = keyof typeof ALL_TABLES
const DEFAULT_TABLES_ORDER: TableKey[] = [
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

async function buildLanEvents(unitId?: string) {
  const events: Array<{ table: string; rows: any[]; unit_id?: string; updated_at?: string }> = []
  for (const key of DEFAULT_TABLES_ORDER) {
    // @ts-expect-error dynamic
    const table = ALL_TABLES[key]
    const pending = await db?.select().from(table).where(sql`pending_sync = 1`)
    if (pending && pending.length) {
      events.push({ table: String(key), rows: pending as any[], unit_id: unitId })
    }
  }
  return events
}

async function applyEventsLocally(list: Array<{ table: string; rows?: any[]; row?: any }>) {
  for (const ev of list) {
    const rows = ev.rows ?? (ev.row ? [ev.row] : [])
    const key = ev.table as TableKey
    // @ts-expect-error dynamic
    const table = ALL_TABLES[key]
    if (!table || !rows?.length) continue
    await db?.transaction(async (tx) => {
      for (const r of rows) {
        await tx
          .insert(table)
          .values({ ...r, pendingSync: 0 })
          .onConflictDoUpdate({ target: [table.id], set: { ...r, pendingSync: 0 } })
          .run?.()
      }
    })
  }
}

export function startSyncService(opts: { mode?: TransportMode; lanIntervalMs?: number; cloudIntervalMs?: number } = {}) {
  const mode = opts.mode ?? (getEnv('SYNC_TRANSPORT', 'cloud') as TransportMode)
  const hubUrl = getEnv('LAN_HUB_URL')
  const secret = getEnv('LAN_SYNC_SECRET')
  let stopped = false

  let cloudHandle: { stop: () => void } | null = null
  let lanClient: LanClient | null = null

  async function startLan() {
    if (!db || !hubUrl) return
    const profile = await getDeviceProfile()
    if (!profile?.unitId || !profile?.deviceId) return
    lanClient = new LanClient({ hubUrl, secret })
    lanClient.onEvent(async (events) => {
      await applyEventsLocally(events as any)
      await setLanLastSync(new Date().toISOString())
    })
    lanClient.connect(profile.unitId, profile.deviceId)

    const loopInterval = opts.lanIntervalMs ?? 500
    async function lanLoop() {
      if (stopped || !lanClient) return
      try {
        const events = await buildLanEvents(profile.unitId)
        if (events.length) await lanClient.push(events as any)
        const since = await getLanLastSync()
        const pulled = await lanClient.pull(profile.unitId, since)
        if (pulled?.length) {
          await applyEventsLocally(pulled as any)
          await setLanLastSync(new Date().toISOString())
        }
      } catch (err) {
        console.warn('LAN sync error', (err as any)?.message ?? err)
      }
      setTimeout(lanLoop, loopInterval)
    }
    lanLoop()
  }

  if (mode === TransportMode.CLOUD) {
    cloudHandle = startCloudLoop({ intervalBaseMs: opts.cloudIntervalMs ?? 3000, jitterMs: 500 })
  } else if (mode === TransportMode.LAN) {
    startLan()
  } else {
    // BOTH: LAN prioridade, CLOUD para consistência
    startLan()
    cloudHandle = startCloudLoop({ intervalBaseMs: opts.cloudIntervalMs ?? 3000, jitterMs: 500 })
  }

  return {
    stop() {
      stopped = true
      cloudHandle?.stop()
    },
    pushCloud: cloudPushAll,
    pullCloud: cloudPullAll,
  }
}
