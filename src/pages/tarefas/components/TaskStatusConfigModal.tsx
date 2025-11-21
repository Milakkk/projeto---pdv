import Modal from '../../../components/base/Modal';
import Input from '../../../components/base/Input';
import Button from '../../../components/base/Button';
import { TaskStatus } from '../../../types';

interface TaskStatusConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  statuses: TaskStatus[];
  onSaveStatuses: (statuses: TaskStatus[]) => void;
}

const COLOR_OPTIONS = [
  { value: 'bg-blue-500', label: 'Azul', hex: '#3b82f6' },
  { value: 'bg-amber-500', label: 'Âmbar', hex: '#f59e0b' },
  { value: 'bg-green-500', label: 'Verde', hex: '#22c55e' },
  { value: 'bg-red-500', label: 'Vermelho', hex: '#ef4444' },
  { value: 'bg-purple-500', label: 'Roxo', hex: '#a855f7' },
  { value: 'bg-gray-500', label: 'Cinza', hex: '#6b7280' },
];

export default function TaskStatusConfigModal({ isOpen, onClose, statuses, onSaveStatuses }: TaskStatusConfigModalProps) {
  const [newStatusLabel, setNewStatusLabel] = useState('');
  const [newStatusColor, setNewStatusColor] = useState(COLOR_OPTIONS[0].value);
  const [newStatusIsFinal, setNewStatusIsFinal] = useState(false);
  const [currentStatuses, setCurrentStatuses] = useState(statuses);

  useEffect(() => {
    // Garantir que os status padrão estejam sempre no início e na ordem correta
    const sortedStatuses = [...statuses].sort((a, b) => {
      if (a.isDefault && !b.isDefault) return -1;
      if (!a.isDefault && b.isDefault) return 1;
      // Ordem padrão: pending, in_progress, completed
      const defaultOrder = { 'pending': 1, 'in_progress': 2, 'completed': 3 };
      return (defaultOrder[a.key as keyof typeof defaultOrder] || 99) - (defaultOrder[b.key as keyof typeof defaultOrder] || 99);
    });
    setCurrentStatuses(sortedStatuses);
  }, [statuses]);

  const handleAddStatus = () => {
    if (!newStatusLabel.trim()) return;

    // Usar um slug simples para a chave
    const newKey = newStatusLabel.trim().toLowerCase().replace(/\s+/g, '_');
    
    if (currentStatuses.some(s => s.key === newKey)) {
      alert('Status com este nome já existe.');
      return;
    }

    const newStatus: TaskStatus = {
      key: newKey,
      label: newStatusLabel.trim(),
      color: newStatusColor,
      isDefault: false,
      isFinal: newStatusIsFinal,
    };

    setCurrentStatuses(prev => [...prev, newStatus]);
    setNewStatusLabel('');
    setNewStatusColor(COLOR_OPTIONS[0].value);
    setNewStatusIsFinal(false);
  };

  const handleRemoveStatus = (key: string) => {
    setCurrentStatuses(currentStatuses.filter(s => s.key !== key));
  };
  
  const handleReorder = (index: number, direction: 'up' | 'down') => {
    const newStatuses = [...currentStatuses];
    const statusToMove = newStatuses[index];
    
    // Não permitir mover status padrão
    if (statusToMove.isDefault) return;

    let targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    // Encontrar o próximo status não-padrão para trocar
    while (targetIndex >= 0 && targetIndex < newStatuses.length) {
      if (!newStatuses[targetIndex].isDefault) {
        // Troca
        [newStatuses[index], newStatuses[targetIndex]] = [newStatuses[targetIndex], newStatuses[index]];
        setCurrentStatuses(newStatuses);
        return;
      }
      targetIndex = direction === 'up' ? targetIndex - 1 : targetIndex + 1;
    }
  };

  const handleSave = () => {
    // Garantir que o status 'completed' seja sempre final
    const finalStatuses = currentStatuses.map(s => 
      s.key === 'completed' ? { ...s, isFinal: true } : s
    );
    onSaveStatuses(finalStatuses);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Configuração de Status de Tarefas"
      size="lg"
    >
      <div className="space-y-6">
        
        {/* Adicionar Novo Status */}
        <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
          <h4 className="font-medium text-gray-900 mb-3">Adicionar Novo Status Personalizado</h4>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div className="md:col-span-2">
              <Input
                label="Nome do Status"
                value={newStatusLabel}
                onChange={(e) => setNewStatusLabel(e.target.value)}
                placeholder="Ex: Revisão, Bloqueado"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cor
              </label>
              <div className="flex space-x-2">
                <select
                  value={newStatusColor}
                  onChange={(e) => setNewStatusColor(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm"
                >
                  {COLOR_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <div className={`w-8 h-8 rounded-lg ${newStatusColor} flex-shrink-0 border border-gray-300`}></div>
              </div>
            </div>
            
            <Button onClick={handleAddStatus} disabled={!newStatusLabel.trim()}>
              <i className="ri-add-line mr-2"></i>
              Adicionar
            </Button>
          </div>
          
          <div className="mt-3 flex items-center space-x-2">
            <input
              type="checkbox"
              id="isFinal"
              checked={newStatusIsFinal}
              onChange={(e) => setNewStatusIsFinal(e.target.checked)}
              className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
            />
            <label htmlFor="isFinal" className="text-sm text-gray-700">
              Marcar como status final (Concluído)
            </label>
          </div>
        </div>

        {/* Lista de Status Atuais */}
        <div>
          <h4 className="font-medium text-gray-900 mb-3">Status Ativos ({currentStatuses.length})</h4>
          <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
            {currentStatuses.map((status, index) => {
              const isMovable = !status.isDefault;
              const canMoveUp = isMovable && index > 0 && !currentStatuses[index - 1].isDefault;
              const canMoveDown = isMovable && index < currentStatuses.length - 1 && !currentStatuses[index + 1].isDefault;
              
              return (
                <div key={status.key} className="p-3 flex items-center justify-between bg-white">
                  <div className="flex items-center space-x-3">
                    <span className={`w-3 h-3 rounded-full ${status.color}`}></span>
                    <span className="font-medium text-gray-900">{status.label}</span>
                    {status.isFinal && (
                      <span className="text-xs font-semibold bg-green-100 text-green-800 px-2 py-0.5 rounded-full">Final</span>
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {isMovable && (
                      <div className="flex space-x-1">
                        <button
                          onClick={() => handleReorder(index, 'up')}
                          disabled={!canMoveUp}
                          className={`w-6 h-6 flex items-center justify-center rounded text-xs transition-colors ${
                            canMoveUp ? 'text-gray-600 hover:bg-gray-200' : 'text-gray-300 cursor-not-allowed'
                          }`}
                          title="Mover para cima"
                        >
                          <i className="ri-arrow-up-s-line"></i>
                        </button>
                        <button
                          onClick={() => handleReorder(index, 'down')}
                          disabled={!canMoveDown}
                          className={`w-6 h-6 flex items-center justify-center rounded text-xs transition-colors ${
                            canMoveDown ? 'text-gray-600 hover:bg-gray-200' : 'text-gray-300 cursor-not-allowed'
                          }`}
                          title="Mover para baixo"
                        >
                          <i className="ri-arrow-down-s-line"></i>
                        </button>
                      </div>
                    )}
                    
                    {status.isDefault ? (
                      <span className="text-xs text-blue-600">Padrão</span>
                    ) : (
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleRemoveStatus(status.key)}
                      >
                        <i className="ri-delete-bin-line"></i>
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button variant="secondary" onClick={onClose} className="mr-3">
            Cancelar
          </Button>
          <Button onClick={handleSave}>
            <i className="ri-save-line mr-2"></i>
            Salvar Configurações
          </Button>
        </div>
      </div>
    </Modal>
  );
}