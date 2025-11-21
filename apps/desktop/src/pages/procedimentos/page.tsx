import { useEffect, useMemo, useState } from 'react'
import Modal from '../../components/base/Modal'

type Procedure = {
  id: string
  unit_id: string | null
  title: string
  category: string | null
  content: string | null
  is_active: number
  updated_at: string
}

export default function ProcedimentosPage() {
  const api = (window as any).api
  const [items, setItems] = useState<Procedure[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<{ title: string; category: string; content: string }>({ title: '', category: '', content: '' })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return items
    return items.filter(i => (i.title + ' ' + (i.category || '') + ' ' + (i.content || '')).toLowerCase().includes(term))
  }, [items, q])

  async function load() {
    setLoading(true)
    try {
      // Garantir existência da tabela quando em desenvolvimento
      await api?.db?.query(
        `CREATE TABLE IF NOT EXISTS procedures (
          id TEXT PRIMARY KEY,
          unit_id TEXT,
          title TEXT NOT NULL,
          category TEXT,
          content TEXT,
          is_active INTEGER NOT NULL DEFAULT 1,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          version INTEGER NOT NULL DEFAULT 1,
          pending_sync INTEGER NOT NULL DEFAULT 0
        );`,
        []
      )
      const res = await api?.db?.query(
        'SELECT id, unit_id, title, category, content, is_active, updated_at FROM procedures ORDER BY title ASC',
        []
      )
      if (res?.rows) setItems(res.rows)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  function openNew() {
    setForm({ title: '', category: '', content: '' })
    setEditId(null)
    setError(null)
    setIsOpen(true)
  }

  async function save() {
    setError(null)
    const title = form.title.trim()
    if (!title) { setError('Título é obrigatório'); return }
    setSaving(true)
    try {
      if (editId) {
        const res = await api?.db?.query(
          'UPDATE procedures SET title = ?, category = ?, content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [title, form.category.trim() || null, form.content.trim() || null, editId]
        )
        if (res?.error) { setError(String(res.error)); return }
      } else {
        const id = (crypto as any)?.randomUUID ? (crypto as any).randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`
        const res = await api?.db?.query(
          'INSERT INTO procedures (id, unit_id, title, category, content, is_active) VALUES (?, ?, ?, ?, ?, 1)',
          [id, null, title, form.category.trim() || null, form.content.trim() || null]
        )
        if (res?.error) { setError(String(res.error)); return }
      }
      setIsOpen(false)
      await load()
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(id: string, active: boolean) {
    await api?.db?.query('UPDATE procedures SET is_active = ? WHERE id = ?', [active ? 1 : 0, id])
    await load()
  }

  function openEdit(item: Procedure) {
    setEditId(item.id)
    setForm({ title: item.title, category: item.category || '', content: item.content || '' })
    setError(null)
    setIsOpen(true)
  }

  async function remove(id: string) {
    const ok = window.confirm('Excluir este procedimento?')
    if (!ok) return
    await api?.db?.query('DELETE FROM procedures WHERE id = ?', [id])
    await load()
  }

  return (
    <div className="min-h-full bg-gray-50">
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900">Procedimentos (POP)</h1>
          <button onClick={openNew} className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600">
            <i className="ri-add-line mr-2"></i>
            Novo
          </button>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-md border border-gray-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1">
              <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
              <input
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="Buscar por título, categoria ou conteúdo"
                className="w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            {loading && <span className="text-gray-500 text-sm">Carregando...</span>}
          </div>

          <div className="overflow-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Título</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Categoria</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Atualizado</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filtered.map(item => (
                  <tr key={item.id} className={item.is_active ? '' : 'opacity-50'}>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <i className="ri-book-open-line text-amber-500"></i>
                        <div>
                          <div className="font-medium text-gray-900">{item.title}</div>
                          {item.content && <div className="text-xs text-gray-500 line-clamp-1">{item.content}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-gray-700">{item.category || '-'}</td>
                    <td className="px-3 py-2 text-gray-700">{new Date(item.updated_at).toLocaleString()}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() => toggleActive(item.id, !item.is_active)}
                          className={`px-3 py-1 rounded-lg border ${item.is_active ? 'border-green-500 text-green-600' : 'border-gray-400 text-gray-600'}`}
                          title={item.is_active ? 'Desativar' : 'Ativar'}
                        >
                          {item.is_active ? 'Ativo' : 'Inativo'}
                        </button>
                        <button onClick={() => openEdit(item)} className="px-3 py-1 rounded-lg border border-amber-500 text-amber-600" title="Editar">
                          <i className="ri-edit-line"></i>
                        </button>
                        <button onClick={() => remove(item.id)} className="px-3 py-1 rounded-lg border border-red-500 text-red-600" title="Excluir">
                          <i className="ri-delete-bin-line"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td className="px-3 py-6 text-center text-gray-500" colSpan={4}>Nenhum procedimento encontrado</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title={editId ? 'Editar Procedimento' : 'Novo Procedimento'} size="lg">
          <div className="space-y-4">
            {error && <div className="px-3 py-2 rounded bg-red-50 text-red-700 border border-red-200">{error}</div>}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
              <input
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
              <input
                value={form.category}
                onChange={e => setForm({ ...form, category: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Conteúdo</label>
              <textarea
                value={form.content}
                onChange={e => setForm({ ...form, content: e.target.value })}
                rows={6}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setIsOpen(false)} className="px-4 py-2 border rounded-lg text-gray-700">Cancelar</button>
              <button disabled={saving} onClick={save} className={`px-4 py-2 rounded-lg text-white ${saving ? 'bg-amber-300' : 'bg-amber-500 hover:bg-amber-600'}`}>{saving ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  )
}
