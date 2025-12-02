import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/base/Button';

interface SubModuleConfig {
  id: string;
  title: string;
  description: string;
  icon: string;
  path: string;
  color: string;
  bgColor: string;
  permission: string;
}

const subModules: SubModuleConfig[] = [
  {
    id: 'tarefas',
    title: 'Tarefas',
    description: 'Gerenciamento de tarefas operacionais com atribuição de responsáveis e prazos',
    icon: 'ri-task-line',
    path: '/tarefas',
    color: 'text-violet-600',
    bgColor: 'bg-violet-100',
    permission: 'TAREFAS',
  },
  {
    id: 'checklist',
    title: 'Checklists',
    description: 'Criação e execução de listas de verificação diárias, semanais ou mensais',
    icon: 'ri-checkbox-multiple-line',
    path: '/checklist',
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-100',
    permission: 'CHECKLIST',
  },
  {
    id: 'procedimentos',
    title: 'Procedimentos',
    description: 'Registro e consulta de procedimentos operacionais padrão (POPs)',
    icon: 'ri-book-open-line',
    path: '/procedimentos',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    permission: 'PROCEDIMENTOS',
  },
];

export default function TarefasPopsPage() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();

  const handleSubModuleClick = (subModule: SubModuleConfig) => {
    if (hasPermission(subModule.permission as any)) {
      navigate(subModule.path);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-purple-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Link 
                to="/dashboard" 
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <i className="ri-arrow-left-line text-xl text-gray-600"></i>
              </Link>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Tarefas & POPs</h1>
                <p className="text-sm text-gray-500">Gestão operacional</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Intro */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <i className="ri-list-check-3 text-white text-2xl"></i>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Gestão Operacional</h2>
              <p className="text-gray-600">Organize tarefas, checklists e procedimentos</p>
            </div>
          </div>
        </div>

        {/* Sub-modules Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {subModules.map((subModule) => {
            const canAccess = hasPermission(subModule.permission as any);
            
            return (
              <button
                key={subModule.id}
                onClick={() => handleSubModuleClick(subModule)}
                disabled={!canAccess}
                className={`
                  relative overflow-hidden rounded-2xl p-6 text-left transition-all duration-300
                  border-2 group
                  ${canAccess 
                    ? 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-xl cursor-pointer' 
                    : 'bg-gray-50 border-gray-100 cursor-not-allowed opacity-60'
                  }
                `}
              >
                {/* Icon */}
                <div className={`
                  w-14 h-14 rounded-xl ${subModule.bgColor} ${subModule.color}
                  flex items-center justify-center mb-4
                  transition-transform duration-300 group-hover:scale-110
                `}>
                  <i className={`${subModule.icon} text-2xl`}></i>
                </div>
                
                {/* Title */}
                <h3 className={`text-xl font-bold mb-2 ${canAccess ? 'text-gray-900' : 'text-gray-500'}`}>
                  {subModule.title}
                </h3>
                
                {/* Description */}
                <p className={`text-sm ${canAccess ? 'text-gray-600' : 'text-gray-400'}`}>
                  {subModule.description}
                </p>

                {/* Arrow */}
                {canAccess && (
                  <div className={`
                    absolute bottom-4 right-4
                    w-8 h-8 rounded-full ${subModule.bgColor} ${subModule.color}
                    flex items-center justify-center
                    opacity-0 group-hover:opacity-100 transition-all duration-300
                    transform translate-x-2 group-hover:translate-x-0
                  `}>
                    <i className="ri-arrow-right-line"></i>
                  </div>
                )}

                {/* Lock */}
                {!canAccess && (
                  <div className="absolute bottom-4 right-4 text-gray-400">
                    <i className="ri-lock-2-fill text-xl"></i>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Quick Actions */}
        <div className="mt-12 bg-white rounded-2xl p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Ações Rápidas</h3>
          <div className="flex flex-wrap gap-3">
            {hasPermission('TAREFAS' as any) && (
              <Button 
                variant="secondary" 
                size="sm"
                onClick={() => navigate('/tarefas')}
                className="bg-violet-50 text-violet-700 hover:bg-violet-100"
              >
                <i className="ri-add-line mr-2"></i>
                Nova Tarefa
              </Button>
            )}
            {hasPermission('CHECKLIST' as any) && (
              <Button 
                variant="secondary" 
                size="sm"
                onClick={() => navigate('/checklist')}
                className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              >
                <i className="ri-checkbox-line mr-2"></i>
                Iniciar Checklist
              </Button>
            )}
            {hasPermission('PROCEDIMENTOS' as any) && (
              <Button 
                variant="secondary" 
                size="sm"
                onClick={() => navigate('/procedimentos')}
                className="bg-blue-50 text-blue-700 hover:bg-blue-100"
              >
                <i className="ri-book-read-line mr-2"></i>
                Ver Procedimentos
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

