import { useState } from 'react';
import type { KitchenOperator } from '../../../types';
import Modal from '../../../components/base/Modal';
import Input from '../../../components/base/Input';
import Button from '../../../components/base/Button';
import ConfirmationModal from '../../../components/base/ConfirmationModal';

interface OperatorManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  operators: KitchenOperator[];
  setOperators: (operators: KitchenOperator[]) => void;
}

export default function OperatorManagementModal({ isOpen, onClose, operators, setOperators }: OperatorManagementModalProps) {
  const [newOperatorName, setNewOperatorName] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [operatorToDelete, setOperatorToDelete] = useState<KitchenOperator | null>(null);
  
  // NOVOS ESTADOS PARA EDIÇÃO
  const [editingOperator, setEditingOperator] = useState<KitchenOperator | null>(null);
  const [editedName, setEditedName] = useState('');

  const handleAddOperator = () => {
    if (newOperatorName.trim() === '') {
      alert('O nome do operador não pode ser vazio.');
      return;
    }
    if (operators.some(op => op.name.toLowerCase() === newOperatorName.trim().toLowerCase())) {
      alert('Este operador já existe.');
      return;
    }

    const newOperator: KitchenOperator = {
      id: Date.now().toString(),
      name: newOperatorName.trim(),
    };

    setOperators([...operators, newOperator]);
    setNewOperatorName('');
  };
  
  const handleStartEdit = (operator: KitchenOperator) => {
    setEditingOperator(operator);
    setEditedName(operator.name);
  };
  
  const handleSaveEdit = () => {
    if (!editingOperator || editedName.trim() === '') {
      alert('O nome não pode ser vazio.');
      return;
    }
    
    const trimmedName = editedName.trim();
    
    // Verifica se o nome já existe em outro operador
    if (operators.some(op => op.name.toLowerCase() === trimmedName.toLowerCase() && op.id !== editingOperator.id)) {
      alert('Este nome já está em uso por outro operador.');
      return;
    }
    
    setOperators(operators.map(op => 
      op.id === editingOperator.id ? { ...op, name: trimmedName } : op
    ));
    
    setEditingOperator(null);
    setEditedName('');
  };
  
  const handleCancelEdit = () => {
    setEditingOperator(null);
    setEditedName('');
  };

  const handleDeleteOperator = (operator: KitchenOperator) => {
    setOperatorToDelete(operator);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteOperator = () => {
    if (operatorToDelete) {
      setOperators(operators.filter(op => op.id !== operatorToDelete.id));
    }
    setShowDeleteConfirm(false);
    setOperatorToDelete(null);
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Gerenciar Operadores da Cozinha"
        size="md"
      >
        <div className="space-y-6">
          {/* Adicionar novo operador */}
          <div>
            <h4 className="font-medium text-gray-900 mb-3">Adicionar Novo Operador</h4>
            <div className="flex space-x-2">
              <Input
                value={newOperatorName}
                onChange={(e) => setNewOperatorName(e.target.value)}
                placeholder="Nome do operador"
                className="flex-1"
                onKeyPress={(e) => e.key === 'Enter' && handleAddOperator()}
              />
              <Button onClick={handleAddOperator}>
                <i className="ri-add-line mr-2"></i>
                Adicionar
              </Button>
            </div>
          </div>

          {/* Lista de operadores existentes */}
          <div>
            <h4 className="font-medium text-gray-900 mb-3">Operadores Cadastrados ({operators.length})</h4>
            {operators.length === 0 ? (
              <div className="text-center py-6 bg-gray-50 rounded-lg">
                <p className="text-gray-500">Nenhum operador cadastrado.</p>
              </div>
            ) : (
              <div className="max-h-64 overflow-y-auto space-y-2 border border-gray-200 rounded-lg p-3">
                {operators.map(operator => {
                  const isEditing = editingOperator?.id === operator.id;
                  
                  return (
                    <div key={operator.id} className="flex items-center justify-between p-2 bg-white rounded hover:bg-gray-50">
                      {isEditing ? (
                        <div className="flex-1 flex space-x-2 items-center">
                          <Input
                            value={editedName}
                            onChange={(e) => setEditedName(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleSaveEdit()}
                            className="flex-1"
                            autoFocus
                          />
                          <Button size="sm" onClick={handleSaveEdit} disabled={!editedName.trim()}>
                            <i className="ri-save-line"></i>
                          </Button>
                          <Button size="sm" variant="secondary" onClick={handleCancelEdit}>
                            <i className="ri-close-line"></i>
                          </Button>
                        </div>
                      ) : (
                        <>
                          <span className="font-medium text-gray-800">{operator.name}</span>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleStartEdit(operator)}
                              className="text-blue-500 hover:text-blue-700"
                              title="Editar operador"
                            >
                              <i className="ri-edit-line"></i>
                            </button>
                            <button
                              onClick={() => handleDeleteOperator(operator)}
                              className="text-red-500 hover:text-red-700"
                              title="Remover operador"
                            >
                              <i className="ri-delete-bin-line"></i>
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex justify-end pt-4 border-t">
            <Button variant="secondary" onClick={onClose}>
              Fechar
            </Button>
          </div>
        </div>
      </Modal>

      {operatorToDelete && (
        <ConfirmationModal
          isOpen={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={confirmDeleteOperator}
          title="Confirmar Exclusão"
          message={
            <>
              Tem certeza que deseja remover o operador:
              <span className="font-bold text-red-700 block mt-1">"{operatorToDelete.name}"</span>?
              <p className="text-xs text-gray-500 mt-2">
                Esta ação não afetará os registros de pedidos antigos.
              </p>
            </>
          }
          confirmText="Sim, remover"
          variant="danger"
        />
      )}
    </>
  );
}
