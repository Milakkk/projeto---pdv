import { getSupabaseAdmin } from '../../lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

export default async function ChecklistDashboard() {
  let masters: any[] = []
  let executions: any[] = []
  let fatal: string | null = null

  try {
    const supa = getSupabaseAdmin()
    const [{ data: mastersData, error: mastersErr }, { data: execData, error: execErr }] = await Promise.all([
      supa
        .from('checklist_masters')
        .select('id,name,description,frequency,active,assigned_roles,unit_id')
        .order('updated_at', { ascending: false })
        .limit(50),
      supa
        .from('checklist_executions')
        .select('id,name,unit_id,status,completion_percentage,started_at,completed_at')
        .order('started_at', { ascending: false })
        .limit(50),
    ])

    if (mastersErr) throw mastersErr
    if (execErr) throw execErr

    masters = mastersData || []
    executions = execData || []
  } catch (e: any) {
    fatal = e?.message ?? 'Erro ao carregar dados'
  }

  if (fatal) {
    return (
      <div style={{ padding: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600 }}>Dashboard de Checklists</h1>
        <p style={{ marginTop: 12, color: '#b91c1c', fontSize: 13 }}>{fatal}</p>
      </div>
    )
  }

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 20, fontWeight: 600 }}>Dashboard de Checklists</h1>
      <div style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600 }}>Modelos</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 12 }}>
          {masters.map((m) => (
            <div key={m.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>{m.name}</strong>
                <span style={{ fontSize: 12, color: m.active ? '#16a34a' : '#6b7280' }}>{m.active ? 'Ativo' : 'Inativo'}</span>
              </div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>{m.description || 'Sem descrição'}</div>
              <div style={{ fontSize: 12, color: '#374151', marginTop: 6 }}>Frequência: {String(m.frequency).toUpperCase()}</div>
              <div style={{ marginTop: 8 }}>
                <a href={`/checklist/exec/${m.id}`} style={{ display: 'inline-block', background: '#111827', color: '#fff', padding: '8px 12px', borderRadius: 6, textDecoration: 'none' }}>Abrir no celular</a>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600 }}>Últimas Execuções</h2>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb', textAlign: 'left' }}>
                <th style={{ padding: 8, fontSize: 12 }}>Checklist</th>
                <th style={{ padding: 8, fontSize: 12 }}>Status</th>
                <th style={{ padding: 8, fontSize: 12 }}>Progresso</th>
                <th style={{ padding: 8, fontSize: 12 }}>Início</th>
                <th style={{ padding: 8, fontSize: 12 }}>Conclusão</th>
              </tr>
            </thead>
            <tbody>
              {(executions || []).map((e) => (
                <tr key={e.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                  <td style={{ padding: 8, fontSize: 12 }}>{e.name}</td>
                  <td style={{ padding: 8, fontSize: 12 }}>{e.status}</td>
                  <td style={{ padding: 8, fontSize: 12 }}>{e.completion_percentage}%</td>
                  <td style={{ padding: 8, fontSize: 12 }}>{e.started_at ? new Date(e.started_at as any).toLocaleString('pt-BR') : '-'}</td>
                  <td style={{ padding: 8, fontSize: 12 }}>{e.completed_at ? new Date(e.completed_at as any).toLocaleString('pt-BR') : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
