import { Task } from '../../../types';
import Button from '../../../components/base/Button';

interface TaskCalendarProps {
  tasks: Task[];
  onEdit: (task: Task) => void;
}

const PRIORITY_MAP = {
  low: 'bg-green-500',
  medium: 'bg-amber-500',
  high: 'bg-red-500',
};

// Função auxiliar para gerar o calendário do mês atual
const generateCalendar = (tasks: Task[]) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  
  const startDay = firstDayOfMonth.getDay(); // 0=Dom, 1=Seg...
  const daysInMonth = lastDayOfMonth.getDate();
  
  const calendarDays: (Date | null)[] = [];
  
  // Preencher dias vazios no início
  for (let i = 0; i < startDay; i++) {
    calendarDays.push(null);
  }
  
  // Preencher dias do mês
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push(new Date(year, month, i));
  }
  
  // Mapear tarefas por data (YYYY-MM-DD)
  const tasksByDate: Record<string, Task[]> = tasks.reduce((acc, task) => {
    const dateKey = task.dueDate;
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(task);
    return acc;
  }, {} as Record<string, Task[]>);

  return { calendarDays, tasksByDate, month, year };
};

export default function TaskCalendar({ tasks, onEdit }: TaskCalendarProps) {
  const { calendarDays, tasksByDate, month, year } = generateCalendar(tasks);
  
  const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const todayKey = new Date().toISOString().split('T')[0];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <h3 className="text-xl font-bold text-gray-900 mb-4 text-center">
        {monthNames[month]} de {year}
      </h3>
      
      <div className="grid grid-cols-7 gap-1">
        {/* Cabeçalho dos dias da semana */}
        {dayNames.map(day => (
          <div key={day} className="text-center text-sm font-medium text-gray-600 py-2 border-b border-gray-200">
            {day}
          </div>
        ))}
        
        {/* Dias do calendário */}
        {calendarDays.map((date, index) => {
          const dateKey = date ? date.toISOString().split('T')[0] : null;
          const dayTasks = dateKey ? tasksByDate[dateKey] || [] : [];
          const isToday = dateKey === todayKey;
          
          // Determinar a prioridade máxima para a cor do dia
          const maxPriority = dayTasks.reduce((max, task) => {
            if (task.status === 'completed') return max;
            if (task.priority === 'high') return 'high';
            if (task.priority === 'medium' && max !== 'high') return 'medium';
            if (task.priority === 'low' && max === null) return 'low';
            return max;
          }, null as 'low' | 'medium' | 'high' | null);

          return (
            <div 
              key={index} 
              className={`h-32 p-1 border border-gray-200 relative overflow-y-auto text-xs ${
                date ? 'bg-white' : 'bg-gray-50'
              } ${isToday ? 'ring-2 ring-blue-500 border-blue-500' : ''}`}
            >
              {date && (
                <div className={`font-bold mb-1 flex justify-between items-center ${isToday ? 'text-blue-700' : 'text-gray-900'}`}>
                  <span>{date.getDate()}</span>
                  {maxPriority && (
                    <span className={`w-2 h-2 rounded-full ${PRIORITY_MAP[maxPriority]}`} title={`Prioridade ${maxPriority}`}></span>
                  )}
                </div>
              )}
              
              {dayTasks.map(task => (
                <div 
                  key={task.id}
                  onClick={() => onEdit(task)}
                  className={`mt-1 px-1 py-0.5 rounded truncate cursor-pointer transition-colors ${
                    task.status === 'completed' 
                      ? 'bg-green-200 text-green-800 line-through' 
                      : `${PRIORITY_MAP[task.priority]} text-white hover:opacity-80`
                  }`}
                  title={task.title}
                >
                  {task.title}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}