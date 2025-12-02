import { useAuth } from '../../context/AuthContext';
import Button from '../../components/base/Button';
import Input from '../../components/base/Input';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { useKitchens, useAppConfig } from '../../hooks/useDatabase';
import UsersManager from './components/UsersManager';
import RolesManager from './components/RolesManager';
import StoresManager from './components/StoresManager';
import KitchensManager from './components/KitchensManager';
import SessionsHistoryManager from './components/SessionsHistoryManager';
import { Link } from 'react-router-dom';

type MasterTab = 'users' | 'roles' | 'stores' | 'kitchens' | 'sessions' | 'settings';

export default function MasterConfigPage() {
  const { user, store, role } = useAuth();
  const [activeTab, setActiveTab] = useLocalStorage<MasterTab>('master_active_tab', 'users');
  const [search, setSearch] = useLocalStorage<string>('master_search', '');
  const { config, setConfig } = useAppConfig();

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header do módulo Master */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center justify-between w-full">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Configuração Master</h1>
              <p className="text-sm text-gray-600">Gerencie usuários, perfis, lojas, cozinhas e configurações globais.</p>
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
          <div className="flex items-center justify-between py-3 flex-wrap gap-2">
            <div className="flex space-x-2 flex-wrap gap-1">
              <Button variant={activeTab === 'users' ? 'primary' : 'ghost'} size="sm" onClick={() => setActiveTab('users')}>
                <i className="ri-user-line mr-1 hidden sm:inline"></i>Usuários
              </Button>
              <Button variant={activeTab === 'roles' ? 'primary' : 'ghost'} size="sm" onClick={() => setActiveTab('roles')}>
                <i className="ri-shield-user-line mr-1 hidden sm:inline"></i>Perfis
              </Button>
              <Button variant={activeTab === 'stores' ? 'primary' : 'ghost'} size="sm" onClick={() => setActiveTab('stores')}>
                <i className="ri-store-2-line mr-1 hidden sm:inline"></i>Lojas
              </Button>
              <Button variant={activeTab === 'kitchens' ? 'primary' : 'ghost'} size="sm" onClick={() => setActiveTab('kitchens')}>
                <i className="ri-restaurant-2-line mr-1 hidden sm:inline"></i>Cozinhas
              </Button>
              <Button variant={activeTab === 'sessions' ? 'primary' : 'ghost'} size="sm" onClick={() => setActiveTab('sessions')}>
                <i className="ri-history-line mr-1 hidden sm:inline"></i>Aberturas
              </Button>
              <Button variant={activeTab === 'settings' ? 'primary' : 'ghost'} size="sm" onClick={() => setActiveTab('settings')}>
                <i className="ri-settings-3-line mr-1 hidden sm:inline"></i>Configurações
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Pesquisar" className="w-40 sm:w-auto" />
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
        {activeTab === 'kitchens' && <KitchensManager globalFilter={search} />}
        {activeTab === 'sessions' && <SessionsHistoryManager searchFilter={search} />}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            {/* Configurações Gerais */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <i className="ri-settings-3-line mr-2 text-blue-500"></i>
                Configurações Gerais do Sistema
              </h3>
              
              <div className="space-y-6">
                {/* Nome do Estabelecimento */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nome do Estabelecimento
                  </label>
                  <Input
                    value={config.establishmentName}
                    onChange={(e) => setConfig({ establishmentName: e.target.value })}
                    placeholder="Ex: Meu Restaurante"
                    className="max-w-md"
                  />
                </div>
                
                {/* Quantidade Máxima de Cozinhas */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Quantidade Máxima de Cozinhas
                  </label>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={config.maxKitchens}
                    onChange={(e) => setConfig({ maxKitchens: Math.max(1, Math.min(20, parseInt(e.target.value) || 1)) })}
                    className="w-24"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Define o limite de cozinhas que podem ser cadastradas no sistema.
                  </p>
                </div>
                
                {/* SLA Padrão */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    SLA Padrão (minutos)
                  </label>
                  <Input
                    type="number"
                    min={1}
                    value={config.defaultSla}
                    onChange={(e) => setConfig({ defaultSla: Math.max(1, parseInt(e.target.value) || 15) })}
                    className="w-24"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Tempo padrão de preparo para novos itens do cardápio.
                  </p>
                </div>
                
                {/* Formato da Senha */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Formato da Senha do Pedido
                  </label>
                  <div className="flex space-x-4">
                    {(['numeric', 'alphabetic', 'alphanumeric'] as const).map(format => (
                      <button
                        key={format}
                        onClick={() => setConfig({ passwordFormat: format })}
                        className={`flex-1 max-w-[150px] p-3 rounded-lg border-2 transition-colors text-center ${
                          config.passwordFormat === format
                            ? 'border-blue-500 bg-blue-50 text-blue-800'
                            : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        <span className="font-medium text-sm">
                          {format === 'numeric' ? 'Numérica' : 
                           format === 'alphabetic' ? 'Alfabética' : 'Alfanumérica'}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Som de Alerta */}
                <div className="flex items-center justify-between max-w-md">
                  <div>
                    <h4 className="font-medium text-gray-900">Som de Novo Pedido</h4>
                    <p className="text-sm text-gray-500">Alerta sonoro quando chegar novo pedido</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={config.soundAlert}
                      onChange={(e) => setConfig({ soundAlert: e.target.checked })}
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
                
                {/* Modo Escuro */}
                <div className="flex items-center justify-between max-w-md">
                  <div>
                    <h4 className="font-medium text-gray-900">Modo Escuro</h4>
                    <p className="text-sm text-gray-500">Alternar tema claro/escuro</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={config.darkMode}
                      onChange={(e) => {
                        setConfig({ darkMode: e.target.checked });
                        if (e.target.checked) {
                          document.documentElement.classList.add('dark');
                        } else {
                          document.documentElement.classList.remove('dark');
                        }
                      }}
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
