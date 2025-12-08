import { supabase } from '../../utils/supabase'

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
  operationalSessionId?: string | null
}) {
  const id = payload?.id ?? uuid()
  const now = new Date().toISOString()
  const unitId = await getCurrentUnitId()
  if (supabase) {
    const rand = () => Math.max(1000, Math.floor(Math.random() * 9999))
    const pin = rand()
    const password = rand()
    const { error } = await supabase
      .from('orders')
      .insert({
        id,
        unit_id: unitId ?? null,
        status: 'NEW',
        total_cents: 0,
        discount_percent: 0,
        discount_cents: 0,
        observations: payload?.notes ?? null,
        created_at: payload?.openedAt ?? now,
        updated_at: now,
        pin,
        password,
        version: 1,
        pending_sync: false,
      })
    if (error) throw error
  } else {
    await query(
      'INSERT INTO orders (id, status, total_cents, opened_at, device_id, unit_id, operational_session_id, notes, updated_at, version, pending_sync) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        id,
        'open',
        0,
        payload?.openedAt ?? now,
        payload?.deviceId ?? null,
        unitId ?? null,
        payload?.operationalSessionId ?? null,
        payload?.notes ?? null,
        now,
        1,
        1,
      ],
    )
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
  if (supabase) {
    let productName: string | null = null
    let categoryId: string | null = null
    if (params.productId) {
      const { data: p } = await supabase
        .from('products')
        .select('name, category_id')
        .eq('id', params.productId)
        .maybeSingle()
      productName = p?.name ?? null
      categoryId = p?.category_id ?? null
    }
    const { error: errItem } = await supabase
      .from('order_items')
      .insert({
        id,
        order_id: params.orderId,
        product_id: params.productId,
        product_name: productName ?? 'Item',
        quantity: params.qty,
        unit_price_cents: params.unitPriceCents,
        total_cents: subtotal,
        observations: params.notes ?? null,
        updated_at: now,
        version: 1,
        pending_sync: false,
      })
    if (errItem) throw errItem
    const { data: ordRow, error: ordSelErr } = await supabase
      .from('orders')
      .select('total_cents')
      .eq('id', params.orderId)
      .maybeSingle()
    if (ordSelErr) throw ordSelErr
    const current = Number(ordRow?.total_cents ?? 0)
    const { error: errOrdUpdate } = await supabase
      .from('orders')
      .update({ total_cents: current + subtotal, updated_at: now })
      .eq('id', params.orderId)
    if (errOrdUpdate) throw errOrdUpdate
    await supabase
      .from('kds_tickets')
      .insert({ id: uuid(), order_id: params.orderId, kitchen_id: null, status: 'NEW', updated_at: now, version: 1, pending_sync: false })
  } else {
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
    const nextItems = items.filter((x:any)=> String(x.id)!==String(itemId))
    localStorage.setItem('order_items', JSON.stringify(nextItems))
    return true
  }
}

export async function closeOrder(orderId: UUID) {
  const now = new Date().toISOString()
  if (supabase) {
    const { error } = await supabase
      .from('orders')
      .update({ status: 'closed', closed_at: now, updated_at: now })
      .eq('id', orderId)
    if (error) throw error
  } else {
    await query('UPDATE orders SET status = ?, closed_at = ?, updated_at = ?, pending_sync = 1 WHERE id = ?', [
      'closed',
      now,
      now,
      orderId,
    ])
  }
}

export async function cancelOrder(orderId: UUID) {
  const now = new Date().toISOString()
  if (supabase) {
    const { error } = await supabase
      .from('orders')
      .update({ status: 'cancelled', closed_at: now, updated_at: now })
      .eq('id', orderId)
    if (error) throw error
  } else {
    await query('UPDATE orders SET status = ?, closed_at = ?, updated_at = ?, pending_sync = 1 WHERE id = ?', [
      'cancelled',
      now,
      now,
      orderId,
    ])
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
  } catch { return [] }
}

