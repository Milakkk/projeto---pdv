import { supabase } from '../../utils/supabase'
// Renderer: usar IPC seguro exposto pelo preload
const query = async (sql: string, params?: any[]) => {
  const fn = (window as any)?.api?.db?.query
  if (typeof fn !== 'function') throw new Error('Canal de DB indisponível')
  try {
    const res = await fn(sql, params)
    if (res?.error) throw new Error(String(res.error))
    return res as { rows?: any[]; meta?: any; error?: any }
  } catch (e) {
    await new Promise(r => setTimeout(r, 200))
    const res2 = await fn(sql, params)
    if (res2?.error) throw new Error(String(res2.error))
    return res2 as { rows?: any[]; meta?: any; error?: any }
  }
}

type UUID = string

const uuid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`

const lanHubUrl: string | undefined = (() => {
  const envUrl = (import.meta as any)?.env?.VITE_LAN_HUB_URL
  if (envUrl) return envUrl
  const host = typeof window !== 'undefined' ? (window.location.hostname || 'localhost') : 'localhost'
  return `http://${host}:4000`
})()
const lanSecret: string | undefined = (import.meta as any)?.env?.VITE_LAN_SYNC_SECRET || undefined

let lastPushFailAt = 0
async function pushLanEvents(events: any[]) {
  if (!lanSecret) return
  const nowMs = Date.now()
  if (lastPushFailAt && nowMs - lastPushFailAt < 15000) return
  try {
    const unitDefault = 'default'
    const enriched = (Array.isArray(events) ? events : []).map((e: any) => ({ ...e, unit_id: e?.unit_id ?? unitDefault }))
    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${lanSecret}` }
    await fetch(`${lanHubUrl.replace(/\/$/, '')}/push`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ events: enriched }),
    })
  } catch {
    lastPushFailAt = nowMs
  }
}

export async function getPhaseTimes(orderId: string): Promise<any> {
  // [FIX] Supabase call disabled due to 400 Bad Request
  // try {
  //   if (supabase) {
  //     const { data } = await supabase
  //       .from('kds_phase_times')
  //       .select('*')
  //       .eq('order_id', orderId)
  //       .maybeSingle()
  //     return data || {}
  //   }
  try {
    const raw = localStorage.getItem('kdsPhaseTimes')
    const obj = raw ? JSON.parse(raw) : {}
    return obj[String(orderId)] || {}
  } catch { return {} }
  // } catch { return {} }
}

async function setPhaseTime(orderId: string, patch: any) {
  const now = new Date().toISOString()
  // [FIX] Supabase call disabled due to 400 Bad Request
  /*
  try {
    await query(
      'INSERT INTO kds_phase_times (order_id, new_start, preparing_start, ready_at, delivered_at, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(order_id) DO UPDATE SET new_start=COALESCE(excluded.new_start, new_start), preparing_start=COALESCE(excluded.preparing_start, preparing_start), ready_at=COALESCE(excluded.ready_at, ready_at), delivered_at=COALESCE(excluded.delivered_at, delivered_at), updated_at=excluded.updated_at',
      [
        orderId,
        patch?.newStart ?? null,
        patch?.preparingStart ?? null,
        patch?.readyAt ?? null,
        patch?.deliveredAt ?? null,
        now,
      ],
    )
  } catch {
    if (supabase) {
      // await supabase
      //   .from('kds_phase_times')
      //   .upsert({ order_id: orderId, new_start: patch?.newStart ?? null, preparing_start: patch?.preparingStart ?? null, ready_at: patch?.readyAt ?? null, delivered_at: patch?.deliveredAt ?? null, updated_at: now }, { onConflict: 'order_id' })
    } else {
  */
  try {
    const raw = localStorage.getItem('kdsPhaseTimes')
    const obj = raw ? JSON.parse(raw) : {}
    const cur = obj[String(orderId)] || {}
    const next = { ...cur, ...patch }
    obj[String(orderId)] = next
    localStorage.setItem('kdsPhaseTimes', JSON.stringify(obj))
  } catch { }
  //   }
  // }
  try { await pushLanEvents([{ table: 'kds_phase_times', row: { orderId, ...patch } }]) } catch { }
}

async function persistUnitStateDb(orderId: string, itemId: string, unitId: string, patch: any) {
  const id = `${orderId}:${itemId}:${unitId}`
  const now = new Date().toISOString()
  const operatorName = patch?.operatorName ?? null
  const unitStatus = patch?.unitStatus ?? null
  const completedObservationsJson = Array.isArray(patch?.completedObservations)
    ? JSON.stringify(patch.completedObservations)
    : null
  const completedAt = patch?.completedAt ?? null
  const deliveredAt = patch?.deliveredAt ?? null
  try {
    await query(
      'INSERT INTO kds_unit_states (id, order_id, item_id, unit_id, operator_name, unit_status, completed_observations_json, completed_at, delivered_at, updated_at, version, pending_sync) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET operator_name=COALESCE(excluded.operator_name, operator_name), unit_status=COALESCE(excluded.unit_status, unit_status), completed_observations_json=COALESCE(excluded.completed_observations_json, completed_observations_json), completed_at=COALESCE(excluded.completed_at, completed_at), delivered_at=COALESCE(excluded.delivered_at, delivered_at), updated_at=excluded.updated_at, pending_sync=excluded.pending_sync',
      [id, orderId, itemId, unitId, operatorName, unitStatus, completedObservationsJson, completedAt, deliveredAt, now, 1, 1],
    )
  } catch {
    try {
      const raw = localStorage.getItem('kdsUnitState')
      const state = raw ? JSON.parse(raw) : {}
      const key = `${orderId}:${itemId}:${unitId}`
      const current = state[key] || {}
      const next = { ...current, ...patch }
      state[key] = next
      localStorage.setItem('kdsUnitState', JSON.stringify(state))
    } catch { }
  }
}

export async function loadUnitStatesForOrder(orderId: string): Promise<Record<string, any>> {
  const map: Record<string, any> = {}
  try {
    const res = await query('SELECT * FROM kds_unit_states WHERE order_id = ?', [orderId])
    for (const r of (res?.rows ?? [])) {
      const key = `${String(r.order_id ?? r.orderId)}:${String(r.item_id ?? r.itemId)}:${String(r.unit_id ?? r.unitId)}`
      map[key] = {
        operatorName: r.operator_name ?? r.operatorName ?? undefined,
        unitStatus: r.unit_status ?? r.unitStatus ?? undefined,
        completedObservations: (() => { try { const arr = JSON.parse(String(r.completed_observations_json ?? 'null')); return Array.isArray(arr) ? arr : [] } catch { return [] } })(),
        completedAt: r.completed_at ?? r.completedAt ?? undefined,
      }
    }
    return map
  } catch {
    if (supabase) {
      const { data } = await supabase
        .from('kds_unit_states')
        .select('*')
        .eq('order_id', orderId)
      const out: Record<string, any> = {}
      for (const r of (data || [])) {
        const key = `${String(r.order_id)}:${String(r.item_id)}:${String(r.unit_id)}`
        out[key] = {
          operatorName: r.operator_name ?? undefined,
          unitStatus: r.unit_status ?? undefined,
          completedObservations: (() => { try { const arr = JSON.parse(String(r.completed_observations_json ?? 'null')); return Array.isArray(arr) ? arr : [] } catch { return [] } })(),
          completedAt: r.completed_at ?? undefined,
        }
      }
      return out
    }
    try {
      const raw = localStorage.getItem('kdsUnitState')
      const state = raw ? JSON.parse(raw) : {}
      return state || {}
    } catch { return {} }
  }
}

function mergeUnitFromMap(stateMap: Record<string, any>, orderId: string, itemId: string, unit: any) {
  const key = `${orderId}:${itemId}:${unit.unitId}`
  const s = stateMap[key] || null
  if (!s) return unit
  const out = { ...unit }
  if (s.operatorName) out.operatorName = s.operatorName
  if (s.unitStatus) out.unitStatus = s.unitStatus
  if (Array.isArray(s.completedObservations)) out.completedObservations = s.completedObservations
  if (s.unitStatus === 'READY') out.completedAt = out.completedAt || s.completedAt || new Date().toISOString()
  if (s.deliveredAt) out.deliveredAt = s.deliveredAt
  return out
}

export async function applyHubEvents(events: any[]) {
  const arr = Array.isArray(events) ? events : []
  if (!arr.length) return
  const now = new Date().toISOString()
  for (const e of arr) {
    const table = String(e?.table || '')
    const row = e?.row || {}
    if (table === 'kdsTickets') {
      const id = String(row.id || '')
      if (!id) continue
      const orderId = row.order_id ?? row.orderId ?? null
      const unitId = row.unit_id ?? row.unitId ?? null
      const status = row.status ?? 'queued'
      const station = row.station ?? null
      const updatedAt = row.updated_at ?? row.updatedAt ?? now
      try {
        await query(
          'INSERT INTO kds_tickets (id, order_id, unit_id, status, station, updated_at, version, pending_sync) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET order_id=excluded.order_id, unit_id=excluded.unit_id, status=excluded.status, station=excluded.station, updated_at=excluded.updated_at, pending_sync=excluded.pending_sync',
          [id, orderId, unitId, status, station, updatedAt, 1, 0],
        )
      } catch { }
    } else if (table === 'orders') {
      const id = String(row.id || '')
      if (!id) continue
      const incomingStatus = row.status ?? null
      const total = row.total_cents ?? row.totalCents ?? null
      const openedAt = row.opened_at ?? row.openedAt ?? null
      const deliveredAt = row.deliveredAt ?? row.delivered_at ?? null
      const closedAtRaw = row.closed_at ?? row.closedAt ?? null
      const deviceId = row.device_id ?? row.deviceId ?? null
      const unitId = row.unit_id ?? row.unitId ?? null
      const notes = row.notes ?? null
      const updatedAt = row.updated_at ?? row.updatedAt ?? now
      const statusStr = String(incomingStatus || '').toUpperCase()
      // Apenas atualizar status para fechamento (closed/cancelled), não para status intermediários
      const dbStatus = statusStr === 'DELIVERED' ? 'closed' : statusStr === 'CANCELLED' ? 'cancelled' : null
      const dbClosedAt = dbStatus === 'closed' || dbStatus === 'cancelled' ? (deliveredAt ?? closedAtRaw ?? updatedAt) : null
      try {
        // Se for fechamento, atualizar status e closed_at. Caso contrário, apenas inserir se não existir
        if (dbStatus === 'closed' || dbStatus === 'cancelled') {
          await query(
            'INSERT INTO orders (id, status, total_cents, opened_at, closed_at, device_id, unit_id, notes, updated_at, version, pending_sync) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET status=excluded.status, closed_at=excluded.closed_at, updated_at=excluded.updated_at, pending_sync=excluded.pending_sync',
            [id, dbStatus, total, openedAt, dbClosedAt, deviceId, unitId, notes, updatedAt, 1, 0],
          )
        } else {
          // Para status intermediários, apenas inserir se não existir (não atualizar opened_at nem status)
          await query(
            'INSERT INTO orders (id, status, total_cents, opened_at, closed_at, device_id, unit_id, notes, updated_at, version, pending_sync) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET total_cents=COALESCE(excluded.total_cents, total_cents), notes=COALESCE(excluded.notes, notes), updated_at=excluded.updated_at, pending_sync=excluded.pending_sync',
            [id, incomingStatus || 'open', total, openedAt, closedAtRaw, deviceId, unitId, notes, updatedAt, 1, 0],
          )
        }
        const pin = row.pin ?? null
        const password = row.password ?? null
        if (pin || password) {
          await query(
            'INSERT INTO orders_details (order_id, pin, password, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(order_id) DO UPDATE SET pin=COALESCE(excluded.pin, pin), password=COALESCE(excluded.password, password), updated_at=excluded.updated_at',
            [id, pin, password, updatedAt],
          )
        }
      } catch { }
    } else if (table === 'cash_sessions') {
      const id = String(row.id || '')
      if (!id) continue
      const openedAt = row.opened_at ?? row.openedAt ?? null
      const closedAt = row.closed_at ?? row.closedAt ?? null
      const openedBy = row.opened_by ?? row.openedBy ?? null
      const closedBy = row.closed_by ?? row.closedBy ?? null
      const openingAmount = row.opening_amount_cents ?? row.openingAmountCents ?? null
      const closingAmount = row.closing_amount_cents ?? row.closingAmountCents ?? null
      const updatedAt = row.updated_at ?? row.updatedAt ?? now
      try {
        await query(
          'INSERT INTO cash_sessions (id, opened_at, closed_at, opened_by, closed_by, opening_amount_cents, closing_amount_cents, updated_at, version, pending_sync) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET opened_at=COALESCE(excluded.opened_at, opened_at), closed_at=COALESCE(excluded.closed_at, closed_at), opened_by=COALESCE(excluded.opened_by, opened_by), closed_by=COALESCE(excluded.closed_by, closed_by), opening_amount_cents=COALESCE(excluded.opening_amount_cents, opening_amount_cents), closing_amount_cents=COALESCE(excluded.closing_amount_cents, closing_amount_cents), updated_at=excluded.updated_at, pending_sync=excluded.pending_sync',
          [id, openedAt, closedAt, openedBy, closedBy, openingAmount, closingAmount, updatedAt, 1, 0],
        )
      } catch { }
    } else if (table === 'cash_movements') {
      const id = String(row.id || '')
      if (!id) continue
      const sessionId = row.session_id ?? row.sessionId ?? null
      const type = row.type ?? null
      const reason = row.reason ?? null
      const amount = row.amount_cents ?? row.amountCents ?? null
      const createdAt = row.created_at ?? row.createdAt ?? null
      const updatedAt = row.updated_at ?? row.updatedAt ?? now
      try {
        await query(
          'INSERT INTO cash_movements (id, session_id, type, reason, amount_cents, created_at, updated_at, version, pending_sync) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET session_id=COALESCE(excluded.session_id, session_id), type=COALESCE(excluded.type, type), reason=COALESCE(excluded.reason, reason), amount_cents=COALESCE(excluded.amount_cents, amount_cents), created_at=COALESCE(excluded.created_at, created_at), updated_at=excluded.updated_at, pending_sync=excluded.pending_sync',
          [id, sessionId, type, reason, amount, createdAt, updatedAt, 1, 0],
        )
      } catch { }
    } else if (table === 'kds_phase_times') {
      const orderId = String(row.orderId || row.order_id || '')
      if (!orderId) continue
      const patch: any = {
        newStart: row.newStart ?? null,
        preparingStart: row.preparingStart ?? null,
        readyAt: row.readyAt ?? null,
        deliveredAt: row.deliveredAt ?? null,
      }
      try { await setPhaseTime(orderId, patch) } catch { }
    }
  }
}

export async function enqueueTicket(params: { orderId: UUID; station?: string | null }) {
  const id = uuid()
  const now = new Date().toISOString()
  const unitId = await getCurrentUnitId()
  if (supabase) {
    await supabase
      .from('kds_tickets')
      .insert({ id, order_id: params.orderId, unit_id: unitId ?? null, status: 'NEW', station: params.station ?? null, updated_at: now, version: 1, pending_sync: false })
    try { console.log('[KDS] enqueueTicket supabase', { id, orderId: params.orderId, status: 'NEW', kitchenId: null }) } catch { }
  } else {
    try {
      await query(
        'INSERT INTO kds_tickets (id, order_id, unit_id, status, station, updated_at, version, pending_sync) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [id, params.orderId, unitId ?? null, 'queued', params.station ?? null, now, 1, 1],
      )
    } catch {
      try {
        const raw = localStorage.getItem('kdsTickets')
        const arr = raw ? JSON.parse(raw) : []
        const ticket = { id, order_id: params.orderId, unit_id: unitId ?? null, status: 'queued', station: params.station ?? null, updated_at: now }
        arr.push(ticket)
        localStorage.setItem('kdsTickets', JSON.stringify(arr))
      } catch { }
    }
  }
  try { await pushLanEvents([{ table: 'kdsTickets', row: { id, order_id: params.orderId, unit_id: unitId ?? null, status: 'NEW', station: params.station ?? null, updated_at: now } }]) } catch { }
  try { await setPhaseTime(params.orderId, { newStart: now }) } catch { }
  return id
}

export async function setTicketStatus(id: UUID, status: 'queued' | 'prep' | 'ready' | 'done') {
  const now = new Date().toISOString()
  if ((await import('../../utils/supabase')).supabase) {
    const { supabase } = await import('../../utils/supabase')
    const map = { queued: 'NEW', prep: 'PREPARING', ready: 'READY', done: 'DELIVERED' } as Record<string, string>
    const { data: tk } = await supabase
      .from('kds_tickets')
      .select('order_id')
      .eq('id', id)
      .maybeSingle()
    const orderId = tk?.order_id ? String(tk.order_id) : undefined
    await supabase
      .from('kds_tickets')
      .update({ status: map[status], updated_at: now })
      .eq('id', id)
    // FIXED: Update orders table for ALL statuses, not just 'done'
    if (orderId) {
      const orderUpdate: Record<string, any> = { status: map[status], updated_at: now }
      if (status === 'ready') orderUpdate.ready_at = now
      if (status === 'done') {
        orderUpdate.delivered_at = now
        orderUpdate.closed_at = now
      }
      await supabase
        .from('orders')
        .update(orderUpdate)
        .eq('id', orderId)
    }
    // return - removido para garantir que o estado local também seja atualizado (optimistic/backup)
  }

  let orderId: string | undefined
  let targetTicketId: string | undefined
  try {
    const r = await query('SELECT order_id FROM kds_tickets WHERE id = ?', [id])
    orderId = r?.rows && r.rows[0]?.order_id ? String(r.rows[0].order_id) : undefined
    targetTicketId = orderId ? String(id) : undefined
  } catch { }
  if (!orderId) {
    try {
      const raw = localStorage.getItem('kdsTickets')
      const arr = raw ? JSON.parse(raw) : []
      const tk = (Array.isArray(arr) ? arr : []).find((t: any) => String(t.id) === String(id))
      orderId = tk?.order_id || tk?.orderId
      targetTicketId = tk?.id ? String(tk.id) : undefined
    } catch { }
  }
  // Fallback: tratar 'id' como orderId e localizar o ticket correspondente
  if (!orderId) {
    try {
      const r2 = await query('SELECT id, order_id FROM kds_tickets WHERE order_id = ? ORDER BY datetime(updated_at) DESC LIMIT 1', [id])
      const row = r2?.rows && r2.rows[0]
      if (row) {
        orderId = String(row.order_id)
        targetTicketId = String(row.id)
      }
    } catch { }
  }
  if (orderId) {
    try {
      if (status === 'queued') await setPhaseTime(orderId, { newStart: now })
      if (status === 'prep') await setPhaseTime(orderId, { preparingStart: now })
      if (status === 'ready') await setPhaseTime(orderId, { readyAt: now })
      if (status === 'done') await setPhaseTime(orderId, { deliveredAt: now })
    } catch { }
  }
  try {
    const ticketIdForUpdate = targetTicketId || id
    await query('UPDATE kds_tickets SET status = ?, updated_at = ?, pending_sync = 1 WHERE id = ?', [status, now, ticketIdForUpdate])
    if (status === 'done') {
      try {
        const res = await query('SELECT order_id FROM kds_tickets WHERE id = ?', [ticketIdForUpdate])
        const oid = res?.rows && res.rows[0]?.order_id
        if (oid) {
          await query('UPDATE orders SET status = ?, closed_at = ?, updated_at = ?, pending_sync = 1 WHERE id = ?', ['closed', now, now, oid])
        }
      } catch { }
    }
  } catch {
    try {
      const raw = localStorage.getItem('kdsTickets')
      const arr = raw ? JSON.parse(raw) : []
      const updated = arr.map((t: any) => (String(t.id) === (targetTicketId || id)) ? { ...t, status, updated_at: now } : t)
      localStorage.setItem('kdsTickets', JSON.stringify(updated))
    } catch { }
  }
  try {
    const events: any[] = [{ table: 'kdsTickets', row: { id: (targetTicketId || id), order_id: orderId, status, updated_at: now } }]
    if (orderId) {
      const mapToOrderStatus = (s: string) => s === 'done' ? 'DELIVERED' : s === 'ready' ? 'READY' : s === 'prep' ? 'PREPARING' : 'NEW'
      const ordRow: any = { id: orderId, status: mapToOrderStatus(String(status)), updatedAt: now }
      if (status === 'ready') ordRow.readyAt = now
      if (status === 'done') ordRow.deliveredAt = now
      events.push({ table: 'orders', row: ordRow })
    }
    await pushLanEvents(events)
  } catch { }
}

export async function listTicketsByStatus(status: 'queued' | 'prep' | 'ready' | 'done', kitchenId?: string | null) {
  let tickets: any[] = []

  if (supabase) {
    try {
      const map = { queued: 'NEW', prep: 'PREPARING', ready: 'READY', done: 'DELIVERED' } as Record<string, string>
      let query = supabase.from('kds_tickets').select('*').eq('status', map[status])
      if (kitchenId) query = query.eq('kitchen_id', kitchenId)
      const { data } = await query
      // Log removido para performance
      // try { console.log('[KDS] listTickets supabase', { status: map[status], kitchenId: kitchenId ?? null, count: (data || []).length }) } catch { }
      const sbTickets = data || []

      const enriched = [] as any[]
      for (const t of sbTickets) {
        const ordId = String(t.order_id)
        const times = await getPhaseTimes(ordId)
        let items: any[] = []
        try {
          const { data: oi } = await supabase
            .from('order_items')
            .select('*')
            .eq('order_id', ordId)
          items = (oi || []).map((it: any) => ({
            id: String(it.id),
            quantity: Number(it.quantity ?? it.qty ?? 1),
            skipKitchen: false,
            menuItem: { id: String(it.product_id ?? ''), name: String(it.product_name ?? 'Item'), unitDeliveryCount: 1, categoryId: String(it.category_id ?? '') },
            productionUnits: Array.from({ length: Math.max(1, Number(it.qty ?? 1)) }, (_, idx) => ({ unitId: `${String(it.id)}-${idx + 1}`, unitStatus: 'PENDING', operatorName: undefined, completedObservations: [], completedAt: undefined })),
          }))
        } catch { }
        enriched.push({ ...t, items, createdAt: times?.newStart || t.created_at, updatedAt: times?.preparingStart || t.updated_at, readyAt: times?.readyAt, deliveredAt: times?.deliveredAt })
      }
      tickets = [...tickets, ...enriched]
    } catch (e) {
      console.warn('[KDS] Falha ao ler do Supabase, tentando local:', e)
    }
  }

  // Fallback Local (se Supabase falhou ou retornou vazio - ou para complementar)
  // Sempre tenta ler localmente para pegar tickets criados offline
  try {
    // Tenta DB local (Electron)
    let localTickets: any[] = []
    try {
      const res = await query('SELECT * FROM kds_tickets WHERE status = ?', [status])
      if (Array.isArray(res?.rows)) localTickets = res.rows
    } catch { }

    // Tenta localStorage (Browser offline fallback)
    if (localTickets.length === 0) {
      try {
        const rawTk = localStorage.getItem('kdsTickets')
        const lsTickets = rawTk ? JSON.parse(rawTk) : []
        // Filtra por status (aceita tanto 'queued' quanto 'NEW' mapeado)
        localTickets = Array.isArray(lsTickets) ? lsTickets.filter((t: any) => String(t.status) === String(status) || (status === 'queued' && t.status === 'NEW')) : []

        // Filtra por cozinha se necessário
        if (kitchenId && localTickets.length > 0) {
          localTickets = localTickets.filter((t: any) => !t.kitchen_id || String(t.kitchen_id) === String(kitchenId))
        }
      } catch { }
    }

    if (localTickets.length > 0) {
      const enrichedLocal = [] as any[]
      for (const t of localTickets) {
        // Evita duplicatas se já veio do Supabase
        if (tickets.some(existing => String(existing.id) === String(t.id))) continue

        const ordId = String(t.order_id || t.orderId)
        const times = await getPhaseTimes(ordId)

        // Tenta buscar itens localmente (Electron ou localStorage)
        let items: any[] = []
        try {
          const resItems = await query('SELECT oi.*, p.name as product_name, p.category_id as category_id FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ?', [ordId])
          if (resItems?.rows) {
            items = resItems.rows.map((it: any) => ({
              id: String(it.id),
              quantity: Number(it.qty ?? 1),
              skipKitchen: false,
              menuItem: { id: String(it.product_id ?? ''), name: String(it.product_name ?? 'Item'), unitDeliveryCount: 1, categoryId: String(it.category_id ?? '') },
              productionUnits: Array.from({ length: Math.max(1, Number(it.qty ?? 1)) }, (_, idx) => ({ unitId: `${String(it.id)}-${idx + 1}`, unitStatus: 'PENDING', operatorName: undefined, completedObservations: [], completedAt: undefined })),
            }))
          } else {
            // Fallback itens localStorage
            const rawItems = localStorage.getItem('order_items')
            const allItems = rawItems ? JSON.parse(rawItems) : []
            const myItems = allItems.filter((it: any) => String(it.order_id) === ordId)
            items = myItems.map((it: any) => ({
              id: String(it.id),
              quantity: Number(it.qty ?? 1),
              skipKitchen: false,
              menuItem: { id: String(it.product_id ?? ''), name: String(it.product_name ?? 'Item'), unitDeliveryCount: 1, categoryId: String(it.category_id ?? '') },
              productionUnits: Array.from({ length: Math.max(1, Number(it.qty ?? 1)) }, (_, idx) => ({ unitId: `${String(it.id)}-${idx + 1}`, unitStatus: 'PENDING', operatorName: undefined, completedObservations: [], completedAt: undefined })),
            }))
          }
        } catch { }

        enrichedLocal.push({ ...t, items, createdAt: times?.newStart || t.createdAt || t.created_at, updatedAt: times?.preparingStart || t.updatedAt || t.updated_at, readyAt: times?.readyAt || t.ready_at, deliveredAt: times?.deliveredAt || t.delivered_at })
      }
      tickets = [...tickets, ...enrichedLocal]
    }
  } catch { }

  return tickets
}

function persistUnitState(key: string, patch: any) {
  try {
    const raw = localStorage.getItem('kdsUnitState')
    const state = raw ? JSON.parse(raw) : {}
    const current = state[key] || {}
    const next = { ...current, ...patch }
    state[key] = next
    localStorage.setItem('kdsUnitState', JSON.stringify(state))
  } catch { }
}

export async function setUnitOperator(orderId: string, itemId: string, unitId: string, operatorName: string) {
  await persistUnitStateDb(orderId, itemId, unitId, { operatorName })
  try { await pushLanEvents([{ table: 'kds_unit_operator', row: { orderId, itemId, unitId, operatorName } }]) } catch { }
}

export async function setUnitStatus(orderId: string, itemId: string, unitId: string, unitStatus: 'PENDING' | 'READY', completedObservations?: string[]) {
  const patch: any = { unitStatus }
  if (Array.isArray(completedObservations)) patch.completedObservations = completedObservations
  if (unitStatus === 'READY') patch.completedAt = new Date().toISOString()
  else patch.completedAt = undefined
  await persistUnitStateDb(orderId, itemId, unitId, patch)
  try { await pushLanEvents([{ table: 'kds_unit_status', row: { orderId, itemId, unitId, unitStatus, completedObservations } }]) } catch { }
}

export async function setUnitDelivered(orderId: string, itemId: string, unitId: string, deliveredAt?: string) {
  const patch: any = { deliveredAt: deliveredAt ?? new Date().toISOString() }
  await persistUnitStateDb(orderId, itemId, unitId, patch)
  try { await pushLanEvents([{ table: 'kds_unit_delivered', row: { orderId, itemId, unitId, deliveredAt: patch.deliveredAt } }]) } catch { }
}

export async function broadcastOperators(operators: any[]) {
  try {
    await pushLanEvents([{ table: 'kds_operators', row: { operators } }])
  } catch { }
}

export async function listTicketsByStation(station: string) {
  const res = await query('SELECT * FROM kds_tickets WHERE station = ?', [station])
  const tickets = Array.isArray(res?.rows) ? res.rows : []
  const enriched = [] as any[]
  for (const t of tickets) {
    const ordId = t.order_id ?? t.orderId
    const resItems = await query('SELECT oi.*, p.name as product_name, p.category_id as category_id FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ?', [ordId])
    const items = (resItems?.rows ?? []).map((it: any) => ({
      id: String(it.id),
      quantity: Number(it.qty ?? 1),
      skipKitchen: false,
      menuItem: {
        id: String(it.product_id ?? ''),
        name: String(it.product_name ?? 'Item'),
        unitDeliveryCount: 1,
        categoryId: String(it.category_id ?? ''),
      },
      productionUnits: Array.from({ length: Math.max(1, Number(it.qty ?? 1)) }, (_, idx) => ({
        unitId: `${String(it.id)}-${idx + 1}`,
        unitStatus: 'PENDING',
        operatorName: undefined,
        completedObservations: [],
        completedAt: undefined,
      })),
    }))
    enriched.push({ ...t, items })
  }
  return enriched
}

export async function listOperators() {
  try {
    const res = await query('SELECT * FROM kitchen_operators', [])
    const rows = res?.rows ?? []
    return Array.isArray(rows) ? rows : []
  } catch {
    try {
      const raw = localStorage.getItem('kitchenOperators')
      const arr = raw ? JSON.parse(raw) : []
      return Array.isArray(arr) ? arr : []
    } catch { return [] }
  }
}

export async function upsertOperator(params: { id?: string; name: string; role?: string | null }) {
  const id = params.id ?? uuid()
  const now = new Date().toISOString()
  const role = params.role ?? null
  try {
    await query(
      'INSERT INTO kitchen_operators (id, name, role, updated_at, version, pending_sync) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, role=excluded.role, updated_at=excluded.updated_at, version=excluded.version, pending_sync=excluded.pending_sync',
      [id, params.name, role, now, 1, 1],
    )
  } catch {
    try {
      const raw = localStorage.getItem('kitchenOperators')
      const arr = raw ? JSON.parse(raw) : []
      const next = [{ id, name: params.name, role, updated_at: now, version: 1, pending_sync: 1 }, ...arr.filter((o: any) => String(o.id) !== String(id))]
      localStorage.setItem('kitchenOperators', JSON.stringify(next))
    } catch { }
  }
  try { await pushLanEvents([{ table: 'kitchen_operators', row: { id, name: params.name, role, updated_at: now } }]) } catch { }
  return id
}

export async function deleteOperator(id: string) {
  try {
    await query('DELETE FROM kitchen_operators WHERE id = ?', [id])
  } catch {
    try {
      const raw = localStorage.getItem('kitchenOperators')
      const arr = raw ? JSON.parse(raw) : []
      const next = (Array.isArray(arr) ? arr : []).filter((o: any) => String(o.id) !== String(id))
      localStorage.setItem('kitchenOperators', JSON.stringify(next))
    } catch { }
  }
  try { await pushLanEvents([{ table: 'kitchen_operators_delete', row: { id } }]) } catch { }
}
import { getCurrentUnitId } from './deviceProfileService'
