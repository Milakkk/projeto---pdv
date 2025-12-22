import { supabase } from '../../utils/supabase'
import { supabaseSync } from '../../utils/supabaseSync'
import { setPhaseTime } from './kdsService'

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

async function scheduleTicketReceiptCheck(params: { orderId: UUID; ticketId: UUID; sentAtIso: string; kitchenId: string | null }) {
  if (!supabase) return
  try {
    const sentAtMs = new Date(params.sentAtIso).getTime()
    setTimeout(async () => {
      try {
        if (!supabase) return
        const { data } = await supabaseSync.select('kds_tickets', (q) =>
          q.select('id, created_at, updated_at, kitchen_id, status').eq('id', params.ticketId).maybeSingle(),
          { silent: true }
        )
        if (!data) return
        const row = data as any
        const createdAtMs = row.created_at ? new Date(String(row.created_at)).getTime() : sentAtMs
        const updatedAtMs = row.updated_at ? new Date(String(row.updated_at)).getTime() : NaN
        const acked = row.created_at && row.updated_at && String(row.created_at) !== String(row.updated_at)
        const transferMs = Number.isFinite(updatedAtMs) ? Math.max(0, updatedAtMs - createdAtMs) : null
        if (acked) {
          try { console.log('[PDV->KDS] Confirmação de recebimento', { orderId: params.orderId, ticketId: params.ticketId, kitchenId: row.kitchen_id ?? params.kitchenId, status: row.status, transferMs }) } catch { }
        } else {
          try { console.warn('[PDV->KDS] Sem confirmação de recebimento (ainda)', { orderId: params.orderId, ticketId: params.ticketId, kitchenId: row.kitchen_id ?? params.kitchenId, status: row.status }) } catch { }
        }
      } catch { }
    }, 1500)
  } catch { }
}

