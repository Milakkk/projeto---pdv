import { BrowserRouter, HashRouter } from 'react-router-dom'
import { Suspense, useEffect } from 'react'
import { AppRoutes } from './router'
import { AuthProvider, useAuth } from './context/AuthContext';
import ToastProvider from './components/feature/ToastProvider';
import { runMigrationOnce } from '@/offline/bootstrap/migrateFromLocalStorage';
import { startRealtime, stopRealtime } from '@/offline/sync/realtime';
import { pushAll, pullAll } from '@/offline/sync/worker';
import { useCatalogSync } from './hooks/useCatalogSync';

// Componente Wrapper para lidar com o redirecionamento inicial
function AppWrapper() {
  const { isAuthenticated } = useAuth();
  
  // Hook para sincronizar catálogo (Categorias e Produtos) do Supabase
  useCatalogSync();
  
  // Rodar migração após primeiro mount
  useEffect(() => {
    runMigrationOnce();
    // Inicia realtime e agenda sincronização periódica
    startRealtime();
    const interval = setInterval(() => {
      // Puxa mudanças do servidor primeiro, depois envia locais
      pullAll().then(() => pushAll()).catch(() => {/* noop */})
    }, 30_000);
    return () => {
      clearInterval(interval);
      stopRealtime();
    }
  }, []);
  
  // Se não estiver autenticado, redireciona para /login
  // Se estiver autenticado, o ProtectedRoute cuidará do redirecionamento para /dashboard
  const routerBase = __BASE_PATH__ && __BASE_PATH__ !== './' ? __BASE_PATH__ : undefined
  const isElectron = typeof navigator !== 'undefined' && navigator.userAgent.includes('Electron')
  const RouterImpl = isElectron ? HashRouter : BrowserRouter
  return (
    <RouterImpl basename={isElectron ? undefined : routerBase}>
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
    </RouterImpl>
  );
}

function App() {
  return (
    <AuthProvider>
      <ToastProvider />
      <AppWrapper />
    </AuthProvider>
  )
}

export default App
