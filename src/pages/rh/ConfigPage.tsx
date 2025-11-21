import { useLocalStorage } from '../../hooks/useLocalStorage';
import { mockStores } from '../../mocks/auth';
import { Link } from 'react-router-dom';
import Button from '../../components/base/Button';

export default function RHConfigPage() {
  const [selectedStoreId, setSelectedStoreId] = useLocalStorage<string>('rh_selected_store', mockStores[0]?.id || '');

  return (
    <div className="min-h-full bg-gray-50">
      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <i className="ri-settings-3-line text-amber-600 mr-2"></i>
              Configurações de RH
            </h1>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-700">Loja:</label>
              <select
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                value={selectedStoreId}
                onChange={e => setSelectedStoreId(e.target.value)}
              >
                {mockStores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <Link 
            to="/rh" 
            className="text-gray-500 hover:text-gray-700 text-sm font-medium flex items-center space-x-1"
            title="Voltar ao RH"
          >
            <i className="ri-arrow-left-line"></i>
            <span>RH</span>
          </Link>
        </div>

        <div className="space-y-6 bg-white rounded-lg shadow-md border border-gray-200 p-4">
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-2">Campos obrigatórios</h4>
            <p className="text-sm text-gray-600">Definições de campos mínimos para cadastro de pessoas e vínculos.</p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="primary">Salvar</Button>
              <Button size="sm" variant="secondary">Resetar</Button>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-2">Validações</h4>
            <p className="text-sm text-gray-600">Regras de validação serão integradas posteriormente.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
