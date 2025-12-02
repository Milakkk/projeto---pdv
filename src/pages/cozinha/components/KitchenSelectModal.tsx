import { useState, useEffect } from 'react';
import { useKitchens, useKitchenOperators, useKitchenSessions, Kitchen, useOutOfStockIngredients } from '../../../hooks/useDatabase';
import { KitchenOperator } from '../../../types';
import Button from '../../../components/base/Button';
import Modal from '../../../components/base/Modal';
import Input from '../../../components/base/Input';
import OutOfStockModal from './OutOfStockModal';

interface KitchenSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (kitchen: Kitchen | null, operator: KitchenOperator | null) => void;
  currentKitchen: Kitchen | null;
  currentOperator: KitchenOperator | null;
}

export default function KitchenSelectModal({
  isOpen,
  onClose,
  onSelect,
  currentKitchen,
  currentOperator,
}: KitchenSelectModalProps) {
  const { kitchens, loading: kitchensLoading } = useKitchens();
  const { operators, addOperator, deleteOperator, loading: operatorsLoading } = useKitchenOperators();
  const { isKitchenOnline, openKitchenSession, getKitchenSession } = useKitchenSessions();
  
  const [selectedKitchenId, setSelectedKitchenId] = useState<string | null>(currentKitchen?.id || null);
  const [selectedOperatorId, setSelectedOperatorId] = useState<string | null>(currentOperator?.id || null);
  const [newOperatorName, setNewOperatorName] = useState('');
  const [showAddOperator, setShowAddOperator] = useState(false);
  const [showOutOfStockModal, setShowOutOfStockModal] = useState(false);
  const { outOfStockIngredients } = useOutOfStockIngredients();

  // Sincroniza com props quando modal abre
  useEffect(() => {
    if (isOpen) {
      setSelectedKitchenId(currentKitchen?.id || null);
      setSelectedOperatorId(currentOperator?.id || null);
    }
  }, [isOpen, currentKitchen, currentOperator]);

  const activeKitchens = kitchens.filter(k => k.isActive);

  const handleConfirm = () => {
    const kitchen = selectedKitchenId 
      ? kitchens.find(k => k.id === selectedKitchenId) || null 
      : null;
    const operator = selectedOperatorId 
      ? operators.find(o => o.id === selectedOperatorId) || null 
      : null;
    
    // Abre sessão da cozinha selecionada (marca como online)
    if (kitchen) {
      openKitchenSession(kitchen.id, kitchen.name, operator?.id, operator?.name);
    }
    
    onSelect(kitchen, operator);
    onClose();
  };

  const handleAddOperator = async () => {
    if (!newOperatorName.trim()) return;
    
    const id = await addOperator(newOperatorName.trim());
    setSelectedOperatorId(id);
    setNewOperatorName('');
    setShowAddOperator(false);
  };

  const handleDeleteOperator = async (id: string) => {
    await deleteOperator(id);
    if (selectedOperatorId === id) {
      setSelectedOperatorId(null);
    }
  };

  if (kitchensLoading || operatorsLoading) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Configuração do KDS" size="md">
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Configuração do KDS" size="md">
      <div className="space-y-6">
        {/* Seleção de Cozinha */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            <i className="ri-restaurant-2-line mr-2 text-orange-500"></i>
            Selecionar Cozinha
          </label>
          
          {activeKitchens.length === 0 ? (
            <div className="p-4 bg-gray-50 rounded-xl text-center">
              <i className="ri-restaurant-line text-3xl text-gray-300 mb-2"></i>
              <p className="text-sm text-gray-500">
                Nenhuma cozinha configurada.
                <br />
                Configure cozinhas no menu <strong>ADM → Configurações Master</strong>
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {/* Opção "Todas" */}
              <button
                type="button"
                onClick={() => setSelectedKitchenId(null)}
                className={`p-4 rounded-xl border-2 transition-all text-left ${
                  selectedKitchenId === null
                    ? 'border-orange-500 bg-orange-50'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <div className={`w-10 h-10 rounded-lg mb-2 flex items-center justify-center ${
                  selectedKitchenId === null ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600'
                }`}>
                  <i className="ri-layout-grid-line text-xl"></i>
                </div>
                <h4 className="font-semibold text-gray-900">Todas</h4>
                <p className="text-xs text-gray-500">Ver todos os pedidos</p>
              </button>
              
              {/* Cozinhas */}
              {activeKitchens.map(kitchen => {
                const online = isKitchenOnline(kitchen.id);
                const session = getKitchenSession(kitchen.id);
                return (
                  <button
                    key={kitchen.id}
                    type="button"
                    onClick={() => setSelectedKitchenId(kitchen.id)}
                    className={`p-4 rounded-xl border-2 transition-all text-left relative ${
                      selectedKitchenId === kitchen.id
                        ? 'border-orange-500 bg-orange-50'
                        : online 
                          ? 'border-green-400 bg-green-50 hover:border-green-500'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    {/* Indicador de status online */}
                    {online && (
                      <div className="absolute top-2 right-2 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                        <span className="text-[10px] font-medium text-green-600">ONLINE</span>
                      </div>
                    )}
                    <div className={`w-10 h-10 rounded-lg mb-2 flex items-center justify-center ${
                      selectedKitchenId === kitchen.id 
                        ? 'bg-orange-500 text-white' 
                        : online 
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-100 text-gray-600'
                    }`}>
                      <i className="ri-restaurant-2-line text-xl"></i>
                    </div>
                    <h4 className="font-semibold text-gray-900">{kitchen.name}</h4>
                    <p className="text-xs text-gray-500">
                      {online && session?.operatorName 
                        ? `${session.operatorName}` 
                        : online 
                          ? 'Em operação'
                          : 'Cozinha dedicada'}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Seleção de Operador */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="block text-sm font-semibold text-gray-700">
              <i className="ri-user-line mr-2 text-blue-500"></i>
              Operador (opcional)
            </label>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAddOperator(!showAddOperator)}
            >
              <i className={`${showAddOperator ? 'ri-close-line' : 'ri-add-line'} mr-1`}></i>
              {showAddOperator ? 'Cancelar' : 'Novo'}
            </Button>
          </div>
          
          {/* Formulário de novo operador */}
          {showAddOperator && (
            <div className="flex space-x-2 mb-3">
              <Input
                value={newOperatorName}
                onChange={(e) => setNewOperatorName(e.target.value)}
                placeholder="Nome do operador"
                onKeyPress={(e) => e.key === 'Enter' && handleAddOperator()}
                className="flex-1"
              />
              <Button onClick={handleAddOperator} disabled={!newOperatorName.trim()}>
                Adicionar
              </Button>
            </div>
          )}
          
          {operators.length === 0 ? (
            <div className="p-4 bg-gray-50 rounded-xl text-center">
              <i className="ri-user-add-line text-3xl text-gray-300 mb-2"></i>
              <p className="text-sm text-gray-500">
                Nenhum operador cadastrado.
                <br />
                Clique em "Novo" para adicionar.
              </p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {/* Opção sem operador */}
              <button
                type="button"
                onClick={() => setSelectedOperatorId(null)}
                className={`px-4 py-2 rounded-lg border-2 transition-all ${
                  selectedOperatorId === null
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:border-gray-300 bg-white text-gray-700'
                }`}
              >
                <i className="ri-user-line mr-2"></i>
                Sem Identificação
              </button>
              
              {operators.map(operator => (
                <div key={operator.id} className="relative group">
                  <button
                    type="button"
                    onClick={() => setSelectedOperatorId(operator.id)}
                    className={`px-4 py-2 rounded-lg border-2 transition-all ${
                      selectedOperatorId === operator.id
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:border-gray-300 bg-white text-gray-700'
                    }`}
                  >
                    <i className="ri-user-3-line mr-2"></i>
                    {operator.name}
                  </button>
                  {/* Botão de excluir (aparece no hover) */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteOperator(operator.id);
                    }}
                    className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-red-600"
                    title="Remover operador"
                  >
                    <i className="ri-close-line"></i>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Controle de Insumos Esgotados */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="block text-sm font-semibold text-gray-700">
              <i className="ri-box-3-line mr-2 text-red-500"></i>
              Insumos Esgotados
            </label>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowOutOfStockModal(true)}
            >
              <i className="ri-settings-3-line mr-1"></i>
              Gerenciar
            </Button>
          </div>
          
          {outOfStockIngredients.length === 0 ? (
            <div className="p-3 bg-green-50 rounded-xl text-center">
              <i className="ri-check-double-line text-2xl text-green-500 mb-1"></i>
              <p className="text-sm text-green-700 font-medium">
                Todos os insumos disponíveis
              </p>
            </div>
          ) : (
            <div className="p-3 bg-red-50 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <i className="ri-error-warning-line text-red-500"></i>
                <span className="text-sm font-medium text-red-700">
                  {outOfStockIngredients.length} insumo(s) esgotado(s)
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                {outOfStockIngredients.slice(0, 5).map(i => (
                  <span 
                    key={i.ingredientId}
                    className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs"
                  >
                    {i.ingredientName}
                  </span>
                ))}
                {outOfStockIngredients.length > 5 && (
                  <span className="px-2 py-0.5 bg-red-200 text-red-800 rounded text-xs font-medium">
                    +{outOfStockIngredients.length - 5} mais
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Resumo da Seleção */}
        <div className="bg-gray-50 rounded-xl p-4">
          <h4 className="text-sm font-medium text-gray-500 mb-2">Resumo da Configuração</h4>
          <div className="flex items-center space-x-4 text-sm">
            <div className="flex items-center">
              <i className="ri-restaurant-2-line mr-1 text-orange-500"></i>
              <span className="font-medium">
                {selectedKitchenId 
                  ? kitchens.find(k => k.id === selectedKitchenId)?.name 
                  : 'Todas as Cozinhas'}
              </span>
            </div>
            <div className="flex items-center">
              <i className="ri-user-line mr-1 text-blue-500"></i>
              <span className="font-medium">
                {selectedOperatorId 
                  ? operators.find(o => o.id === selectedOperatorId)?.name 
                  : 'Não identificado'}
              </span>
            </div>
          </div>
        </div>

        {/* Botões */}
        <div className="flex space-x-3">
          <Button
            variant="secondary"
            onClick={onClose}
            className="flex-1"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500"
          >
            <i className="ri-check-line mr-2"></i>
            Confirmar
          </Button>
        </div>
      </div>
      
      {/* Modal de Insumos Esgotados */}
      <OutOfStockModal 
        isOpen={showOutOfStockModal} 
        onClose={() => setShowOutOfStockModal(false)} 
      />
    </Modal>
  );
}

