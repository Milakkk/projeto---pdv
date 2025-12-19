import { useState, useEffect } from 'react';
import Modal from '../../../components/base/Modal';
import Button from '../../../components/base/Button';
import Input from '../../../components/base/Input';
import { useOutOfStockIngredients } from '../../../hooks/useDatabase';

interface OutOfStockModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Interface simples para insumo
interface Ingredient {
  id: string;
  name: string;
}

export default function OutOfStockModal({ isOpen, onClose }: OutOfStockModalProps) {
  const { 
    outOfStockIngredients, 
    markAsOutOfStock, 
    markAsAvailable,
    clearAll 
  } = useOutOfStockIngredients();
  
  const [allIngredients, setAllIngredients] = useState<Ingredient[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Carrega lista de insumos
  useEffect(() => {
    if (!isOpen) return;
    
    const load = async () => {
      setLoading(true);
      try {
        // Tenta carregar do inventoryService via IPC
        const fn = (window as any)?.api?.db?.query;
        if (typeof fn === 'function') {
          const res = await fn('SELECT id, name FROM ingredients ORDER BY name');
          if (res?.rows) {
            setAllIngredients(res.rows);
            setLoading(false);
            return;
          }
        }
      } catch (err) {
        console.warn('Erro ao carregar insumos do DB:', err);
      }
      
      // Fallback: localStorage
      try {
        const raw = localStorage.getItem('ingredients');
        const list = raw ? JSON.parse(raw) : [];
        setAllIngredients(list);
      } catch {
        setAllIngredients([]);
      }
      setLoading(false);
    };
    
    load();
  }, [isOpen]);

  const filteredIngredients = allIngredients.filter(i => 
    i.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isOutOfStock = (id: string) => 
    outOfStockIngredients.some(i => i.ingredientId === id);

  const handleToggle = (ingredient: Ingredient) => {
    if (isOutOfStock(ingredient.id)) {
      markAsAvailable(ingredient.id);
    } else {
      markAsOutOfStock(ingredient.id, ingredient.name);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Insumos Esgotados" size="md">
      <div className="space-y-4">
        {/* Info */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <i className="ri-alert-line text-amber-600 text-lg mt-0.5"></i>
            <div className="text-sm text-amber-800">
              <strong>Atenção:</strong> Itens que usam insumos marcados como esgotados 
              não aparecerão no caixa para venda.
            </div>
          </div>
        </div>

        {/* Resumo */}
        {outOfStockIngredients.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div className="text-sm text-red-800">
                <strong>{outOfStockIngredients.length}</strong> insumo(s) marcado(s) como esgotado(s)
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={clearAll}
                className="text-red-600 hover:text-red-700"
              >
                <i className="ri-delete-bin-line mr-1"></i>
                Limpar Todos
              </Button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {outOfStockIngredients.map(i => (
                <span 
                  key={i.ingredientId}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs"
                >
                  {i.ingredientName}
                  <button
                    type="button"
                    onClick={() => markAsAvailable(i.ingredientId)}
                    className="hover:bg-red-200 rounded-full p-0.5"
                  >
                    <i className="ri-close-line text-xs"></i>
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Busca */}
        <div>
          <Input
            placeholder="Buscar insumo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full"
          />
        </div>

        {/* Lista de insumos */}
        <div className="max-h-80 overflow-y-auto border rounded-lg divide-y">
          {loading ? (
            <div className="p-8 text-center text-gray-500">
              <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
              Carregando insumos...
            </div>
          ) : filteredIngredients.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {searchQuery ? 'Nenhum insumo encontrado' : 'Nenhum insumo cadastrado'}
            </div>
          ) : (
            filteredIngredients.map(ingredient => {
              const outOfStock = isOutOfStock(ingredient.id);
              return (
                <div 
                  key={ingredient.id}
                  className={`flex items-center justify-between p-3 hover:bg-gray-50 cursor-pointer ${
                    outOfStock ? 'bg-red-50' : ''
                  }`}
                  onClick={() => handleToggle(ingredient)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      outOfStock ? 'bg-red-500 text-white' : 'bg-green-100 text-green-600'
                    }`}>
                      <i className={outOfStock ? 'ri-close-line' : 'ri-check-line'}></i>
                    </div>
                    <div>
                      <div className={`font-medium ${outOfStock ? 'text-red-700 line-through' : 'text-gray-900'}`}>
                        {ingredient.name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {outOfStock ? 'ESGOTADO' : 'Disponível'}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      outOfStock 
                        ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                        : 'bg-red-100 text-red-700 hover:bg-red-200'
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggle(ingredient);
                    }}
                  >
                    {outOfStock ? (
                      <><i className="ri-add-line mr-1"></i>Disponível</>
                    ) : (
                      <><i className="ri-subtract-line mr-1"></i>Esgotado</>
                    )}
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Botão Fechar */}
        <div className="flex justify-end pt-2">
          <Button onClick={onClose}>
            Fechar
          </Button>
        </div>
      </div>
    </Modal>
  );
}

