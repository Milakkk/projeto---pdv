"use client"
import { useMemo, useState } from 'react'

type View = 'week' | 'month'

type ScheduleItem = {
  id: string
  unit_id: string
  person_id: string
  date: string // YYYY-MM-DD
  label?: string | null
  start_time?: string | null // HH:mm
  end_time?: string | null
  status: 'scheduled' | 'worked' | 'absence' | 'justified'
}

const people = [
  { id: 'p1', name: 'Ana Silva', unit_id: 'unit-1' },
  { id: 'p2', name: 'Bruno Souza', unit_id: 'unit-1' },
]

const initialSchedules: ScheduleItem[] = [
  { id: 's1', unit_id: 'unit-1', person_id: 'p1', date: new Date().toISOString().slice(0, 10), start_time: '08:00', end_time: '16:00', status: 'scheduled' },
  { id: 's2', unit_id: 'unit-1', person_id: 'p2', date: new Date().toISOString().slice(0, 10), start_time: '16:00', end_time: '22:00', status: 'scheduled' },
]

function getWeekDays(base: Date): string[] {
  const day = base.getDay() // 0..6
  const mondayOffset = ((day + 6) % 7) // 0..6, 0 for Monday
  const monday = new Date(base)
  monday.setDate(base.getDate() - mondayOffset)
  return Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d.toISOString().slice(0, 10)
  })
}

export default function EscalaPage() {
  const [unit, setUnit] = useState<string>('unit-1')
  const [view, setView] = useState<View>('week')
  const [cursor, setCursor] = useState<Date>(new Date())
  const [items, setItems] = useState<ScheduleItem[]>(initialSchedules)

  const weekDays = useMemo(() => getWeekDays(cursor), [cursor])

  const rows = useMemo(() => {
    const ps = people.filter((p) => p.unit_id === unit)
    return ps.map((p) => ({
      person: p,
      days: weekDays.map((d) => items.filter((it) => it.person_id === p.id && it.date === d)),
    }))
  }, [unit, weekDays, items])

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">RH — Escala</h1>
      <div className="flex gap-3 items-end">
        <div>
          <label className="block text-sm font-medium">Loja</label>
          <select className="border rounded px-3 py-2" value={unit} onChange={(e) => setUnit(e.target.value)}>
            <option value="unit-1">Matriz</option>
            <option value="unit-2">Filial</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium">Visão</label>
          <select className="border rounded px-3 py-2" value={view} onChange={(e) => setView(e.target.value as View)}>
            <option value="week">Semana</option>
            <option value="month">Mês</option>
          </select>
        </div>
        <div className="ml-auto flex gap-2">
          <button className="px-3 py-2 border rounded" onClick={() => setCursor((d) => new Date(d.getTime() - 7 * 86400000))}>◀</button>
          <button className="px-3 py-2 border rounded" onClick={() => setCursor(new Date())}>Hoje</button>
          <button className="px-3 py-2 border rounded" onClick={() => setCursor((d) => new Date(d.getTime() + 7 * 86400000))}>▶</button>
        </div>
      </div>

      {view === 'week' && (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border rounded">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-3 py-2">Pessoa</th>
                {weekDays.map((d) => (
                  <th key={d} className="text-left px-3 py-2">{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.person.id} className="border-t align-top">
                  <td className="px-3 py-2 whitespace-nowrap">{row.person.name}</td>
                  {row.days.map((cells, idx) => (
                    <td key={idx} className="px-3 py-2">
                      {cells.map((c) => (
                        <div key={c.id} className="mb-1 px-2 py-1 rounded bg-amber-50 border">
                          <div className="font-medium">{c.start_time ?? '—'} - {c.end_time ?? '—'}</div>
                          <div className="text-xs text-gray-600">{c.status}</div>
                        </div>
                      ))}
                      {cells.length === 0 && <div className="text-xs text-gray-400">—</div>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {view === 'month' && (
        <div className="text-gray-500">Visão mensal simplificada (placeholder)</div>
      )}
    </div>
  )
}

