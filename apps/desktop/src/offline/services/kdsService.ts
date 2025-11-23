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

async function pushLanEvents(events: any[]) {
  try {
    const unitDefault = 'default'
    const enriched = (Array.isArray(events) ? events : []).map((e:any)=> ({ ...e, unit_id: e?.unit_id ?? unitDefault }))
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (lanSecret) headers['Authorization'] = `Bearer ${lanSecret}`
    await fetch(`${lanHubUrl.replace(/\/$/, '')}/push`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ events: enriched }),
    })
  } catch {}
}

function getPhaseTimes(orderId: string): any {
  try {
    const raw = localStorage.getItem('kdsPhaseTimes')
    const obj = raw ? JSON.parse(raw) : {}
    return obj[String(orderId)] || {}
  } catch { return {} }
}

async function setPhaseTime(orderId: string, patch: any) {
  try {
    const raw = localStorage.getItem('kdsPhaseTimes')
    const obj = raw ? JSON.parse(raw) : {}
    const cur = obj[String(orderId)] || {}
    const next = { ...cur, ...patch }
    obj[String(orderId)] = next
    localStorage.setItem('kdsPhaseTimes', JSON.stringify(obj))
  } catch {}
  try { await pushLanEvents([{ table: 'kds_phase_times', row: { orderId, ...patch } }]) } catch {}
}

export async function enqueueTicket(params: { orderId: UUID; station?: string | null }) {
  const id = uuid()
  const now = new Date().toISOString()
  const unitId = await getCurrentUnitId()
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
    } catch {}
  }
  try { await pushLanEvents([{ table: 'kdsTickets', row: { id, order_id: params.orderId, unit_id: unitId ?? null, status: 'queued', station: params.station ?? null, updated_at: now } }]) } catch {}
  try { await setPhaseTime(params.orderId, { newStart: now }) } catch {}
  return id
}

export async function setTicketStatus(id: UUID, status: 'queued' | 'prep' | 'ready' | 'done') {
  const now = new Date().toISOString()
  let orderId: string | undefined
  try {
    const r = await query('SELECT order_id FROM kds_tickets WHERE id = ?', [id])
    orderId = r?.rows && r.rows[0]?.order_id ? String(r.rows[0].order_id) : undefined
  } catch {}
  if (!orderId) {
    try {
      const raw = localStorage.getItem('kdsTickets')
      const arr = raw ? JSON.parse(raw) : []
      const tk = (Array.isArray(arr) ? arr : []).find((t:any)=> String(t.id)===String(id))
      orderId = tk?.order_id || tk?.orderId
    } catch {}
  }
  if (orderId) {
    try {
      if (status === 'queued') await setPhaseTime(orderId, { newStart: now })
      if (status === 'prep') await setPhaseTime(orderId, { preparingStart: now })
      if (status === 'ready') await setPhaseTime(orderId, { readyAt: now })
      if (status === 'done') await setPhaseTime(orderId, { deliveredAt: now })
    } catch {}
  }
  try {
    await query('UPDATE kds_tickets SET status = ?, updated_at = ?, pending_sync = 1 WHERE id = ?', [status, now, id])
    if (status === 'done') {
      try {
        const res = await query('SELECT order_id FROM kds_tickets WHERE id = ?', [id])
        const orderId = res?.rows && res.rows[0]?.order_id
        if (orderId) {
          await query('UPDATE orders SET status = ?, closed_at = ?, updated_at = ?, pending_sync = 1 WHERE id = ?', ['closed', now, now, orderId])
        }
      } catch {}
    }
  } catch {
    try {
      const raw = localStorage.getItem('kdsTickets')
      const arr = raw ? JSON.parse(raw) : []
      const updated = arr.map((t:any)=> t.id===id ? { ...t, status, updated_at: now } : t)
      localStorage.setItem('kdsTickets', JSON.stringify(updated))

      const mapToOrderStatus = (s:string)=> s==='done'?'closed': s==='ready'?'READY': s==='prep'?'PREPARING': 'NEW'
      try {
        const rawOrders = localStorage.getItem('orders')
        const orders = rawOrders ? JSON.parse(rawOrders) : []
        const tk = (Array.isArray(arr)?arr:[]).find((t:any)=> String(t.id)===String(id))
        const orderId = tk?.order_id || tk?.orderId
        const updOrders = (Array.isArray(orders)?orders:[]).map((o:any)=> {
          if (String(o.id)===String(orderId)) {
            const nextStatus = mapToOrderStatus(String(status))
            const out:any = { ...o, status: nextStatus }
            if (nextStatus==='PREPARING' && !o.updated_at) out.updated_at = now
            if (nextStatus==='READY') out.readyAt = now
            if (nextStatus!=='READY') out.readyAt = undefined
            if (nextStatus==='closed') { out.closed_at = now; out.updated_at = now }
            return out
          }
          return o
        })
        localStorage.setItem('orders', JSON.stringify(updOrders))
      } catch {}
    } catch {}
  }
  try { await pushLanEvents([{ table: 'kdsTickets', row: { id, status, updated_at: now } }]) } catch {}
}

