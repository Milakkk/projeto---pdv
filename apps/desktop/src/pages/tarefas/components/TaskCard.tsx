import type { Task, TaskStatus } from '../../../types';
import Button from '../../../components/base/Button';
import { useLocalStorage } from '../../../hooks/useLocalStorage';
import { useState, useEffect, useRef } from 'react';

interface TaskCardProps {
  task: Task;
  onToggleComplete: (taskId: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onUpdateStatus: (taskId: string, statusKey: TaskStatus['key']) => void; // Novo prop
}

const PRIORITY_MAP = {
  low: { label: 'Baixa', color: 'bg-green-100 text-green-800', icon: 'ri-arrow-down-line' },
  medium: { label: 'Média', color: 'bg-amber-100 text-amber-800', icon: 'ri-arrow-right-line' },
  high: { label: 'Alta', color: 'bg-red-100 text-red-800', icon: 'ri-arrow-up-line' },
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
  if (diffDays === 1) return { text: 'Amanhã', color: 'text-blue-600' };
  return { text: `Em ${diffDays} dias`, color: 'text-gray-600' };
};

export default function TaskCard({ task, onToggleComplete, onEdit, onDelete, onUpdateStatus }: TaskCardProps) {
  const [taskStatuses] = useLocalStorage<TaskStatus[]>('taskStatuses', []);
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
    <div 
      // Removendo 'overflow-hidden' e adicionando 'z-10' para garantir que o dropdown não seja cortado
      className={`bg-white rounded-lg shadow-md border transition-all cursor-pointer z-10 ${
        isCompleted 
          ? 'border-green-300 bg-green-50 opacity-70' 
          : task.priority === 'high' ? 'border-red-300' : 'border-gray-200'
      }`}
      onClick={() => onEdit(task)}
    >
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-3">
            {/* Botão de Conclusão Rápida (Toggle) */}
            <button
              onClick={(e) => { e.stopPropagation(); onToggleComplete(task.id); }}
              className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors flex-shrink-0 ${
                isCompleted
                  ? 'bg-green-500 border-green-500 text-white'
                  : 'bg-white border-gray-300 text-transparent hover:border-green-500'
              }`}
              title={isCompleted ? 'Marcar como pendente' : 'Marcar como concluída'}
            >
              <i className="ri-check-line text-sm"></i>
            </button>
            
            <h3 className={`font-bold text-lg ${isCompleted ? 'line-through text-gray-500' : 'text-gray-900'}`}>
              {task.title}
            </h3>
          </div>
          
          <div className="flex items-center space-x-2">
            <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${priorityInfo.color}`}>
              <i className={`${priorityInfo.icon} mr-1`}></i>
              {priorityInfo.label}
            </span>
          </div>
        </div>

        {task.description && (
          <p className={`text-sm text-gray-600 mb-3 ${isCompleted ? 'line-through' : ''}`}>
            {task.description}
          </p>
        )}

        {/* Seletor de Status */}
        <div className="relative mb-3" ref={dropdownRef}>
          <button
            onClick={(e) => { 
              e.stopPropagation(); // IMPEDE PROPAGAÇÃO PARA O CARD
              setShowStatusDropdown(prev => !prev); 
            }}
            className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${currentStatus.color} text-white hover:opacity-90`}
          >
            <span className="flex items-center">
              <i className="ri-refresh-line mr-2"></i>
              {currentStatus.label}
            </span>
            <i className="ri-arrow-down-s-line"></i>
          </button>
          
          {showStatusDropdown && (
            <div className="absolute z-20 mt-1 w-full bg-white rounded-lg shadow-xl border border-gray-200 max-h-48 overflow-y-auto">
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
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm border-t pt-3">
          <div>
            <span className="text-gray-500">Vencimento:</span>
            <span className={`ml-2 ${daysRemaining.color}`}>
              {daysRemaining.text} ({task.dueDate.split('-').reverse().join('/')})
            </span>
          </div>
          {task.assignedToName && (
            <div>
              <span className="text-gray-500">Atribuído a:</span>
              <span className="font-medium text-gray-800 ml-2">{task.assignedToName}</span>
            </div>
          )}
          {isCompleted && task.completedAt && (
            <div className="col-span-2">
              <span className="text-gray-500">Concluído em:</span>
              <span className="font-medium text-green-600 ml-2">
                {new Date(task.completedAt).toLocaleDateString('pt-BR')}
              </span>
            </div>
          )}
        </div>
      </div>
      
      <div className="flex justify-end p-3 border-t bg-gray-50 space-x-2">
        <Button 
          variant="danger" 
          size="sm" 
          onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
        >
          <i className="ri-delete-bin-line mr-1"></i>
          Excluir
        </Button>
      </div>
    </div>
  );
}
