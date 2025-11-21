import { StrictMode } from 'react'
import './i18n'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { runMigrationOnce } from './offline/bootstrap/migrateFromLocalStorage'
import { startSyncService, TransportMode } from '@sync/syncService'

// Inicializa migração localStorage -> SQLite e o loop de sync
runMigrationOnce().then(() => {
  startSyncService({
    mode: (import.meta.env?.VITE_SYNC_TRANSPORT as TransportMode) ?? TransportMode.CLOUD,
    lanIntervalMs: 500,
    cloudIntervalMs: 3000,
  })
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