export async function listOrdersDetailed(limit = 100): Promise<Array<{ order: any; items: any[]; payments: any[]; details?: { pin?: string; password?: string }; phaseTimes?: any; unitStates?: any }>> {
  try {
    const unitId = await getCurrentUnitId()
    const sql = unitId
      ? 'SELECT * FROM orders WHERE unit_id = ? ORDER BY datetime(updated_at) DESC LIMIT ?'
      : 'SELECT * FROM orders ORDER BY datetime(updated_at) DESC LIMIT ?'
    const params = unitId ? [unitId, limit] : [limit]
    const res = await query(sql, params)
    const orders = res?.rows ?? []
    const ids = orders.map((r: any) => String(r.id)).filter(Boolean)
    if (!ids.length) return []
    const placeholders = ids.map(() => '?').join(', ')
    const itemsRes = await query(`SELECT oi.*, p.name as product_name, p.category_id as category_id FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id WHERE oi.order_id IN (${placeholders})`, ids)
    const paysRes = await query(`SELECT order_id, method, SUM(amount_cents) AS amount_cents, SUM(change_cents) AS change_cents FROM payments WHERE order_id IN (${placeholders}) GROUP BY order_id, method`, ids)
    const detRes = await query(`SELECT * FROM orders_details WHERE order_id IN (${placeholders})`, ids)
    const timesRes = await query(`SELECT * FROM kds_phase_times WHERE order_id IN (${placeholders})`, ids)
    const unitStatesRes = await query(`SELECT * FROM kds_unit_states WHERE order_id IN (${placeholders})`, ids)

    const itemsByOrder: Record<string, any[]> = {}
    for (const it of (itemsRes?.rows ?? [])) {
      const oid = String((it as any).order_id ?? (it as any).orderId ?? '')
      if (!itemsByOrder[oid]) itemsByOrder[oid] = []
      itemsByOrder[oid].push(it)
    }

    const paysByOrder: Record<string, any[]> = {}
    for (const p of (paysRes?.rows ?? [])) {
      const oid = String((p as any).order_id ?? (p as any).orderId ?? '')
      if (!paysByOrder[oid]) paysByOrder[oid] = []
      paysByOrder[oid].push(p)
    }

    const detByOrder: Record<string, any> = {}
    for (const d of (detRes?.rows ?? [])) {
      const oid = String((d as any).order_id ?? (d as any).orderId ?? '')
      detByOrder[oid] = d
    }

    const timesByOrder: Record<string, any> = {}
    for (const t of (timesRes?.rows ?? [])) {
      const oid = String((t as any).order_id ?? (t as any).orderId ?? '')
      timesByOrder[oid] = {
        newStart: t.new_start ?? t.newStart,
        preparingStart: t.preparing_start ?? t.preparingStart,
        readyAt: t.ready_at ?? t.readyAt,
        deliveredAt: t.delivered_at ?? t.deliveredAt,
      }
    }

    const unitStatesByOrder: Record<string, any> = {}
    for (const u of (unitStatesRes?.rows ?? [])) {
      const oid = String((u as any).order_id ?? (u as any).orderId ?? '')
      const itemId = String((u as any).item_id ?? (u as any).itemId ?? '')
      const unitId = String((u as any).unit_id ?? (u as any).unitId ?? '')
      if (!unitStatesByOrder[oid]) unitStatesByOrder[oid] = {}
      const key = `${itemId}:${unitId}`
      unitStatesByOrder[oid][key] = {
        operatorName: u.operator_name ?? u.operatorName ?? undefined,
        unitStatus: u.unit_status ?? u.unitStatus ?? undefined,
        completedAt: u.completed_at ?? u.completedAt ?? undefined,
        deliveredAt: u.delivered_at ?? u.deliveredAt ?? undefined,
        completedObservations: (() => { try { const arr = JSON.parse(String(u.completed_observations_json ?? 'null')); return Array.isArray(arr) ? arr : [] } catch { return [] } })(),
      }
    }

    return orders.map((r: any) => {
      const oid = String(r.id)
      const d = detByOrder[oid]
      return {
        order: r,
        items: itemsByOrder[oid] ?? [],
        payments: paysByOrder[oid] ?? [],
        details: d ? { pin: d.pin ? String(d.pin) : undefined, password: d.password ? String(d.password) : undefined } : undefined,
        phaseTimes: timesByOrder[oid],
        unitStates: unitStatesByOrder[oid],
      }
    })
  } catch { return [] }
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
  } catch { return null }
}

export async function getOrderDetails(id: UUID): Promise<{ pin?: string; password?: string } | null> {
  try {
    const res = await query('SELECT pin, password FROM orders_details WHERE order_id = ?', [id])
    const row = (res?.rows ?? [])[0]
    return row ? { pin: row.pin ? String(row.pin) : undefined, password: row.password ? String(row.password) : undefined } : null
  } catch { return null }
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

export async function setOrderDetails(orderId: UUID, details: { pin?: string; password?: string }) {
  const now = new Date().toISOString()
  try {
    await query(
      'INSERT INTO orders_details (order_id, pin, password, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(order_id) DO UPDATE SET pin=COALESCE(excluded.pin, pin), password=COALESCE(excluded.password, password), updated_at=excluded.updated_at',
      [orderId, details.pin ?? null, details.password ?? null, now],
    )
  } catch {
    try {
      const raw = localStorage.getItem('kdsOrderDetails')
      const obj = raw ? JSON.parse(raw) : {}
      const cur = obj[String(orderId)] || {}
      const next = { ...cur, ...details }
      obj[String(orderId)] = next
      localStorage.setItem('kdsOrderDetails', JSON.stringify(obj))
    } catch {}
  }
}
import { getCurrentUnitId } from './deviceProfileService'
