import { useAuth } from '../../context/AuthContext';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import Button from '../../components/base/Button';
import Input from '../../components/base/Input';
import { Link } from 'react-router-dom';
import UsersManager from './components/UsersManager';
import RolesManager from './components/RolesManager';
import StoresManager from './components/StoresManager';
import StoreOperatingDays from './components/StoreOperatingDays';

type MasterTab = 'users' | 'roles' | 'stores' | 'settings';

export default function MasterConfigPage() {
  const { user, store, role } = useAuth();
  const [activeTab, setActiveTab] = useLocalStorage<MasterTab>('master_active_tab', 'users');
  const [search, setSearch] = useLocalStorage<string>('master_search', '');

  return (
    <div className="min-h-full bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <i className="ri-settings-3-line text-2xl text-amber-600"></i>
            <h1 className="text-2xl font-bold text-gray-900">Configuração Master</h1>
          </div>
          <Link to="/dashboard" className="text-sm text-gray-600 hover:text-gray-900">
            <i className="ri-arrow-left-line mr-1"></i>
            Voltar ao Dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Informações de Acesso */}
        <div className="bg-white p-4 rounded-lg border border-blue-200 mb-6">
          <h2 className="text-lg font-semibold text-blue-800 mb-2">Informações de Acesso</h2>
          <p className="text-sm text-gray-700">Usuário: <span className="font-medium">{user?.name} ({user?.username})</span></p>
          <p className="text-sm text-gray-700">Perfil: <span className="font-medium">{role?.name}</span></p>
          <p className="text-sm text-gray-700">Loja: <span className="font-medium">{store?.name}</span></p>
        </div>

        {/* Filtro global e ações */}
        <div className="flex items-center justify-between bg-white p-4 rounded-lg border border-gray-200 mb-4">
          <div className="flex items-center space-x-3">
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filtrar por nome, perfil ou loja" />
            <Button variant="secondary">
              <i className="ri-filter-3-line mr-2"></i>
              Aplicar filtros
            </Button>
          </div>
          <div className="flex items-center space-x-2">
            <Button>
              <i className="ri-user-add-line mr-2"></i>
              Novo usuário
            </Button>
            <Button variant="secondary">
              <i className="ri-store-3-line mr-2"></i>
              Nova loja
            </Button>
          </div>
        </div>

        {/* Abas */}
        <div className="border-b border-gray-200 mb-4">
          <nav className="-mb-px flex space-x-6" aria-label="Tabs">
            <button
              className={`whitespace-nowrap py-4 px-1 border-b-2 text-sm font-medium ${activeTab === 'users' ? 'border-amber-600 text-amber-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
              onClick={() => setActiveTab('users')}
            >
              Usuários
            </button>
            <button
              className={`whitespace-nowrap py-4 px-1 border-b-2 text-sm font-medium ${activeTab === 'roles' ? 'border-amber-600 text-amber-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
              onClick={() => setActiveTab('roles')}
            >
              Perfis
            </button>
            <button
              className={`whitespace-nowrap py-4 px-1 border-b-2 text-sm font-medium ${activeTab === 'stores' ? 'border-amber-600 text-amber-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
              onClick={() => setActiveTab('stores')}
            >
              Lojas
            </button>
            <button
              className={`whitespace-nowrap py-4 px-1 border-b-2 text-sm font-medium ${activeTab === 'settings' ? 'border-amber-600 text-amber-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
              onClick={() => setActiveTab('settings')}
            >
              Configurações
            </button>
          </nav>
        </div>

        {/* Conteúdo das Abas */}
        {activeTab === 'users' && (
          <UsersManager />
        )}
        {activeTab === 'roles' && (
          <RolesManager />
        )}
        {activeTab === 'stores' && (
          <StoresManager />
        )}
        {activeTab === 'settings' && (
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <h3 className="text-lg font-semibold mb-3">Dias de funcionamento</h3>
            <p className="text-sm text-gray-600 mb-4">Defina os dias em que cada loja opera. A geração de escala respeitará estes dias.</p>
            <StoreOperatingDays />
          </div>
        )}
      </main>
    </div>
  );
}
