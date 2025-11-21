import Button from '../../components/base/Button';
import Modal from '../../components/base/Modal';
import ChecklistFormModal from './components/ChecklistFormModal';
import ChecklistExecutionModal from './components/ChecklistExecutionModal';
import ConfirmationModal from '../../components/base/ConfirmationModal';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { ChecklistMaster, ChecklistExecution, Store, Role, ChecklistSchedule } from '../../types';
import ChecklistScheduleModal from './components/ChecklistScheduleModal';
import { showReadyAlert } from '../../utils/toast';
import { useAuth } from '../../context/AuthContext';
import { mockStores, mockRoles } from '../../mocks/auth';

// Mock inicial para demonstração
const initialChecklists: ChecklistMaster[] = [
  {
    id: 'cl_1',
    name: 'Abertura de Loja',
    description: 'Tarefas essenciais para iniciar o dia de operação.',
    items: [
      { id: 'i1', description: 'Ligar equipamentos (chapa, fritadeira, cafeteira)', requiredPhoto: false },
      { id: 'i2', description: 'Conferir troco inicial no caixa', requiredPhoto: true, requiredValue: 150.00 },
      { id: 'i3', description: 'Limpar e abastecer área de bebidas', requiredPhoto: false },
    ],
    storeId: mockStores[0].id,
    active: true,
    frequency: 'daily',
    assignedRoleIds: [mockRoles.find(r => r.name === 'Operador de Caixa')?.id || ''],
  },
  {
    id: 'cl_2',
    name: 'Fechamento de Cozinha',
    description: 'Procedimentos de limpeza e segurança ao final do turno.',
    items: [
      { id: 'i4', description: 'Limpeza profunda da chapa', requiredPhoto: true },
      { id: 'i5', description: 'Desligar e limpar fritadeiras', requiredPhoto: true },
      { id: 'i6', description: 'Conferir estoque de carnes', requiredPhoto: false },
    ],
    storeId: mockStores[0].id,
    active: true,
    frequency: 'daily',
    assignedRoleIds: [mockRoles.find(r => r.name === 'Cozinheiro')?.id || ''],
  },
];

