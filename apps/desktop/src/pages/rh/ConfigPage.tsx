import { useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import Button from '../../components/base/Button';
import { mockStores } from '../../mocks/auth';
import { Link } from 'react-router-dom';

export default function RHConfigPage() {
  const { user, role, store } = useAuth();
  const [selectedStoreId, setSelectedStoreId] = useLocalStorage<string>('rh_config_selected_store_id', store?.id || mockStores[0].id);
  const [scheduleTypes, setScheduleTypes] = useLocalStorage<string[]>('rh_schedule_types', []);
  const [newType, setNewType] = useState('');

  const selectedStore = useMemo(() => mockStores.find(s => s.id === selectedStoreId) || mockStores[0], [selectedStoreId]);

  const addType = () => {
    const type = newType.trim();
    if (!type) return;
    if (scheduleTypes.includes(type)) return;
    setScheduleTypes([...scheduleTypes, type]);
    setNewType('');
  };

  const removeType = (type: string) => {
    setScheduleTypes(scheduleTypes.filter(t => t !== type));
  };

  return (
    <div className="min-h-full bg-gray-50">
      {/* Header com navegação e seleção de loja */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <i className="ri-settings-3-line text-2xl text-amber-600"></i>
            <h1 className="text-2xl font-bold text-gray-900">Configurações de RH</h1>
          </div>
          <div className="flex items-center space-x-3">
            <Link to="/rh" className="text-sm text-gray-600 hover:text-gray-900">
              <i className="ri-arrow-left-line mr-1"></i>
              Voltar ao RH
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

        {/* Seções de Configurações */}
        <section className="bg-white p-6 rounded-lg border border-gray-200 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Campos obrigatórios</h2>
          <p className="text-sm text-gray-600">Definições de campos obrigatórios para cadastro de pessoas e vínculos.</p>
          <div className="mt-4">
            <Button variant="secondary">
              <i className="ri-save-3-line mr-2"></i>
              Salvar alterações
            </Button>
          </div>
        </section>

        <section className="bg-white p-6 rounded-lg border border-gray-200 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Tipos de escala</h2>
          <p className="text-sm text-gray-600 mb-4">Defina os tipos de escala disponíveis (ex.: 6x1, 5x2). Esses tipos serão usados na geração da escala mensal.</p>
          {scheduleTypes.length === 0 && (
            <span className="text-xs text-gray-500">Nenhum tipo de escala definido. Adicione abaixo.</span>
          )}
          {scheduleTypes.length > 0 && (
            <ul className="mt-2 mb-4 divide-y divide-gray-200 border border-gray-200 rounded">
              {scheduleTypes.map((type) => (
                <li key={type} className="flex items-center justify-between px-3 py-2">
                  <span className="text-sm">{type}</span>
                  <Button variant="secondary" onClick={() => removeType(type)}>
                    <i className="ri-delete-bin-6-line mr-2"></i>
                    Remover
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-center space-x-2">
            <input
              value={newType}
              onChange={e => setNewType(e.target.value)}
              placeholder="Novo tipo de escala (ex.: 6x1)"
              className="border border-gray-300 rounded-md px-3 py-2 text-sm w-64"
            />
            <Button onClick={addType}>
              <i className="ri-add-line mr-2"></i>
              Adicionar tipo
            </Button>
          </div>
        </section>

        <section className="bg-white p-6 rounded-lg border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Validações</h2>
          <p className="text-sm text-gray-600">Configuração de regras de validação para documentos e vínculos.</p>
          <div className="mt-4">
            <Button variant="secondary">
              <i className="ri-save-3-line mr-2"></i>
              Salvar alterações
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
}
