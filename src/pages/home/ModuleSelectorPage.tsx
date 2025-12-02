import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/base/Button';
import { useState } from 'react';

interface ModuleConfig {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  icon: string;
  path: string;
  color: string;
  bgGradient: string;
  iconBg: string;
  permissions: string[];
}

const modules: ModuleConfig[] = [
  {
    id: 'caixa',
    title: 'CAIXA',
    subtitle: 'PDV',
    description: 'Registro de vendas, abertura de sessão e fechamento de caixa',
    icon: 'ri-shopping-cart-2-fill',
    path: '/caixa',
    color: 'text-emerald-600',
    bgGradient: 'from-emerald-500/20 via-emerald-400/10 to-transparent',
    iconBg: 'bg-emerald-100',
    permissions: ['CAIXA'],
  },
  {
    id: 'cozinha',
    title: 'COZINHA',
    subtitle: 'KDS',
    description: 'Gerenciamento de pedidos em preparo e controle de produção',
    icon: 'ri-restaurant-2-fill',
    path: '/cozinha',
    color: 'text-orange-600',
    bgGradient: 'from-orange-500/20 via-orange-400/10 to-transparent',
    iconBg: 'bg-orange-100',
    permissions: ['COZINHA'],
  },
  {
    id: 'tarefas',
    title: 'TAREFAS',
    subtitle: "& POP's",
    description: 'Gerenciamento de tarefas, checklists e procedimentos operacionais',
    icon: 'ri-list-check-3',
    path: '/tarefas-pops',
    color: 'text-violet-600',
    bgGradient: 'from-violet-500/20 via-violet-400/10 to-transparent',
    iconBg: 'bg-violet-100',
    permissions: ['TAREFAS', 'CHECKLIST', 'PROCEDIMENTOS'],
  },
  {
    id: 'adm',
    title: 'ADM',
    subtitle: 'Administração',
    description: 'Relatórios, configurações, usuários, estoque e gestão geral',
    icon: 'ri-settings-4-fill',
    path: '/adm',
    color: 'text-blue-600',
    bgGradient: 'from-blue-500/20 via-blue-400/10 to-transparent',
    iconBg: 'bg-blue-100',
    permissions: ['GESTAO', 'MASTER', 'RH'],
  },
  {
    id: 'cliente',
    title: 'CLIENTE',
    subtitle: 'Autoatendimento',
    description: 'Totem de autoatendimento para clientes fazerem seus pedidos',
    icon: 'ri-user-smile-fill',
    path: '/cliente',
    color: 'text-rose-600',
    bgGradient: 'from-rose-500/20 via-rose-400/10 to-transparent',
    iconBg: 'bg-rose-100',
    permissions: ['CAIXA'], // Qualquer um com acesso ao caixa pode configurar o totem
  },
];

interface ModuleCardProps {
  module: ModuleConfig;
  hasPermission: boolean;
  onClick: () => void;
}

