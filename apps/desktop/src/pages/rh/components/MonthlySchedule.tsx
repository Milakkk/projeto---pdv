import { useMemo, useState } from 'react'
import Button from '../../../components/base/Button'
import Input from '../../../components/base/Input'
import Modal from '../../../components/base/Modal'
import { useLocalStorage } from '../../../hooks/useLocalStorage'

type Assignment = {
  id: string
  person?: string
  type: string
}

type DaySchedule = {
  date: string
  assignments: Assignment[]
}

type MonthlyScheduleProps = {
  storeId: string
  scheduleTypes: string[]
  onGenerate?: (monthKey: string, next: DaySchedule[]) => void
  onValidate?: (monthKey: string, current: DaySchedule[]) => void
}

const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const monthNames = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'
]

const fmtKey = (d: Date) => d.toISOString().split('T')[0]

export default function MonthlySchedule({ storeId, scheduleTypes, onGenerate, onValidate }: MonthlyScheduleProps) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`
  const storageKey = `rh_monthly_schedule:${storeId}:${monthKey}`
  const [days, setDays] = useLocalStorage<DaySchedule[]>(storageKey, [])
  const [people] = useLocalStorage<{ id: string; name: string; scheduleType: string }[]>(`rh_people:${storeId}`, [])
  const [operatingDays] = useLocalStorage<Record<string, number[]>>('master_store_operating_days', {})
  const openDays = useMemo(() => operatingDays[storeId] ?? [0,1,2,3,4,5,6], [operatingDays, storeId])
  const [editingDate, setEditingDate] = useState<string | null>(null)
  const [newPerson, setNewPerson] = useState('')
  const [newType, setNewType] = useState('')

  const { calendarDays } = useMemo(() => {
    const first = new Date(year, month, 1)
    const last = new Date(year, month + 1, 0)
    const startDay = first.getDay()
    const daysInMonth = last.getDate()
    const arr: (Date | null)[] = []
    for (let i = 0; i < startDay; i++) arr.push(null)
    for (let i = 1; i <= daysInMonth; i++) arr.push(new Date(year, month, i))
    return { calendarDays: arr }
  }, [year, month])

  const byDate = useMemo(() => {
    const map: Record<string, DaySchedule> = {}
    for (const d of days) map[d.date] = d
    return map
  }, [days])

  const openEdit = (date: string) => {
    setEditingDate(date)
    setNewPerson('')
    setNewType('')
  }

  const addAssignment = () => {
    if (!editingDate) return
    const type = newType.trim()
    if (!type) return
    const assignment: Assignment = { id: crypto.randomUUID(), person: newPerson.trim() || undefined, type }
    const next = [...days]
    const idx = next.findIndex(d => d.date === editingDate)
    if (idx >= 0) {
      next[idx] = { ...next[idx], assignments: [...next[idx].assignments, assignment] }
    } else {
      next.push({ date: editingDate, assignments: [assignment] })
    }
    setDays(next)
    setNewPerson('')
    setNewType('')
  }

  const removeAssignment = (date: string, id: string) => {
    const next = days.map(d => d.date === date ? { ...d, assignments: d.assignments.filter(a => a.id !== id) } : d)
    setDays(next)
  }

  const clearDay = (date: string) => {
    const next = days.filter(d => d.date !== date)
    setDays(next)
    setEditingDate(null)
  }

  const changeMonth = (delta: number) => {
    const base = new Date(year, month, 1)
    base.setMonth(base.getMonth() + delta)
    setYear(base.getFullYear())
    setMonth(base.getMonth())
  }

  const handleGenerate = () => {
    const last = new Date(year, month + 1, 0)
    const parse = (t: string) => {
      const m = t.match(/^(\d+)x(\d+)$/)
      if (!m) return { work: 1, rest: 0 }
      return { work: parseInt(m[1], 10), rest: parseInt(m[2], 10) }
    }
    const nextMap: Record<string, Assignment[]> = {}
    for (const p of people) {
      const cfg = parse(p.scheduleType)
      let cyclePos = 0
      for (let d = 1; d <= last.getDate(); d++) {
        const date = fmtKey(new Date(year, month, d))
        const dow = new Date(year, month, d).getDay()
        if (!openDays.includes(dow)) continue
        const isWork = cyclePos < cfg.work
        if (isWork) {
          const arr = nextMap[date] || []
          arr.push({ id: crypto.randomUUID(), person: p.name, type: p.scheduleType })
          nextMap[date] = arr
        }
        cyclePos++
        if (cyclePos >= cfg.work + cfg.rest) cyclePos = 0
      }
    }
    const next: DaySchedule[] = Object.keys(nextMap)
      .sort()
      .map(date => ({ date, assignments: nextMap[date] }))
    setDays(next)
    onGenerate?.(monthKey, next)
  }

  const handleValidate = () => {
    const issues: { date: string; message: string }[] = []
    for (const d of days) {
      const seen = new Set<string>()
      for (const a of d.assignments) {
        if (a.person) {
          const key = `${d.date}:${a.person}`
          if (seen.has(key)) issues.push({ date: d.date, message: `Pessoa duplicada no dia: ${a.person}` })
          seen.add(key)
        }
        if (!a.type) issues.push({ date: d.date, message: 'Tipo de escala vazio' })
      }
    }
    onValidate?.(monthKey, days)
    if (issues.length === 0) {
      alert('Escala válida para o mês selecionado.')
    } else {
      alert(`Foram encontradas ${issues.length} inconsistências. Verifique os dias sinalizados.`)
    }
  }

  const todayKey = fmtKey(new Date())

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Button variant="secondary" size="sm" onClick={() => changeMonth(-1)}>
            <i className="ri-arrow-left-s-line mr-1"></i> Mês anterior
          </Button>
          <Button variant="secondary" size="sm" onClick={() => changeMonth(1)}>
            Próximo mês <i className="ri-arrow-right-s-line ml-1"></i>
          </Button>
        </div>
        <h3 className="text-lg font-semibold">{monthNames[month]} de {year}</h3>
        <div className="flex items-center space-x-2">
          <Button size="sm" onClick={handleGenerate}>
            <i className="ri-time-line mr-2"></i> Gerar escala
          </Button>
          <Button size="sm" variant="secondary" onClick={handleValidate}>
            <i className="ri-shield-check-line mr-2"></i> Validar escala
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {dayNames.map(d => (
          <div key={d} className="text-center text-sm font-medium text-gray-600 py-2 border-b border-gray-200">{d}</div>
        ))}
        {calendarDays.map((date, idx) => {
          const dateKey = date ? fmtKey(date) : null
          const day = dateKey ? byDate[dateKey] : undefined
          const isToday = dateKey === todayKey
          return (
            <div key={idx} className={`h-36 p-1 border border-gray-200 relative overflow-y-auto text-xs ${date ? 'bg-white' : 'bg-gray-50'} ${isToday ? 'ring-2 ring-blue-500 border-blue-500' : ''}`}>
              {date && (
                <div className={`font-bold mb-1 flex justify-between items-center ${isToday ? 'text-blue-700' : 'text-gray-900'}`}>
                  <span>{date.getDate()}</span>
                  <div className="flex items-center space-x-1">
                    <button className="text-gray-400 hover:text-gray-600" title="Adicionar" onClick={() => openEdit(dateKey!)}>
                      <i className="ri-add-line"></i>
                    </button>
                    {day && day.assignments.length > 0 && (
                      <button className="text-gray-400 hover:text-red-600" title="Limpar dia" onClick={() => clearDay(dateKey!)}>
                        <i className="ri-delete-bin-line"></i>
                      </button>
                    )}
                  </div>
                </div>
              )}
              {day && day.assignments.map(a => (
                <div key={a.id} className="mt-1 px-1 py-0.5 rounded bg-amber-500 text-white flex items-center justify-between">
                  <span className="truncate" title={`${a.person || 'Sem pessoa'} · ${a.type}`}>{a.person || 'Sem pessoa'} · {a.type}</span>
                  <button className="ml-2 text-white/80 hover:text-white" onClick={() => removeAssignment(day.date, a.id)} title="Remover">
                    <i className="ri-close-line"></i>
                  </button>
                </div>
              ))}
            </div>
          )
        })}
      </div>

      <Modal isOpen={!!editingDate} onClose={() => setEditingDate(null)} title="Adicionar na data" size="md">
        <div className="space-y-3">
          <Input label="Pessoa" value={newPerson} onChange={e => setNewPerson(e.target.value)} placeholder="Nome (opcional)" />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de escala</label>
            <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" value={newType} onChange={e => setNewType(e.target.value)}>
              <option value="">Selecione...</option>
              {scheduleTypes.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center justify-end space-x-2">
            <Button variant="secondary" onClick={() => setEditingDate(null)}>Cancelar</Button>
            <Button onClick={addAssignment} disabled={!newType}>Adicionar</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
