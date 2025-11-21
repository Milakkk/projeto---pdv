import { useAuth } from '../../context/AuthContext';
import Button from '../../components/base/Button';
import Input from '../../components/base/Input';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { Link } from 'react-router-dom';
import { mockStores } from '../../mocks/auth';

type RHTab = 'pessoas' | 'vinculos';

export default function RHPage() {
  const { user, store, role } = useAuth();
  const [activeTab, setActiveTab] = useLocalStorage<RHTab>('rh_active_tab', 'pessoas');
  const [filter, setFilter] = useLocalStorage<string>('rh_people_filter', '');
  const [selectedStoreId, setSelectedStoreId] = useLocalStorage<string>('rh_selected_store', mockStores[0]?.id || '');

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header do módulo RH */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-gray-900 flex items-center">
              <i className="ri-group-line text-amber-600 mr-2"></i>
              Recursos Humanos (RH)
            </h1>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-700">Loja:</label>
              <select
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm"
                value={selectedStoreId}
                onChange={e => setSelectedStoreId(e.target.value)}
              >
                {mockStores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex space-x-3">
            <Link 
              to="/dashboard" 
              className="text-gray-500 hover:text-gray-700 text-sm font-medium flex items-center space-x-1"
              title="Voltar ao Dashboard"
            >
              <i className="ri-arrow-left-line"></i>
              <span>Dashboard</span>
            </Link>
            <Link 
              to="/rh/config"
              className="text-gray-500 hover:text-gray-700 text-sm font-medium flex items-center space-x-1"
              title="Configurações de RH"
            >
              <i className="ri-settings-3-line"></i>
              <span>Configurações</span>
            </Link>
          </div>
        </div>
        {/* Tabs */}
        <div className="px-6 border-t border-gray-200">
          <div className="flex space-x-2">
            <Button variant={activeTab === 'pessoas' ? 'primary' : 'ghost'} size="sm" onClick={() => setActiveTab('pessoas')}>Pessoas</Button>
            <Button variant={activeTab === 'vinculos' ? 'primary' : 'ghost'} size="sm" onClick={() => setActiveTab('vinculos')}>Vínculos com Usuários</Button>
          </div>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="p-6">
        {activeTab === 'pessoas' && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <div className="flex items-center gap-3 mb-4">
              <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filtrar pessoas" />
              <Button onClick={() => setFilter('')} variant="secondary">Limpar</Button>
            </div>
            <p className="text-sm text-gray-500">Lista de pessoas e CRUD serão conectados futuramente.</p>
          </div>
        )}

        {activeTab === 'vinculos' && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <p className="text-sm text-gray-500">Vincule pessoas ativas do RH a usuários do sistema.</p>
            <p className="text-xs text-gray-400 mt-2">Interface detalhada será adicionada conforme integração de dados.</p>
          </div>
        )}
      </div>
    </div>
  );
}
