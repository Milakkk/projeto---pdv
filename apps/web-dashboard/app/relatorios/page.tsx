import { getSupabaseAdmin } from '../../lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

type OrderRow = {
  id: string
  pin: number | null
  status: string | null
  created_at: string | null
  updated_at: string | null
  completed_at: string | null
}

type PhaseRow = {
  order_id: string
  new_start: string | null
  preparing_start: string | null
  ready_at: string | null
  delivered_at: string | null
  updated_at: string | null
}

type TicketRow = {
  id: string
  order_id: string
  status: string | null
  updated_at: string | null
}

const toMs = (v: string | null | undefined) => {
  if (!v) return null
  const t = new Date(v).getTime()
  return Number.isFinite(t) ? t : null
}

const fmtMinutes = (ms: number) => `${Math.max(0, Math.round(ms / 60000))} min`

export default async function RelatoriosPage() {
  let fatal: string | null = null
  let ordersNorm: OrderRow[] = []
  let deliveredOrders: OrderRow[] = []
  let readyOrders: OrderRow[] = []
  let deliveredMissingPhase: OrderRow[] = []
  let readyMissingPhase: OrderRow[] = []
  let lastReadyTickets: TicketRow[] = []
  let readyTicketsLast5m: TicketRow[] = []
  let sample: Array<{
    id: string
    pin: number | null
    status: string
    waitMs: number | null
    prepMs: number | null
    deliveryMs: number | null
    hasPhase: boolean
  }> = []

  try {
    const supa = getSupabaseAdmin()

    const { data: orders, error: ordersErr } = await supa
      .from('orders')
      .select('id,pin,status,created_at,updated_at,completed_at')
      .order('updated_at', { ascending: false })
      .limit(80)
    if (ordersErr) throw ordersErr

    const orderIds = (orders || []).map((o: any) => String(o.id)).filter(Boolean)

    const [{ data: phases, error: phasesErr }, { data: tickets, error: ticketsErr }] = await Promise.all([
      orderIds.length
        ? supa
            .from('kds_phase_times')
            .select('order_id,new_start,preparing_start,ready_at,delivered_at,updated_at')
            .in('order_id', orderIds)
        : Promise.resolve({ data: [] as any[], error: null as any }),
      supa
        .from('kds_tickets')
        .select('id,order_id,status,updated_at')
        .order('updated_at', { ascending: false })
        .limit(120),
    ])

    if (phasesErr) throw phasesErr
    if (ticketsErr) throw ticketsErr

    const phaseByOrderId: Record<string, PhaseRow> = {}
    for (const p of (phases || []) as any[]) phaseByOrderId[String(p.order_id)] = p as PhaseRow

    const now = Date.now()
    ordersNorm = ((orders || []) as any[]).map((o) => o as OrderRow)

    deliveredOrders = ordersNorm.filter((o) => String(o.status || '').toUpperCase() === 'DELIVERED' || !!o.completed_at)
    readyOrders = ordersNorm.filter((o) => String(o.status || '').toUpperCase() === 'READY')

    deliveredMissingPhase = deliveredOrders.filter((o) => {
      const ph = phaseByOrderId[String(o.id)]
      return !ph?.delivered_at
    })

    readyMissingPhase = readyOrders.filter((o) => {
      const ph = phaseByOrderId[String(o.id)]
      return !ph?.ready_at
    })

    lastReadyTickets = ((tickets || []) as any[])
      .map((t) => t as TicketRow)
      .filter((t) => String(t.status || '').toUpperCase() === 'READY')
      .slice(0, 20)

    readyTicketsLast5m = lastReadyTickets.filter((t) => {
      const ms = toMs(t.updated_at)
      return ms != null && now - ms <= 5 * 60000
    })

    sample = ordersNorm.slice(0, 15).map((o) => {
      const ph = phaseByOrderId[String(o.id)]
      const createdAtMs = toMs(ph?.new_start) ?? toMs(o.created_at) ?? toMs(o.updated_at) ?? null
      const preparingStartMs = toMs(ph?.preparing_start) ?? null
      const readyAtMs = toMs(ph?.ready_at) ?? null
      const deliveredAtMs = toMs(ph?.delivered_at) ?? toMs(o.completed_at) ?? null

      const waitMs =
        createdAtMs != null
          ? (preparingStartMs ?? readyAtMs ?? deliveredAtMs ?? now) - createdAtMs
          : null

      const prepMs =
        preparingStartMs != null
          ? (readyAtMs ?? deliveredAtMs ?? now) - preparingStartMs
          : null

      const deliveryMs =
        readyAtMs != null
          ? (deliveredAtMs ?? now) - readyAtMs
          : null

      return {
        id: String(o.id),
        pin: o.pin,
        status: String(o.status || ''),
        waitMs,
        prepMs,
        deliveryMs,
        hasPhase: !!ph,
      }
    })
  } catch (e: any) {
    fatal = e?.message ?? 'Erro ao carregar dados'
  }

  if (fatal) {
    return (
      <div style={{ padding: 24, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Relatórios — Teste do Banco (Vercel)</h1>
        <p style={{ marginTop: 8, color: '#6b7280', fontSize: 13 }}>
          Esta tela lê direto do Supabase (server-side) e serve como “smoke test” do DB.
        </p>
        <p style={{ marginTop: 12, color: '#b91c1c', fontSize: 13 }}>{fatal}</p>
      </div>
    )
  }

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' }}>
      <h1 style={{ fontSize: 20, fontWeight: 700 }}>Relatórios — Teste do Banco (Vercel)</h1>
      <p style={{ marginTop: 8, color: '#6b7280', fontSize: 13 }}>
        Esta tela lê direto do Supabase (server-side) e serve como “smoke test” do DB.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 12, marginTop: 16 }}>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 12, color: '#6b7280' }}>Pedidos carregados</div>
          <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>{ordersNorm.length}</div>
        </div>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 12, color: '#6b7280' }}>DELIVERED sem `kds_phase_times.delivered_at`</div>
          <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>{deliveredMissingPhase.length}</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>
            Total DELIVERED: {deliveredOrders.length}
          </div>
        </div>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 12, color: '#6b7280' }}>READY sem `kds_phase_times.ready_at`</div>
          <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>{readyMissingPhase.length}</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>
            Total READY: {readyOrders.length}
          </div>
        </div>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 12, color: '#6b7280' }}>Tickets READY atualizados (últimos 5 min)</div>
          <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>{readyTicketsLast5m.length}</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>
            Observados: {lastReadyTickets.length}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 18, border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ padding: 12, background: '#f9fafb', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>
          Amostra (últimos pedidos)
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', background: '#fff' }}>
                <th style={{ padding: 10, borderBottom: '1px solid #e5e7eb' }}>Pedido</th>
                <th style={{ padding: 10, borderBottom: '1px solid #e5e7eb' }}>Status</th>
                <th style={{ padding: 10, borderBottom: '1px solid #e5e7eb' }}>Fase no DB</th>
                <th style={{ padding: 10, borderBottom: '1px solid #e5e7eb' }}>Espera</th>
                <th style={{ padding: 10, borderBottom: '1px solid #e5e7eb' }}>Preparo</th>
                <th style={{ padding: 10, borderBottom: '1px solid #e5e7eb' }}>Entrega</th>
              </tr>
            </thead>
            <tbody>
              {sample.map((o) => (
                <tr key={o.id}>
                  <td style={{ padding: 10, borderBottom: '1px solid #f3f4f6' }}>
                    #{o.pin ?? o.id}
                  </td>
                  <td style={{ padding: 10, borderBottom: '1px solid #f3f4f6' }}>{o.status || '—'}</td>
                  <td style={{ padding: 10, borderBottom: '1px solid #f3f4f6' }}>{o.hasPhase ? 'OK' : '—'}</td>
                  <td style={{ padding: 10, borderBottom: '1px solid #f3f4f6' }}>{o.waitMs != null ? fmtMinutes(o.waitMs) : '—'}</td>
                  <td style={{ padding: 10, borderBottom: '1px solid #f3f4f6' }}>{o.prepMs != null ? fmtMinutes(o.prepMs) : '—'}</td>
                  <td style={{ padding: 10, borderBottom: '1px solid #f3f4f6' }}>{o.deliveryMs != null ? fmtMinutes(o.deliveryMs) : '—'}</td>
                </tr>
              ))}
              {sample.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: 14, color: '#6b7280' }}>
                    Sem dados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
