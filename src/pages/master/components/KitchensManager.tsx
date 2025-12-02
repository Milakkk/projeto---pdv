import { useState, useMemo } from 'react';
import { useKitchens, Kitchen, useAppConfig } from '../../../hooks/useDatabase';
import Button from '../../../components/base/Button';
import Input from '../../../components/base/Input';
import Modal from '../../../components/base/Modal';
import ConfirmationModal from '../../../components/base/ConfirmationModal';

interface KitchensManagerProps {
  globalFilter: string;
}

export default function KitchensManager({ globalFilter }: KitchensManagerProps) {
  const { kitchens, addKitchen, deleteKitchen, loading } = useKitchens();
  const { config } = useAppConfig();
  
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ name: '', isActive: true });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [kitchenToDelete, setKitchenToDelete] = useState<Kitchen | null>(null);
  
  // Filtro de busca
  const filteredKitchens = useMemo(() => {
    if (!globalFilter) return kitchens;
    const term = globalFilter.toLowerCase();
    return kitchens.filter(k => k.name.toLowerCase().includes(term));
  }, [kitchens, globalFilter]);
  
  const canAddMore = kitchens.length < config.maxKitchens;
  
  const handleOpenNew = () => {
    if (!canAddMore) {
      alert(`Limite de ${config.maxKitchens} cozinhas atingido. Ajuste nas configurações se precisar de mais.`);
      return;
    }
    setFormData({ name: '', isActive: true });
    setShowModal(true);
  };
  
  const handleSave = async () => {
    if (!formData.name.trim()) {
      alert('Nome da cozinha é obrigatório');
      return;
    }
    
    try {
      await addKitchen({
        name: formData.name.trim(),
        isActive: formData.isActive,
        displayOrder: kitchens.length,
      });
      setShowModal(false);
      setFormData({ name: '', isActive: true });
    } catch (err: any) {
      alert(err.message || 'Erro ao adicionar cozinha');
    }
  };
  
  const handleDelete = async () => {
    if (kitchenToDelete) {
      await deleteKitchen(kitchenToDelete.id);
      setKitchenToDelete(null);
    }
    setShowDeleteConfirm(false);
  };
  
  // REMOVIDO: handleToggleActive - não permite editar, apenas adicionar
  // Para desativar uma cozinha, deve removê-la e adicionar novamente se necessário
  
  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-12 bg-gray-200 rounded"></div>
          <div className="h-12 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Cozinhas</h2>
          <p className="text-sm text-gray-500">
            {kitchens.length} de {config.maxKitchens} cozinhas configuradas
          </p>
        </div>
        <Button onClick={handleOpenNew} disabled={!canAddMore}>
          <i className="ri-add-line mr-2"></i>
          Nova Cozinha
        </Button>
      </div>
      
      {/* Barra de Progresso */}
      <div className="bg-white rounded-lg p-4 border border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Uso de Cozinhas</span>
          <span className="text-sm text-gray-500">{kitchens.length}/{config.maxKitchens}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className={`h-2 rounded-full transition-all ${
              kitchens.length >= config.maxKitchens ? 'bg-red-500' : 'bg-orange-500'
            }`}
            style={{ width: `${Math.min(100, (kitchens.length / config.maxKitchens) * 100)}%` }}
          ></div>
        </div>
      </div>
      
      {/* Lista de Cozinhas */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {filteredKitchens.length === 0 ? (
          <div className="p-8 text-center">
            <i className="ri-restaurant-2-line text-5xl text-gray-300 mb-4"></i>
            <h3 className="text-lg font-medium text-gray-600 mb-2">Nenhuma cozinha cadastrada</h3>
            <p className="text-sm text-gray-500 mb-4">
              Adicione cozinhas para organizar sua operação e direcionar pedidos.
            </p>
            {canAddMore && (
              <Button onClick={handleOpenNew}>
                <i className="ri-add-line mr-2"></i>
                Criar Primeira Cozinha
              </Button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredKitchens.map((kitchen, index) => (
              <div 
                key={kitchen.id} 
                className={`p-4 flex items-center justify-between ${
                  !kitchen.isActive ? 'bg-gray-50' : ''
                }`}
              >
                <div className="flex items-center space-x-4">
                  <div className={`
                    w-12 h-12 rounded-xl flex items-center justify-center
                    ${kitchen.isActive ? 'bg-orange-100 text-orange-600' : 'bg-gray-200 text-gray-400'}
                  `}>
                    <i className="ri-restaurant-2-line text-xl"></i>
                  </div>
                  <div>
                    <h3 className={`font-semibold ${kitchen.isActive ? 'text-gray-900' : 'text-gray-500 line-through'}`}>
                      {kitchen.name}
                    </h3>
                    <p className="text-sm text-gray-500">
                      Posição #{index + 1}
                      {!kitchen.isActive && ' • Inativa'}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  {/* Status (apenas visual, não editável) */}
                  <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                    kitchen.isActive 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {kitchen.isActive ? 'Ativa' : 'Inativa'}
                  </div>
                  
                  {/* Excluir */}
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => {
                      setKitchenToDelete(kitchen);
                      setShowDeleteConfirm(true);
                    }}
                  >
                    <i className="ri-delete-bin-line"></i>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Dicas */}
      <div className="bg-orange-50 rounded-xl p-4 border border-orange-200">
        <h4 className="font-medium text-orange-800 mb-2 flex items-center">
          <i className="ri-lightbulb-line mr-2"></i>
          Dicas sobre Cozinhas
        </h4>
        <ul className="text-sm text-orange-700 space-y-1">
          <li>• Configure cozinhas para dividir a produção (ex: Grill, Bebidas, Sobremesas)</li>
          <li>• Associe categorias a cozinhas específicas nas configurações do cardápio</li>
          <li>• Operadores do KDS selecionam qual cozinha operar ao iniciar</li>
          <li>• No PDV, é possível filtrar itens por cozinha</li>
        </ul>
      </div>
      
      {/* Modal de Edição/Criação */}
      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setFormData({ name: '', isActive: true });
        }}
        title="Nova Cozinha"
        size="sm"
      >
        <div className="space-y-4">
          <Input
            label="Nome da Cozinha *"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="Ex: Grill, Bebidas, Sobremesas..."
          />
          
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-900">Status</h4>
              <p className="text-sm text-gray-500">Cozinhas inativas não recebem pedidos</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={formData.isActive}
                onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
              <span className="ml-3 text-sm font-medium text-gray-900">
                {formData.isActive ? 'Ativa' : 'Inativa'}
              </span>
            </label>
          </div>
          
          <div className="flex space-x-3 pt-4">
            <Button 
              variant="secondary" 
              onClick={() => setShowModal(false)}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleSave}
              className="flex-1"
            >
              Criar
            </Button>
          </div>
        </div>
      </Modal>
      
      {/* Confirmação de Exclusão */}
      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Excluir Cozinha"
        message={
          <>
            Tem certeza que deseja excluir a cozinha <strong>"{kitchenToDelete?.name}"</strong>?
            <br /><br />
            <span className="text-red-600">
              Esta ação é irreversível. Categorias associadas a esta cozinha ficarão sem cozinha definida.
            </span>
          </>
        }
        variant="danger"
        confirmText="Excluir"
      />
    </div>
  );
}

