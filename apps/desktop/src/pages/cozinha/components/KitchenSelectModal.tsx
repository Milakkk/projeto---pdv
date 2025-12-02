import { useState, useEffect, useCallback } from 'react';
import Button from '../../../components/base/Button';
import Input from '../../../components/base/Input';

interface Kitchen {
  id: string;
  name: string;
  is_active: number;
}

interface KitchenOperator {
  name: string;
}

interface KitchenSelectModalProps {
  onSelect: (kitchenId: string | null, kitchenName: string, operatorName: string) => void;
  onCancel: () => void;
  operators: KitchenOperator[];
}

export default function KitchenSelectModal({ onSelect, onCancel, operators }: KitchenSelectModalProps) {
  const [kitchens, setKitchens] = useState<Kitchen[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedKitchen, setSelectedKitchen] = useState<string | null>(null);
  const [operatorName, setOperatorName] = useState('');

  const loadKitchens = useCallback(async () => {
    const api = (window as any)?.api;
    if (!api?.db?.query) {
      setLoading(false);
      return;
    }

    try {
      const result = await api.db.query('SELECT * FROM kitchens WHERE is_active = 1 ORDER BY display_order, name');
      if (result?.rows) {
        setKitchens(result.rows);
      }
    } catch (err) {
      console.error('Erro ao carregar cozinhas:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadKitchens();
  }, [loadKitchens]);

  const handleSubmit = () => {
    const kitchen = kitchens.find(k => k.id === selectedKitchen);
    onSelect(
      selectedKitchen,
      kitchen?.name || 'Todas as Cozinhas',
      operatorName.trim() || 'Operador'
    );
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-3/4 mx-auto"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-12 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-500 to-green-600 px-6 py-5 text-white">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center">
              <i className="ri-restaurant-2-fill text-3xl"></i>
            </div>
            <div>
              <h2 className="text-2xl font-bold">Cozinha (KDS)</h2>
              <p className="text-emerald-100">Selecione a cozinha e operador</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Seleção de Cozinha */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              <i className="ri-restaurant-line mr-2"></i>
              Qual cozinha você vai operar?
            </label>
            
            <div className="space-y-2">
              {/* Opção: Todas as cozinhas */}
              <button
                onClick={() => setSelectedKitchen(null)}
                className={`w-full p-4 rounded-xl border-2 transition-all flex items-center gap-4 ${
                  selectedKitchen === null
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-gray-200 hover:border-gray-300 text-gray-700'
                }`}
              >
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                  selectedKitchen === null ? 'bg-emerald-500 text-white' : 'bg-gray-100'
                }`}>
                  <i className="ri-apps-line text-xl"></i>
                </div>
                <div className="text-left">
                  <h3 className="font-semibold">Todas as Cozinhas</h3>
                  <p className="text-sm opacity-70">Ver pedidos de todas as cozinhas</p>
                </div>
                {selectedKitchen === null && (
                  <i className="ri-check-line text-xl ml-auto text-emerald-600"></i>
                )}
              </button>

              {/* Lista de cozinhas */}
              {kitchens.map(kitchen => (
                <button
                  key={kitchen.id}
                  onClick={() => setSelectedKitchen(kitchen.id)}
                  className={`w-full p-4 rounded-xl border-2 transition-all flex items-center gap-4 ${
                    selectedKitchen === kitchen.id
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-700'
                  }`}
                >
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                    selectedKitchen === kitchen.id ? 'bg-emerald-500 text-white' : 'bg-gray-100'
                  }`}>
                    <i className="ri-restaurant-2-fill text-xl"></i>
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold">{kitchen.name}</h3>
                    <p className="text-sm opacity-70">Filtrar por esta cozinha</p>
                  </div>
                  {selectedKitchen === kitchen.id && (
                    <i className="ri-check-line text-xl ml-auto text-emerald-600"></i>
                  )}
                </button>
              ))}

              {kitchens.length === 0 && (
                <p className="text-center text-gray-500 py-4">
                  Nenhuma cozinha cadastrada. Vá em ADM → Cozinhas para criar.
                </p>
              )}
            </div>
          </div>

          {/* Seleção de Operador */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              <i className="ri-user-line mr-2"></i>
              Quem está operando?
            </label>
            
            {operators.length > 0 ? (
              <div className="grid grid-cols-2 gap-2 mb-3">
                {operators.map((op, idx) => (
                  <button
                    key={idx}
                    onClick={() => setOperatorName(op.name)}
                    className={`p-3 rounded-lg border transition-all ${
                      operatorName === op.name
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <i className="ri-user-fill mr-2"></i>
                    {op.name}
                  </button>
                ))}
              </div>
            ) : null}
            
            <Input
              value={operatorName}
              onChange={(e) => setOperatorName(e.target.value)}
              placeholder="Nome do operador"
              className="w-full"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex gap-3">
          <Button
            variant="secondary"
            onClick={onCancel}
            className="flex-1"
          >
            <i className="ri-arrow-left-line mr-2"></i>
            Voltar
          </Button>
          <Button
            onClick={handleSubmit}
            className="flex-1 bg-emerald-500 hover:bg-emerald-600"
          >
            <i className="ri-check-line mr-2"></i>
            Iniciar
          </Button>
        </div>
      </div>
    </div>
  );
}

