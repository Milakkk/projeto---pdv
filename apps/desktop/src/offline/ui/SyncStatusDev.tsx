import { useEffect, useState } from 'react'

type Status = {
  lastPulledAt?: string | null
  lastPushedAt?: string | null
  pendingCounts?: Record<string, number>
  error?: string
}

export default function SyncStatusDev() {
  const [status, setStatus] = useState<Status>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const { db } = await import('@/offline/db/client')
        const { syncLog, ALL_TABLES } = await import('@/offline/db/schema')
        const counts: Record<string, number> = {}
        // @ts-ignore: iterate table map
        for (const [key, table] of Object.entries(ALL_TABLES)) {
          // @ts-expect-error drizzle count
          const rows = await db.select({ c: db.fn.count() }).from(table).where(db.sql`pending_sync = 1`)
          counts[key] = Number(rows?.[0]?.c ?? 0)
        }
        const rows = await db.select().from(syncLog)
        const agg = rows.reduce(
          (acc, r) => ({
            lastPulledAt: acc.lastPulledAt && r.lastPulledAt && acc.lastPulledAt > r.lastPulledAt ? acc.lastPulledAt : r.lastPulledAt,
            lastPushedAt: acc.lastPushedAt && r.lastPushedAt && acc.lastPushedAt > r.lastPushedAt ? acc.lastPushedAt : r.lastPushedAt,
          }),
          { lastPulledAt: null as string | null, lastPushedAt: null as string | null }
        )
        if (mounted) setStatus({ ...agg, pendingCounts: counts })
      } catch (e: any) {
        if (mounted) setStatus({ error: e?.message ?? 'Falha ao ler SQLite local' })
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  const forceSync = async () => {
    setLoading(true)
    try {
      const { pullAll, pushAll } = await import('@/offline/sync/worker')
      await pullAll()
      await pushAll()
    } catch (e) {
      console.warn(e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Sync Status (Dev)</h1>
      {status.error && (
        <div className="text-red-600">{status.error} — verifique ambiente (Tauri/Electron) para SQLite.</div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border rounded p-4">
          <div className="font-medium mb-2">Último Pull</div>
          <div>{status.lastPulledAt ?? '—'}</div>
        </div>
        <div className="border rounded p-4">
          <div className="font-medium mb-2">Último Push</div>
          <div>{status.lastPushedAt ?? '—'}</div>
        </div>
      </div>
      <div className="border rounded p-4">
        <div className="font-medium mb-2">Pendências</div>
        <ul className="list-disc pl-5">
          {status.pendingCounts &&
            Object.entries(status.pendingCounts).map(([k, v]) => (
              <li key={k}>
                {k}: {v}
              </li>
            ))}
          {!status.pendingCounts && <li>—</li>}
        </ul>
      </div>
      <button
        className="px-4 py-2 rounded bg-amber-600 text-white disabled:opacity-50"
        onClick={forceSync}
        disabled={loading}
      >
        {loading ? 'Sincronizando...' : 'Forçar Sync'}
      </button>
    </div>
  )
}

