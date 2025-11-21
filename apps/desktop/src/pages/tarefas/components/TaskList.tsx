import type { Task, TaskStatus } from '../../../types';
import Button from '../../../components/base/Button';
import { useLocalStorage } from '../../../hooks/useLocalStorage';

interface TaskListProps {
  tasks: Task[];
  onToggleComplete: (taskId: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onUpdateStatus: (taskId: string, statusKey: TaskStatus['key']) => void; // Novo prop
}

const PRIORITY_MAP = {
  low: { label: 'Baixa', color: 'bg-green-100 text-green-800' },
  medium: { label: 'Média', color: 'bg-amber-100 text-amber-800' },
  high: { label: 'Alta', color: 'bg-red-100 text-red-800' },
};

const getDaysRemaining = (dueDate: string) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  
  const diffTime = due.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) return { text: 'Atrasada', color: 'text-red-600 font-bold' };
  if (diffDays === 0) return { text: 'Hoje', color: 'text-amber-600 font-bold' };
  return { text: `Em ${diffDays} dias`, color: 'text-gray-600' };
};

// Componente de Linha de Tarefa para gerenciar o estado do dropdown
function TaskRow({ task, onToggleComplete, onEdit, onDelete, onUpdateStatus, taskStatuses }: {
  task: Task;
  onToggleComplete: (taskId: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onUpdateStatus: (taskId: string, statusKey: TaskStatus['key']) => void;
  taskStatuses: TaskStatus[];
}) {
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const priorityInfo = PRIORITY_MAP[task.priority];
  const daysRemaining = getDaysRemaining(task.dueDate);
  
  const currentStatus = taskStatuses.find(s => s.key === task.status) || { 
    key: task.status, 
    label: task.status, 
    color: 'bg-gray-500', 
    isFinal: false 
  };
  const isCompleted = currentStatus.isFinal;

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowStatusDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownRef]);

  const handleStatusChange = (statusKey: TaskStatus['key']) => {
    onUpdateStatus(task.id, statusKey);
    setShowStatusDropdown(false);
  };

  return (
    <tr 
      key={task.id} 
      className={`hover:bg-gray-50 cursor-pointer ${isCompleted ? 'bg-green-50 opacity-70' : ''}`}
      onClick={() => onEdit(task)} // Edição por clique
    >
      <td className="px-4 py-3 whitespace-nowrap">
        <button
          onClick={(e) => { e.stopPropagation(); onToggleComplete(task.id); }}
          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
            isCompleted
              ? 'bg-green-500 border-green-500 text-white'
              : 'bg-white border-gray-300 text-transparent hover:border-green-500'
          }`}
          title={isCompleted ? 'Marcar como pendente' : 'Marcar como concluída'}
        >
          <i className="ri-check-line text-sm"></i>
        </button>
      </td>
      <td className="px-4 py-3">
        <div className={`font-medium text-gray-900 ${isCompleted ? 'line-through text-gray-500' : ''}`}>
          {task.title}
        </div>
        {task.description && (
          <div className="text-xs text-gray-500 mt-1 truncate max-w-xs">
            {task.description}
          </div>
        )}
      </td>
      <td className="px-4 py-3 whitespace-nowrap relative" ref={dropdownRef}>
        <button
          onClick={(e) => { 
            e.stopPropagation(); // IMPEDE PROPAGAÇÃO PARA A LINHA
            setShowStatusDropdown(prev => !prev); 
          }}
          className={`inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full transition-colors border border-gray-300 ${currentStatus.color} text-white`}
        >
          {currentStatus.label}
          <i className="ri-arrow-down-s-line ml-1"></i>
        </button>
        
        {showStatusDropdown && (
          <div className="absolute z-10 mt-1 w-40 bg-white rounded-lg shadow-xl border border-gray-200 max-h-48 overflow-y-auto">
            {taskStatuses.map(status => (
              <button
                key={status.key}
                onClick={(e) => { e.stopPropagation(); handleStatusChange(status.key); }}
                className={`w-full text-left px-3 py-2 text-sm flex items-center space-x-2 hover:bg-gray-100 ${
                  status.key === task.status ? 'bg-gray-100 font-semibold' : 'text-gray-700'
                }`}
              >
                <span className={`w-3 h-3 rounded-full ${status.color}`}></span>
                <span>{status.label}</span>
              </button>
            ))}
          </div>
        )}
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${priorityInfo.color}`}>
          {priorityInfo.label}
        </span>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <div className={`text-sm ${daysRemaining.color}`}>
          {daysRemaining.text}
        </div>
        <div className="text-xs text-gray-500">
          {task.dueDate.split('-').reverse().join('/')}
        </div>
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-800">
        {task.assignedToName || 'Não Atribuído'}
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-sm">
        <Button 
          variant="danger" 
          size="sm" 
          onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
        >
          <i className="ri-delete-bin-line"></i>
        </Button>
      </td>
    </tr>
  );
}


export default function TaskList({ tasks, onToggleComplete, onEdit, onDelete, onUpdateStatus }: TaskListProps) {
  const [taskStatuses] = useLocalStorage<TaskStatus[]>('taskStatuses', []);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                Concluir
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-64">
                Tarefa
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                Prioridade
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                Vencimento
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                Atribuído a
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {tasks.map(task => (
              <TaskRow
                key={task.id}
                task={task}
                onToggleComplete={onToggleComplete}
                onEdit={onEdit}
                onDelete={onDelete}
                onUpdateStatus={onUpdateStatus}
                taskStatuses={taskStatuses}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
