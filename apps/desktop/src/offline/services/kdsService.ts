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

const lanHubUrl: string | undefined = (import.meta as any)?.env?.VITE_LAN_HUB_URL || 'http://localhost:4000'
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
  return id
}

export async function setTicketStatus(id: UUID, status: 'queued' | 'prep' | 'ready' | 'done') {
  const now = new Date().toISOString()
  try {
    await query('UPDATE kds_tickets SET status = ?, updated_at = ?, pending_sync = 1 WHERE id = ?', [status, now, id])
  } catch {
    try {
      const raw = localStorage.getItem('kdsTickets')
      const arr = raw ? JSON.parse(raw) : []
      const updated = arr.map((t:any)=> t.id===id ? { ...t, status, updated_at: now } : t)
      localStorage.setItem('kdsTickets', JSON.stringify(updated))

      const mapToOrderStatus = (s:string)=> s==='ready'?'READY': s==='prep'?'PREPARING': 'NEW'
      try {
        const rawOrders = localStorage.getItem('orders')
        const orders = rawOrders ? JSON.parse(rawOrders) : []
        const updOrders = (Array.isArray(orders)?orders:[]).map((o:any)=> {
          if (String(o.id)===String(id)) {
            const nextStatus = mapToOrderStatus(String(status))
            const out:any = { ...o, status: nextStatus }
            if (nextStatus==='PREPARING' && !o.updatedAt) out.updatedAt = now
            if (nextStatus==='READY') out.readyAt = now
            if (nextStatus!=='READY') out.readyAt = undefined
            return out
          }
          return o
        })
        localStorage.setItem('orders', JSON.stringify(updOrders))
      } catch {}
    } catch {}
  }
}

export async function listTicketsByStatus(status: 'queued' | 'prep' | 'ready' | 'done') {
  try {
    const res = await query('SELECT * FROM kds_tickets WHERE status = ?', [status])
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
      // Merge com estado persistido no navegador (operador, status e checklist)
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
        enriched.push({ ...t, items: mergedItems })
      } catch {
        enriched.push({ ...t, items })
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
          res.push({ ...t, items })
        }
        return res
      }
      const ordRaw = localStorage.getItem('orders')
      const orders = ordRaw ? JSON.parse(ordRaw) : []
      const mapStatus = (s:string)=> s==='READY'?'ready': s==='PREPARING'?'prep': 'queued'
      const res = (Array.isArray(orders)?orders:[])
        .filter((o:any)=> mapStatus(String(o.status||'NEW'))===status)
        .map((o:any)=> ({ id: String(o.id), order_id: String(o.id), status: mapStatus(String(o.status||'NEW')), items: (Array.isArray(o.items)? o.items.filter((it:any)=> !(it.skipKitchen || it.menuItem?.skipKitchen)) : []) }))
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
import { getCurrentUnitId } from './deviceProfileService'
