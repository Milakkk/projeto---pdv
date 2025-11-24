import { BrowserRouter, HashRouter } from 'react-router-dom'
import { Suspense, useEffect } from 'react'
import { AppRoutes } from './router'
import { AuthProvider, useAuth } from './context/AuthContext';
import ToastProvider from './components/feature/ToastProvider';
import { seedCatalogIfEmpty } from '@/offline/bootstrap/catalog.seed';
import ErrorBoundary from './components/base/ErrorBoundary'
import { ensureDeviceProfile, getDeviceProfile } from '@/offline/services/deviceProfileService'
import * as kdsService from '@/offline/services/kdsService'

// Componente Wrapper para lidar com o redirecionamento inicial
function AppWrapper() {
  useAuth();
  
  useEffect(() => {
    try {
      seedCatalogIfEmpty()
    } catch (e) {
      console.error('[boot:error]', (e as any)?.message || e)
    }
  }, []);

  useEffect(() => {
    let ws: WebSocket | null = null
    ;(async () => {
      try {
        const hasIpc = typeof (window as any)?.api?.db?.query === 'function'
        let unitId = 'default'
        let deviceId = ''
        if (hasIpc) {
          await ensureDeviceProfile({ role: 'pos' })
          const dp = await getDeviceProfile()
          unitId = dp?.unitId || 'default'
          deviceId = dp?.deviceId || ''
        } else {
          try {
            const lsUnit = localStorage.getItem('unitId')
            const lsDevice = localStorage.getItem('deviceId')
            unitId = lsUnit || 'default'
            deviceId = lsDevice || crypto.randomUUID()
            if (!lsUnit) localStorage.setItem('unitId', unitId)
            if (!lsDevice) localStorage.setItem('deviceId', deviceId)
          } catch {
            unitId = 'default'
            deviceId = crypto.randomUUID()
          }
        }
        const hubUrl = (import.meta as any)?.env?.VITE_LAN_HUB_URL || 'http://localhost:4000'
        const secret = (import.meta as any)?.env?.VITE_LAN_SYNC_SECRET || ''
        if (!secret) return
        const wsUrl = hubUrl.replace(/^http/, 'ws').replace(/\/$/, '') + `/realtime?token=${encodeURIComponent(secret)}`
        ws = new WebSocket(wsUrl)
        const dispatchStorage = (key: string, newValue: string, oldValue: string | null) => {
          try {
            const ev = new StorageEvent('storage', { key, newValue, oldValue, url: window.location.href, storageArea: window.localStorage })
            window.dispatchEvent(ev)
          } catch {}
        }
        const applyEvent = (e: any) => {
          const table = String(e.table || '')
          const row = e.row || null
          if (table === 'cash_sessions' && row && row.id) {
            try {
              const oldCur = localStorage.getItem('currentCashSession')
              const cur = JSON.parse(oldCur || 'null')
              if (!cur || cur.id === row.id || !cur.closed_at) {
                const next = JSON.stringify(row)
                localStorage.setItem('currentCashSession', next)
                dispatchStorage('currentCashSession', next, oldCur)
              }
              const oldSessions = localStorage.getItem('cashSessions')
              const sessions = JSON.parse(oldSessions || '[]')
              const updated = [row, ...sessions.filter((s:any)=> s.id !== row.id)]
              const nextSessions = JSON.stringify(updated)
              localStorage.setItem('cashSessions', nextSessions)
              dispatchStorage('cashSessions', nextSessions, oldSessions)
            } catch {}
          } else if ((table === 'cash_movements' || table === 'cashMovements') && row && row.id) {
            try {
              const oldMovs = localStorage.getItem('cashMovements')
              const movs = JSON.parse(oldMovs || '[]')
              movs.push(row)
              const nextMovs = JSON.stringify(movs)
              localStorage.setItem('cashMovements', nextMovs)
              dispatchStorage('cashMovements', nextMovs, oldMovs)
            } catch {}
          } else if ((table === 'kds_tickets' || table === 'kdsTickets') && row && row.id) {
            try {
              const oldTk = localStorage.getItem('kdsTickets')
              const list = oldTk ? JSON.parse(oldTk) : []
              const idx = list.findIndex((t:any)=> String(t.id) === String(row.id))
              if (idx >= 0) {
                list[idx] = { ...list[idx], ...row }
                const next = JSON.stringify(list)
                localStorage.setItem('kdsTickets', next)
                dispatchStorage('kdsTickets', next, oldTk)
              } else {
                const next = JSON.stringify([row, ...list])
                localStorage.setItem('kdsTickets', next)
                dispatchStorage('kdsTickets', next, oldTk)
              }
            } catch {}
          } else if (table === 'kds_operators' && row) {
            try {
              const ops = Array.isArray(row?.operators) ? row.operators : []
              const oldOps = localStorage.getItem('kitchenOperators')
              const nextOps = JSON.stringify(ops)
              localStorage.setItem('kitchenOperators', nextOps)
              dispatchStorage('kitchenOperators', nextOps, oldOps)
            } catch {}
          } else if (table === 'kds_unit_operator' && row) {
            try {
              const key = `${row.orderId}:${row.itemId}:${row.unitId}`
              const oldState = localStorage.getItem('kdsUnitState')
              const state = oldState ? JSON.parse(oldState) : {}
              const cur = state[key] || {}
              state[key] = { ...cur, operatorName: row.operatorName }
              const nextState = JSON.stringify(state)
              localStorage.setItem('kdsUnitState', nextState)
              dispatchStorage('kdsUnitState', nextState, oldState)
            } catch {}
          } else if (table === 'kds_unit_status' && row) {
            try {
              const key = `${row.orderId}:${row.itemId}:${row.unitId}`
              const oldState = localStorage.getItem('kdsUnitState')
              const state = oldState ? JSON.parse(oldState) : {}
              const cur = state[key] || {}
              const patch: any = { unitStatus: row.unitStatus }
              if (Array.isArray(row.completedObservations)) patch.completedObservations = row.completedObservations
              if (row.unitStatus === 'READY') patch.completedAt = new Date().toISOString()
              else patch.completedAt = undefined
              state[key] = { ...cur, ...patch }
              const nextState = JSON.stringify(state)
              localStorage.setItem('kdsUnitState', nextState)
              dispatchStorage('kdsUnitState', nextState, oldState)
            } catch {}
          } else if (table === 'global_observations') {
            try {
              const obs = Array.isArray(row?.observations) ? row.observations : []
              const oldObs = localStorage.getItem('globalObservations')
              const nextObs = JSON.stringify(obs)
              localStorage.setItem('globalObservations', nextObs)
              dispatchStorage('globalObservations', nextObs, oldObs)
            } catch {}
          }
        }
        ws.addEventListener('open', () => {
          try { ws?.send(JSON.stringify({ unit_id: unitId, device_id: deviceId })) } catch {}
        })
        ws.addEventListener('message', (ev) => {
          try {
            const msg = JSON.parse(String(ev.data))
            if (Array.isArray(msg?.events)) {
              for (const e of msg.events) {
                applyEvent(e)
              }
              try { kdsService.applyHubEvents(msg.events) } catch {}
            }
          } catch {}
        })

        try {
          const headers: Record<string,string> = {}
          if (secret) headers['Authorization'] = `Bearer ${secret}`
          const url = hubUrl.replace(/\/$/, '') + `/pull?unit_id=${encodeURIComponent(unitId)}`
          const controller = new AbortController()
          const timeoutId = setTimeout(() => { try { controller.abort() } catch {} }, 5000)
          const res = await fetch(url, { headers, signal: controller.signal })
          clearTimeout(timeoutId)
          if (!res.ok) return
          const data = await res.json().catch(()=>({}))
          if (Array.isArray(data?.events)) {
            for (const e of data.events) applyEvent(e)
            try { kdsService.applyHubEvents(data.events) } catch {}
          }
        } catch {}
      } catch {}
    })()
    return () => { try { ws?.close() } catch {} }
  }, [])

  // Removido auto-login em dev para sempre exigir autenticação
  
  // Se não estiver autenticado, redireciona para /login
  // Se estiver autenticado, o ProtectedRoute cuidará do redirecionamento para /dashboard
  const routerBase = __BASE_PATH__ && __BASE_PATH__ !== './' ? __BASE_PATH__ : undefined
  const isElectron = typeof navigator !== 'undefined' && navigator.userAgent.includes('Electron')
  const RouterImpl = isElectron ? HashRouter : BrowserRouter
  return (
    <RouterImpl basename={routerBase}>
      <ErrorBoundary
        fallback={
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
              <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">Carregando...</p>
            </div>
          </div>
        }
      >
        <Suspense fallback={
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
              <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">Carregando...</p>
            </div>
          </div>
        }>
          <AppRoutes />
        </Suspense>
      </ErrorBoundary>
    </RouterImpl>
  );
}

function App() {
  // Captura global de erros para evitar silêncio em Electron
  if (typeof window !== 'undefined' && !(window as any).__errorsHooked) {
    (window as any).__errorsHooked = true
    window.addEventListener('error', (e) => {
      console.error('[GlobalError]', e.message, e.error)
    })
    window.addEventListener('unhandledrejection', (e) => {
      console.error('[GlobalUnhandledRejection]', (e.reason as any)?.message ?? e.reason)
    })
  }
  return (
    <AuthProvider>
      <ToastProvider />
      <AppWrapper />
    </AuthProvider>
  )
}

export default App
