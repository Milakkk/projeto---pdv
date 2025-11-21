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

export async function createOrder(payload?: {
  id?: UUID
  deviceId?: string | null
  notes?: string | null
  openedAt?: string | null
}) {
  const id = payload?.id ?? uuid()
  const now = new Date().toISOString()
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

  return id
}

export async function removeItem(itemId: UUID) {
  const now = new Date().toISOString()
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
}

export async function closeOrder(orderId: UUID) {
  const now = new Date().toISOString()
  await query('UPDATE orders SET status = ?, closed_at = ?, updated_at = ?, pending_sync = 1 WHERE id = ?', [
    'closed',
    now,
    now,
    orderId,
  ])
}

export async function cancelOrder(orderId: UUID) {
  const now = new Date().toISOString()
  await query('UPDATE orders SET status = ?, closed_at = ?, updated_at = ?, pending_sync = 1 WHERE id = ?', [
    'cancelled',
    now,
    now,
    orderId,
  ])
}

export async function listOrders(limit = 100) {
  const unitId = await getCurrentUnitId()
  const sql = unitId
    ? 'SELECT * FROM orders WHERE unit_id = ? ORDER BY datetime(updated_at) DESC LIMIT ?'
    : 'SELECT * FROM orders ORDER BY datetime(updated_at) DESC LIMIT ?'
  const params = unitId ? [unitId, limit] : [limit]
  const res = await query(sql, params)
  return res?.rows ?? []
}

export async function getOrderById(id: UUID) {
  const resOrd = await query('SELECT * FROM orders WHERE id = ?', [id])
  const ord = (resOrd?.rows ?? [])[0]
  if (!ord) return null
  const resItems = await query('SELECT * FROM order_items WHERE order_id = ?', [id])
  const items = resItems?.rows ?? []
  const resPays = await query('SELECT * FROM payments WHERE order_id = ?', [id])
  const pays = resPays?.rows ?? []
  return { order: ord, items, payments: pays }
}

export async function addPayment(params: { orderId: UUID; method: string; amountCents: number; notes?: string | null }) {
  const id = uuid()
  const now = new Date().toISOString()
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
  return id
}
import { getCurrentUnitId } from './deviceProfileService'
