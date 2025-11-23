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

export async function createOrder(payload?: {
  id?: UUID
  deviceId?: string | null
  notes?: string | null
  openedAt?: string | null
}) {
  const id = payload?.id ?? uuid()
  const now = new Date().toISOString()
  try {
    const unitId = await getCurrentUnitId()
    await query(
      'INSERT INTO orders (id, status, total_cents, opened_at, device_id, unit_id, notes, updated_at, version, pending_sync) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        id,
        'open',
        0,
        payload?.openedAt ?? now,
        payload?.deviceId ?? null,
        unitId ?? null,
        payload?.notes ?? null,
        now,
        1,
        1,
      ],
    )
  } catch {
    const raw = localStorage.getItem('orders')
    const arr = raw ? JSON.parse(raw) : []
    const unitId = null
    arr.unshift({ id, status: 'open', total_cents: 0, opened_at: payload?.openedAt ?? now, device_id: payload?.deviceId ?? null, unit_id: unitId, notes: payload?.notes ?? null, updated_at: now, version: 1, pending_sync: 1 })
    localStorage.setItem('orders', JSON.stringify(arr))
  }
  return id
}

export async function addItem(params: {
  orderId: UUID
  productId: UUID | null
  qty: number
  unitPriceCents: number
  notes?: string | null
}) {
  const id = uuid()
  const now = new Date().toISOString()
  const subtotal = Math.max(0, Math.round(params.qty * params.unitPriceCents))
  try {
    await query(
      'INSERT INTO order_items (id, order_id, product_id, qty, unit_price_cents, notes, updated_at, version, pending_sync) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        id,
        params.orderId,
        params.productId,
        params.qty,
        params.unitPriceCents,
        params.notes ?? null,
        now,
        1,
        1,
      ],
    )
    await query(
      'UPDATE orders SET total_cents = COALESCE(total_cents, 0) + ?, updated_at = ?, pending_sync = 1 WHERE id = ?',
      [subtotal, now, params.orderId],
    )
  } catch {
    const rawItems = localStorage.getItem('order_items')
    const items = rawItems ? JSON.parse(rawItems) : []
    items.push({ id, order_id: params.orderId, product_id: params.productId, qty: params.qty, unit_price_cents: params.unitPriceCents, notes: params.notes ?? null, updated_at: now, version: 1, pending_sync: 1 })
    localStorage.setItem('order_items', JSON.stringify(items))
    const rawOrders = localStorage.getItem('orders')
    const ords = rawOrders ? JSON.parse(rawOrders) : []
    const idx = ords.findIndex((o:any)=> String(o.id)===String(params.orderId))
    if (idx>=0) {
      const o = ords[idx]
      const nextTotal = Math.max(0, (o.total_cents || 0) + subtotal)
      ords[idx] = { ...o, total_cents: nextTotal, updated_at: now, pending_sync: 1 }
      localStorage.setItem('orders', JSON.stringify(ords))
    }
  }
  return id
}

export async function removeItem(itemId: UUID) {
  const now = new Date().toISOString()
  try {
    const resItem = await query('SELECT * FROM order_items WHERE id = ?', [itemId])
    const it = (resItem?.rows ?? [])[0]
    if (!it) return false
    const subtotal = Math.max(0, Math.round((it.qty ?? 1) * (it.unitPriceCents ?? 0)))
    await query('DELETE FROM order_items WHERE id = ?', [itemId])
    await query(
      'UPDATE orders SET total_cents = CASE WHEN COALESCE(total_cents,0) - ? < 0 THEN 0 ELSE COALESCE(total_cents,0) - ? END, updated_at = ?, pending_sync = 1 WHERE id = ?',
      [subtotal, subtotal, now, it.orderId],
    )
    return true
  } catch {
    const rawItems = localStorage.getItem('order_items')
    const items = rawItems ? JSON.parse(rawItems) : []
    const it = items.find((x:any)=> String(x.id)===String(itemId))
    if (!it) return false
    const subtotal = Math.max(0, Math.round((it.qty ?? 1) * (it.unit_price_cents ?? 0)))
    const nextItems = items.filter((x:any)=> String(x.id)!==String(itemId))
    localStorage.setItem('order_items', JSON.stringify(nextItems))
    const rawOrders = localStorage.getItem('orders')
    const ords = rawOrders ? JSON.parse(rawOrders) : []
    const idx = ords.findIndex((o:any)=> String(o.id)===String(it.order_id))
    if (idx>=0) {
      const o = ords[idx]
      const nextTotal = Math.max(0, (o.total_cents || 0) - subtotal)
      ords[idx] = { ...o, total_cents: nextTotal, updated_at: now, pending_sync: 1 }
      localStorage.setItem('orders', JSON.stringify(ords))
    }
    return true
  }
}