export async function createOrder(payload?: {
  id?: UUID
  deviceId?: string | null
  notes?: string | null
  openedAt?: string | null
  operationalSessionId?: string | null
  pin?: string | number | null
  password?: string | null
}) {
  const id = payload?.id ?? uuid()
  const now = new Date().toISOString()
  const unitId = await getCurrentUnitId()
  let persisted = false

  if (supabase) {
    try {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      const validUnitId = unitId && uuidRegex.test(unitId) ? unitId : null

      const rand = () => Math.max(1000, Math.floor(Math.random() * 9999))
      const pin = payload?.pin ?? rand()
      const password = payload?.password ?? rand()
      const { error } = await supabaseSync.insert('orders', {
        id,
        unit_id: validUnitId,
        status: 'NEW',
        total_cents: 0,
        discount_percent: 0,
        discount_cents: 0,
        observations: payload?.notes ?? null,
        created_at: payload?.openedAt ?? now,
        updated_at: now,
        pin,
        password,
        operational_session_id: payload?.operationalSessionId ?? null,
        version: 1,
        pending_sync: false,
      })
      if (error) throw error
      // Initialize phase time for Supabase orders
      setPhaseTime(id, { newStart: payload?.openedAt ?? now }).catch(console.error)
      persisted = true
    } catch (err) {
      console.warn('[ordersService] Falha ao criar pedido no Supabase, tentando local:', err)
    }
  }

  if (!persisted) {
    try {
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
      if (payload?.pin || payload?.password) {
        await setOrderDetails(id, { pin: String(payload.pin), password: payload.password ?? undefined })
      }
      // Persist phase time (new_start)
      setPhaseTime(id, { newStart: payload?.openedAt ?? now }).catch(console.error)
    } catch {
      const raw = localStorage.getItem('orders')
      const arr = raw ? JSON.parse(raw) : []
      arr.push({ id, status: 'open', total_cents: 0, opened_at: payload?.openedAt ?? now, device_id: payload?.deviceId ?? null, unit_id: unitId ?? null, operational_session_id: payload?.operationalSessionId ?? null, notes: payload?.notes ?? null, updated_at: now, version: 1, pending_sync: 1 })
      localStorage.setItem('orders', JSON.stringify(arr))
      // Persist phase time for localStorage fallback
      setPhaseTime(id, { newStart: payload?.openedAt ?? now }).catch(console.error)
    }
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
  let persisted = false

  if (supabase) {
    try {
      const transferStart = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()
      let productName: string | null = null
      let categoryId: string | null = null
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

      if (params.productId && uuidRegex.test(params.productId)) {
        const { data: p } = await supabaseSync.select('products', (q) =>
          q.select('name, category_id').eq('id', params.productId).maybeSingle(),
          { silent: true }
        )
        const prow = p as any
        productName = prow?.name ?? null
        categoryId = prow?.category_id ?? null
      }

      const { error: errItem } = await supabaseSync.insert('order_items', {
        id,
        order_id: params.orderId,
        product_id: (params.productId && uuidRegex.test(params.productId)) ? params.productId : null,
        product_name: productName ?? 'Item',
        quantity: params.qty,
        unit_price_cents: params.unitPriceCents,
        total_cents: subtotal,
        observations: params.notes ?? null,
        created_at: now,
        updated_at: now,
        version: 1,
        pending_sync: false,
      })
      if (errItem) throw errItem

      const { data: ordRow, error: ordSelErr } = await supabaseSync.select('orders', (q) =>
        q.select('total_cents').eq('id', params.orderId).maybeSingle(),
        { silent: true }
      )
      if (!ordSelErr) {
        const orow = ordRow as any
        const current = Number(orow?.total_cents ?? 0)
        await supabaseSync.update('orders',
          { total_cents: current + subtotal, updated_at: now },
          { id: params.orderId }
        )
      }

      // Roteamento por cozinha
      let kitchenIds: string[] = []
      if (categoryId) {
        const { data: cats } = await supabaseSync.select('category_kitchens', (q) =>
          q.select('kitchen_id').eq('category_id', categoryId),
          { silent: true }
        )
        kitchenIds = ((cats as any) || []).map((r: any) => String(r.kitchen_id)).filter(Boolean)
      }
      const baseTicket = { order_id: params.orderId, status: 'NEW', updated_at: now, version: 1, pending_sync: false } as any
      const inserted: { ticketId: UUID; kitchenId: string | null }[] = []

      if (kitchenIds.length > 0) {
        const { data: existing } = await supabaseSync.select('kds_tickets', (q) =>
          q.select('id,kitchen_id').eq('order_id', params.orderId).in('kitchen_id', kitchenIds),
          { silent: true }
        )
        const existingSet = new Set(((existing as any) || []).map((r: any) => String(r.kitchen_id)))
        const missing = kitchenIds.filter((kid) => !existingSet.has(String(kid)))
        if (missing.length > 0) {
          const rows = missing.map((kid) => {
            const ticketId = uuid()
            inserted.push({ ticketId, kitchenId: kid })
            return { id: ticketId, ...baseTicket, kitchen_id: kid }
          })
          await supabaseSync.insert('kds_tickets', rows)
        }
      } else {
        const { data: existingNull } = await supabaseSync.select('kds_tickets', (q) =>
          q.select('id').eq('order_id', params.orderId).is('kitchen_id', null).limit(1),
          { silent: true }
        )
        if (((existingNull as any) || []).length === 0) {
          const ticketId = uuid()
          inserted.push({ ticketId, kitchenId: null })
          await supabaseSync.insert('kds_tickets', { id: ticketId, ...baseTicket, kitchen_id: null })
        }
      }

      try {
        const end = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()
        const ms = Math.max(0, end - (transferStart as any))
        if (inserted.length > 0) {
          console.log('[PDV->KDS] Tickets criados', { orderId: params.orderId, count: inserted.length, transferMs: Math.round(ms) })
        }
      } catch { }

      try {
        for (const it of inserted) {
          scheduleTicketReceiptCheck({ orderId: params.orderId, ticketId: it.ticketId, kitchenId: it.kitchenId, sentAtIso: now })
        }
      } catch { }
      persisted = true
    } catch (err) {
      console.warn('[ordersService] Falha ao adicionar item no Supabase, tentando local:', err)
    }
  }

  if (!persisted) {
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

      const unitId = await getCurrentUnitId()
      const ticketId = uuid()
      await query(
        'INSERT INTO kds_tickets (id, order_id, unit_id, status, station, updated_at, version, pending_sync) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(order_id) DO NOTHING',
        [ticketId, params.orderId, unitId ?? null, 'queued', null, now, 1, 1],
      )
    } catch {
      const rawItems = localStorage.getItem('order_items')
      const arrItems = rawItems ? JSON.parse(rawItems) : []
      arrItems.push({ id, order_id: params.orderId, product_id: params.productId, qty: params.qty, unit_price_cents: params.unitPriceCents, notes: params.notes ?? null, updated_at: now, version: 1, pending_sync: 1 })
      localStorage.setItem('order_items', JSON.stringify(arrItems))

      const rawOrders = localStorage.getItem('orders')
      const arrOrders = rawOrders ? JSON.parse(rawOrders) : []
      const nextOrders = arrOrders.map((o: any) => String(o.id) === String(params.orderId) ? { ...o, total_cents: Math.max(0, Number(o.total_cents || 0) + subtotal), updated_at: now } : o)
      localStorage.setItem('orders', JSON.stringify(nextOrders))

      const rawTk = localStorage.getItem('kdsTickets')
      const arrTk = rawTk ? JSON.parse(rawTk) : []
      arrTk.push({ id: uuid(), order_id: params.orderId, status: 'queued', updated_at: now })
      localStorage.setItem('kdsTickets', JSON.stringify(arrTk))
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
    const it = items.find((x: any) => String(x.id) === String(itemId))
    if (!it) return false
    const nextItems = items.filter((x: any) => String(x.id) !== String(itemId))
    localStorage.setItem('order_items', JSON.stringify(nextItems))
    return true
  }
}

export async function closeOrder(orderId: UUID) {
  const now = new Date().toISOString()
  if (supabase) {
    try {
      const { data: existing } = await supabaseSync.select('orders', (q) =>
        q.select('completed_at').eq('id', orderId).maybeSingle(),
        { silent: true }
      )
      const completedAt = existing?.completed_at ?? now
      await supabaseSync.update('orders',
        { status: 'DELIVERED', completed_at: completedAt, updated_at: now },
        { id: orderId }
      )
    } catch (err) {
      console.error('[ordersService] Erro ao fechar pedido no Supabase:', err)
    }
  } else {
    await query('UPDATE orders SET status = ?, closed_at = COALESCE(closed_at, ?), updated_at = ?, pending_sync = 1 WHERE id = ?', [
      'closed',
      now,
      now,
      orderId,
    ])
  }

  await setPhaseTime(orderId, { deliveredAt: now })
}

export async function cancelOrder(orderId: UUID) {
  const now = new Date().toISOString()
  if (supabase) {
    try {
      await supabaseSync.update('orders',
        { status: 'CANCELLED', updated_at: now },
        { id: orderId }
      )
    } catch (err) {
      console.error('[ordersService] Erro ao cancelar pedido no Supabase:', err)
    }
  } else {
    await query('UPDATE orders SET status = ?, closed_at = COALESCE(closed_at, ?), updated_at = ?, pending_sync = 1 WHERE id = ?', [
      'cancelled',
      now,
      now,
      orderId,
    ])
  }
}

export async function clearLocalOrders() {
  try {
    const api = (window as any)?.api?.db?.query
    if (typeof api === 'function') {
      const statements = [
        'DELETE FROM kds_unit_states',
        'DELETE FROM kds_phase_times',
        'DELETE FROM kds_tickets',
        'DELETE FROM payments',
        'DELETE FROM order_items',
        'DELETE FROM orders_details',
        'DELETE FROM orders',
      ]

      for (const sql of statements) {
        try {
          await query(sql)
        } catch { }
      }
      return
    }
  } catch { }

  try {
    localStorage.removeItem('orders')
    localStorage.removeItem('order_items')
    localStorage.removeItem('payments')
    localStorage.removeItem('orders_details')
    localStorage.removeItem('kdsTickets')
    localStorage.removeItem('kdsPhaseTimes')
    localStorage.removeItem('kdsUnitState')
  } catch { }
}

export async function listAllLocalOrders() {
  try {
    const api = (window as any)?.api?.db?.query
    if (typeof api === 'function') {
      const res = await query('SELECT * FROM orders')
      return res?.rows ?? []
    }
    const raw = localStorage.getItem('orders')
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export async function listOrders(limit = 100) {
  try {
    const unitId = await getCurrentUnitId()
    const api = (window as any)?.api?.db?.query
    if (typeof api === 'function') {
      const sql = unitId
        ? 'SELECT * FROM orders WHERE unit_id = ? ORDER BY datetime(updated_at) DESC LIMIT ?'
        : 'SELECT * FROM orders ORDER BY datetime(updated_at) DESC LIMIT ?'
      const params = unitId ? [unitId, limit] : [limit]
      const res = await query(sql, params)
      return res?.rows ?? []
    }
    if (supabase) {
      const { data, error } = await supabaseSync.select('orders', (q) => {
        let res = q.select('*').order('updated_at', { ascending: false }).limit(limit)
        if (unitId) res = res.eq('unit_id', unitId)
        return res
      }, { silent: true })
      if (error) throw error
      return data || []
    }
    return []
  } catch { return [] }
}

export async function listOrdersDetailed(limit = 100): Promise<Array<{ order: any; items: any[]; payments: any[]; details?: { pin?: string; password?: string }; phaseTimes?: any; unitStates?: any }>> {
  try {
    const unitId = await getCurrentUnitId()
    const api = (window as any)?.api?.db?.query
    if (typeof api === 'function') {
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

      // [FIX] Fallback to LocalStorage for phase times if missing in SQLite
      try {
        const localRaw = localStorage.getItem('kdsPhaseTimes')
        const localObj = localRaw ? JSON.parse(localRaw) : {}
        for (const oid of ids) {
          if (!timesByOrder[oid] && localObj[oid]) {
            const t = localObj[oid]
            timesByOrder[oid] = {
              newStart: t.newStart ?? t.new_start,
              preparingStart: t.preparingStart ?? t.preparing_start,
              readyAt: t.readyAt ?? t.ready_at,
              deliveredAt: t.deliveredAt ?? t.delivered_at,
            }
          }
        }
      } catch { }

      const unitStatesByOrder: Record<string, any> = {}
      for (const u of (unitStatesRes?.rows ?? [])) {
        const oid = String((u as any).order_id ?? (u as any).orderId ?? '')
        const itemId = String((u as any).order_item_id ?? (u as any).orderItemId ?? (u as any).item_id ?? (u as any).itemId ?? '')
        const unitId = String((u as any).production_unit_id ?? (u as any).productionUnitId ?? (u as any).unit_id ?? (u as any).unitId ?? '')
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
        const pt = timesByOrder[oid]

        // Merge phase times into the order object for easier consumption by components like OrderTimeStatus
        const mergedOrder = {
          ...r,
          pin: d?.pin ?? r.pin,
          password: d?.password ?? r.password,
          preparingStartedAt: pt?.preparingStart ? new Date(pt.preparingStart) : undefined,
          readyAt: pt?.readyAt ? new Date(pt.readyAt) : undefined,
          deliveredAt: pt?.deliveredAt ? new Date(pt.deliveredAt) : undefined,
        }

        return {
          order: mergedOrder,
          items: itemsByOrder[oid] ?? [],
          payments: paysByOrder[oid] ?? [],
          details: d ? { pin: d.pin ? String(d.pin) : undefined, password: d.password ? String(d.password) : undefined } : undefined,
          phaseTimes: pt,
          unitStates: unitStatesByOrder[oid],
        }
      })
    }
    if (supabase) {
      let q = supabase.from('orders').select('id, status, total_cents, discount_percent, discount_cents, observations, pin, password, unit_id, created_at, updated_at, completed_at').order('updated_at', { ascending: false }).limit(limit)
      if (unitId) q = q.eq('unit_id', unitId)
      const { data: ords, error: ordErr } = await q
      if (ordErr) throw ordErr
      const ids = (ords || []).map(r => String(r.id))
      if (!ids.length) return []

      const { data: itemsData, error: itemsErr } = await supabase.from('order_items').select('id, order_id, product_id, product_name, quantity, unit_price_cents, total_cents').in('order_id', ids)
      if (itemsErr) throw itemsErr

      const { data: paysData, error: paysErr } = await supabase.from('payments').select('order_id, method, amount_cents, change_cents').in('order_id', ids)
      if (paysErr) throw paysErr

      const { data: timesData } = await supabase.from('kds_phase_times').select('*').in('order_id', ids)

      const prodIds = Array.from(new Set((itemsData || []).map(it => String(it.product_id)).filter(id => id && id !== 'null' && id !== 'undefined')))
      const { data: prods } = prodIds.length > 0 ? await supabase.from('products').select('id, category_id, name').in('id', prodIds) : { data: [] as any[] }
      const catByProd: Record<string, string | null> = {}
      for (const p of (prods || [])) catByProd[String(p.id)] = (p as any).category_id ?? null

      const itemsByOrder: Record<string, any[]> = {}
      for (const it of (itemsData || [])) {
        const oid = String(it.order_id)
        itemsByOrder[oid] = itemsByOrder[oid] || []
        itemsByOrder[oid].push({ ...it, category_id: catByProd[String(it.product_id)] ?? null })
      }

      const paysByOrder: Record<string, any[]> = {}
      for (const p of (paysData || [])) {
        const oid = String(p.order_id)
        paysByOrder[oid] = paysByOrder[oid] || []
        paysByOrder[oid].push(p)
      }

      const timesByOrder: Record<string, any> = {}
      for (const t of (timesData || [])) {
        const oid = String(t.order_id)
        timesByOrder[oid] = {
          newStart: t.new_start,
          preparingStart: t.preparing_start,
          readyAt: t.ready_at,
          deliveredAt: t.delivered_at
        }
      }

      return (ords || []).map(r => {
        const oid = String(r.id)
        const pt = timesByOrder[oid]

        // Merge phase times and ensure pin/password are correctly typed
        const mergedOrder = {
          ...r,
          preparingStartedAt: pt?.preparingStart ? new Date(pt.preparingStart) : undefined,
          readyAt: pt?.readyAt ? new Date(pt.readyAt) : undefined,
          deliveredAt: pt?.deliveredAt ? new Date(pt.deliveredAt) : undefined,
          createdAt: r.created_at ? new Date(r.created_at) : undefined,
          updatedAt: r.updated_at ? new Date(r.updated_at) : undefined,
          completedAt: r.completed_at ? new Date(r.completed_at) : undefined,
        }

        return {
          order: mergedOrder,
          items: itemsByOrder[oid] || [],
          payments: paysByOrder[oid] || [],
          details: { pin: (r as any).pin, password: (r as any).password },
          phaseTimes: pt
        }
      })
    }
    return []
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
    } catch { }
  }
}
import { getCurrentUnitId } from './deviceProfileService'
