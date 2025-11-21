import { BrowserRouter, HashRouter } from 'react-router-dom'
import { Suspense, useEffect } from 'react'
import { AppRoutes } from './router'
import { AuthProvider, useAuth } from './context/AuthContext';
import ToastProvider from './components/feature/ToastProvider';
import { seedCatalogIfEmpty } from '@/offline/bootstrap/catalog.seed';
import ErrorBoundary from './components/base/ErrorBoundary'

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
