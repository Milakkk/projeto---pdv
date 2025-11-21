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
      enriched.push({ ...t, items })
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
          const items = Array.isArray(ord?.items) ? ord.items.filter((it:any)=> !(it.skipKitchen || it.menuItem?.skipKitchen)) : []
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
