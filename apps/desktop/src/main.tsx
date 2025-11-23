import { StrictMode } from 'react'
import './i18n'
import { createRoot } from 'react-dom/client'
import './index.css'
import 'material-symbols'
import 'remixicon/fonts/remixicon.css'
import App from './App.tsx'
import { startSyncService, TransportMode } from '@sync/syncService'

try {
  startSyncService({
    mode: (import.meta.env?.VITE_SYNC_TRANSPORT as TransportMode) ?? TransportMode.BOTH,
    lanIntervalMs: 500,
    cloudIntervalMs: 3000,
  })
} catch {}

const isElectron = typeof navigator !== 'undefined' && navigator.userAgent.includes('Electron')
createRoot(document.getElementById('root')!).render(
  isElectron ? <App /> : (
    <StrictMode>
      <App />
    </StrictMode>
  ),
)
