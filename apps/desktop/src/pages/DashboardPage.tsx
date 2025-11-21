import { useAuth } from '../context/AuthContext';
import Button from '../components/base/Button';
import type { Module } from '../types';
import { useNavigate } from 'react-router-dom';

interface ModuleItem {
  module: Module;
  title: string;
  description: string;
  icon: string;
  path: string;
}

const modules: ModuleItem[] = [
  { 
    module: 'CAIXA', 
    title: 'Caixa (PDV)', 
    description: 'Registro de vendas, abertura e fechamento de caixa.', 
    icon: 'ri-shopping-cart-line', 
    path: '/caixa', 
  },
  { 
    module: 'COZINHA', 
    title: 'Cozinha (KDS)', 
    description: 'Visualização e gerenciamento de pedidos em preparo.', 
    icon: 'ri-restaurant-line', 
    path: '/cozinha', 
  },
  { 
    module: 'GESTAO', 
    title: 'Relatórios', 
    description: 'Relatórios de vendas e indicadores.', 
    icon: 'ri-bar-chart-line', 
    path: '/relatorios', 
  },
  { 
    module: 'TAREFAS', 
    title: 'Tarefas', 
    description: 'Gerenciamento de tarefas operacionais.', 
    icon: 'ri-list-check-2-line', 
    path: '/tarefas', 
  },
  { 
    module: 'CHECKLIST', 
    title: 'Check-list', 
    description: 'Criação e execução de listas de verificação.', 
    icon: 'ri-checkbox-line', 
    path: '/checklist', 
  },
  { 
    module: 'PROCEDIMENTOS', 
    title: 'Procedimentos', 
    description: 'Registro e consulta de procedimentos internos (POP).', 
    icon: 'ri-book-open-line', 
    path: '/procedimentos', 
  },
  { 
    module: 'RH', 
    title: 'RH', 
    description: 'Escalas por loja e banco de dados de pessoas.', 
    icon: 'ri-group-line', 
    path: '/rh', 
  },
  { 
    module: 'MASTER', 
    title: 'Configuração Master', 
    description: 'Gerenciamento de usuários, lojas, perfis e configurações globais.', 
    icon: 'ri-settings-3-line', 
    path: '/master-config', 
  },
  { 
    module: 'ESTOQUE', 
    title: 'Estoque', 
    description: 'Fichas técnicas, insumos e gerenciamento de estoque.', 
    icon: 'ri-file-list-3-line', 
    path: '/estoque/fichas', 
  },
];

interface ModuleCardProps {
  module: Module;
  title: string;
  description: string;
  icon: string;
  path: string;
  hasPermission: boolean;
}

const ModuleCard = ({ module, title, description, icon, path, hasPermission }: ModuleCardProps) => {
  const navigate = useNavigate();
  const isElectron = typeof navigator !== 'undefined' && navigator.userAgent.includes('Electron');
  const getIpcRenderer = (): any | null => {
    try {
      // Em Electron com nodeIntegration, usar window.require
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w: any = window as any;
      const electronMod = w.require ? w.require('electron') : null;
      return electronMod ? electronMod.ipcRenderer : null;
    } catch {
      return null;
    }
  };
  
  const handleClick = () => {
    if (hasPermission) {
      if (isElectron && (path === '/caixa' || path === '/cozinha')) {
        const ipc = getIpcRenderer();
        if (ipc) {
          ipc.invoke('open-module-window', path);
          return;
        }
      }
      navigate(path);
    }
  };

  return (
    <div 
      className={`p-6 rounded-xl shadow-lg border transition-all ${
        hasPermission 
          ? 'bg-white border-amber-200 hover:shadow-xl cursor-pointer'
          : 'bg-gray-100 border-gray-300 cursor-not-allowed opacity-60'
      }`}
      onClick={handleClick}
    >
      <div className="flex items-center space-x-4 mb-4">
        <i className={`${icon} text-4xl ${hasPermission ? 'text-amber-600' : 'text-gray-500'}`}></i>
        <h3 className="text-xl font-bold text-gray-900">{title}</h3>
      </div>
      <p className="text-gray-600 mb-4 text-sm">{description}</p>
      
      <Button 
        variant={hasPermission ? 'primary' : 'secondary'}
        disabled={!hasPermission}
        className="w-full"
      >
        {hasPermission ? 'Acessar Módulo' : 'Sem Permissão'}
      </Button>
    </div>
  );
};

