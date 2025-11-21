import type { RouteObject } from 'react-router-dom';
import { Navigate } from 'react-router-dom';
// Removendo lazy para evitar travas de carregamento
import LoginPage from '../pages/auth/LoginPage';
import DashboardPage from '../pages/DashboardPage';
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
// Dev pages para fallback
import DevCaixa from '../pages/dev/DevCaixa';
import DevCozinha from '../pages/dev/DevCozinha';
import ProtectedRoute from '../components/auth/ProtectedRoute';
import type { Module } from '../types';

const IS_DEV = import.meta.env.DEV;

// Rota de debug de sync desativada para simplificar dev
const SyncStatusDev = null


const routes: RouteObject[] = [
  // Normaliza carregamento via file://index.html no Electron
  {
    path: '/index.html',
    element: <Navigate to="/login" replace />
  },
  {
    path: '/splash',
    element: <SplashPage />
  },
  {
    path: '/role',
    element: <RoleSelectPage />
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
        path: 'dashboard',
        element: <DashboardPage />
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
    path: '/',
    element: <ProtectedRoute isModuleRoute={true} />, 
    children: [
          // Módulo CAIXA
          {
            path: 'caixa',
            element: (
              <ProtectedRoute
                requiredPermission={'CAIXA' as Module}
                allowedRoles={['Administrador Master', 'Gerente', 'Operador de Caixa']}
              />
            ),
            children: [
              { index: true, element: <CaixaPage /> },
              // Configurações movidas para o módulo CAIXA
              {
                path: 'configuracoes',
                element: (
                  <ProtectedRoute
                    requiredPermission={'CAIXA' as Module}
                    allowedRoles={['Administrador Master', 'Gerente', 'Operador de Caixa']}
                  />
                ),
                children: [
                  { index: true, element: <ConfiguracoesPage /> },
                ],
              }
            ]
          },
          
          // Módulo COZINHA
          {
            path: 'cozinha',
            element: (
              <ProtectedRoute
                requiredPermission={'COZINHA' as Module}
                allowedRoles={['Administrador Master', 'Gerente', 'Cozinheiro']}
              />
            ),
            children: [
              { index: true, element: <CozinhaPage /> },
              // Configurações do módulo COZINHA
              {
                path: 'configuracoes',
                element: (
                  <ProtectedRoute
                    requiredPermission={'COZINHA' as Module}
                    allowedRoles={['Administrador Master', 'Gerente', 'Cozinheiro']}
                  />
                ),
                children: [
                  { index: true, element: <ConfiguracoesPage /> },
                ],
              }
            ]
          },
          
          // Módulo GESTÃO
          {
            path: 'relatorios',
            element: <ProtectedRoute requiredPermission={'GESTAO' as Module} />,
            children: [
              { index: true, element: <RelatoriosPage /> }
            ]
          },
          {
            path: 'gerenciamento-caixa',
            element: <ProtectedRoute requiredPermission={'GESTAO' as Module} />,
            children: [
              { index: true, element: <GerenciamentoCaixaPage /> }
            ]
          },
          // A rota /configuracoes foi removida daqui
          
          // Novos Módulos Operacionais (Permissão TAREFAS, CHECKLIST, PROCEDIMENTOS)
          {
            path: 'tarefas',
            element: <ProtectedRoute requiredPermission={'TAREFAS' as Module} />,
            children: [
              { index: true, element: <TarefasPage /> }
            ]
          },
          {
            path: 'checklist',
            element: <ProtectedRoute requiredPermission={'CHECKLIST' as Module} />,
            children: [
              { index: true, element: <ChecklistPage /> }
            ]
          },
          {
            path: 'procedimentos',
            element: <ProtectedRoute requiredPermission={'PROCEDIMENTOS' as Module} />,
            children: [
              { index: true, element: <ProcedimentosPage /> }
            ]
          },
          
          {
            path: 'estoque',
            element: (
              <ProtectedRoute
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
          // Módulo RH
          {
            path: 'rh',
            element: (
              <ProtectedRoute
                requiredPermission={'RH' as Module}
                allowedRoles={['Administrador Master', 'Gerente']}
              />
            ),
            children: [
              { index: true, element: <RHPage /> },
              {
                path: 'config',
                element: (
                  <ProtectedRoute
                    requiredPermission={'RH' as Module}
                    allowedRoles={['Administrador Master', 'Gerente']}
                  />
                ),
                children: [
                  { index: true, element: <RHConfigPage /> },
                ],
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
// Sem injeção de rotas dev; usar fluxo normal

export default routes;
export const routesDev: RouteObject[] = [
  { path: '/', element: <Navigate to="/role" replace /> },
  { path: '/splash', element: <SplashPage /> },
  { path: '/role', element: <RoleSelectPage /> },
  { path: '/caixa', element: <CaixaPage /> },
  { path: '/cozinha', element: <CozinhaPage /> },
  { path: '*', element: <NotFoundPage /> },
]
import EstoqueFichasPage from '../pages/estoque/FichasPage'
import EstoquePrecosPage from '../pages/estoque/PrecosPage'
import EstoqueGerenciamentoPage from '../pages/estoque/GerenciamentoEstoquePage'
