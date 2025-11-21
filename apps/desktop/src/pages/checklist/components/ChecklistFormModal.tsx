import Modal from '../../../components/base/Modal';
import Input from '../../../components/base/Input';
import Button from '../../../components/base/Button';
import type { ChecklistMaster, ChecklistItem, Store, Role } from '../../../types';
import { useLocalStorage } from '../../../hooks/useLocalStorage';
import { mockRoles, mockStores } from '../../../mocks/auth';

interface ChecklistFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (checklist: ChecklistMaster) => void;
  editingChecklist: ChecklistMaster | null;
}

const FREQUENCY_OPTIONS = [
  { value: 'daily', label: 'Diário' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'monthly', label: 'Mensal' },
  { value: 'on_demand', label: 'Sob Demanda' },
];

export default function ChecklistFormModal({ isOpen, onClose, onSave, editingChecklist }: ChecklistFormModalProps) {
  const [name, setName] = useState(editingChecklist?.name || '');
  const [description, setDescription] = useState(editingChecklist?.description || '');
  const [frequency, setFrequency] = useState(editingChecklist?.frequency || 'daily');
  const [storeId, setStoreId] = useState(editingChecklist?.storeId || mockStores[0]?.id || '');
  const [assignedRoleIds, setAssignedRoleIds] = useState(editingChecklist?.assignedRoleIds || []);
  const [items, setItems] = useState<ChecklistItem[]>(editingChecklist?.items || []);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  
  const [newItemDescription, setNewItemDescription] = useState('');
  const [newItemRequiredPhoto, setNewItemRequiredPhoto] = useState(false);
  // Campo Valor Esperado removido
  
  const [stores] = useLocalStorage<Store[]>('mockStores', mockStores);
  const [roles] = useLocalStorage<Role[]>('mockRoles', mockRoles);

  useEffect(() => {
    if (editingChecklist) {
      setName(editingChecklist.name);
      setDescription(editingChecklist.description || '');
      setFrequency(editingChecklist.frequency);
      setStoreId(editingChecklist.storeId);
      setAssignedRoleIds(editingChecklist.assignedRoleIds);
      setItems(editingChecklist.items);
    } else {
      setName('');
      setDescription('');
      setFrequency('daily');
      setStoreId(mockStores[0]?.id || '');
      setAssignedRoleIds([]);
      setItems([]);
    }
  }, [editingChecklist, isOpen]);

  const handleAddItem = () => {
    if (!newItemDescription.trim()) return;

    const newItem: ChecklistItem = {
      id: Date.now().toString(),
      description: newItemDescription.trim(),
      requiredPhoto: newItemRequiredPhoto,
    };

    setItems([...items, newItem]);
    setNewItemDescription('');
    setNewItemRequiredPhoto(false);
  };

  const handleRemoveItem = (itemId: string) => {
    setItems(items.filter(item => item.id !== itemId));
    if (editingItemId === itemId) {
      setEditingItemId(null);
    }
  };

  const startEditItem = (itemId: string) => {
    setEditingItemId(itemId);
  };

  const cancelEditItem = () => {
    setEditingItemId(null);
  };

  const updateItemField = (itemId: string, field: keyof ChecklistItem, value: any) => {
    setItems(prev => prev.map(item => item.id === itemId ? { ...item, [field]: value } : item));
  };

  const handleSave = () => {
    if (!name.trim() || !storeId || items.length === 0) {
      alert('Nome, Loja e pelo menos um item são obrigatórios.');
      return;
    }

    // Sanitiza itens para remover quaisquer propriedades legadas (ex.: requiredValue)
    const sanitizedItems: ChecklistItem[] = items.map(it => ({
      id: it.id,
      description: it.description,
      requiredPhoto: it.requiredPhoto,
    }));

    const checklist: ChecklistMaster = {
      id: editingChecklist?.id || Date.now().toString(),
      name: name.trim(),
      description: description.trim() || undefined,
      items: sanitizedItems,
      storeId,
      active: editingChecklist?.active ?? true,
      frequency,
      assignedRoleIds,
    };

    onSave(checklist);
    onClose();
  };
  
  const toggleRoleAssignment = (roleId: string) => {
    setAssignedRoleIds(prev => 
      prev.includes(roleId) 
        ? prev.filter(id => id !== roleId)
        : [...prev, roleId]
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingChecklist ? 'Editar Checklist' : 'Novo Checklist Mestre'}
      size="xl"
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Coluna 1: Detalhes Básicos */}
        <div className="lg:col-span-1 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Detalhes Básicos</h3>
          
          <Input
            label="Nome do Checklist *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Abertura de Caixa, Limpeza Diária"
            autoFocus
          />
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Descrição (opcional):
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Objetivo e contexto do checklist..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={3}
              maxLength={500}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Loja Aplicável *
            </label>
            <select
              value={storeId}
              onChange={(e) => setStoreId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              required
            >
              <option value="">Selecione a Loja</option>
              {stores.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Frequência
            </label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as ChecklistMaster['frequency'])}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              {FREQUENCY_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          
          {/* Atribuição de Perfil */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">
              Perfis Autorizados a Executar:
            </h4>
            <div className="space-y-2 max-h-32 overflow-y-auto p-2 border rounded-lg bg-white">
              {roles.map(role => (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => toggleRoleAssignment(role.id)}
                  className={`w-full text-left p-2 rounded-lg border transition-colors flex items-center justify-between ${
                    assignedRoleIds.includes(role.id)
                      ? 'bg-blue-100 border-blue-300 text-blue-800'
                      : 'bg-gray-50 border-gray-200 hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  <span className="text-sm font-medium">{role.name}</span>
                  {assignedRoleIds.includes(role.id) && <i className="ri-check-line text-blue-600"></i>}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Selecione os perfis que podem iniciar este checklist.
            </p>
          </div>
        </div>

        {/* Coluna 2 e 3: Itens do Checklist */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Itens do Checklist ({items.length})</h3>
          
          {/* Adicionar Novo Item */}
          <div className="p-4 border border-blue-200 rounded-lg bg-blue-50 space-y-3">
            <h4 className="font-medium text-blue-800">Adicionar Item</h4>
            <Input
              value={newItemDescription}
              onChange={(e) => setNewItemDescription(e.target.value)}
              placeholder="Descrição da tarefa (Ex: Verificar temperatura do freezer)"
              onKeyPress={(e) => e.key === 'Enter' && handleAddItem()}
            />
            
            <div className="grid grid-cols-2 gap-4 items-center">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newItemRequiredPhoto}
                  onChange={(e) => setNewItemRequiredPhoto(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Requer Foto</span>
              </label>
              
              <Button onClick={handleAddItem} disabled={!newItemDescription.trim()}>
                <i className="ri-add-line mr-2"></i>
                Adicionar
              </Button>
            </div>
          </div>

          {/* Lista de Itens */}
          <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100 bg-white">
            {items.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <i className="ri-list-check-line text-3xl mb-2"></i>
                <p className="text-sm">Nenhum item adicionado ainda.</p>
              </div>
            ) : (
              items.map((item, index) => (
                <div key={item.id} className="p-3 hover:bg-gray-50">
                  {editingItemId === item.id ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                        <div className="md:col-span-2">
                          <Input
                            label={`Item ${index + 1} - Descrição`}
                            value={item.description}
                            onChange={e => updateItemField(item.id, 'description', e.target.value)}
                          />
                        </div>
                        <div className="flex items-center space-x-3">
                          <label className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={item.requiredPhoto}
                              onChange={e => updateItemField(item.id, 'requiredPhoto', e.target.checked)}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700">Requer Foto</span>
                          </label>
                        </div>
                      </div>
                        <div className="md:col-span-3 flex justify-end space-x-2">
                          <Button variant="secondary" size="sm" onClick={cancelEditItem}>
                            <i className="ri-close-line mr-1"></i>
                            Cancelar
                          </Button>
                          <Button variant="primary" size="sm" onClick={() => setEditingItemId(null)}>
                            <i className="ri-check-line mr-1"></i>
                            Salvar
                          </Button>
                          <Button 
                            variant="danger" 
                            size="sm" 
                            onClick={() => handleRemoveItem(item.id)}
                          >
                            <i className="ri-delete-bin-line"></i>
                            Remover
                          </Button>
                        </div>
                      </div>
                  ) : (
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0 pr-4">
                        <span className="text-sm font-medium text-gray-900 block truncate">
                          {index + 1}. {item.description}
                        </span>
                        <div className="text-xs text-gray-500 mt-1 space-x-3">
                          {item.requiredPhoto && (
                            <span className="text-blue-600">
                              <i className="ri-camera-line mr-1"></i>
                              Requer Foto
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button 
                          variant="secondary" 
                          size="sm" 
                          onClick={() => startEditItem(item.id)}
                        >
                          <i className="ri-edit-line"></i>
                        </Button>
                        <Button 
                          variant="danger" 
                          size="sm" 
                          onClick={() => handleRemoveItem(item.id)}
                        >
                          <i className="ri-delete-bin-line"></i>
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Rodapé e Ações */}
      <div className="flex justify-end space-x-3 pt-4 border-t mt-6">
        <Button variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button onClick={handleSave} disabled={!name.trim() || items.length === 0}>
          <i className="ri-save-line mr-2"></i>
          Salvar Checklist
        </Button>
      </div>
    </Modal>
  );
}