const ModuleCard = ({ module, hasPermission, onClick }: ModuleCardProps) => {
  return (
    <button
      onClick={onClick}
      disabled={!hasPermission}
      className={`
        relative overflow-hidden rounded-3xl p-6 sm:p-8 text-left transition-all duration-300
        border-2 group
        ${hasPermission 
          ? 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-xl hover:scale-[1.02] cursor-pointer active:scale-[0.98]' 
          : 'bg-gray-50 border-gray-100 cursor-not-allowed opacity-60'
        }
      `}
    >
      {/* Gradient Background */}
      <div className={`absolute inset-0 bg-gradient-to-br ${module.bgGradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
      
      {/* Content */}
      <div className="relative z-10">
        {/* Icon */}
        <div className={`
          w-16 h-16 sm:w-20 sm:h-20 rounded-2xl ${module.iconBg} ${module.color}
          flex items-center justify-center mb-4 sm:mb-6
          transition-transform duration-300 group-hover:scale-110
        `}>
          <i className={`${module.icon} text-3xl sm:text-4xl`}></i>
        </div>
        
        {/* Title */}
        <div className="mb-2 sm:mb-3">
          <h3 className={`text-2xl sm:text-3xl font-black tracking-tight ${hasPermission ? 'text-gray-900' : 'text-gray-500'}`}>
            {module.title}
          </h3>
          <span className={`text-sm sm:text-base font-semibold ${hasPermission ? module.color : 'text-gray-400'}`}>
            {module.subtitle}
          </span>
        </div>
        
        {/* Description */}
        <p className={`text-sm sm:text-base ${hasPermission ? 'text-gray-600' : 'text-gray-400'} line-clamp-2`}>
          {module.description}
        </p>
        
        {/* Arrow indicator */}
        {hasPermission && (
          <div className={`
            absolute bottom-6 right-6 sm:bottom-8 sm:right-8
            w-10 h-10 sm:w-12 sm:h-12 rounded-full ${module.iconBg} ${module.color}
            flex items-center justify-center
            opacity-0 group-hover:opacity-100 transition-all duration-300
            transform translate-x-2 group-hover:translate-x-0
          `}>
            <i className="ri-arrow-right-line text-xl sm:text-2xl"></i>
          </div>
        )}
        
        {/* Lock indicator for no permission */}
        {!hasPermission && (
          <div className="absolute bottom-6 right-6 sm:bottom-8 sm:right-8 text-gray-400">
            <i className="ri-lock-2-fill text-2xl"></i>
          </div>
        )}
      </div>
    </button>
  );
};

export default function ModuleSelectorPage() {
  const navigate = useNavigate();
  const { user, store, role, logout, hasPermission } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const isElectron = typeof navigator !== 'undefined' && navigator.userAgent.includes('Electron');
  
  const getIpcRenderer = (): any | null => {
    try {
      const w = window as any;
      const electronMod = w.require ? w.require('electron') : null;
      return electronMod ? electronMod.ipcRenderer : null;
    } catch {
      return null;
    }
  };

  const handleModuleClick = (module: ModuleConfig) => {
    // Verifica se tem permissão para pelo menos um dos módulos requeridos
    const canAccess = module.permissions.some(p => hasPermission(p as any));
    
    if (!canAccess) return;

    // Em Electron, abre nova janela para caixa e cozinha
    if (isElectron && (module.path === '/caixa' || module.path === '/cozinha')) {
      const ipc = getIpcRenderer();
      if (ipc) {
        ipc.invoke('open-module-window', module.path);
        return;
      }
    }

    navigate(module.path);
  };

  const checkModulePermission = (module: ModuleConfig) => {
    return module.permissions.some(p => hasPermission(p as any));
  };

  // Conta módulos acessíveis
  const accessibleModulesCount = modules.filter(m => checkModulePermission(m)).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            {/* Logo/Title */}
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                <i className="ri-store-3-fill text-white text-xl sm:text-2xl"></i>
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-gray-900">
                  Sistema PDV
                </h1>
                <p className="text-xs sm:text-sm text-gray-500 hidden sm:block">
                  Selecione um módulo para começar
                </p>
              </div>
            </div>

            {/* User Menu */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center space-x-3 px-3 py-2 rounded-xl hover:bg-gray-100 transition-colors"
              >
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-semibold text-gray-900">{user?.name}</p>
                  <p className="text-xs text-gray-500">{role?.name} • {store?.name}</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-bold">
                  {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                </div>
                <i className={`ri-arrow-down-s-line text-gray-500 transition-transform ${showUserMenu ? 'rotate-180' : ''}`}></i>
              </button>

              {/* Dropdown Menu */}
              {showUserMenu && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setShowUserMenu(false)}
                  />
                  <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-xl border border-gray-200 py-2 z-50">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <p className="text-sm font-semibold text-gray-900">{user?.name}</p>
                      <p className="text-xs text-gray-500">{user?.username}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        <i className="ri-shield-user-line mr-1"></i>
                        {role?.name}
                      </p>
                      <p className="text-xs text-gray-400">
                        <i className="ri-store-2-line mr-1"></i>
                        {store?.name}
                      </p>
                    </div>
                    <button
                      onClick={logout}
                      className="w-full px-4 py-3 text-left text-sm text-red-600 hover:bg-red-50 flex items-center"
                    >
                      <i className="ri-logout-circle-r-line mr-2"></i>
                      Sair do Sistema
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Welcome Section */}
        <div className="mb-8 sm:mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
            Olá, {user?.name?.split(' ')[0]}! 👋
          </h2>
          <p className="text-gray-600">
            Você tem acesso a <span className="font-semibold text-amber-600">{accessibleModulesCount} módulo{accessibleModulesCount !== 1 ? 's' : ''}</span> do sistema.
          </p>
        </div>

        {/* Modules Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {modules.map((module) => (
            <ModuleCard
              key={module.id}
              module={module}
              hasPermission={checkModulePermission(module)}
              onClick={() => handleModuleClick(module)}
            />
          ))}
        </div>

        {/* No Access Warning */}
        {accessibleModulesCount === 0 && (
          <div className="mt-8 p-6 bg-red-50 border border-red-200 rounded-2xl text-center">
            <i className="ri-error-warning-fill text-4xl text-red-500 mb-3"></i>
            <h3 className="text-lg font-semibold text-red-800 mb-2">
              Sem Permissões de Acesso
            </h3>
            <p className="text-red-600">
              Seu perfil não possui permissão para acessar nenhum módulo do sistema.
              <br />
              Entre em contato com o administrador.
            </p>
          </div>
        )}

        {/* Quick Stats */}
        <div className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-4 sm:p-6 border border-gray-200">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                <i className="ri-shopping-bag-3-line text-emerald-600 text-xl"></i>
              </div>
              <div>
                <p className="text-xs text-gray-500">Módulos</p>
                <p className="text-lg font-bold text-gray-900">{accessibleModulesCount}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-4 sm:p-6 border border-gray-200">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                <i className="ri-store-2-line text-blue-600 text-xl"></i>
              </div>
              <div>
                <p className="text-xs text-gray-500">Loja</p>
                <p className="text-lg font-bold text-gray-900 truncate max-w-[100px]">{store?.name?.split(' - ')[0] || '-'}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-4 sm:p-6 border border-gray-200">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
                <i className="ri-shield-user-line text-violet-600 text-xl"></i>
              </div>
              <div>
                <p className="text-xs text-gray-500">Perfil</p>
                <p className="text-lg font-bold text-gray-900 truncate max-w-[100px]">{role?.name?.split(' ')[0] || '-'}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-4 sm:p-6 border border-gray-200">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                <i className="ri-time-line text-amber-600 text-xl"></i>
              </div>
              <div>
                <p className="text-xs text-gray-500">Data</p>
                <p className="text-lg font-bold text-gray-900">
                  {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white/50 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-center text-xs text-gray-400">
            Sistema PDV © {new Date().getFullYear()} • Versão 2.0
          </p>
        </div>
      </footer>
    </div>
  );
}

