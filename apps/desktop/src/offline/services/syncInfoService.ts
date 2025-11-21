import { db } from '../db/client'
import { ALL_TABLES, syncLog, syncMeta, units } from '../db/schema'
import { eq } from 'drizzle-orm'
import { getDeviceProfile } from './deviceProfileService'

export type OperationMode = 'Online' | 'Offline' | 'Híbrido'

const transport = (import.meta.env.VITE_SYNC_TRANSPORT ?? 'cloud') as 'cloud' | 'lan' | 'both'

function getConnectivityMode(): OperationMode {
  if (!navigator.onLine) return 'Offline'
  if (transport === 'both') return 'Híbrido'
  return 'Online'
}

export async function getQueueSize(): Promise<number> {
  // Sum of pendingSync across operational tables
  let total = 0
  // ALL_TABLES é um objeto; iteramos seus valores
  for (const table of Object.values(ALL_TABLES)) {
    // Nem todas as tabelas possuem coluna pendingSync
    // @ts-ignore - checagem dinâmica
    if (!table?.columns || !("pendingSync" in (table as any).columns)) continue
    // @ts-ignore - acesso dinâmico à coluna
    const pendingCol = (table as any).columns.pendingSync
    const rows = await db.select({ c: pendingCol }).from(table as any).where(eq(pendingCol, 1))
    total += Array.isArray(rows) ? rows.length : 0
  }
  return total
}

export async function getLastSyncAt(): Promise<Date | null> {
  try {
    const logs = await db.select().from(syncLog)
    let latest: number = 0
    for (const l of logs) {
      const t1 = l.lastPulledAt ? new Date(l.lastPulledAt).getTime() : 0
      const t2 = l.lastPushedAt ? new Date(l.lastPushedAt).getTime() : 0
      latest = Math.max(latest, t1, t2)
    }
    const meta = await db.select().from(syncMeta)
    for (const m of meta) {
      if (m.key?.toLowerCase().includes('lastsync')) {
        const t = m.updatedAt ? new Date(m.updatedAt).getTime() : 0
        latest = Math.max(latest, t)
      }
    }
    return latest ? new Date(latest) : null
  } catch {
    return null
  }
}

export async function getUnitName(unitId?: string | null): Promise<string | null> {
  try {
    const profile = await getDeviceProfile()
    const id = unitId ?? profile?.unitId
    if (!id) return null
    const rows = await db.select().from(units).where(eq(units.id, id))
    return rows?.[0]?.name ?? null
  } catch {
    return null
  }
}

export function getLocalIp(): string | null {
  try {
    // exposed via preload if available
    // @ts-ignore
    const ip = window?.api?.system?.getLocalIp?.()
    return ip || null
  } catch {
    return null
  }
}

export function getDataPath(): string | null {
  try {
    // @ts-ignore
    return window?.api?.system?.getDataPath?.() ?? null
  } catch {
    return null
  }
}

export async function getOperationInfo() {
  const profile = await getDeviceProfile()
  const queue = await getQueueSize()
  const last = await getLastSyncAt()
  const unitName = await getUnitName(profile?.unitId)
  const ip = getLocalIp()
  const mode = getConnectivityMode()
  return {
    mode,
    queueSize: queue,
    lastSyncAt: last,
    unitName,
    localIp: ip,
    profile,
  }
}

export function getAppVersions() {
  const appVersion = import.meta.env?.VITE_APP_VERSION || '0.0.0'
  const electronVersion = (window as any)?.process?.versions?.electron || 'unknown'
  return { appVersion, electronVersion }
}

export async function getDbVersion(): Promise<number | null> {
  try {
    // Use raw PRAGMA via exposed db bridge
    // @ts-ignore
    const result = await window.api?.db?.query?.('PRAGMA user_version')
    if (Array.isArray(result) && result[0] && typeof result[0].user_version !== 'undefined') {
      return Number(result[0].user_version) || 0
    }
    return null
  } catch {
    return null
  }
}
