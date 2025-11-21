import Button from '../../components/base/Button';
import Input from '../../components/base/Input';
import TaskCard from './components/TaskCard';
import TaskFormModal from './components/TaskFormModal';
import ConfirmationModal from '../../components/base/ConfirmationModal';
import TaskList from './components/TaskList';
import TaskCalendar from './components/TaskCalendar';
import TaskStatusConfigModal from './components/TaskStatusConfigModal';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { Task, Store, TaskStatus, TaskStatusKey } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { mockUsers, mockStores } from '../../mocks/auth';
import { DEFAULT_TASK_STATUSES } from '../../utils/constants';

type FilterStatus = 'all' | TaskStatusKey;
type FilterPriority = 'all' | 'low' | 'medium' | 'high';
type ViewMode = 'quadros' | 'list' | 'calendar';

// Função para inicializar tarefas com storeId e assignedToName
const initializeTasks = (tasks: Omit<Task, 'storeId' | 'assignedToName'>[]): Task[] => {
  const defaultStoreId = mockStores[0]?.id || 'store_1';
  
  return tasks.map(task => {
    const assignedUser = mockUsers.find(u => u.id === task.assignedToId);
    
    return {
      ...task,
      storeId: defaultStoreId, // Atribui a loja padrão
      assignedToName: assignedUser?.name,
      comments: [], // Inicializa comentários
    } as Task;
  });
};

// Mock inicial para demonstração (ajustado para usar assignedToId e novo status)
const initialTasks: Omit<Task, 'storeId' | 'assignedToName' | 'status'>[] = [
  {
    id: '1',
    title: 'Limpar a chapa e fritadeira',
    description: 'Limpeza profunda após o pico da noite.',
    dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0], // Amanhã
    priority: 'high',
    status: 'in_progress', // Novo status
    assignedToId: mockUsers.find(u => u.username === 'cozinha')?.id,
    createdAt: new Date(),
  },
  {
    id: '2',
    title: 'Contagem de estoque de bebidas',
    description: 'Verificar refrigerantes e cervejas no refrigerador.',
    dueDate: new Date().toISOString().split('T')[0], // Hoje
    priority: 'medium',
    status: 'pending',
    assignedToId: mockUsers.find(u => u.username === 'caixa')?.id,
    createdAt: new Date(),
  },
  {
    id: '3',
    title: 'Revisar POP de fechamento',
    dueDate: new Date(Date.now() - 86400000).toISOString().split('T')[0], // Ontem (Atrasada)
    priority: 'low',
    status: 'completed',
    assignedToId: mockUsers.find(u => u.username === 'gerente')?.id,
    createdAt: new Date(),
    completedAt: new Date(),
  },
];

