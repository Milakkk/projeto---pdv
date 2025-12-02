import type { RouteObject } from 'react-router-dom';
import { Navigate } from 'react-router-dom';
// Removendo lazy para evitar travas de carregamento
import LoginPage from '../pages/auth/LoginPage';
import DashboardPage from '../pages/DashboardPage';
import ModuleSelectorPage from '../pages/ModuleSelectorPage';
import NotFoundPage from '../pages/NotFound';
import SplashPage from '../pages/splash/page';
import RoleSelectPage from '../pages/role/page';
import CaixaPage from '../pages/caixa/page';
import CozinhaPage from '../pages/cozinha/page';
import ConfiguracoesPage from '../pages/configuracoes/page';
import RelatoriosPage from '../pages/relatorios/page';
import GerenciamentoCaixaPage from '../pages/gerenciamento-caixa/page';
import MasterConfigPage from '../pages/master/MasterConfigPage';
import TarefasPage from '../pages/tarefas/page';
import ChecklistPage from '../pages/checklist/page';
import ProcedimentosPage from '../pages/procedimentos/page';
import RHPage from '../pages/rh/page';
import RHConfigPage from '../pages/rh/ConfigPage';
import ClientePdvPage from '../pages/cliente-pdv/page';
import AdmPage from '../pages/adm/page';
// Dev pages para fallback
import ProtectedRoute from '../components/auth/ProtectedRoute';
const isExternalPreview = (typeof __IS_PREVIEW__ !== 'undefined' && __IS_PREVIEW__ === true)
import type { Module } from '../types';

 


const routes: RouteObject[] = [
  // Normaliza carregamento via file://index.html no Electron
  {
    path: '/index.html',
    element: <Navigate to="/module-selector" replace />
  },
  {
    path: '/splash',
    element: <SplashPage />
  },
  {
    path: '/role',
    element: <Navigate to="/module-selector" replace />
  },
  // Rota de Login
  {
    path: '/login',
    element: <LoginPage />
  },
  // Nova tela de seleção de módulos (página inicial)
  {
    path: '/module-selector',
    element: <ModuleSelectorPage />
  },
  // PDV Cliente (sem navegação, tela limpa)
  {
    path: '/cliente-pdv',
    element: <ClientePdvPage />
  },
  
  // Rotas Protegidas (Requer autenticação)
  {
    path: '/',
    element: <ProtectedRoute />,
    children: [
      // Rota Raiz -> Seleção de Módulos
      {
        index: true,
        element: <ModuleSelectorPage />
      },
      {
        path: 'dashboard',
        element: <Navigate to="/module-selector" replace />
      },
      
      // Módulo ADM (Administração)
      {
        path: 'adm',
        element: <AdmPage />
      },
      
      // Módulo Master (Permissão MASTER)
      {
        path: 'master-config',
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
        path: 'caixa',
        element: (
          <ProtectedRoute
            isModuleRoute={true}
            requiredPermission={'CAIXA' as Module}
            allowedRoles={['Administrador Master', 'Gerente', 'Operador de Caixa']}
          />
        ),
        children: [
          { index: true, element: <CaixaPage /> },
          {
            path: 'configuracoes',
            element: <ConfiguracoesPage />,
          }
        ]
      },
      {
        path: 'cozinha',
        element: (
          <ProtectedRoute
            isModuleRoute={true}
            requiredPermission={'COZINHA' as Module}
            allowedRoles={['Administrador Master', 'Gerente', 'Cozinheiro']}
          />
        ),
        children: [
          { index: true, element: <CozinhaPage /> },
          {
            path: 'configuracoes',
            element: <ConfiguracoesPage />,
          }
        ]
      },
      // Relatórios ficam acessíveis também por rota pública; manter fora daqui
      {
        path: 'gerenciamento-caixa',
        element: <ProtectedRoute isModuleRoute={true} requiredPermission={'GESTAO' as Module} />,
        children: [
          { index: true, element: <GerenciamentoCaixaPage /> }
        ]
      },
      {
        path: 'tarefas',
        element: <ProtectedRoute isModuleRoute={true} requiredPermission={'TAREFAS' as Module} />,
        children: [
          { index: true, element: <TarefasPage /> }
        ]
      },
      {
        path: 'checklist',
        element: <ProtectedRoute isModuleRoute={true} requiredPermission={'CHECKLIST' as Module} />,
        children: [
          { index: true, element: <ChecklistPage /> }
        ]
      },
      {
        path: 'procedimentos',
        element: <ProtectedRoute isModuleRoute={true} requiredPermission={'PROCEDIMENTOS' as Module} />,
        children: [
          { index: true, element: <ProcedimentosPage /> }
        ]
      },
      {
        path: 'estoque',
        element: (
          <ProtectedRoute
            isModuleRoute={true}
            requiredPermission={'ESTOQUE' as Module}
            allowedRoles={['Administrador Master', 'Gerente']}
          />
        ),
        children: [
          { path: 'fichas', element: <EstoqueFichasPage /> },
          { path: 'precos', element: <EstoquePrecosPage /> },
          { path: 'gerenciamento', element: <EstoqueGerenciamentoPage /> },
        ]
      },
      {
        path: 'rh',
        element: (
          <ProtectedRoute
            isModuleRoute={true}
            requiredPermission={'RH' as Module}
            allowedRoles={['Administrador Master', 'Gerente']}
          />
        ),
        children: [
          { index: true, element: <RHPage /> },
          {
            path: 'config',
            element: <RHConfigPage />,
          }
        ]
      },
    ]
  },

  // Rota pública para Relatórios (sem ProtectedRoute)
  {
    path: '/relatorios',
    element: <RelatoriosPage />
  },
  
  // Rota 404
  {
    path: '*',
    element: <NotFoundPage />
  }
];

// Anexa rota /sync-status apenas em DEV
// Sem injeção de rotas dev; usar fluxo normal

export default routes;
export const routesDev: RouteObject[] = [
  { path: '/', element: <Navigate to="/module-selector" replace /> },
  { path: '/splash', element: <SplashPage /> },
  { path: '/role', element: <Navigate to="/module-selector" replace /> },
  { path: '/module-selector', element: <ModuleSelectorPage /> },
  { path: '/caixa', element: <CaixaPage /> },
  { path: '/cozinha', element: <CozinhaPage /> },
  { path: '/cliente-pdv', element: <ClientePdvPage /> },
  { path: '*', element: <NotFoundPage /> },
]
import EstoqueFichasPage from '../pages/estoque/FichasPage'
import EstoquePrecosPage from '../pages/estoque/PrecosPage'
import EstoqueGerenciamentoPage from '../pages/estoque/GerenciamentoEstoquePage'