export async function closeOrder(orderId: UUID) {
  const now = new Date().toISOString()
  try {
    await query('UPDATE orders SET status = ?, closed_at = ?, updated_at = ?, pending_sync = 1 WHERE id = ?', [
      'closed',
      now,
      now,
      orderId,
    ])
  } catch {
    const raw = localStorage.getItem('orders')
    const ords = raw ? JSON.parse(raw) : []
    const idx = ords.findIndex((o:any)=> String(o.id)===String(orderId))
    if (idx>=0) {
      const o = ords[idx]
      ords[idx] = { ...o, status: 'closed', closed_at: now, updated_at: now, pending_sync: 1 }
      localStorage.setItem('orders', JSON.stringify(ords))
    }
  }
}

export async function cancelOrder(orderId: UUID) {
  const now = new Date().toISOString()
  try {
    await query('UPDATE orders SET status = ?, closed_at = ?, updated_at = ?, pending_sync = 1 WHERE id = ?', [
      'cancelled',
      now,
      now,
      orderId,
    ])
  } catch {
    const raw = localStorage.getItem('orders')
    const ords = raw ? JSON.parse(raw) : []
    const idx = ords.findIndex((o:any)=> String(o.id)===String(orderId))
    if (idx>=0) {
      const o = ords[idx]
      ords[idx] = { ...o, status: 'cancelled', closed_at: now, updated_at: now, pending_sync: 1 }
      localStorage.setItem('orders', JSON.stringify(ords))
    }
  }
}

export async function listOrders(limit = 100) {
  try {
    const unitId = await getCurrentUnitId()
    const sql = unitId
      ? 'SELECT * FROM orders WHERE unit_id = ? ORDER BY datetime(updated_at) DESC LIMIT ?'
      : 'SELECT * FROM orders ORDER BY datetime(updated_at) DESC LIMIT ?'
    const params = unitId ? [unitId, limit] : [limit]
    const res = await query(sql, params)
    return res?.rows ?? []
  } catch {
    const raw = localStorage.getItem('orders')
    const ords = raw ? JSON.parse(raw) : []
    const arr = Array.isArray(ords) ? ords : []
    return arr.slice(0, limit)
  }
}

export async function getOrderById(id: UUID) {
  try {
    const resOrd = await query('SELECT * FROM orders WHERE id = ?', [id])
    const ord = (resOrd?.rows ?? [])[0]
    if (!ord) return null
    const resItems = await query('SELECT * FROM order_items WHERE order_id = ?', [id])
    const items = resItems?.rows ?? []
    const resPays = await query('SELECT * FROM payments WHERE order_id = ?', [id])
    const pays = resPays?.rows ?? []
    return { order: ord, items, payments: pays }
  } catch {
    const rawOrd = localStorage.getItem('orders')
    const ords = rawOrd ? JSON.parse(rawOrd) : []
    const ord = (Array.isArray(ords) ? ords : []).find((o:any)=> String(o.id)===String(id))
    if (!ord) return null
    const rawItems = localStorage.getItem('order_items')
    const items = rawItems ? JSON.parse(rawItems) : []
    const rawPays = localStorage.getItem('payments')
    const pays = rawPays ? JSON.parse(rawPays) : []
    return { order: ord, items: items.filter((x:any)=> String(x.order_id)===String(id)), payments: pays.filter((x:any)=> String(x.order_id)===String(id)) }
  }
}

export async function addPayment(params: { orderId: UUID; method: string; amountCents: number; notes?: string | null }) {
  const id = uuid()
  const now = new Date().toISOString()
  try {
    await query(
      'INSERT INTO payments (id, order_id, method, amount_cents, change_cents, auth_code, updated_at, version, pending_sync) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        id,
        params.orderId,
        params.method,
        Math.max(0, Math.round(params.amountCents ?? 0)),
        0,
        null,
        now,
        1,
        1,
      ],
    )
  } catch {
    const raw = localStorage.getItem('payments')
    const arr = raw ? JSON.parse(raw) : []
    arr.push({ id, order_id: params.orderId, method: params.method, amount_cents: Math.max(0, Math.round(params.amountCents ?? 0)), change_cents: 0, auth_code: null, updated_at: now, version: 1, pending_sync: 1 })
    localStorage.setItem('payments', JSON.stringify(arr))
  }
  return id
}
import { getCurrentUnitId } from './deviceProfileService'
