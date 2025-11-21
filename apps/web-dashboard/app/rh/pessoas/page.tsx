"use client"
import { useMemo, useState } from 'react'

type Status = 'active' | 'on_leave' | 'terminated'

type PersonRow = {
  id: string
  unit_id: string
  full_name: string
  email?: string | null
  phone?: string | null
  role_title?: string | null
  weekly_hours?: number | null
  status: Status
  updated_at?: string
}

const demoData: PersonRow[] = [
  { id: 'p1', unit_id: 'unit-1', full_name: 'Ana Silva', email: 'ana@example.com', phone: '(11) 99999-0001', role_title: 'Atendente', weekly_hours: 44, status: 'active' },
  { id: 'p2', unit_id: 'unit-1', full_name: 'Bruno Souza', email: 'bruno@example.com', phone: '(11) 99999-0002', role_title: 'Cozinheiro', weekly_hours: 36, status: 'on_leave' },
  { id: 'p3', unit_id: 'unit-2', full_name: 'Carla Dias', email: 'carla@example.com', phone: '(21) 98888-0003', role_title: 'Gerente', weekly_hours: 44, status: 'active' },
]

export default function PessoasPage() {
  const [unit, setUnit] = useState<string>('unit-1')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<Status | ''>('')

  const filtered = useMemo(() => {
    return demoData
      .filter((p) => (unit ? p.unit_id === unit : true))
      .filter((p) => (status ? p.status === status : true))
      .filter((p) => {
        const q = search.trim().toLowerCase()
        if (!q) return true
        const hay = [p.full_name, p.email ?? '', p.phone ?? '', p.role_title ?? ''].map(String).map((v) => v.toLowerCase())
        return hay.some((v) => v.includes(q))
      })
  }, [unit, search, status])

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">RH — Pessoas</h1>
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-sm font-medium">Loja</label>
          <select className="border rounded px-3 py-2" value={unit} onChange={(e) => setUnit(e.target.value)}>
            <option value="unit-1">Matriz</option>
            <option value="unit-2">Filial</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium">Status</label>
          <select className="border rounded px-3 py-2" value={status} onChange={(e) => setStatus((e.target.value as Status) || '')}>
            <option value="">Todos</option>
            <option value="active">Ativo</option>
            <option value="on_leave">Licença</option>
            <option value="terminated">Desligado</option>
          </select>
        </div>
        <div className="flex-1 min-w-[240px]">
          <label className="block text-sm font-medium">Busca</label>
          <input className="border rounded px-3 py-2 w-full" placeholder="Nome, e-mail, telefone, cargo" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button className="px-4 py-2 rounded bg-amber-600 text-white">Nova pessoa</button>
      </div>

      <div className="overflow-x-auto border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-3 py-2">Nome</th>
              <th className="text-left px-3 py-2">E-mail</th>
              <th className="text-left px-3 py-2">Telefone</th>
              <th className="text-left px-3 py-2">Cargo</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-left px-3 py-2">Horas/semana</th>
              <th className="text-left px-3 py-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="px-3 py-2">{p.full_name}</td>
                <td className="px-3 py-2">{p.email ?? '—'}</td>
                <td className="px-3 py-2">{p.phone ?? '—'}</td>
                <td className="px-3 py-2">{p.role_title ?? '—'}</td>
                <td className="px-3 py-2">{p.status}</td>
                <td className="px-3 py-2">{p.weekly_hours ?? '—'}</td>
                <td className="px-3 py-2">
                  <button className="px-3 py-1 rounded bg-gray-100">Editar</button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td className="px-3 py-6 text-center text-gray-500" colSpan={7}>Nenhuma pessoa encontrada</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

