import { supabase } from '../../utils/supabase'
import { supabaseSync } from '../../utils/supabaseSync'
import { uuid } from '../../utils/uuid'
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

// local uuid removed, now using shared utility

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

export async function acknowledgeTicket(ticketId: string, orderId?: string) {
  const now = new Date().toISOString()

  // Log receipt if not already logged
  try {
    if (supabase) {
      const { data: ticket } = await supabaseSync.select('kds_tickets', (q) =>
        q.select('created_at, acknowledged_at').eq('id', ticketId).maybeSingle(),
        { silent: true }
      )

      if (ticket && !ticket.acknowledged_at) {
        const createdAt = new Date(ticket.created_at).getTime()
        const nowMs = Date.now()
        const latencyMs = nowMs - createdAt

        await supabaseSync.update('kds_tickets',
          { acknowledged_at: now, updated_at: now },
          { id: ticketId }
        )

        await supabaseSync.insert('kds_sync_logs', {
          id: uuid(),
          ticket_id: ticketId,
          order_id: orderId || null,
          event_type: 'RECEIVED',
          latency_ms: latencyMs,
          created_at: now
        })
      }
    }
  } catch (err) {
    console.error('[KDS] Acknowledge error:', err)
  }

  // SQLite local update
  try {
    await query('UPDATE kds_tickets SET acknowledged_at = ?, updated_at = ? WHERE id = ?', [now, now, ticketId])
  } catch { }
}

export async function logSyncDelay(ticketId: string, orderId: string, latencyMs: number) {
  const now = new Date().toISOString()
  if (supabase) {
    try {
      await supabaseSync.insert('kds_sync_logs', {
        id: uuid(),
        ticket_id: ticketId,
        order_id: orderId,
        event_type: 'SYNC_DELAY',
        latency_ms: latencyMs,
        created_at: now
      }, { silent: true })
    } catch { }
  }
}