export default function DashboardPage() {
  const { user, store, role, logout, hasPermission } = useAuth();
  const navigate = useNavigate();
  const isElectron = typeof navigator !== 'undefined' && navigator.userAgent.includes('Electron');
  const getIpcRenderer = (): any | null => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w: any = window as any;
      const electronMod = w.require ? w.require('electron') : null;
      return electronMod ? electronMod.ipcRenderer : null;
    } catch {
      return null;
    }
  };

  const modulesWithPermissions: ModuleCardProps[] = modules.map(mod => ({
    ...mod,
    hasPermission: hasPermission(mod.module)
  }));

  const availableModules = modulesWithPermissions.filter(mod => mod.hasPermission);
  const unavailableModules = modulesWithPermissions.filter(mod => !mod.hasPermission);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      
      {/* Header Fixo */}
      <header className="bg-white shadow-md border-b border-gray-200 flex-shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">
            Dashboard
          </h1>
          <div className="flex items-center space-x-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-gray-900">{user?.name}</p>
              <p className="text-xs text-gray-500">{role?.name} @ {store?.name}</p>
            </div>
            <Button onClick={logout} variant="secondary" size="sm">
              <i className="ri-logout-circle-line mr-2"></i>
              Sair
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        
        {/* Sidebar de Módulos (Desktop) - Mantido para consistência, mas o foco é o grid */}
        <nav className="hidden lg:block w-64 bg-white border-r border-gray-200 p-4 overflow-y-auto flex-shrink-0">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Módulos Disponíveis</h2>
          <div className="space-y-2">
            {availableModules.map(mod => (
              <button
                key={mod.path}
                onClick={() => {
                  if (isElectron && (mod.path === '/caixa' || mod.path === '/cozinha')) {
                    const ipc = getIpcRenderer();
                    if (ipc) {
                      ipc.invoke('open-module-window', mod.path);
                      return;
                    }
                  }
                  navigate(mod.path);
                }}
                className="w-full flex items-center p-3 rounded-lg text-left transition-colors bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200"
              >
                <i className={`${mod.icon} text-xl mr-3`}></i>
                <span className="font-medium">{mod.title}</span>
              </button>
            ))}
          </div>
          
          {unavailableModules.length > 0 && (
            <div className="mt-6 pt-4 border-t border-gray-200">
              <h3 className="text-sm font-medium text-gray-500 mb-3">Sem Permissão</h3>
              <div className="space-y-2">
                {unavailableModules.map(mod => (
                  <div
                    key={mod.path}
                    className="w-full flex items-center p-3 rounded-lg text-left text-gray-400 bg-gray-50 border border-gray-200 cursor-not-allowed"
                  >
                    <i className={`${mod.icon} text-xl mr-3`}></i>
                    <span className="font-medium line-through">{mod.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </nav>

        {/* Conteúdo Principal (Grid de Módulos) */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Seleção de Módulos</h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
            {modulesWithPermissions.map(mod => (
              <ModuleCard key={mod.module} {...mod} />
            ))}
          </div>

          {availableModules.length === 0 && (
            <div className="text-center py-12 bg-white rounded-xl mt-8 border border-red-200">
              <i className="ri-alert-line text-5xl text-red-500 mb-4"></i>
              <p className="text-lg text-red-700 font-medium">Seu perfil não possui permissão para acessar nenhum módulo.</p>
              <p className="text-sm text-gray-500 mt-2">Entre em contato com o administrador master.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
