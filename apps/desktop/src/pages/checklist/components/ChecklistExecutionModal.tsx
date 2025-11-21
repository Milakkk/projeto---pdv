import Modal from '../../../components/base/Modal';
import Button from '../../../components/base/Button';
import type { ChecklistMaster, ChecklistExecution, ChecklistExecutionItem } from '../../../types';
import { useAuth } from '../../../context/AuthContext';

interface ChecklistExecutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  checklistMaster: ChecklistMaster;
  onComplete: (execution: ChecklistExecution) => void;
}

export default function ChecklistExecutionModal({ isOpen, onClose, checklistMaster, onComplete }: ChecklistExecutionModalProps) {
  const { user } = useAuth();
  const [executionItems, setExecutionItems] = useState<ChecklistExecutionItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && checklistMaster.items.length > 0) {
      // Inicializa os itens de execução a partir do mestre
      const initialItems: ChecklistExecutionItem[] = checklistMaster.items.map(item => ({
        ...item,
        isCompleted: false,
        completedByUserId: user?.id || '',
        completedByUserName: user?.name || 'Desconhecido',
      }));
      setExecutionItems(initialItems);
    }
  }, [isOpen, checklistMaster, user]);

  const toggleItemCompletion = (itemId: string, isCompleted: boolean) => {
    setExecutionItems(prev => prev.map(item => {
      if (item.id === itemId) {
        // Se estiver desmarcando, limpa os campos de evidência
        if (!isCompleted) {
          return {
            ...item,
            isCompleted: false,
            completedAt: undefined,
            photoUrl: undefined,
            notes: undefined,
          };
        }
        
        // Se estiver marcando, verifica requisitos
        if (item.requiredPhoto && !item.photoUrl) {
          alert('Este item requer uma foto para ser concluído.');
          return item;
        }

        return {
          ...item,
          isCompleted: true,
          completedAt: new Date(),
        };
      }
      return item;
    }));
  };
  
  const updateItemEvidence = (itemId: string, key: 'photoUrl' | 'notes', value: any) => {
    setExecutionItems(prev => prev.map(item => {
      if (item.id === itemId) {
        return { ...item, [key]: value };
      }
      return item;
    }));
  };

  const calculateCompletionPercentage = () => {
    if (executionItems.length === 0) return 0;
    const completedCount = executionItems.filter(item => item.isCompleted).length;
    return Math.round((completedCount / executionItems.length) * 100);
  };

  const handleCompleteChecklist = async () => {
    // Validação final: todos os itens devem estar completos
    const incompleteItems = executionItems.filter(item => !item.isCompleted);
    if (incompleteItems.length > 0) {
      alert(`Ainda faltam ${incompleteItems.length} itens para completar o checklist.`);
      return;
    }
    
    setIsSubmitting(true);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simular envio

    const completionPercentage = calculateCompletionPercentage();

    const execution: ChecklistExecution = {
      id: Date.now().toString(),
      masterId: checklistMaster.id,
      name: checklistMaster.name,
      storeId: checklistMaster.storeId,
      startedAt: new Date(),
      startedByUserId: user?.id || 'unknown',
      startedByUserName: user?.name || 'Desconhecido',
      items: executionItems,
      status: 'COMPLETED',
      completedAt: new Date(),
      completionPercentage,
    };

    onComplete(execution);
    setIsSubmitting(false);
    onClose();
  };
  
  const completionPercentage = calculateCompletionPercentage();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Executar Checklist: ${checklistMaster.name}`}
      size="xl"
    >
      <div className="space-y-6">
        
        {/* Progresso */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="font-medium text-blue-800">Progresso:</span>
            <span className="text-xl font-bold text-blue-900">{completionPercentage}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div 
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-500" 
              style={{ width: `${completionPercentage}%` }}
            ></div>
          </div>
        </div>

        {/* Lista de Itens */}
        <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100 bg-white">
          {executionItems.map((item, index) => (
            <div key={item.id} className={`p-4 transition-colors ${item.isCompleted ? 'bg-green-50' : 'hover:bg-gray-50'}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3 flex-1 min-w-0 pr-4">
                  <input
                    type="checkbox"
                    checked={item.isCompleted}
                    onChange={(e) => toggleItemCompletion(item.id, e.target.checked)}
                    className="w-5 h-5 rounded border-gray-300 text-green-600 focus:ring-green-500 flex-shrink-0 cursor-pointer"
                    disabled={isSubmitting}
                  />
                  <span className={`text-base font-medium text-gray-900 ${item.isCompleted ? 'line-through text-gray-500' : ''}`}>
                    {index + 1}. {item.description}
                  </span>
                </div>
                
                <div className="flex items-center space-x-2 text-sm text-gray-600 flex-shrink-0">
                  {item.requiredPhoto && (
                    <span className="text-blue-600" title="Requer Foto">
                      <i className="ri-camera-line"></i>
                    </span>
                  )}
                </div>
              </div>
              
              {/* Evidências (Aparece se o item estiver marcado ou se houver requisitos) */}
              {(item.isCompleted || item.requiredPhoto) && (
                <div className="mt-3 ml-8 p-3 border border-gray-200 rounded-lg bg-white space-y-3">
                  
                  {/* Foto */}
                  {item.requiredPhoto && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Evidência Fotográfica:
                      </label>
                      {item.photoUrl ? (
                        <div className="flex items-center space-x-3">
                          <img src={item.photoUrl} alt="Evidência" className="w-16 h-16 object-cover rounded-lg border" />
                          <Button 
                            size="sm" 
                            variant="secondary" 
                            onClick={() => updateItemEvidence(item.id, 'photoUrl', undefined)}
                            disabled={item.isCompleted && !isSubmitting}
                          >
                            Remover Foto
                          </Button>
                        </div>
                      ) : (
                        <Button 
                          size="sm" 
                          variant="info" 
                          onClick={() => {
                            // Simulação de upload de foto
                            const mockPhotoUrl = `https://picsum.photos/seed/${item.id}/100/100`;
                            updateItemEvidence(item.id, 'photoUrl', mockPhotoUrl);
                          }}
                          disabled={item.isCompleted && !isSubmitting}
                        >
                          <i className="ri-camera-line mr-2"></i>
                          Tirar/Anexar Foto
                        </Button>
                      )}
                    </div>
                  )}
                  
                  {/* Notas */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Notas (opcional):
                    </label>
                    <textarea
                      value={item.notes || ''}
                      onChange={(e) => updateItemEvidence(item.id, 'notes', e.target.value)}
                      placeholder="Observações sobre a execução..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm"
                      rows={2}
                      disabled={item.isCompleted && !isSubmitting}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Rodapé e Ações */}
        <div className="flex justify-end space-x-3 pt-4 border-t">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button 
            onClick={handleCompleteChecklist} 
            disabled={completionPercentage !== 100 || isSubmitting}
            variant="success"
          >
            {isSubmitting ? (
              <>
                <i className="ri-loader-4-line mr-2 animate-spin"></i>
                Finalizando...
              </>
            ) : (
              <>
                <i className="ri-check-line mr-2"></i>
                Finalizar Checklist
              </>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
