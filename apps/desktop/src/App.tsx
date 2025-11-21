import { BrowserRouter, HashRouter } from 'react-router-dom'
import { Suspense, useEffect } from 'react'
import { AppRoutes } from './router'
import { AuthProvider, useAuth } from './context/AuthContext';
import ToastProvider from './components/feature/ToastProvider';
import { seedCatalogIfEmpty } from '@/offline/bootstrap/catalog.seed';
import ErrorBoundary from './components/base/ErrorBoundary'
import { ensureDeviceProfile, getDeviceProfile } from '@/offline/services/deviceProfileService'

// Componente Wrapper para lidar com o redirecionamento inicial
function AppWrapper() {
  const { isAuthenticated } = useAuth();
  
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
        await ensureDeviceProfile({ role: 'pos' })
        const dp = await getDeviceProfile()
        const unitId = dp?.unitId || 'default'
        const deviceId = dp?.deviceId || ''
        const hubUrl = (import.meta as any)?.env?.VITE_LAN_HUB_URL || 'http://localhost:4000'
        const secret = (import.meta as any)?.env?.VITE_LAN_SYNC_SECRET || ''
        const wsUrl = hubUrl.replace(/^http/, 'ws').replace(/\/$/, '') + `/realtime${secret ? `?token=${encodeURIComponent(secret)}` : ''}`
        ws = new WebSocket(wsUrl)
        const applyEvent = (e: any) => {
          const table = String(e.table || '')
          const row = e.row || null
          if (table === 'cash_sessions' && row && row.id) {
            try {
              const cur = JSON.parse(localStorage.getItem('currentCashSession') || 'null')
              if (!cur || cur.id === row.id || !cur.closed_at) {
                localStorage.setItem('currentCashSession', JSON.stringify(row))
              }
              const sessions = JSON.parse(localStorage.getItem('cashSessions') || '[]')
              const updated = [row, ...sessions.filter((s:any)=> s.id !== row.id)]
              localStorage.setItem('cashSessions', JSON.stringify(updated))
            } catch {}
          } else if (table === 'cash_movements' && row && row.id) {
            try {
              const movs = JSON.parse(localStorage.getItem('cashMovements') || '[]')
              movs.push(row)
              localStorage.setItem('cashMovements', JSON.stringify(movs))
            } catch {}
          } else if (table === 'kds_operators' && row) {
            try {
              const ops = Array.isArray(row?.operators) ? row.operators : []
              localStorage.setItem('kitchenOperators', JSON.stringify(ops))
            } catch {}
          } else if (table === 'kds_unit_operator' && row) {
            try {
              const key = `${row.orderId}:${row.itemId}:${row.unitId}`
              const raw = localStorage.getItem('kdsUnitState')
              const state = raw ? JSON.parse(raw) : {}
              const cur = state[key] || {}
              state[key] = { ...cur, operatorName: row.operatorName }
              localStorage.setItem('kdsUnitState', JSON.stringify(state))
            } catch {}
          } else if (table === 'kds_unit_status' && row) {
            try {
              const key = `${row.orderId}:${row.itemId}:${row.unitId}`
              const raw = localStorage.getItem('kdsUnitState')
              const state = raw ? JSON.parse(raw) : {}
              const cur = state[key] || {}
              const patch: any = { unitStatus: row.unitStatus }
              if (Array.isArray(row.completedObservations)) patch.completedObservations = row.completedObservations
              if (row.unitStatus === 'READY') patch.completedAt = new Date().toISOString()
              else patch.completedAt = undefined
              state[key] = { ...cur, ...patch }
              localStorage.setItem('kdsUnitState', JSON.stringify(state))
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
            }
          } catch {}
        })

        try {
          const headers: Record<string,string> = {}
          if (secret) headers['Authorization'] = `Bearer ${secret}`
          const url = hubUrl.replace(/\/$/, '') + `/pull?unit_id=${encodeURIComponent(unitId)}`
          const res = await fetch(url, { headers })
          const data = await res.json().catch(()=>({}))
          if (Array.isArray(data?.events)) {
            for (const e of data.events) applyEvent(e)
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
  const RouterImpl = HashRouter
  return (
    <RouterImpl basename={undefined}>
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
