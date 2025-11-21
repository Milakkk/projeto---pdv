'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabaseClient } from '../../../lib/supabaseClient'

export default function ExecPage({ params }: { params: { id: string } }) {
  const checklistId = params.id
  const [items, setItems] = useState<any[]>([])
  const [completed, setCompleted] = useState<Record<string, boolean>>({})
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const load = async () => {
      if (!supabaseClient) return
      const { data } = await supabaseClient
        .from('checklist_items')
        .select('id,description,required_photo,checklist_id')
        .eq('checklist_id', checklistId)
        .order('description')
      setItems(data || [])
      setLoading(false)
    }
    load()
  }, [checklistId])

  const pct = useMemo(() => {
    const total = items.length || 1
    const done = items.filter(i => completed[i.id]).length
    return Math.round((done / total) * 100)
  }, [items, completed])

  const toggle = (id: string) => setCompleted(prev => ({ ...prev, [id]: !prev[id] }))

  const submit = async () => {
    if (!name.trim()) return
    try {
      setSubmitting(true)
      const res = await fetch('/api/checklist/exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ masterId: checklistId, operatorName: name, items: items.map(i => ({ id: i.id, description: i.description, required_photo: i.required_photo, is_completed: !!completed[i.id] })) }),
      })
      if (!res.ok) throw new Error('Falha ao enviar')
      alert('Checklist enviado')
      setCompleted({})
      setName('')
    } catch (e: any) {
      alert(e.message || 'Erro')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ padding: 16, maxWidth: 640, margin: '0 auto' }}>
      <h1 style={{ fontSize: 18, fontWeight: 600 }}>Executar Checklist</h1>
      <input placeholder="Seu nome" value={name} onChange={e => setName(e.target.value)} style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: 8, padding: 10, marginTop: 12 }} />
      <div style={{ marginTop: 12, fontSize: 12 }}>Progresso: {pct}%</div>
      {loading ? (
        <div style={{ marginTop: 12 }}>Carregando...</div>
      ) : (
        <div style={{ marginTop: 12 }}>
          {items.map(item => (
            <button key={item.id} onClick={() => toggle(item.id)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', textAlign: 'left', padding: 12, border: '1px solid #e5e7eb', borderRadius: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 14 }}>{item.description}</span>
              <span style={{ fontSize: 18 }}>{completed[item.id] ? '✓' : '○'}</span>
            </button>
          ))}
        </div>
      )}
      <button onClick={submit} disabled={submitting} style={{ marginTop: 12, background: '#111827', color: '#fff', padding: '10px 12px', borderRadius: 8 }}>{submitting ? 'Enviando...' : 'Enviar'}</button>
    </div>
  )
}

