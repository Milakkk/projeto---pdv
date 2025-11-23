import Modal from '../../../components/base/Modal';
import Input from '../../../components/base/Input';
import Button from '../../../components/base/Button';
import TaskComments from './TaskComments';
import type { Task, User, Store, TaskComment } from '../../../types';
import { mockUsers } from '../../../mocks/auth';
import { useLocalStorage } from '../../../hooks/useLocalStorage';
import { useAuth } from '../../../context/AuthContext';
import { useState, useEffect } from 'react';

interface TaskFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: Omit<Task, 'id' | 'createdAt' | 'completedAt'>, isEditing: boolean) => void; // Removido newComment do onSave
  editingTask: Task | null;
}

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Baixa', color: 'text-green-600' },
  { value: 'medium', label: 'Média', color: 'text-amber-600' },
  { value: 'high', label: 'Alta', color: 'text-red-600' },
];

export default function TaskFormModal({ isOpen, onClose, onSave, editingTask }: TaskFormModalProps) {
  const { user, store } = useAuth();
  const [stores] = useLocalStorage<Store[]>('mockStores', []); // Usando mockStores para obter a lista de lojas
  
  const [activeTab, setActiveTab] = useState<'details' | 'comments'>('details');
  
  const [title, setTitle] = useState(editingTask?.title || '');
  const [description, setDescription] = useState(editingTask?.description || '');
  const [dueDate, setDueDate] = useState(editingTask?.dueDate || '');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>(editingTask?.priority || 'medium');
  const [assignedToId, setAssignedToId] = useState(editingTask?.assignedToId || user?.id || '');
  const [selectedStoreId, setSelectedStoreId] = useState(editingTask?.storeId || store?.id || '');
  const [comments, setComments] = useState<TaskComment[]>(editingTask?.comments || []);

  // Lista de usuários disponíveis para atribuição
  const availableUsers: User[] = mockUsers;

  useEffect(() => {
    if (editingTask) {
      setTitle(editingTask.title);
      setDescription(editingTask.description || '');
      setDueDate(editingTask.dueDate);
      setPriority(editingTask.priority);
      setAssignedToId(editingTask.assignedToId || '');
      setSelectedStoreId(editingTask.storeId);
      setComments(editingTask.comments || []);
      setActiveTab('details'); // Volta para detalhes ao abrir
    } else {
      // Resetar para nova tarefa, pré-selecionando o usuário logado e a loja atual
      setTitle('');
      setDescription('');
      setDueDate('');
      setPriority('medium');
      setAssignedToId(user?.id || '');
      setSelectedStoreId(store?.id || '');
      setComments([]);
      setActiveTab('details');
    }
  }, [editingTask, isOpen, user, store]);

  const handleSave = () => {
    if (!title.trim() || !dueDate || !selectedStoreId) {
      alert('Título, Data de Vencimento e Loja são obrigatórios.');
      return;
    }

    const assignedUser = availableUsers.find(u => u.id === assignedToId);

    const taskData: Omit<Task, 'id' | 'createdAt' | 'completedAt'> = {
      title: title.trim(),
      description: description.trim() || undefined,
      dueDate,
      priority,
      status: editingTask?.status || 'pending',
      assignedToId: assignedUser?.id,
      assignedToName: assignedUser?.name,
      storeId: selectedStoreId,
      comments: comments, // Incluir comentários
    };

    onSave(taskData, !!editingTask);
    onClose();
  };
  
  // Função para sincronizar comentários do componente filho
  const handleUpdateComments = (updatedComments: TaskComment[]) => {
    setComments(updatedComments);
    
    // Se estiver editando, salva imediatamente a tarefa com os comentários atualizados
    if (editingTask) {
      const assignedUser = availableUsers.find(u => u.id === assignedToId);
      
      const taskData: Omit<Task, 'id' | 'createdAt' | 'completedAt'> = {
        title: title.trim(),
        description: description.trim() || undefined,
        dueDate,
        priority,
        status: editingTask.status,
        assignedToId: assignedUser?.id,
        assignedToName: assignedUser?.name,
        storeId: selectedStoreId,
        comments: updatedComments, // Passa a lista atualizada
      };
      
      // Chama onSave para persistir o estado atualizado (sem fechar o modal)
      onSave(taskData, true);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingTask ? 'Editar Tarefa' : 'Nova Tarefa'}
      size="lg" // Aumentando o tamanho para acomodar a aba de comentários
    >
      <div className="flex space-x-8 border-b border-gray-200 mb-4">
        <button
          onClick={() => setActiveTab('details')}
          className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
            activeTab === 'details'
              ? 'border-amber-500 text-amber-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <i className="ri-file-list-line mr-2"></i>
          Detalhes
        </button>
        {editingTask && (
          <button
            onClick={() => setActiveTab('comments')}
            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'comments'
                ? 'border-amber-500 text-amber-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <i className="ri-chat-3-line mr-2"></i>
            Comentários ({comments.length})
          </button>
        )}
      </div>
      
      <div className="space-y-4">
        {activeTab === 'details' && (
          <div className="space-y-4">
            <Input
              label="Título da Tarefa *"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Limpar a chapa, Fazer inventário..."
              autoFocus
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Descrição (opcional):
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detalhes da tarefa..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"
                rows={3}
                maxLength={500}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Data de Vencimento *"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
              />
              
              {/* Seleção de Loja */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Loja: *
                </label>
                <select
                  value={selectedStoreId}
                  onChange={(e) => setSelectedStoreId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm"
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
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              {/* Atribuído a */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Atribuído a:
                </label>
                <select
                  value={assignedToId}
                  onChange={(e) => setAssignedToId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm"
                >
                  <option value="">Não Atribuído</option>
                  {availableUsers.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.username})
                    </option>
                  ))}
                </select>
              </div>

              {/* Prioridade */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Prioridade:
                </label>
                <div className="flex space-x-3">
                  {PRIORITY_OPTIONS.map(option => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setPriority(option.value as 'low' | 'medium' | 'high')}
                      className={`flex-1 p-3 rounded-lg border-2 transition-colors ${
                        priority === option.value
                          ? 'border-amber-500 bg-amber-50'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <span className={`font-medium text-sm ${option.color}`}>
                        {option.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
        
        {activeTab === 'comments' && editingTask && (
          <TaskComments
            comments={comments}
            onUpdateComments={handleUpdateComments}
          />
        )}

        <div className="flex space-x-3 pt-4 border-t">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Cancelar
          </Button>
          <Button onClick={handleSave} className="flex-1">
            <i className="ri-save-line mr-2"></i>
            Salvar Tarefa
          </Button>
        </div>
      </div>
    </Modal>
  );
}
