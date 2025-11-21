import { RouteObject, Navigate } from 'react-router-dom';
import { lazy } from 'react';
import ProtectedRoute from '../components/auth/ProtectedRoute';
import { Module } from '../types';

// Telas de Autenticação e Dashboard
const LoginPage = lazy(() => import('../pages/auth/LoginPage'));
const DashboardPage = lazy(() => import('../pages/DashboardPage.tsx'));
const NotFoundPage = lazy(() => import('../pages/NotFound'));

// Módulos
const CaixaPage = lazy(() => import('../pages/caixa/page'));
const CozinhaPage = lazy(() => import('../pages/cozinha/page'));
const ConfiguracoesPage = lazy(() => import('../pages/configuracoes/page'));
const RelatoriosPage = lazy(() => import('../pages/relatorios/page'));
const GerenciamentoCaixaPage = lazy(() => import('../pages/gerenciamento-caixa/page'));
const MasterConfigPage = lazy(() => import('../pages/master/MasterConfigPage')); // Nova página Master

// Novos Módulos
const TarefasPage = lazy(() => import('../pages/tarefas/page'));
const ChecklistPage = lazy(() => import('../pages/checklist/page'));
const ProcedimentosPage = lazy(() => import('../pages/procedimentos/page'));
const RHPage = lazy(() => import('../pages/rh/page'));
const RHConfigPage = lazy(() => import('../pages/rh/ConfigPage'));

// Rota de debug de sync apenas em desenvolvimento
const SyncStatusDev = import.meta.env.DEV ? lazy(() => import('../offline/ui/SyncStatusDev')) : null


const routes: RouteObject[] = [
  // Normaliza carregamento via file://index.html no Electron
  {
    path: '/index.html',
    element: <Navigate to="/login" replace />
  },
  // Rota de Login
  {
    path: '/login',
    element: <LoginPage />
  },
  
  // Rotas Protegidas (Requer autenticação)
  {
    path: '/',
    element: <ProtectedRoute />,
    children: [
      // Rota Raiz -> Dashboard
      {
        index: true,
        element: <DashboardPage />
      },
      {
        path: '/dashboard',
        element: <DashboardPage />
      },
      
      // Módulo Master (Permissão MASTER)
      {
        path: '/master-config',
        element: <ProtectedRoute requiredPermission={'MASTER' as Module} />,
        children: [
          {
            index: true,
            element: <MasterConfigPage />
          }
        ]
      },

      // Módulos com Navegação (Renderiza Navigation e Outlet)
      {
        path: '/',
        element: <ProtectedRoute isModuleRoute={true} />, 
        children: [
          // Módulo CAIXA
          {
            path: '/caixa',
            element: <ProtectedRoute requiredPermission={'CAIXA' as Module} />,
            children: [
              { index: true, element: <CaixaPage /> },
              // Configurações movidas para o módulo CAIXA
              { path: '/caixa/configuracoes', element: <ConfiguracoesPage /> }
            ]
          },
          
          // Módulo COZINHA
          {
            path: '/cozinha',
            element: <ProtectedRoute requiredPermission={'COZINHA' as Module} />,
            children: [
              { index: true, element: <CozinhaPage /> },
            ]
          },
          
          // Módulo GESTÃO
          {
            path: '/relatorios',
            element: <ProtectedRoute requiredPermission={'GESTAO' as Module} />,
            children: [
              { index: true, element: <RelatoriosPage /> }
            ]
          },
          {
            path: '/gerenciamento-caixa',
            element: <ProtectedRoute requiredPermission={'GESTAO' as Module} />,
            children: [
              { index: true, element: <GerenciamentoCaixaPage /> }
            ]
          },
          // A rota /configuracoes foi removida daqui
          
          // Novos Módulos Operacionais (Permissão TAREFAS, CHECKLIST, PROCEDIMENTOS)
          {
            path: '/tarefas',
            element: <ProtectedRoute requiredPermission={'TAREFAS' as Module} />,
            children: [
              { index: true, element: <TarefasPage /> }
            ]
          },
          {
            path: '/checklist',
            element: <ProtectedRoute requiredPermission={'CHECKLIST' as Module} />,
            children: [
              { index: true, element: <ChecklistPage /> }
            ]
          },
          {
            path: '/procedimentos',
            element: <ProtectedRoute requiredPermission={'PROCEDIMENTOS' as Module} />,
            children: [
              { index: true, element: <ProcedimentosPage /> }
            ]
          },
          {
            path: '/rh',
            element: <ProtectedRoute requiredPermission={'RH' as Module} />,
            children: [
              { index: true, element: <RHPage /> },
              { path: '/rh/config', element: <RHConfigPage /> }
            ]
          },
        ]
      },
    ]
  },
  
  // Rota 404
  {
    path: '*',
    element: <NotFoundPage />
  }
];

// Anexa rota /sync-status apenas em DEV
if (import.meta.env.DEV && SyncStatusDev) {
  routes.unshift({ path: '/sync-status', element: <SyncStatusDev /> })
}

export default routes;
