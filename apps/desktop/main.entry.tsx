// Ponto de entrada do desktop, bootstrap local resolvendo dependências a partir de apps/desktop
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './src/i18n'
import './src/index.css'
import 'material-symbols'
import 'remixicon/fonts/remixicon.css'
import App from './src/App.tsx'

// Logs globais para evitar falhas silenciosas no renderer
window.addEventListener('error', (e) => console.error('[renderer error]', (e as any)?.error || (e as any)?.message))
// eslint-disable-next-line @typescript-eslint/no-explicit-any
window.addEventListener('unhandledrejection', (e: any) => console.error('[renderer promise]', e?.reason))

const rootEl = document.getElementById('root')
if (!rootEl) {
  console.error('[renderer] #root not found')
} else {
  createRoot(rootEl).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
