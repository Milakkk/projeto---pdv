import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

interface AdminModuleConfig {
  id: string;
  title: string;
  description: string;
  icon: string;
  path: string;
  color: string;
  bgColor: string;
  permissions: string[];
}

const adminModules: AdminModuleConfig[] = [
  {
    id: 'relatorios',
    title: 'Relatórios',
    description: 'Relatórios de vendas, indicadores de desempenho e análises',
    icon: 'ri-bar-chart-box-line',
    path: '/relatorios',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    permissions: ['GESTAO'],
  },
  {
    id: 'master',
    title: 'Configurações Master',
    description: 'Usuários, perfis de acesso, lojas e configurações globais',
    icon: 'ri-settings-3-line',
    path: '/master-config',
    color: 'text-violet-600',
    bgColor: 'bg-violet-100',
    permissions: ['MASTER'],
  },
  {
    id: 'gerenciamento-caixa',
    title: 'Gerenciamento de Caixa',
    description: 'Histórico de sessões de caixa, movimentações e conferências',
    icon: 'ri-money-dollar-box-line',
    path: '/gerenciamento-caixa',
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-100',
    permissions: ['GESTAO'],
  },
  {
    id: 'rh',
    title: 'Recursos Humanos',
    description: 'Escalas de trabalho, banco de dados de funcionários e gestão de pessoas',
    icon: 'ri-team-line',
    path: '/rh',
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
    permissions: ['RH'],
  },
  {
    id: 'estoque',
    title: 'Estoque',
    description: 'Controle de inventário, entradas, saídas e alertas de estoque',
    icon: 'ri-archive-drawer-line',
    path: '/estoque',
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-100',
    permissions: ['GESTAO'],
  },
  {
    id: 'configuracoes',
    title: 'Configurações do PDV',
    description: 'Categorias, itens do cardápio, formas de pagamento e atalhos',
    icon: 'ri-list-settings-line',
    path: '/caixa/configuracoes',
    color: 'text-rose-600',
    bgColor: 'bg-rose-100',
    permissions: ['CAIXA', 'MASTER'],
  },
];

export default function AdmPage() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();

  const checkAccess = (permissions: string[]) => {
    return permissions.some(p => hasPermission(p as any));
  };

  const handleModuleClick = (module: AdminModuleConfig) => {
    if (checkAccess(module.permissions)) {
      navigate(module.path);
    }
  };

  // Divide em módulos acessíveis e não acessíveis
  const accessibleModules = adminModules.filter(m => checkAccess(m.permissions));
  const inaccessibleModules = adminModules.filter(m => !checkAccess(m.permissions));

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Link 
                to="/dashboard" 
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <i className="ri-arrow-left-line text-xl text-gray-600"></i>
              </Link>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Administração</h1>
                <p className="text-sm text-gray-500">Gestão e configurações do sistema</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Intro */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <i className="ri-settings-4-fill text-white text-2xl"></i>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Painel Administrativo</h2>
              <p className="text-gray-600">
                {accessibleModules.length} módulo{accessibleModules.length !== 1 ? 's' : ''} disponíve{accessibleModules.length !== 1 ? 'is' : 'l'}
              </p>
            </div>
          </div>
        </div>

        {/* Accessible Modules */}
        {accessibleModules.length > 0 && (
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
              Módulos Disponíveis
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {accessibleModules.map((module) => (
                <button
                  key={module.id}
                  onClick={() => handleModuleClick(module)}
                  className="
                    relative overflow-hidden rounded-2xl p-5 text-left transition-all duration-300
                    bg-white border-2 border-gray-200 hover:border-gray-300 hover:shadow-lg
                    cursor-pointer group
                  "
                >
                  <div className="flex items-start space-x-4">
                    {/* Icon */}
                    <div className={`
                      w-12 h-12 rounded-xl ${module.bgColor} ${module.color}
                      flex items-center justify-center flex-shrink-0
                      transition-transform duration-300 group-hover:scale-110
                    `}>
                      <i className={`${module.icon} text-xl`}></i>
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <h4 className="text-base font-semibold text-gray-900 mb-1">
                        {module.title}
                      </h4>
                      <p className="text-sm text-gray-500 line-clamp-2">
                        {module.description}
                      </p>
                    </div>
                  </div>

                  {/* Arrow */}
                  <div className={`
                    absolute bottom-3 right-3
                    w-8 h-8 rounded-full ${module.bgColor} ${module.color}
                    flex items-center justify-center
                    opacity-0 group-hover:opacity-100 transition-all duration-300
                    transform translate-x-2 group-hover:translate-x-0
                  `}>
                    <i className="ri-arrow-right-line text-sm"></i>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Inaccessible Modules */}
        {inaccessibleModules.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">
              Requer Permissão
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {inaccessibleModules.map((module) => (
                <div
                  key={module.id}
                  className="
                    relative overflow-hidden rounded-2xl p-5
                    bg-gray-50 border-2 border-gray-100
                    opacity-60 cursor-not-allowed
                  "
                >
                  <div className="flex items-start space-x-4">
                    {/* Icon */}
                    <div className="
                      w-12 h-12 rounded-xl bg-gray-200 text-gray-400
                      flex items-center justify-center flex-shrink-0
                    ">
                      <i className={`${module.icon} text-xl`}></i>
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <h4 className="text-base font-semibold text-gray-500 mb-1">
                        {module.title}
                      </h4>
                      <p className="text-sm text-gray-400 line-clamp-2">
                        {module.description}
                      </p>
                    </div>
                  </div>

                  {/* Lock */}
                  <div className="absolute bottom-3 right-3 text-gray-400">
                    <i className="ri-lock-2-fill"></i>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {accessibleModules.length === 0 && (
          <div className="text-center py-12 bg-white rounded-2xl border border-gray-200">
            <i className="ri-lock-line text-5xl text-gray-300 mb-4"></i>
            <h3 className="text-lg font-semibold text-gray-600 mb-2">
              Acesso Restrito
            </h3>
            <p className="text-gray-500">
              Você não possui permissão para acessar módulos administrativos.
              <br />
              Contate o administrador do sistema.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