export default function TarefasPage() {
  const { store, user } = useAuth();
  const [tasks, setTasks] = useLocalStorage<Task[]>('tasks', initializeTasks(initialTasks));
  const [stores] = useLocalStorage<Store[]>('mockStores', mockStores);
  const [taskStatuses, setTaskStatuses] = useLocalStorage<TaskStatus[]>('taskStatuses', DEFAULT_TASK_STATUSES);
  
  const [showFormModal, setShowFormModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('pending');
  const [filterPriority, setFilterPriority] = useState<FilterPriority>('all');
  const [filterStoreId, setFilterStoreId] = useState<string>(store?.id || 'all');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('quadros');
  
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);

  const handleSaveStatuses = (newStatuses: TaskStatus[]) => {
    setTaskStatuses(newStatuses);
  };

  const handleUpdateStatus = (taskId: string, statusKey: TaskStatusKey) => {
    setTasks(prevTasks => prevTasks.map(t => {
      if (t.id === taskId) {
        const newStatus = taskStatuses.find(s => s.key === statusKey);
        const isFinalStatus = newStatus?.isFinal;
        
        return {
          ...t,
          status: statusKey,
          completedAt: isFinalStatus ? new Date() : undefined,
        };
      }
      return t;
    }));
  };

  const handleSaveTask = (taskData: Omit<Task, 'id' | 'createdAt' | 'completedAt'>, isEditing: boolean) => {
    const assignedUser = mockUsers.find(u => u.id === taskData.assignedToId);
    
    const taskWithNames = {
      ...taskData,
      assignedToName: assignedUser?.name,
    };

    if (isEditing && editingTask) {
      // Se o status for alterado para um status final, registra completedAt
      const currentStatus = taskStatuses.find(s => s.key === taskData.status);
      const isFinalStatus = currentStatus?.isFinal;
      
      setTasks(tasks.map(t => 
        t.id === editingTask.id 
          ? { 
              ...editingTask, 
              ...taskWithNames,
              comments: taskData.comments || [], // Garantir que os comentários sejam salvos
              completedAt: isFinalStatus ? new Date() : undefined,
            } 
          : t
      ));
    } else {
      const newTask: Task = {
        ...taskWithNames as Task,
        id: Date.now().toString(),
        createdAt: new Date(),
        status: 'pending', // Novo status padrão
        comments: [], // Nova tarefa começa sem comentários
      };
      setTasks([...tasks, newTask]);
    }
    setEditingTask(null);
  };

  const handleEdit = (task: Task) => {
    setEditingTask(task);
    setShowFormModal(true);
  };

  const handleToggleComplete = (taskId: string) => {
    setTasks(tasks.map(t => {
      if (t.id === taskId) {
        const isCompleted = taskStatuses.find(s => s.key === t.status)?.isFinal;
        
        // Se estiver concluída, volta para 'pending'. Se não, vai para 'completed'.
        const newStatusKey = isCompleted ? 'pending' : 'completed';
        const newStatus = taskStatuses.find(s => s.key === newStatusKey);
        const isFinalStatus = newStatus?.isFinal;

        return {
          ...t,
          status: newStatusKey,
          completedAt: isFinalStatus ? new Date() : undefined,
        };
      }
      return t;
    }));
  };

  const handleDelete = (taskId: string) => {
    setTaskToDelete(taskId);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    if (taskToDelete) {
      setTasks(tasks.filter(t => t.id !== taskToDelete));
      setTaskToDelete(null);
      setShowDeleteConfirm(false);
    }
  };

  const filteredTasks = useMemo(() => {
    let filtered = tasks;

    // 1. Filtrar por Loja
    if (filterStoreId !== 'all') {
      filtered = filtered.filter(t => t.storeId === filterStoreId);
    }

    // 2. Filtrar por status (apenas se a visualização não for Calendário)
    if (viewMode !== 'calendar' && filterStatus !== 'all') {
      filtered = filtered.filter(t => t.status === filterStatus);
    }

    // 3. Filtrar por prioridade
    if (filterPriority !== 'all') {
      filtered = filtered.filter(t => t.priority === filterPriority);
    }

    // 4. Filtrar por termo de busca
    if (searchTerm.trim()) {
      const lowerSearch = searchTerm.trim().toLowerCase();
      filtered = filtered.filter(t => 
        t.title.toLowerCase().includes(lowerSearch) ||
        t.description?.toLowerCase().includes(lowerSearch) ||
        t.assignedToName?.toLowerCase().includes(lowerSearch)
      );
    }

    // 5. Ordenar (apenas para Quadros e Lista)
    if (viewMode !== 'calendar') {
      const priorityOrder = { high: 3, medium: 2, low: 1, pending: 0 };
      
      filtered.sort((a, b) => {
        // Status final sempre no final
        const statusAIsFinal = taskStatuses.find(s => s.key === a.status)?.isFinal;
        const statusBIsFinal = taskStatuses.find(s => s.key === b.status)?.isFinal;

        if (statusAIsFinal && !statusBIsFinal) return 1;
        if (!statusAIsFinal && statusBIsFinal) return -1;
        
        // Ordenar por prioridade (decrescente)
        const priorityA = priorityOrder[a.priority];
        const priorityB = priorityOrder[b.priority];
        if (priorityA !== priorityB) {
          return priorityB - priorityA;
        }
        
        // Se a prioridade for igual, ordenar por data de vencimento (mais próxima primeiro)
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      });
    }
    
    return filtered;
  }, [tasks, filterStatus, filterPriority, searchTerm, filterStoreId, viewMode, taskStatuses]);

  const pendingCount = tasks.filter(t => 
    !taskStatuses.find(s => s.key === t.status)?.isFinal && 
    (filterStoreId === 'all' || t.storeId === filterStoreId)
  ).length;

  // Mapeamento de status para o filtro
  const statusFilterOptions = useMemo(() => {
    return [
      { key: 'all', label: 'Todos os Status' },
      ...taskStatuses.map(s => ({ key: s.key, label: s.label }))
    ];
  }, [taskStatuses]);

  return (
    <div className="min-h-full bg-gray-50">
      
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            Gerenciador de Tarefas 
            <span className="ml-3 text-base font-medium text-gray-500">
              ({pendingCount} ativas)
            </span>
          </h1>
          <div className="flex space-x-3">
            <Button 
              variant="secondary" 
              onClick={() => setShowConfigModal(true)}
              className="bg-gray-200 text-gray-800 hover:bg-gray-300"
            >
              <i className="ri-settings-3-line mr-2"></i>
              Configurações
            </Button>
            <Button onClick={() => { setEditingTask(null); setShowFormModal(true); }}>
              <i className="ri-add-line mr-2"></i>
              Nova Tarefa
            </Button>
          </div>
        </div>

        {/* Filtros e Visualização */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
            
            {/* Busca */}
            <div className="md:col-span-2">
              <Input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por título, descrição ou responsável..."
                label="Buscar Tarefa:"
              />
            </div>
            
            {/* Filtro de Loja */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Loja:
              </label>
              <select
                value={filterStoreId}
                onChange={(e) => setFilterStoreId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm"
              >
                <option value="all">Todas as Lojas</option>
                {stores.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status (Oculto no calendário) */}
            {viewMode !== 'calendar' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status:
                </label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm"
                >
                  {statusFilterOptions.map(opt => (
                    <option key={opt.key} value={opt.key}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            
            {/* Prioridade */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Prioridade:
              </label>
              <select
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value as FilterPriority)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm"
              >
                <option value="all">Todas</option>
                <option value="high">Alta</option>
                <option value="medium">Média</option>
                <option value="low">Baixa</option>
              </select>
            </div>
          </div>
          
          {/* Seletor de Visualização */}
          <div className="mt-4 pt-4 border-t border-gray-200 flex justify-end">
            <div className="flex items-center space-x-2 bg-gray-200 p-1 rounded-lg">
              <Button
                size="sm"
                variant={viewMode === 'quadros' ? 'primary' : 'secondary'}
                onClick={() => setViewMode('quadros')}
                className="!rounded-md"
              >
                <i className="ri-layout-grid-line mr-2"></i>
                Quadros
              </Button>
              <Button
                size="sm"
                variant={viewMode === 'list' ? 'primary' : 'secondary'}
                onClick={() => setViewMode('list')}
                className="!rounded-md"
              >
                <i className="ri-list-check-2-line mr-2"></i>
                Lista
              </Button>
              <Button
                size="sm"
                variant={viewMode === 'calendar' ? 'primary' : 'secondary'}
                onClick={() => setViewMode('calendar')}
                className="!rounded-md"
              >
                <i className="ri-calendar-line mr-2"></i>
                Calendário
              </Button>
            </div>
          </div>
        </div>

        {/* Conteúdo da Visualização */}
        {filteredTasks.length === 0 && (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <i className="ri-inbox-line text-5xl text-gray-400 mb-4"></i>
            <p className="text-lg text-gray-700">Nenhuma tarefa encontrada com os filtros atuais.</p>
          </div>
        )}
        
        {viewMode === 'quadros' && filteredTasks.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTasks.map(task => (
              <TaskCard
                key={task.id}
                task={task}
                onToggleComplete={handleToggleComplete}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onUpdateStatus={handleUpdateStatus}
              />
            ))}
          </div>
        )}
        
        {viewMode === 'list' && filteredTasks.length > 0 && (
          <TaskList
            tasks={filteredTasks}
            onToggleComplete={handleToggleComplete}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onUpdateStatus={handleUpdateStatus}
          />
        )}
        
        {viewMode === 'calendar' && (
          <TaskCalendar
            tasks={tasks.filter(t => filterStoreId === 'all' || t.storeId === filterStoreId)}
            onEdit={handleEdit}
          />
        )}
      </div>

      {/* Modal de Formulário */}
      <TaskFormModal
        isOpen={showFormModal}
        onClose={() => setShowFormModal(false)}
        onSave={handleSaveTask}
        editingTask={editingTask}
      />
      
      {/* Modal de Configuração de Status */}
      <TaskStatusConfigModal
        isOpen={showConfigModal}
        onClose={() => setShowConfigModal(false)}
        statuses={taskStatuses}
        onSaveStatuses={handleSaveStatuses}
      />
      
      {/* Modal de Confirmação de Exclusão */}
      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={confirmDelete}
        title="Excluir Tarefa"
        message="Tem certeza que deseja excluir esta tarefa? Esta ação é irreversível."
        variant="danger"
        confirmText="Excluir"
      />
    </div>
  );
}