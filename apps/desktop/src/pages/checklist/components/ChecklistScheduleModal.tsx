import Modal from '../../../components/base/Modal';
import Input from '../../../components/base/Input';
import Button from '../../../components/base/Button';
import type { ChecklistMaster, ChecklistSchedule, Role, Store } from '../../../types';
import { useLocalStorage } from '../../../hooks/useLocalStorage';
import { mockRoles, mockStores } from '../../../mocks/auth';
import { useEffect, useState } from 'react';

interface ChecklistScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  master: ChecklistMaster | null;
  onSave: (schedule: ChecklistSchedule) => void;
  editingSchedule?: ChecklistSchedule | null;
}

const WEEK_DAYS = [
  { value: 0, label: 'Dom' },
  { value: 1, label: 'Seg' },
  { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' },
  { value: 5, label: 'Sex' },
  { value: 6, label: 'Sáb' },
];

export default function ChecklistScheduleModal({ isOpen, onClose, master, onSave, editingSchedule }: ChecklistScheduleModalProps) {
  const [stores] = useLocalStorage<Store[]>('mockStores', mockStores);
  const [roles] = useLocalStorage<Role[]>('mockRoles', mockRoles);

  const [storeId, setStoreId] = useState<string>('');
  const [roleIds, setRoleIds] = useState<string[]>([]);
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly'>(master?.frequency || 'daily');
  const [timeOfDay, setTimeOfDay] = useState<string>('08:00');
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([1]);
  const [dayOfMonth, setDayOfMonth] = useState<number>(1);
  const [enabled, setEnabled] = useState<boolean>(true);

  useEffect(() => {
    if (!isOpen) return;
    if (editingSchedule) {
      setStoreId(editingSchedule.storeId);
      setRoleIds(editingSchedule.roleIds);
      setFrequency(editingSchedule.frequency);
      setTimeOfDay(editingSchedule.timeOfDay);
      setDaysOfWeek(editingSchedule.daysOfWeek || []);
      setDayOfMonth(editingSchedule.dayOfMonth || 1);
      setEnabled(editingSchedule.enabled);
    } else {
      setStoreId(master?.storeId || stores[0]?.id || '');
      setRoleIds(master?.assignedRoleIds || []);
      setFrequency(master?.frequency || 'daily');
      setTimeOfDay('08:00');
      setDaysOfWeek([1]);
      setDayOfMonth(1);
      setEnabled(true);
    }
  }, [isOpen, master, editingSchedule, stores]);

  const toggleDayOfWeek = (day: number) => {
    setDaysOfWeek(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  const handleSave = () => {
    if (!master) return;
    if (!timeOfDay || !storeId || roleIds.length === 0) {
      alert('Loja, horário e pelo menos um perfil são obrigatórios.');
      return;
    }

    const schedule: ChecklistSchedule = {
      id: editingSchedule?.id || Date.now().toString(),
      masterId: master.id,
      storeId,
      roleIds,
      frequency,
      timeOfDay,
      daysOfWeek: frequency === 'weekly' ? daysOfWeek.sort() : undefined,
      dayOfMonth: frequency === 'monthly' ? dayOfMonth : undefined,
      enabled,
      lastTriggeredAt: editingSchedule?.lastTriggeredAt,
    };
    onSave(schedule);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Agendar Checklist${master ? `: ${master.name}` : ''}`}
      size="lg"
    >
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Loja</label>
            <select className="w-full border rounded p-2" value={storeId} onChange={e => setStoreId(e.target.value)}>
              {stores.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Horário</label>
            <Input type="time" value={timeOfDay} onChange={e => setTimeOfDay(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Periodicidade</label>
            <select className="w-full border rounded p-2" value={frequency} onChange={e => setFrequency(e.target.value as any)}>
              <option value="daily">Diário</option>
              <option value="weekly">Semanal</option>
              <option value="monthly">Mensal</option>
            </select>
          </div>
          <div>
            {frequency === 'weekly' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Dias da Semana</label>
                <div className="flex flex-wrap gap-2">
                  {WEEK_DAYS.map(d => (
                    <button
                      key={d.value}
                      type="button"
                      onClick={() => toggleDayOfWeek(d.value)}
                      className={`px-3 py-1 rounded border ${daysOfWeek.includes(d.value) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300'}`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {frequency === 'monthly' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dia do Mês</label>
                <Input type="number" min={1} max={31} value={dayOfMonth} onChange={e => setDayOfMonth(Math.max(1, Math.min(31, parseInt(e.target.value || '1'))))} />
              </div>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Perfis Notificados/Responsáveis</label>
          <div className="flex flex-wrap gap-2">
            {roles.map(r => (
              <button
                key={r.id}
                type="button"
                onClick={() => setRoleIds(prev => prev.includes(r.id) ? prev.filter(id => id !== r.id) : [...prev, r.id])}
                className={`px-3 py-1 rounded border text-sm ${roleIds.includes(r.id) ? 'bg-blue-100 text-blue-800 border-blue-300' : 'bg-white text-gray-700 border-gray-300'}`}
              >
                {r.name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center">
          <input id="enabled" type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} className="mr-2" />
          <label htmlFor="enabled" className="text-sm text-gray-700">Agendamento Ativo</label>
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave}>
            <i className="ri-save-line mr-2"></i>
            Salvar Agendamento
          </Button>
        </div>
      </div>
    </Modal>
  );
}
