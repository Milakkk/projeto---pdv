import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface ModuleConfig {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  icon: string;
  path: string;
  color: string;
  bgGradient: string;
  hoverGradient: string;
}

const modules: ModuleConfig[] = [
  {
    id: 'caixa',
    title: 'CAIXA',
    subtitle: 'PDV',
    description: 'Registro de vendas, abertura e fechamento de caixa, pagamentos',
    icon: 'ri-shopping-cart-2-fill',
    path: '/caixa',
    color: 'amber',
    bgGradient: 'from-amber-500 to-orange-600',
    hoverGradient: 'from-amber-600 to-orange-700',
  },
  {
    id: 'cozinha',
    title: 'COZINHA',
    subtitle: 'KDS',
    description: 'Visualização e gerenciamento de pedidos em preparo',
    icon: 'ri-restaurant-2-fill',
    path: '/cozinha',
    color: 'emerald',
    bgGradient: 'from-emerald-500 to-green-600',
    hoverGradient: 'from-emerald-600 to-green-700',
  },
  {
    id: 'tarefas',
    title: 'TAREFAS',
    subtitle: "E POP's",
    description: 'Gerenciamento de tarefas operacionais e procedimentos',
    icon: 'ri-task-fill',
    path: '/tarefas',
    color: 'blue',
    bgGradient: 'from-blue-500 to-indigo-600',
    hoverGradient: 'from-blue-600 to-indigo-700',
  },
  {
    id: 'adm',
    title: 'ADM',
    subtitle: 'Administração',
    description: 'Relatórios, configurações, RH, estoque e mais',
    icon: 'ri-settings-4-fill',
    path: '/adm',
    color: 'purple',
    bgGradient: 'from-purple-500 to-violet-600',
    hoverGradient: 'from-purple-600 to-violet-700',
  },
  {
    id: 'cliente',
    title: 'CLIENTE',
    subtitle: 'PDV',
    description: 'Terminal de autoatendimento para clientes',
    icon: 'ri-user-heart-fill',
    path: '/cliente-pdv',
    color: 'rose',
    bgGradient: 'from-rose-500 to-pink-600',
    hoverGradient: 'from-rose-600 to-pink-700',
  },
];

export default function ModuleSelectorPage() {
  const navigate = useNavigate();
  const { user, store, isAuthenticated, logout } = useAuth();
  const [hoveredModule, setHoveredModule] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleModuleClick = (module: ModuleConfig) => {
    // Para Caixa e Cozinha, abrir em nova janela Electron se disponível
    const api = (window as any)?.api;
    if (api && (module.id === 'caixa' || module.id === 'cozinha')) {
      // Navegar na mesma janela para simplicidade
    }
    navigate(module.path);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('pt-BR', { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'long',
      year: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
        }} />
      </div>

      {/* Header */}
      <header className="relative z-10 px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          {/* Logo e Info */}
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
              <i className="ri-store-3-fill text-2xl sm:text-3xl text-white"></i>
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                {store?.name || 'Sistema PDV'}
              </h1>
              <p className="text-sm text-slate-400 capitalize">{formatDate(currentTime)}</p>
            </div>
          </div>

          {/* Relógio e Usuário */}
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="text-right hidden sm:block">
              <p className="text-3xl sm:text-4xl font-bold text-white font-mono tracking-wider">
                {formatTime(currentTime)}
              </p>
            </div>
            
            {isAuthenticated && user && (
              <div className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center">
                  <i className="ri-user-fill text-white"></i>
                </div>
                <div className="hidden sm:block">
                  <p className="text-sm font-medium text-white">{user.name}</p>
                  <p className="text-xs text-slate-400">{store?.name}</p>
                </div>
                <button
                  onClick={logout}
                  className="ml-2 p-2 rounded-lg hover:bg-white/10 transition-colors"
                  title="Sair"
                >
                  <i className="ri-logout-circle-line text-slate-400 hover:text-white"></i>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Título Central */}
      <div className="relative z-10 text-center px-4 py-4 sm:py-8">
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-2">
          Selecione o Módulo
        </h2>
        <p className="text-slate-400 text-sm sm:text-base">
          Escolha qual sistema deseja acessar
        </p>
      </div>

      {/* Grid de Módulos */}
      <main className="relative z-10 flex-1 px-4 sm:px-6 lg:px-8 pb-8 overflow-y-auto">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 sm:gap-6">
            {modules.map((module) => (
              <button
                key={module.id}
                onClick={() => handleModuleClick(module)}
                onMouseEnter={() => setHoveredModule(module.id)}
                onMouseLeave={() => setHoveredModule(null)}
                className={`
                  group relative overflow-hidden rounded-2xl sm:rounded-3xl
                  bg-gradient-to-br ${hoveredModule === module.id ? module.hoverGradient : module.bgGradient}
                  p-6 sm:p-8 text-left transition-all duration-300 ease-out
                  hover:scale-[1.02] hover:shadow-2xl hover:shadow-${module.color}-500/30
                  focus:outline-none focus:ring-4 focus:ring-${module.color}-500/50
                  min-h-[200px] sm:min-h-[280px] flex flex-col justify-between
                `}
              >
                {/* Decorative Elements */}
                <div className="absolute top-0 right-0 w-32 h-32 sm:w-40 sm:h-40 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform duration-500" />
                <div className="absolute bottom-0 left-0 w-24 h-24 sm:w-32 sm:h-32 bg-black/10 rounded-full translate-y-1/2 -translate-x-1/2 group-hover:scale-110 transition-transform duration-500" />

                {/* Content */}
                <div className="relative z-10">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                    <i className={`${module.icon} text-3xl sm:text-4xl text-white`}></i>
                  </div>
                  
                  <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                    {module.title}
                  </h3>
                  <p className="text-lg sm:text-xl font-medium text-white/80 -mt-1">
                    {module.subtitle}
                  </p>
                </div>

                <div className="relative z-10">
                  <p className="text-sm text-white/70 line-clamp-2 group-hover:text-white/90 transition-colors">
                    {module.description}
                  </p>
                  
                  <div className="mt-4 flex items-center text-white/80 group-hover:text-white transition-colors">
                    <span className="text-sm font-medium">Acessar</span>
                    <i className="ri-arrow-right-line ml-2 group-hover:translate-x-1 transition-transform"></i>
                  </div>
                </div>

                {/* Shine Effect */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                </div>
              </button>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 px-4 py-4 text-center">
        <p className="text-xs text-slate-500">
          Sistema PDV • v1.0.0 • {new Date().getFullYear()}
        </p>
      </footer>
    </div>
  );
}

