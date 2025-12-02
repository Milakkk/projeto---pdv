import { RouteObject, Navigate } from 'react-router-dom';
import { lazy } from 'react';
import ProtectedRoute from '../components/auth/ProtectedRoute';
import { Module } from '../types';

// Telas de Autenticação e Dashboard
const LoginPage = lazy(() => import('../pages/auth/LoginPage'));
const ModuleSelectorPage = lazy(() => import('../pages/home/ModuleSelectorPage')); // Nova tela inicial
const DashboardPage = lazy(() => import('../pages/DashboardPage')); // Mantido para compatibilidade
const NotFoundPage = lazy(() => import('../pages/NotFound'));

// Módulos Principais
const CaixaPage = lazy(() => import('../pages/caixa/page'));
const CozinhaPage = lazy(() => import('../pages/cozinha/page'));
const ConfiguracoesPage = lazy(() => import('../pages/configuracoes/page'));
const RelatoriosPage = lazy(() => import('../pages/relatorios/page'));
const GerenciamentoCaixaPage = lazy(() => import('../pages/gerenciamento-caixa/page'));
const MasterConfigPage = lazy(() => import('../pages/master/MasterConfigPage'));

// Novos Módulos de Menu
const TarefasPopsPage = lazy(() => import('../pages/tarefas-pops/page')); // Submenu Tarefas/POPs
const AdmPage = lazy(() => import('../pages/adm/page')); // Menu Administração
const ClientePage = lazy(() => import('../pages/cliente/page')); // Totem Cliente

// Módulos Operacionais
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
      // Rota Raiz -> Nova Tela de Seleção de Módulos
      {
        index: true,
        element: <ModuleSelectorPage />
      },
      {
        path: '/dashboard',
        element: <ModuleSelectorPage />
      },
      // Mantém compatibilidade com antiga rota de dashboard
      {
        path: '/dashboard-old',
        element: <DashboardPage />
      },
      
      // ====== NOVOS MENUS DE NAVEGAÇÃO ======
      
      // Menu Tarefas & POPs
      {
        path: '/tarefas-pops',
        element: <TarefasPopsPage />
      },
      
      // Menu Administração
      {
        path: '/adm',
        element: <AdmPage />
      },
      
      // Totem Cliente (PDV Autoatendimento)
      {
        path: '/cliente',
        element: <ClientePage />
      },
      
      // ====== MÓDULOS ADMINISTRATIVOS ======
      
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

      // ====== MÓDULOS OPERACIONAIS ======
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
          
          // Módulo GESTÃO - Relatórios
          {
            path: '/relatorios',
            element: <ProtectedRoute requiredPermission={'GESTAO' as Module} />,
            children: [
              { index: true, element: <RelatoriosPage /> }
            ]
          },
          
          // Módulo GESTÃO - Gerenciamento de Caixa
          {
            path: '/gerenciamento-caixa',
            element: <ProtectedRoute requiredPermission={'GESTAO' as Module} />,
            children: [
              { index: true, element: <GerenciamentoCaixaPage /> }
            ]
          },
          
          // Módulo TAREFAS
          {
            path: '/tarefas',
            element: <ProtectedRoute requiredPermission={'TAREFAS' as Module} />,
            children: [
              { index: true, element: <TarefasPage /> }
            ]
          },
          
          // Módulo CHECKLIST
          {
            path: '/checklist',
            element: <ProtectedRoute requiredPermission={'CHECKLIST' as Module} />,
            children: [
              { index: true, element: <ChecklistPage /> }
            ]
          },
          
          // Módulo PROCEDIMENTOS
          {
            path: '/procedimentos',
            element: <ProtectedRoute requiredPermission={'PROCEDIMENTOS' as Module} />,
            children: [
              { index: true, element: <ProcedimentosPage /> }
            ]
          },
          
          // Módulo RH
          {
            path: '/rh',
            element: <ProtectedRoute requiredPermission={'RH' as Module} />,
            children: [
              { index: true, element: <RHPage /> },
              { path: '/rh/config', element: <RHConfigPage /> }
            ]
          },
          
          // Placeholder para Estoque (futuro)
          {
            path: '/estoque',
            element: <ProtectedRoute requiredPermission={'GESTAO' as Module} />,
            children: [
              { 
                index: true, 
                element: (
                  <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                    <div className="text-center">
                      <i className="ri-archive-drawer-line text-6xl text-gray-300 mb-4"></i>
                      <h2 className="text-xl font-semibold text-gray-600">Módulo de Estoque</h2>
                      <p className="text-gray-500">Em desenvolvimento...</p>
                    </div>
                  </div>
                )
              }
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
