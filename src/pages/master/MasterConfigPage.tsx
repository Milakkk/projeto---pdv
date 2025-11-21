import { useAuth } from '../../context/AuthContext';
import Button from '../../components/base/Button';
import Input from '../../components/base/Input';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import UsersManager from './components/UsersManager';
import RolesManager from './components/RolesManager';
import StoresManager from './components/StoresManager';
import { Link } from 'react-router-dom';

type MasterTab = 'users' | 'roles' | 'stores' | 'settings';

export default function MasterConfigPage() {
  const { user, store, role } = useAuth();
  const [activeTab, setActiveTab] = useLocalStorage<MasterTab>('master_active_tab', 'users');
  const [search, setSearch] = useLocalStorage<string>('master_search', '');

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header do módulo Master */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center justify-between w-full">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Configuração Master</h1>
              <p className="text-sm text-gray-600">Gerencie usuários, perfis, lojas e configurações globais.</p>
            </div>
            <Link 
              to="/dashboard" 
              className="text-gray-500 hover:text-gray-700 text-sm font-medium flex items-center space-x-1"
              title="Voltar ao Dashboard"
            >
              <i className="ri-arrow-left-line"></i>
              <span>Dashboard</span>
            </Link>
          </div>
        </div>
        {/* Tabs */}
        <div className="px-6 border-t border-gray-200">
          <div className="flex items-center justify-between py-3">
            <div className="flex space-x-2">
              <Button variant={activeTab === 'users' ? 'primary' : 'ghost'} size="sm" onClick={() => setActiveTab('users')}>Usuários</Button>
              <Button variant={activeTab === 'roles' ? 'primary' : 'ghost'} size="sm" onClick={() => setActiveTab('roles')}>Perfis</Button>
              <Button variant={activeTab === 'stores' ? 'primary' : 'ghost'} size="sm" onClick={() => setActiveTab('stores')}>Lojas</Button>
              <Button variant={activeTab === 'settings' ? 'primary' : 'ghost'} size="sm" onClick={() => setActiveTab('settings')}>Configurações</Button>
            </div>
            <div className="flex items-center gap-2">
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Pesquisar" />
              <Button variant="secondary" size="sm" onClick={() => setSearch('')}>Limpar</Button>
            </div>
          </div>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="p-6">
        <div className="bg-white p-6 rounded-lg shadow-md border border-blue-200 space-y-2 mb-6">
          <h2 className="text-base font-semibold text-blue-800">Informações de Acesso</h2>
          <p className="text-sm text-gray-700">
            Usuário: <span className="font-medium">{user?.name} ({user?.username})</span>
          </p>
          <p className="text-sm text-gray-700">
            Perfil: <span className="font-medium">{role?.name}</span>
          </p>
          <p className="text-sm text-gray-700">
            Loja: <span className="font-medium">{store?.name}</span>
          </p>
        </div>
        {activeTab === 'users' && <UsersManager globalFilter={search} />}
        {activeTab === 'roles' && <RolesManager globalFilter={search} />}
        {activeTab === 'stores' && <StoresManager globalFilter={search} />}
        {activeTab === 'settings' && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <p className="text-sm text-gray-600">Configurações globais do sistema serão adicionadas aqui.</p>
          </div>
        )}
      </div>
    </div>
  );
}