export async function listTicketsByStatus(status: 'queued' | 'prep' | 'ready' | 'done') {
  try {
    const res = await query('SELECT * FROM kds_tickets WHERE status = ?', [status])
    const tickets = Array.isArray(res?.rows) ? res.rows : []
    const enriched = [] as any[]
    for (const t of tickets) {
      const ordId = t.order_id ?? t.orderId
      const times = getPhaseTimes(String(ordId))
      const resItems = await query('SELECT oi.*, p.name as product_name, p.category_id as category_id FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ?', [ordId])
      const items = (resItems?.rows ?? []).map((it:any) => ({
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
          unitId: `${String(it.id)}-${idx+1}`,
          unitStatus: 'PENDING',
          operatorName: undefined,
          completedObservations: [],
          completedAt: undefined,
        })),
      }))
      try {
        const rawState = localStorage.getItem('kdsUnitState')
        const state = rawState ? JSON.parse(rawState) : {}
        const mergeUnit = (orderId:string, itemId:string, unit:any) => {
          const key = `${orderId}:${itemId}:${unit.unitId}`
          const s = state[key] || null
          if (!s) return unit
          const out = { ...unit }
          if (s.operatorName) out.operatorName = s.operatorName
          if (s.unitStatus) out.unitStatus = s.unitStatus
          if (Array.isArray(s.completedObservations)) out.completedObservations = s.completedObservations
          if (s.unitStatus === 'READY') out.completedAt = out.completedAt || new Date().toISOString()
          return out
        }
        const mergedItems = items.map((it:any)=> ({
          ...it,
          productionUnits: it.productionUnits.map((u:any)=> mergeUnit(String(ordId), String(it.id), u))
        }))
        enriched.push({ ...t, items: mergedItems, createdAt: times?.newStart || t.createdAt, updatedAt: times?.preparingStart || t.updatedAt, readyAt: times?.readyAt || t.readyAt, deliveredAt: times?.deliveredAt || t.deliveredAt })
      } catch {
        enriched.push({ ...t, items, createdAt: times?.newStart || t.createdAt, updatedAt: times?.preparingStart || t.updatedAt, readyAt: times?.readyAt || t.readyAt, deliveredAt: times?.deliveredAt || t.deliveredAt })
      }
    }
    return enriched
  } catch {
    try {
      const rawTk = localStorage.getItem('kdsTickets')
      const tickets = rawTk ? JSON.parse(rawTk) : []
      const filtered = Array.isArray(tickets) ? tickets.filter((t:any)=> String(t.status)===String(status)) : []
      if (filtered.length) {
        const res = [] as any[]
        for (const t of filtered) {
          const ordRaw = localStorage.getItem('orders')
          const orders = ordRaw ? JSON.parse(ordRaw) : []
          const ord = Array.isArray(orders) ? orders.find((o:any)=> String(o.id)===String(t.order_id || t.orderId)) : null
          const times = getPhaseTimes(String(t.order_id || t.orderId))
          let items = Array.isArray(ord?.items) ? ord.items.filter((it:any)=> !(it.skipKitchen || it.menuItem?.skipKitchen)) : []
          try {
            const rawState = localStorage.getItem('kdsUnitState')
            const state = rawState ? JSON.parse(rawState) : {}
            const mergeUnit = (orderId:string, itemId:string, unit:any) => {
              const key = `${orderId}:${itemId}:${unit.unitId}`
              const s = state[key] || null
              if (!s) return unit
              const out = { ...unit }
              if (s.operatorName) out.operatorName = s.operatorName
              if (s.unitStatus) out.unitStatus = s.unitStatus
              if (Array.isArray(s.completedObservations)) out.completedObservations = s.completedObservations
              if (s.unitStatus === 'READY') out.completedAt = out.completedAt || new Date().toISOString()
              return out
            }
            items = items.map((it:any)=> ({
              ...it,
              productionUnits: (Array.isArray(it.productionUnits)? it.productionUnits : []).map((u:any)=> mergeUnit(String(t.order_id || t.orderId), String(it.id), u))
            }))
          } catch {}
          res.push({ ...t, items, createdAt: times?.newStart || t.createdAt, updatedAt: times?.preparingStart || t.updatedAt, readyAt: times?.readyAt || t.readyAt, deliveredAt: times?.deliveredAt || t.deliveredAt })
        }
        return res
      }
      const ordRaw = localStorage.getItem('orders')
      const orders = ordRaw ? JSON.parse(ordRaw) : []
      const mapStatus = (s:string)=> s==='READY'?'ready': s==='PREPARING'?'prep': 'queued'
      const res = (Array.isArray(orders)?orders:[])
        .filter((o:any)=> mapStatus(String(o.status||'NEW'))===status)
        .map((o:any)=> ({ id: String(o.id), order_id: String(o.id), status: mapStatus(String(o.status||'NEW')), items: (Array.isArray(o.items)? o.items.filter((it:any)=> !(it.skipKitchen || it.menuItem?.skipKitchen)) : []), createdAt: getPhaseTimes(String(o.id))?.newStart || o.opened_at || o.createdAt, updatedAt: getPhaseTimes(String(o.id))?.preparingStart || o.updatedAt, readyAt: getPhaseTimes(String(o.id))?.readyAt || o.readyAt, deliveredAt: getPhaseTimes(String(o.id))?.deliveredAt || o.closed_at || o.deliveredAt }))
      return res
    } catch { return [] }
  }
}