export async function listAllLocalTickets() {
  try {
    const api = (window as any)?.api?.db?.query
    if (typeof api === 'function') {
      const res = await query('SELECT * FROM kds_tickets')
      return res?.rows ?? []
    }
    const raw = localStorage.getItem('kdsTickets')
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export async function getPhaseTimes(orderId: string): Promise<any> {
  console.log('[KDS-DEBUG] getPhaseTimes called', { orderId })

  // Try Supabase first (Web Mode)
  try {
    if (supabase) {
      const { data, error } = await supabase
        .from('kds_phase_times')
        .select('*')
        .eq('order_id', orderId)
        .maybeSingle()

      if (error) {
        console.warn('[KDS-DEBUG] getPhaseTimes Supabase error (will fallback):', error.message)
      } else if (data) {
        console.log('[KDS-DEBUG] getPhaseTimes found in Supabase:', data)
        const row: any = data || {}
        return {
          ...row,
          orderId: row.orderId ?? row.order_id ?? orderId,
          newStart: row.newStart ?? row.new_start ?? null,
          preparingStart: row.preparingStart ?? row.preparing_start ?? null,
          readyAt: row.readyAt ?? row.ready_at ?? null,
          deliveredAt: row.deliveredAt ?? row.delivered_at ?? null,
          updatedAt: row.updatedAt ?? row.updated_at ?? null,
        }
      }
    }
  } catch (err) {
    console.warn('[KDS-DEBUG] getPhaseTimes exception:', err)
  }

  // Fallback to localStorage
  try {
    const raw = localStorage.getItem('kdsPhaseTimes')
    const obj = raw ? JSON.parse(raw) : {}
    const result = obj[String(orderId)] || {}
    console.log('[KDS-DEBUG] getPhaseTimes from localStorage:', result)
    return result
  } catch { return {} }
}

export async function setPhaseTime(orderId: string, patch: any) {
  const now = new Date().toISOString()
  console.log('[KDS-DEBUG] setPhaseTime called', { orderId, patch, now })

  // 1. Try SQLite (Local DB)
  try {
    await query(
      'INSERT INTO kds_phase_times (order_id, new_start, preparing_start, ready_at, delivered_at, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(order_id) DO UPDATE SET new_start=COALESCE(new_start, excluded.new_start), preparing_start=COALESCE(preparing_start, excluded.preparing_start), ready_at=COALESCE(ready_at, excluded.ready_at), delivered_at=COALESCE(delivered_at, excluded.delivered_at), updated_at=excluded.updated_at',
      [
        orderId,
        patch?.newStart ?? null,
        patch?.preparingStart ?? null,
        patch?.readyAt ?? null,
        patch?.deliveredAt ?? null,
        now,
      ],
    )
    console.log('[KDS-DEBUG] setPhaseTime SQLite success')
  } catch (err) {
    console.warn('[KDS-DEBUG] setPhaseTime SQLite error (expected in web mode):', err)
  }

  // 2. Try Supabase (Web Mode)
  if (supabase) {
    try {
      // Check if record exists first
      const { data: existing, error: selectErr } = await supabase
        .from('kds_phase_times')
        .select('id, new_start, preparing_start, ready_at, delivered_at')
        .eq('order_id', orderId)
        .maybeSingle()

      if (selectErr) {
        console.warn('[KDS-DEBUG] setPhaseTime select error:', selectErr.message)
      }

      const payload: any = {
        order_id: orderId,
        updated_at: now
      }

      const ex: any = existing || {}
      if (patch?.newStart && !ex.new_start) payload.new_start = patch.newStart
      if (patch?.preparingStart && !ex.preparing_start) payload.preparing_start = patch.preparingStart
      if (patch?.readyAt && !ex.ready_at) payload.ready_at = patch.readyAt
      if (patch?.deliveredAt && !ex.delivered_at) payload.delivered_at = patch.deliveredAt

      console.log('[KDS-DEBUG] setPhaseTime Supabase payload:', payload, 'existing:', existing)

      if (existing?.id) {
        const { error: updateErr } = await supabase.from('kds_phase_times').update(payload).eq('id', existing.id)
        if (updateErr) {
          console.error('[KDS-DEBUG] setPhaseTime update error:', updateErr)
        } else {
          console.log('[KDS-DEBUG] setPhaseTime Supabase UPDATE success')
        }
      } else {
        const { error: insertErr } = await supabase.from('kds_phase_times').insert(payload)
        if (insertErr) {
          console.error('[KDS-DEBUG] setPhaseTime insert error:', insertErr)
        } else {
          console.log('[KDS-DEBUG] setPhaseTime Supabase INSERT success')
        }
      }
    } catch (err) {
      console.error('[KDS-DEBUG] setPhaseTime Supabase exception:', err)
    }
  }

  // 3. Fallback to LocalStorage (always save for offline support)
  try {
    const raw = localStorage.getItem('kdsPhaseTimes')
    const obj = raw ? JSON.parse(raw) : {}
    const cur = obj[String(orderId)] || {}
    const next: any = { ...cur }
    if (patch?.newStart && !cur.newStart) next.newStart = patch.newStart
    if (patch?.preparingStart && !cur.preparingStart) next.preparingStart = patch.preparingStart
    if (patch?.readyAt && !cur.readyAt) next.readyAt = patch.readyAt
    if (patch?.deliveredAt && !cur.deliveredAt) next.deliveredAt = patch.deliveredAt
    obj[String(orderId)] = next
    localStorage.setItem('kdsPhaseTimes', JSON.stringify(obj))
    console.log('[KDS-DEBUG] setPhaseTime localStorage saved:', next)
  } catch { }

  // 4. LAN Sync
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
      'INSERT INTO kds_unit_states (id, order_id, order_item_id, production_unit_id, operator_name, unit_status, completed_observations_json, completed_at, delivered_at, updated_at, version, pending_sync) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET operator_name=COALESCE(excluded.operator_name, operator_name), unit_status=COALESCE(excluded.unit_status, unit_status), completed_observations_json=COALESCE(excluded.completed_observations_json, completed_observations_json), completed_at=COALESCE(excluded.completed_at, completed_at), delivered_at=COALESCE(excluded.delivered_at, delivered_at), updated_at=excluded.updated_at, pending_sync=excluded.pending_sync',
      [id, orderId, itemId, unitId, operatorName, unitStatus, completedObservationsJson, completedAt, deliveredAt, now, 1, 1],
    )
  } catch (err) {
    // console.warn('[KDS] SQLite error:', err)
  }

  // Web Mode (Supabase)
  if (supabase) {
    try {
      // Try to find ticket_id, but don't block if missing (we have order_id now)
      const { data: ticket } = await supabase
        .from('kds_tickets')
        .select('id')
        .eq('order_id', orderId)
        .maybeSingle()

      const ticketId = ticket?.id ?? null

      // Look for existing record using production_unit_id if available, or order_item_id fallback
      // NOTE: Using type assertion or raw query to bypass stale Typescript definitions if needed
      let query = supabase.from('kds_unit_states').select('id')

      // Use the specific production unit ID for precision
      if (unitId) {
        // [FIX] Ensure we handle the "column does not exist" error gracefully by falling back if needed, 
        // but for now we assume migration is applied.
        query = query.eq('production_unit_id', unitId).eq('order_item_id', itemId)
      } else {
        query = query.eq('order_item_id', itemId)
        if (ticketId) query = query.eq('ticket_id', ticketId)
      }

      const { data: existingList, error: fetchError } = await query.limit(1)

      if (fetchError) {
        console.error('[KDS] unit fetch error:', fetchError)
      }

      const existing = existingList?.[0]

      // Fetch operator_id if possible, but we will save operator_name regardless
      let operatorId = null
      if (operatorName) {
        const { data: op } = await supabase
          .from('kitchen_operators')
          .select('id')
          .eq('name', operatorName)
          .maybeSingle()
        operatorId = op?.id
      }

      const payload: any = {
        order_item_id: itemId,
        status: unitStatus || 'PENDING',
        updated_at: now,
        version: 1,
        pending_sync: false,
        // New fields
        operator_name: operatorName,
        production_unit_id: unitId,
        order_id: orderId
      }

      if (ticketId) payload.ticket_id = ticketId
      if (operatorId) payload.operator_id = operatorId
      if (completedAt) payload.completed_at = completedAt

      if (existing?.id) {
        await supabase.from('kds_unit_states').update(payload).eq('id', existing.id)
      } else {
        await supabase.from('kds_unit_states').insert(payload)
      }
    } catch (err) {
      console.error('[KDS] Error persisting unit state to Supabase:', err)
    }
  }

  // LocalStorage Fallback
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

export async function loadUnitStatesForOrder(orderId: string): Promise<Record<string, any>> {
  const map: Record<string, any> = {}
  try {
    const res = await query('SELECT * FROM kds_unit_states WHERE order_id = ?', [orderId])
    for (const r of (res?.rows ?? [])) {
      // Use both new and old column names for compatibility during transition
      const itemId = r.order_item_id ?? r.orderItemId ?? r.item_id ?? r.itemId
      const unitId = r.production_unit_id ?? r.productionUnitId ?? r.unit_id ?? r.unitId
      const key = `${String(r.order_id ?? r.orderId)}:${String(itemId)}:${String(unitId)}`
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
      const { data } = await supabaseSync.select('kds_unit_states', (q) =>
        q.select('*').eq('order_id', orderId),
        { silent: true }
      )
      const out: Record<string, any> = {}
      for (const r of (data || [])) {
        // [FIX] Use new columns for correct key mapping
        const unitId = r.production_unit_id || r.unit_id
        const key = `${String(r.order_id)}:${String(r.order_item_id || r.item_id)}:${String(unitId)}`
        out[key] = {
          operatorName: r.operator_name ?? undefined,
          unitStatus: r.status || r.unit_status || undefined,
          completedObservations: (() => { try { const arr = JSON.parse(String(r.completed_observations_json ?? 'null')); return Array.isArray(arr) ? arr : [] } catch { return [] } })(),
          completedAt: r.completed_at || undefined,  // Removed updated_at fallback - was causing "Concluído às" on PENDING units
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
      const rawStatus = String(row.status ?? 'new')
      const normalizedStatus = (() => {
        const up = rawStatus.toUpperCase()
        if (up === 'NEW') return 'new'
        if (up === 'PREPARING') return 'prep'
        if (up === 'READY') return 'ready'
        if (up === 'DELIVERED') return 'done'
        const low = rawStatus.toLowerCase()
        if (low === 'new' || low === 'prep' || low === 'ready' || low === 'done') return low
        return 'new'
      })()
      const station = row.station ?? null
      const updatedAt = row.updated_at ?? row.updatedAt ?? now
      try {
        await query(
          'INSERT INTO kds_tickets (id, order_id, unit_id, status, station, updated_at, version, pending_sync) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET order_id=excluded.order_id, unit_id=excluded.unit_id, status=excluded.status, station=excluded.station, updated_at=excluded.updated_at, pending_sync=excluded.pending_sync',
          [id, orderId, unitId, normalizedStatus, station, updatedAt, 1, 0],
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
        // Se for fechamento, atualizar status e completed_at (mapping closed_at to completed_at).
        if (dbStatus === 'closed' || dbStatus === 'cancelled') {
          await query(
            'INSERT INTO orders (id, status, total_cents, opened_at, completed_at, device_id, unit_id, notes, updated_at, version, pending_sync) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET status=excluded.status, completed_at=excluded.completed_at, updated_at=excluded.updated_at, pending_sync=excluded.pending_sync',
            [id, dbStatus, total, openedAt, dbClosedAt, deviceId, unitId, notes, updatedAt, 1, 0],
          )
        } else {
          // Para status intermediários, apenas inserir se não existir (não atualizar opened_at nem status)
          await query(
            'INSERT INTO orders (id, status, total_cents, opened_at, completed_at, device_id, unit_id, notes, updated_at, version, pending_sync) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET total_cents=COALESCE(excluded.total_cents, total_cents), notes=COALESCE(excluded.notes, notes), updated_at=excluded.updated_at, pending_sync=excluded.pending_sync',
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
      .insert({ id, order_id: params.orderId, kitchen_id: null, operator_id: null, status: 'NEW', updated_at: now, version: 1, pending_sync: false })
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
  console.log('[KDS-DEBUG] setTicketStatus called', { id, status, now })

  // 1. Supabase (Web Mode)
  if ((await import('../../utils/supabase')).supabase) {
    try {
      const { supabase } = await import('../../utils/supabase')
      const map = { queued: 'NEW', prep: 'PREPARING', ready: 'READY', done: 'DELIVERED' } as Record<string, string>
      const dbStatus = map[status]

      // Fetch order_id for this ticket
      const { data: tk } = await supabase.from('kds_tickets').select('order_id').eq('id', id).maybeSingle()
      const orderId = tk?.order_id ? String(tk.order_id) : undefined

      // Update kds_tickets
      await supabase.from('kds_tickets').update({ status: dbStatus, updated_at: now, acknowledged_at: now }).eq('id', id)

      // Update orders
      if (orderId) {
        const orderUpdate: any = { status: dbStatus, updated_at: now }
        if (status === 'done') orderUpdate.completed_at = now
        await supabase.from('orders').update(orderUpdate).eq('id', orderId)

        // Update phase times
        const phasePatch: any = {}
        if (status === 'queued') phasePatch.newStart = now
        if (status === 'prep') phasePatch.preparingStart = now
        if (status === 'ready') phasePatch.readyAt = now
        if (status === 'done') phasePatch.deliveredAt = now
        await setPhaseTime(orderId, phasePatch)
      }
    } catch (err) {
      console.error('[KDS-DEBUG] Supabase update error:', err)
    }
  }

  // 2. Local/Offline (SQLite + LocalStorage)
  let orderId: string | undefined
  let targetTicketId: string | undefined

  try {
    const r = await query('SELECT order_id FROM kds_tickets WHERE id = ?', [id])
    if (r?.rows && r.rows[0]) {
      orderId = String(r.rows[0].order_id)
      targetTicketId = String(id)
    }
  } catch { }

  if (!orderId) {
    try {
      const raw = localStorage.getItem('kdsTickets')
      const arr = raw ? JSON.parse(raw) : []
      const tk = (Array.isArray(arr) ? arr : []).find((t: any) => String(t.id) === String(id) || String(t.orderId) === String(id) || String(t.order_id) === String(id))
      orderId = tk?.order_id || tk?.orderId
      targetTicketId = tk?.id ? String(tk.id) : undefined
    } catch { }
  }

  // Fallback to treat id as orderId
  if (!orderId) {
    try {
      const r2 = await query('SELECT id FROM kds_tickets WHERE order_id = ? ORDER BY datetime(updated_at) DESC LIMIT 1', [id])
      if (r2?.rows && r2.rows[0]) {
        targetTicketId = String(r2.rows[0].id)
        orderId = String(id)
      }
    } catch { }
  }

  // Final fallbacks
  orderId = orderId || String(id)
  targetTicketId = targetTicketId || String(id)

  const map = { queued: 'NEW', prep: 'PREPARING', ready: 'READY', done: 'DELIVERED' } as Record<string, string>
  const dbStatus = map[status]

  try {
    // Update local DB
    await query('UPDATE kds_tickets SET status = ?, updated_at = ?, acknowledged_at = ?, pending_sync = 1 WHERE id = ?', [status, now, now, targetTicketId])
    await query('UPDATE orders SET status = ?, updated_at = ?, pending_sync = 1 WHERE id = ?', [dbStatus, now, orderId])

    // Update phase times (localStorage + LAN)
    const phasePatch: any = {}
    if (status === 'queued') phasePatch.newStart = now
    if (status === 'prep') phasePatch.preparingStart = now
    if (status === 'ready') phasePatch.readyAt = now
    if (status === 'done') phasePatch.deliveredAt = now
    await setPhaseTime(orderId, phasePatch)

    // LAN Sync
    await pushLanEvents([
      { table: 'kdsTickets', row: { id: targetTicketId, status, updated_at: now, acknowledged_at: now } },
      { table: 'orders', row: { id: orderId, status: dbStatus, updated_at: now } }
    ])
  } catch (err) {
    console.error('[KDS-DEBUG] Local update error:', err)
  }
}

export async function listTicketStatusRows(kitchenId?: string | null) {
  const supabaseToLocal = (s: any): 'queued' | 'prep' | 'ready' | 'done' | null => {
    const up = String(s ?? '').toUpperCase()
    if (up === 'NEW') return 'queued'
    if (up === 'PREPARING' || up === 'PREP') return 'prep'
    if (up === 'READY') return 'ready'
    if (up === 'DELIVERED' || up === 'DONE') return 'done'
    return null
  }

  if (supabase) {
    try {
      let q = supabase
        .from('kds_tickets')
        .select('id, order_id, status, updated_at, kitchen_id')
        .in('status', ['NEW', 'PREPARING', 'READY', 'DELIVERED'])
      if (kitchenId) q = q.eq('kitchen_id', kitchenId)
      const { data } = await q
      const out = [] as Array<{ ticketId: string; orderId: string; status: 'queued' | 'prep' | 'ready' | 'done'; updatedAt?: string; kitchenId?: string | null }>
      for (const r of (Array.isArray(data) ? data : []) as any[]) {
        const orderId = r?.order_id ? String(r.order_id) : ''
        const status = supabaseToLocal(r?.status)
        if (!orderId || !status) continue
        out.push({
          ticketId: String(r?.id ?? ''),
          orderId,
          status,
          updatedAt: r?.updated_at ? String(r.updated_at) : undefined,
          kitchenId: r?.kitchen_id != null ? String(r.kitchen_id) : null,
        })
      }
      return out
    } catch { }
  }

  try {
    const res = await query(
      'SELECT id, order_id, status, updated_at FROM kds_tickets WHERE status IN (?, ?, ?, ?)',
      ['queued', 'prep', 'ready', 'done'],
    )
    const out = [] as Array<{ ticketId: string; orderId: string; status: 'queued' | 'prep' | 'ready' | 'done'; updatedAt?: string }>
    for (const r of (res?.rows ?? []) as any[]) {
      const orderId = r?.order_id ? String(r.order_id) : ''
      const status = supabaseToLocal(r?.status) as any
      if (!orderId || !status) continue
      out.push({
        ticketId: String(r?.id ?? ''),
        orderId,
        status,
        updatedAt: r?.updated_at ? String(r.updated_at) : undefined,
      })
    }
    return out
  } catch {
    try {
      const raw = localStorage.getItem('kdsTickets')
      const arr = raw ? JSON.parse(raw) : []
      const out = [] as Array<{ ticketId: string; orderId: string; status: 'queued' | 'prep' | 'ready' | 'done'; updatedAt?: string }>
      for (const r of (Array.isArray(arr) ? arr : []) as any[]) {
        const orderId = String(r?.order_id ?? r?.orderId ?? '')
        const status = supabaseToLocal(r?.status) as any
        if (!orderId || !status) continue
        out.push({
          ticketId: String(r?.id ?? ''),
          orderId,
          status,
          updatedAt: r?.updated_at ? String(r.updated_at) : undefined,
        })
      }
      return out
    } catch {
      return []
    }
  }
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
      try {
        const nowIso = new Date().toISOString()
        const toAck = sbTickets
          .filter((t: any) => t && t.id && t.status === 'NEW' && t.created_at && t.updated_at && String(t.created_at) === String(t.updated_at))
          .map((t: any) => String(t.id))
        if (toAck.length > 0) {
          await supabase.from('kds_tickets').update({ updated_at: nowIso }).in('id', toAck)
          try { console.log('[KDS] Confirmação de recebimento enviada', { count: toAck.length, kitchenId: kitchenId ?? null }) } catch { }
        }
      } catch { }

      const chunk = <T,>(arr: T[], size: number) => {
        const out: T[][] = []
        for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
        return out
      }

      const orderIds = (Array.isArray(sbTickets) ? sbTickets : [])
        .map((t: any) => String(t?.order_id ?? ''))
        .filter((v: string) => v)

      const phaseTimesMap: Record<string, any> = {}
      try {
        for (const part of chunk(orderIds, 200)) {
          const { data: rows } = await supabase
            .from('kds_phase_times')
            .select('order_id, new_start, preparing_start, ready_at, delivered_at, updated_at')
            .in('order_id', part)
          for (const r of (Array.isArray(rows) ? rows : []) as any[]) {
            const oid = String(r?.order_id ?? '')
            if (!oid) continue
            phaseTimesMap[oid] = {
              orderId: oid,
              newStart: r?.new_start ?? null,
              preparingStart: r?.preparing_start ?? null,
              readyAt: r?.ready_at ?? null,
              deliveredAt: r?.delivered_at ?? null,
              updatedAt: r?.updated_at ?? null,
            }
          }
        }
      } catch { }

      const itemsByOrderId: Record<string, any[]> = {}
      try {
        for (const part of chunk(orderIds, 200)) {
          const { data: rows } = await supabase
            .from('order_items')
            .select('*')
            .in('order_id', part)
          for (const r of (Array.isArray(rows) ? rows : []) as any[]) {
            const oid = String(r?.order_id ?? '')
            if (!oid) continue
            if (!itemsByOrderId[oid]) itemsByOrderId[oid] = []
            itemsByOrderId[oid].push(r)
          }
        }
      } catch { }

      const enriched = [] as any[]
      for (const t of sbTickets) {
        const ordId = String(t.order_id)
        const times = phaseTimesMap[ordId] || {}
        const rows = itemsByOrderId[ordId] || []
        const items = rows.map((it: any) => {
          const quantity = Math.max(1, Number(it.quantity ?? it.qty ?? 1))
          const id = String(it.id)
          return {
            id,
            quantity,
            skipKitchen: false,
            menuItem: { id: String(it.product_id ?? ''), name: String(it.product_name ?? 'Item'), unitDeliveryCount: 1, categoryId: String(it.category_id ?? '') },
            productionUnits: Array.from({ length: quantity }, (_, idx) => ({ unitId: `${id}-${idx + 1}`, unitStatus: 'PENDING', operatorName: undefined, completedObservations: [], completedAt: undefined })),
          }
        })
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
      // === CORREÇÃO DE REVERSÃO ===
      // Verifica os tickets do Supabase contra o estado local real.
      // Se já veio do Supabase mas o local diz que tem outro status mais recente, devemos confiar no local.
      // Isso significa que se `tickets` tem um ID que localmente mudou de status, esse ID deve sair da lista de retornos deste status.
      if (tickets.length > 0) {
        const ids = tickets.map(t => t.id).map(id => `'${id}'`).join(',')
        try {
          // Busca estado atual local desses tickets
          const localStates = await query(`SELECT id, status, pending_sync, updated_at FROM kds_tickets WHERE id IN (${ids})`)
          const localMap = (localStates?.rows ?? []).reduce((acc: any, row: any) => ({ ...acc, [row.id]: row }), {})

          // Filtra tickets
          tickets = tickets.filter(t => {
            const loc = localMap[t.id]
            if (!loc) return true // Sem estado local, confia no remoto

            // Se local tem status diferente E (pendente ou mais novo), o remoto está obsoleto
            // O filtro da função é `status` (parametro). ex: 'queued'
            // Se `loc.status` (ex: 'prep') != `status` ('queued'), então ele NÃO deveria estar aqui nesta lista de 'queued'.
            if (loc.status !== status && (loc.pending_sync || new Date(loc.updated_at).getTime() >= new Date(t.updatedAt || t.updated_at).getTime())) {
              return false // Remove da lista pois não pertence a este status
            }
            return true
          })
        } catch (e) { console.error('Error verifying local states', e) }
      }

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
  // Web Mode (Supabase)
  if (supabase) {
    try {
      const { data } = await supabase.from('kitchen_operators').select('*')
      if (data) return data
    } catch (e) {
      console.warn('[KDS] Failed to fetch operators from Supabase:', e)
    }
  }

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
    // Web Mode (Supabase)
    if (supabase) {
      try {
        await supabase.from('kitchen_operators').upsert({
          id,
          name: params.name,
          role: role,
          updated_at: now,
          version: 1,
          pending_sync: false
        }, { onConflict: 'id' })
      } catch (err) {
        console.error('[KDS] Error persisting operator to Supabase:', err)
      }
    }

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
    // Web Mode (Supabase)
    if (supabase) {
      try {
        await supabase.from('kitchen_operators').delete().eq('id', id)
      } catch (err) {
        console.error('[KDS] Error deleting operator from Supabase:', err)
      }
    }

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