export default function ChecklistPage() {
  const { user, store, role } = useAuth();
  const [checklists, setChecklists] = useLocalStorage<ChecklistMaster[]>('checklistsMaster', initialChecklists);
  const [executions, setExecutions] = useLocalStorage<ChecklistExecution[]>('checklistExecutions', []);
  const [schedules, setSchedules] = useLocalStorage<ChecklistSchedule[]>('checklistSchedules', []);
  const [stores] = useLocalStorage<Store[]>('mockStores', mockStores);
  const [roles] = useLocalStorage<Role[]>('mockRoles', mockRoles);

  const [showFormModal, setShowFormModal] = useState(false);
  const [showExecutionModal, setShowExecutionModal] = useState(false);
  const [editingChecklist, setEditingChecklist] = useState<ChecklistMaster | null>(null);
  const [checklistToExecute, setChecklistToExecute] = useState<ChecklistMaster | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleMaster, setScheduleMaster] = useState<ChecklistMaster | null>(null);
  const [editingSchedule, setEditingSchedule] = useState<ChecklistSchedule | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [checklistToDelete, setChecklistToDelete] = useState<string | null>(null);
  const [expandedExecutionId, setExpandedExecutionId] = useState<string | null>(null);

  const storeMap = stores.reduce((map, s) => ({ ...map, [s.id]: s.name }), {} as Record<string, string>);
  const roleMap = roles.reduce((map, r) => ({ ...map, [r.id]: r.name }), {} as Record<string, string>);

  const handleSaveChecklist = (checklist: ChecklistMaster) => {
    if (editingChecklist) {
      setChecklists(prev => prev.map(c => c.id === checklist.id ? checklist : c));
    } else {
      setChecklists(prev => [...prev, checklist]);
    }
    setEditingChecklist(null);
    setShowFormModal(false);
  };

  const handleStartExecution = (checklist: ChecklistMaster) => {
    // Verifica se o usuário tem permissão para executar
    if (!role || !checklist.assignedRoleIds.includes(role.id)) {
      alert('Você não tem permissão para iniciar este checklist.');
      return;
    }
    
    setChecklistToExecute(checklist);
    setShowExecutionModal(true);
  };

  const handleCompleteExecution = (execution: ChecklistExecution) => {
    setExecutions(prev => [...prev, execution]);
    setChecklistToExecute(null);
    setShowExecutionModal(false);
    alert(`Checklist "${execution.name}" finalizado com sucesso!`);
  };

  const handleDeleteChecklist = (checklistId: string) => {
    setChecklistToDelete(checklistId);
    setShowDeleteConfirm(true);
  };

  const handleSaveSchedule = (schedule: ChecklistSchedule) => {
    setSchedules(prev => {
      const exists = prev.some(s => s.id === schedule.id);
      return exists ? prev.map(s => s.id === schedule.id ? schedule : s) : [...prev, schedule];
    });
    setEditingSchedule(null);
    setShowScheduleModal(false);
  };

  const confirmDelete = () => {
    if (checklistToDelete) {
      setChecklists(prev => prev.filter(c => c.id !== checklistToDelete));
      // Opcional: Limpar execuções relacionadas
      setExecutions(prev => prev.filter(e => e.masterId !== checklistToDelete));
      setChecklistToDelete(null);
      setShowDeleteConfirm(false);
    }
  };
  
  const toggleChecklistActive = (checklistId: string) => {
    setChecklists(prev => prev.map(c => 
      c.id === checklistId ? { ...c, active: !c.active } : c
    ));
  };

  // Filtra checklists disponíveis para a loja e perfil do usuário
  const availableChecklists = checklists.filter(c => 
    c.active && 
    c.storeId === store?.id &&
    (role && c.assignedRoleIds.includes(role.id))
  );

  // Verificação periódica de agendamentos e envio de notificações
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();

      const [currentHour, currentMinute] = [now.getHours(), now.getMinutes()];
      const currentDow = now.getDay();
      const currentDom = now.getDate();

      setSchedules(prev => prev.map(s => {
        // Checar critérios básicos
        const master = checklists.find(c => c.id === s.masterId);
        if (!s.enabled || !master || !master.active) return s;
        if (s.storeId !== store?.id) return s;
        if (role && !s.roleIds.includes(role.id)) return s;

        // Checar horário
        const [hh, mm] = s.timeOfDay.split(':').map(n => parseInt(n, 10));
        const timeMatch = currentHour === hh && currentMinute === mm;
        if (!timeMatch) return s;

        // Checar período
        let periodMatch = false;
        if (s.frequency === 'daily') {
          periodMatch = true;
        } else if (s.frequency === 'weekly') {
          periodMatch = (s.daysOfWeek || []).includes(currentDow);
        } else if (s.frequency === 'monthly') {
          periodMatch = s.dayOfMonth === currentDom;
        }
        if (!periodMatch) return s;

        // Evitar repetição dentro do mesmo minuto
        if (s.lastTriggeredAt) {
          const last = new Date(s.lastTriggeredAt);
          if (last.getFullYear() === now.getFullYear() && last.getMonth() === now.getMonth() && last.getDate() === now.getDate() && last.getHours() === currentHour && last.getMinutes() === currentMinute) {
            return s; // já notificado neste minuto
          }
        }

        // Disparar notificação visual
        showReadyAlert(`🔔 Hora de executar: ${master.name}`);

        // Notificação do navegador (quando permitido)
        if ('Notification' in window) {
          if (Notification.permission === 'granted') {
            new Notification(`Checklist: ${master.name}`, { body: 'Está na hora de executar o checklist.' });
          } else if (Notification.permission === 'default') {
            Notification.requestPermission().then(permission => {
              if (permission === 'granted') {
                new Notification(`Checklist: ${master.name}`, { body: 'Está na hora de executar o checklist.' });
              }
            });
          }
        }

        // Atualiza lastTriggeredAt
        return { ...s, lastTriggeredAt: now };
      }));
    }, 60000); // a cada minuto

    return () => clearInterval(interval);
  }, [schedules, checklists, store?.id, role?.id, setSchedules]);

  return (
    <div className="min-h-full bg-gray-50">
      
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Check-list Operacional</h1>
          <div className="flex space-x-3">
            <Button 
              variant="secondary" 
              onClick={() => setShowHistoryModal(true)}
            >
              <i className="ri-history-line mr-2"></i>
              Histórico de Execuções
            </Button>
            <Button onClick={() => { setEditingChecklist(null); setShowFormModal(true); }}>
              <i className="ri-add-line mr-2"></i>
              Novo Checklist Mestre
            </Button>
          </div>
        </div>

        {/* Checklists Disponíveis para Execução */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
            <i className="ri-play-circle-line mr-2 text-green-600"></i>
            Checklists Disponíveis para {storeMap[store?.id || '']}
          </h2>
          
          {availableChecklists.length === 0 ? (
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 text-center text-gray-500">
              <i className="ri-inbox-line text-4xl mb-2"></i>
              <p>Nenhum checklist ativo para sua loja e perfil.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {availableChecklists.map(cl => (
                <div key={cl.id} className="bg-white p-4 rounded-lg shadow-md border border-green-200">
                  <h3 className="font-bold text-lg text-gray-900 mb-2">{cl.name}</h3>
                  <p className="text-sm text-gray-600 mb-3">{cl.description || 'Sem descrição.'}</p>
                  <div className="text-xs text-gray-500 space-y-1 mb-4">
                    <p><i className="ri-repeat-line mr-1"></i> Frequência: {cl.frequency.toUpperCase()}</p>
                    <p><i className="ri-list-check-line mr-1"></i> {cl.items.length} itens</p>
                  </div>
                  <Button 
                    onClick={() => handleStartExecution(cl)} 
                    className="w-full"
                    variant="success"
                  >
                    <i className="ri-play-line mr-2"></i>
                    Iniciar Checklist
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Gerenciamento de Checklists Mestres */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
            <i className="ri-settings-3-line mr-2 text-amber-600"></i>
            Gerenciar Modelos Mestres ({checklists.length})
          </h2>
          
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Nome
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Loja
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Frequência
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Itens
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Perfis
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-48">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {checklists.map((cl) => (
                    <tr key={cl.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900">{cl.name}</div>
                        <div className="text-xs text-gray-500 truncate max-w-xs">{cl.description}</div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                        {storeMap[cl.storeId] || 'Loja Desconhecida'}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600 capitalize">
                        {cl.frequency}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                        {cl.items.length}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600">
                        <div className="flex flex-wrap gap-1 max-w-40">
                          {cl.assignedRoleIds.map(roleId => (
                            <span key={roleId} className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                              {roleMap[roleId] || 'N/A'}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="sr-only peer" 
                            checked={cl.active}
                            onChange={() => toggleChecklistActive(cl.id)}
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                          <span className="ml-3 text-sm font-medium text-gray-900">
                            {cl.active ? 'Ativo' : 'Inativo'}
                          </span>
                        </label>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm space-x-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => { setEditingChecklist(cl); setShowFormModal(true); }}
                        >
                          <i className="ri-edit-line"></i>
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleDeleteChecklist(cl.id)}
                        >
                          <i className="ri-delete-bin-line"></i>
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => { setScheduleMaster(cl); setEditingSchedule(null); setShowScheduleModal(true); }}
                        >
                          <i className="ri-calendar-check-line"></i>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Lista de Agendamentos */}
          <div className="mt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center">
              <i className="ri-notification-3-line mr-2 text-indigo-600"></i>
              Agendamentos Ativos ({schedules.filter(s => s.enabled).length})
            </h3>
            {schedules.length === 0 ? (
              <div className="text-sm text-gray-500">Nenhum agendamento configurado.</div>
            ) : (
              <div className="overflow-x-auto bg-white border border-gray-200 rounded">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Checklist</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Loja</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Periodicidade</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Horário</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Perfis</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {schedules.map(s => {
                      const master = checklists.find(c => c.id === s.masterId);
                      return (
                        <tr key={s.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-sm text-gray-900">{master?.name || 'N/A'}</td>
                          <td className="px-4 py-2 text-sm text-gray-600">{storeMap[s.storeId] || 'N/A'}</td>
                          <td className="px-4 py-2 text-sm text-gray-600 capitalize">{s.frequency}</td>
                          <td className="px-4 py-2 text-sm text-gray-600">{s.timeOfDay}</td>
                          <td className="px-4 py-2 text-xs text-gray-600">
                            <div className="flex flex-wrap gap-1 max-w-48">
                              {s.roleIds.map(id => (
                                <span key={id} className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded">{roleMap[id] || 'N/A'}</span>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-2">
                            <label className="inline-flex items-center">
                              <input type="checkbox" checked={s.enabled} onChange={e => setSchedules(prev => prev.map(ss => ss.id === s.id ? { ...ss, enabled: e.target.checked } : ss))} />
                              <span className="ml-2 text-sm">{s.enabled ? 'Ativo' : 'Inativo'}</span>
                            </label>
                          </td>
                          <td className="px-4 py-2 space-x-2">
                            <Button variant="secondary" size="sm" onClick={() => { setScheduleMaster(master || null); setEditingSchedule(s); setShowScheduleModal(true); }}>
                              <i className="ri-edit-line"></i>
                            </Button>
                            <Button variant="danger" size="sm" onClick={() => setSchedules(prev => prev.filter(ss => ss.id !== s.id))}>
                              <i className="ri-delete-bin-line"></i>
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modais */}
      <ChecklistFormModal
        isOpen={showFormModal}
        onClose={() => setShowFormModal(false)}
        onSave={handleSaveChecklist}
        editingChecklist={editingChecklist}
      />

      {checklistToExecute && (
        <ChecklistExecutionModal
          isOpen={showExecutionModal}
          onClose={() => setShowExecutionModal(false)}
          checklistMaster={checklistToExecute}
          onComplete={handleCompleteExecution}
        />
      )}

      {/* Modal de Agendamento */}
      <ChecklistScheduleModal
        isOpen={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        master={scheduleMaster}
        onSave={handleSaveSchedule}
        editingSchedule={editingSchedule}
      />
      
      {/* Modal de Histórico de Execuções */}
      <Modal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        title="Histórico de Execuções"
        size="xl"
      >
        <div className="space-y-4">
          {executions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <i className="ri-file-list-line text-4xl mb-2"></i>
              <p>Nenhuma execução de checklist registrada.</p>
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Checklist
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Loja
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Iniciado por
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Data
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Progresso
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Detalhes
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {executions.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()).map(exec => (
                    <tr key={exec.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4 whitespace-nowrap font-medium text-gray-900">
                        {exec.name}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                        {storeMap[exec.storeId] || 'N/A'}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                        {exec.startedByUserName}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                        {new Date(exec.startedAt).toLocaleString('pt-BR')}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm">
                        <div className="w-24 bg-gray-200 rounded-full h-2.5">
                          <div 
                            className="bg-blue-600 h-2.5 rounded-full" 
                            style={{ width: `${exec.completionPercentage}%` }}
                          ></div>
                        </div>
                        <span className="text-xs text-gray-500 mt-1 block">{exec.completionPercentage}%</span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          exec.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                          exec.status === 'IN_PROGRESS' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {exec.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <Button variant="secondary" size="sm" onClick={() => setExpandedExecutionId(prev => prev === exec.id ? null : exec.id)}>
                          <i className={`ri-arrow-${expandedExecutionId === exec.id ? 'up' : 'down'}-s-line mr-1`}></i>
                          Itens
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {expandedExecutionId && (
                <div className="mt-4 border-t pt-4">
                  {(() => {
                    const exec = executions.find(e => e.id === expandedExecutionId);
                    if (!exec) return null;
                    return (
                      <div>
                        <h4 className="text-md font-semibold text-gray-900 mb-2">Itens de "{exec.name}"</h4>
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Concluído</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Por</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Quando</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {exec.items.map(item => (
                                <tr key={item.id}>
                                  <td className="px-4 py-2 text-sm text-gray-900">{item.description}</td>
                                  <td className="px-4 py-2 text-sm">
                                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${item.isCompleted ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'}`}>{item.isCompleted ? 'Sim' : 'Não'}</span>
                                  </td>
                                  <td className="px-4 py-2 text-sm text-gray-700">{item.completedByUserName}</td>
                                  <td className="px-4 py-2 text-sm text-gray-700">{item.completedAt ? new Date(item.completedAt).toLocaleString('pt-BR') : '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="flex justify-end pt-4 border-t">
          <Button variant="secondary" onClick={() => setShowHistoryModal(false)}>
            Fechar
          </Button>
        </div>
      </Modal>

      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={confirmDelete}
        title="Excluir Checklist Mestre"
        message="Tem certeza que deseja excluir este modelo de checklist? Todas as execuções passadas serão mantidas, mas o modelo será removido."
        variant="danger"
        confirmText="Excluir Modelo"
      />
    </div>
  );
}
