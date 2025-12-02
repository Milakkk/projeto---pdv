import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

interface AdminModuleConfig {
  id: string;
  title: string;
  description: string;
  icon: string;
  path: string;
  color: string;
  permission?: string;
}

const adminModules: AdminModuleConfig[] = [
  {
    id: 'relatorios',
    title: 'Relatórios',
    description: 'Relatórios de vendas, desempenho e indicadores',
    icon: 'ri-bar-chart-box-fill',
    path: '/relatorios',
    color: 'blue',
  },
  {
    id: 'master-config',
    title: 'Configuração Master',
    description: 'Usuários, lojas, perfis, cozinhas e configurações globais',
    icon: 'ri-settings-4-fill',
    path: '/master-config',
    color: 'purple',
    permission: 'MASTER',
  },
  {
    id: 'gerenciamento-caixa',
    title: 'Gerenciamento de Caixa',
    description: 'Histórico de sessões e movimentações de caixa',
    icon: 'ri-money-dollar-box-fill',
    path: '/gerenciamento-caixa',
    color: 'green',
  },
  {
    id: 'tarefas',
    title: 'Tarefas',
    description: 'Gerenciamento de tarefas operacionais',
    icon: 'ri-task-fill',
    path: '/tarefas',
    color: 'amber',
  },
  {
    id: 'checklist',
    title: 'Check-list',
    description: 'Criação e execução de listas de verificação',
    icon: 'ri-checkbox-multiple-fill',
    path: '/checklist',
    color: 'emerald',
  },
  {
    id: 'procedimentos',
    title: 'Procedimentos',
    description: 'Registro e consulta de procedimentos internos (POP)',
    icon: 'ri-file-list-3-fill',
    path: '/procedimentos',
    color: 'cyan',
  },
  {
    id: 'rh',
    title: 'RH',
    description: 'Escalas por loja e banco de dados de pessoas',
    icon: 'ri-team-fill',
    path: '/rh',
    color: 'rose',
  },
  {
    id: 'estoque',
    title: 'Estoque',
    description: 'Fichas técnicas, insumos e gerenciamento de estoque',
    icon: 'ri-archive-drawer-fill',
    path: '/estoque/gerenciamento',
    color: 'orange',
  },
  {
    id: 'configuracoes',
    title: 'Configurações PDV',
    description: 'Categorias, itens do cardápio e formas de pagamento',
    icon: 'ri-store-2-fill',
    path: '/caixa/configuracoes',
    color: 'slate',
  },
];

export default function AdmPage() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();

  const handleModuleClick = (module: AdminModuleConfig) => {
    navigate(module.path);
  };

  const getColorClasses = (color: string) => {
    const colors: Record<string, { bg: string; text: string; border: string; hover: string }> = {
      blue: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200', hover: 'hover:border-blue-400 hover:bg-blue-100' },
      purple: { bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-200', hover: 'hover:border-purple-400 hover:bg-purple-100' },
      green: { bg: 'bg-green-50', text: 'text-green-600', border: 'border-green-200', hover: 'hover:border-green-400 hover:bg-green-100' },
      amber: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200', hover: 'hover:border-amber-400 hover:bg-amber-100' },
      emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200', hover: 'hover:border-emerald-400 hover:bg-emerald-100' },
      cyan: { bg: 'bg-cyan-50', text: 'text-cyan-600', border: 'border-cyan-200', hover: 'hover:border-cyan-400 hover:bg-cyan-100' },
      rose: { bg: 'bg-rose-50', text: 'text-rose-600', border: 'border-rose-200', hover: 'hover:border-rose-400 hover:bg-rose-100' },
      orange: { bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-200', hover: 'hover:border-orange-400 hover:bg-orange-100' },
      slate: { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200', hover: 'hover:border-slate-400 hover:bg-slate-100' },
    };
    return colors[color] || colors.slate;
  };

  const filteredModules = adminModules.filter(module => {
    if (module.permission) {
      return hasPermission(module.permission as any);
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-violet-800 to-purple-900 flex flex-col">
      {/* Header */}
      <header className="bg-white/10 backdrop-blur-sm border-b border-white/10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/module-selector')}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
            >
              <i className="ri-arrow-left-line text-xl text-white"></i>
            </button>
            <div>
              <h1 className="text-2xl font-bold text-white">Administração</h1>
              <p className="text-sm text-purple-200">Módulos administrativos do sistema</p>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 px-6 py-8 overflow-y-auto">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredModules.map((module) => {
              const colors = getColorClasses(module.color);
              return (
                <button
                  key={module.id}
                  onClick={() => handleModuleClick(module)}
                  className={`
                    group relative p-6 rounded-2xl border-2 text-left
                    bg-white ${colors.border} ${colors.hover}
                    transition-all duration-200 ease-out
                    hover:shadow-lg hover:-translate-y-1
                  `}
                >
                  <div className={`w-14 h-14 rounded-xl ${colors.bg} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                    <i className={`${module.icon} text-2xl ${colors.text}`}></i>
                  </div>
                  
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {module.title}
                  </h3>
                  
                  <p className="text-sm text-gray-500 line-clamp-2">
                    {module.description}
                  </p>

                  <div className="mt-4 flex items-center text-gray-400 group-hover:text-gray-600 transition-colors">
                    <span className="text-sm font-medium">Acessar</span>
                    <i className="ri-arrow-right-line ml-2 group-hover:translate-x-1 transition-transform"></i>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}

