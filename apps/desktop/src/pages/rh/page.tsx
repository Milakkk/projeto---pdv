import { useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import Button from '../../components/base/Button';
import Input from '../../components/base/Input';
import { mockStores } from '../../mocks/auth';
import { Link } from 'react-router-dom';
import MonthlySchedule from './components/MonthlySchedule';
import PeopleManager from './components/PeopleManager';

type RHTab = 'escala' | 'pessoas';

export default function RHPage() {
  const { user, role, store } = useAuth();
  const [activeTab, setActiveTab] = useLocalStorage<RHTab>('rh_active_tab', 'escala');
  const [search, setSearch] = useLocalStorage<string>('rh_search', '');
  const [selectedStoreId, setSelectedStoreId] = useLocalStorage<string>('rh_selected_store_id', store?.id || mockStores[0].id);
  const [scheduleTypes] = useLocalStorage<string[]>('rh_schedule_types', []);

  const selectedStore = useMemo(() => mockStores.find(s => s.id === selectedStoreId) || mockStores[0], [selectedStoreId]);

  return (
    <div className="min-h-full bg-gray-50">
      {/* Header com navegação e seleção de loja */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <i className="ri-group-line text-2xl text-amber-600"></i>
            <h1 className="text-2xl font-bold text-gray-900">RH</h1>
          </div>
          <div className="flex items-center space-x-3">
            <Link to="/dashboard" className="text-sm text-gray-600 hover:text-gray-900">
              <i className="ri-arrow-left-line mr-1"></i>
              Voltar ao Dashboard
            </Link>
            <Link to="/rh/config" className="text-sm text-amber-700 hover:text-amber-900">
              <i className="ri-settings-3-line mr-1"></i>
              Configurações
            </Link>
            <select
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
              value={selectedStoreId}
              onChange={(e) => setSelectedStoreId(e.target.value)}
            >
              {mockStores.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {/* Conteúdo principal */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Bloco de informações rápidas */}
        <div className="bg-white p-4 rounded-lg border border-gray-200 mb-6">
          <p className="text-sm text-gray-700">
            Usuário: <span className="font-medium">{user?.name}</span> · Perfil: <span className="font-medium">{role?.name}</span> · Loja: <span className="font-medium">{selectedStore.name}</span>
          </p>
        </div>

        {/* Filtros e ações (variáveis por aba) */}
        {activeTab === 'escala' ? (
          <div className="flex items-center justify-between bg-white p-4 rounded-lg border border-gray-200 mb-4">
            <p className="text-sm text-gray-600">Gerencie escalas e banco de dados de pessoas por loja.</p>
            <div className="flex items-center space-x-2">
              <Button size="sm" variant="secondary">
                <i className="ri-shield-check-line mr-2"></i>
                Validar escala
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between bg-white p-4 rounded-lg border border-gray-200 mb-4">
            <div className="flex items-center space-x-3">
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filtrar por nome ou documento" />
              <Button variant="secondary">
                <i className="ri-filter-3-line mr-2"></i>
                Aplicar filtros
              </Button>
            </div>
            <div className="flex items-center space-x-2">
              <Button>
                <i className="ri-user-add-line mr-2"></i>
                Nova pessoa
              </Button>
            </div>
          </div>
        )}

        {/* Abas */}
        <div className="border-b border-gray-200 mb-4">
          <nav className="-mb-px flex space-x-6" aria-label="Tabs">
            <button
              className={`whitespace-nowrap py-4 px-1 border-b-2 text-sm font-medium ${activeTab === 'escala' ? 'border-amber-600 text-amber-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
              onClick={() => setActiveTab('escala')}
            >
              Escala
            </button>
            <button
              className={`whitespace-nowrap py-4 px-1 border-b-2 text-sm font-medium ${activeTab === 'pessoas' ? 'border-amber-600 text-amber-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
              onClick={() => setActiveTab('pessoas')}
            >
              Pessoas
            </button>
          </nav>
        </div>

        {/* Conteúdo das Abas */}
        {activeTab === 'escala' && (
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <h3 className="text-lg font-semibold mb-2">Escala Mensal</h3>
            <p className="text-sm text-gray-600 mb-3">Defina tipos de escala nas Configurações de RH e gere a escala mensal desta loja.</p>
            <MonthlySchedule storeId={selectedStoreId} scheduleTypes={scheduleTypes} />
            <div className="mt-4 text-xs text-gray-500">Dica: defina os tipos de escala em <Link to="/rh/config" className="text-amber-700 hover:text-amber-900">Configurações de RH</Link>.</div>
          </div>
        )}
        {activeTab === 'pessoas' && (
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <h3 className="text-lg font-semibold mb-4">Pessoas</h3>
            <p className="text-sm text-gray-600 mb-3">Cadastre pessoas e relacione o tipo de escala por loja.</p>
            <PeopleManager storeId={selectedStoreId} scheduleTypes={scheduleTypes} />
          </div>
        )}
      </main>
    </div>
  );
}