function persistUnitState(key: string, patch: any) {
  try {
    const raw = localStorage.getItem('kdsUnitState')
    const state = raw ? JSON.parse(raw) : {}
    const current = state[key] || {}
    const next = { ...current, ...patch }
    state[key] = next
    localStorage.setItem('kdsUnitState', JSON.stringify(state))
  } catch {}
}

export async function setUnitOperator(orderId: string, itemId: string, unitId: string, operatorName: string) {
  const key = `${orderId}:${itemId}:${unitId}`
  persistUnitState(key, { operatorName })
  try { await pushLanEvents([{ table: 'kds_unit_operator', row: { orderId, itemId, unitId, operatorName } }]) } catch {}
}

export async function setUnitStatus(orderId: string, itemId: string, unitId: string, unitStatus: 'PENDING' | 'READY', completedObservations?: string[]) {
  const key = `${orderId}:${itemId}:${unitId}`
  const patch: any = { unitStatus }
  if (Array.isArray(completedObservations)) patch.completedObservations = completedObservations
  if (unitStatus === 'READY') patch.completedAt = new Date().toISOString()
  else patch.completedAt = undefined
  persistUnitState(key, patch)
  try { await pushLanEvents([{ table: 'kds_unit_status', row: { orderId, itemId, unitId, unitStatus, completedObservations } }]) } catch {}
}

export async function broadcastOperators(operators: any[]) {
  try {
    await pushLanEvents([{ table: 'kds_operators', row: { operators } }])
  } catch {}
}

export async function listTicketsByStation(station: string) {
  const res = await query('SELECT * FROM kds_tickets WHERE station = ?', [station])
  const tickets = Array.isArray(res?.rows) ? res.rows : []
  const enriched = [] as any[]
  for (const t of tickets) {
    const ordId = t.order_id ?? t.orderId
    const resItems = await query('SELECT oi.*, p.name as product_name, p.category_id as category_id FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ?', [ordId])
    const items = (resItems?.rows ?? []).map((it:any) => ({
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
        unitId: `${String(it.id)}-${idx+1}`,
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
      const next = [{ id, name: params.name, role, updated_at: now, version: 1, pending_sync: 1 }, ...arr.filter((o:any)=> String(o.id)!==String(id))]
      localStorage.setItem('kitchenOperators', JSON.stringify(next))
    } catch {}
  }
  try { await pushLanEvents([{ table: 'kitchen_operators', row: { id, name: params.name, role, updated_at: now } }]) } catch {}
  return id
}

export async function deleteOperator(id: string) {
  try {
    await query('DELETE FROM kitchen_operators WHERE id = ?', [id])
  } catch {
    try {
      const raw = localStorage.getItem('kitchenOperators')
      const arr = raw ? JSON.parse(raw) : []
      const next = (Array.isArray(arr) ? arr : []).filter((o:any)=> String(o.id)!==String(id))
      localStorage.setItem('kitchenOperators', JSON.stringify(next))
    } catch {}
  }
  try { await pushLanEvents([{ table: 'kitchen_operators_delete', row: { id } }]) } catch {}
}
import { getCurrentUnitId } from './deviceProfileService'
