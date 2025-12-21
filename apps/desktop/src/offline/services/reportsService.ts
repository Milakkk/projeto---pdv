import { supabase } from '../../utils/supabase'

// Renderer: usar IPC seguro exposto pelo preload
const query = async (sql: string, params?: any[]) => {
  // @ts-expect-error preload inject
  const fn = (window?.api?.db?.query)
  if (typeof fn !== 'function') throw new Error('Canal de DB indisponível')
  return fn(sql, params) as Promise<{ rows?: any[]; meta?: any; error?: any }>
}

const isElectron = () => typeof (window as any)?.api?.db?.query === 'function'

export async function revenueByPeriod(params: { startIso: string; endIso: string }) {
  console.log('[REPORTS-DEBUG] revenueByPeriod called', params)

  // Try SQLite first (Electron mode)
  if (isElectron()) {
    try {
      const res = await query(
        'SELECT method, SUM(amount_cents) AS total FROM payments WHERE order_id IN (SELECT id FROM orders WHERE status = ? AND datetime(closed_at) >= datetime(?) AND datetime(closed_at) <= datetime(?)) GROUP BY method',
        ['closed', params.startIso, params.endIso],
      )
      const rows = res?.rows ?? []
      const byMethod: Record<string, number> = {}
      let total = 0
      for (const r of rows) {
        const m = String(r.method)
        const t = Number(r.total ?? 0)
        byMethod[m] = t
        total += t
      }
      console.log('[REPORTS-DEBUG] revenueByPeriod SQLite result:', { totalCents: total, byMethod })
      return { totalCents: total, byMethod }
    } catch (err) {
      console.warn('[REPORTS-DEBUG] revenueByPeriod SQLite error:', err)
    }
  }

  // Fallback: Supabase (Web mode)
  if (supabase) {
    try {
      // Get orders in date range that are closed/delivered
      const { data: orders, error: ordersErr } = await supabase
        .from('orders')
        .select('id, status, completed_at')
        .in('status', ['closed', 'DELIVERED'])
        .gte('completed_at', params.startIso)
        .lte('completed_at', params.endIso + 'T23:59:59.999Z')

      if (ordersErr) {
        console.error('[REPORTS-DEBUG] revenueByPeriod orders error:', ordersErr)
        return { totalCents: 0, byMethod: {} }
      }

      const orderIds = (orders || []).map(o => o.id)
      console.log('[REPORTS-DEBUG] revenueByPeriod found orders:', orderIds.length)

      if (orderIds.length === 0) {
        return { totalCents: 0, byMethod: {} }
      }

      // Get payments for those orders
      const { data: payments, error: paymentsErr } = await supabase
        .from('payments')
        .select('method, amount_cents')
        .in('order_id', orderIds)

      if (paymentsErr) {
        console.error('[REPORTS-DEBUG] revenueByPeriod payments error:', paymentsErr)
        return { totalCents: 0, byMethod: {} }
      }

      const byMethod: Record<string, number> = {}
      let total = 0
      for (const p of (payments || [])) {
        const m = String(p.method || 'cash')
        const amt = Number(p.amount_cents ?? 0)
        byMethod[m] = (byMethod[m] || 0) + amt
        total += amt
      }

      console.log('[REPORTS-DEBUG] revenueByPeriod Supabase result:', { totalCents: total, byMethod })
      return { totalCents: total, byMethod }
    } catch (err) {
      console.error('[REPORTS-DEBUG] revenueByPeriod Supabase exception:', err)
    }
  }

  console.warn('[REPORTS-DEBUG] revenueByPeriod: No data source available')
  return { totalCents: 0, byMethod: {} }
}

export async function topSellingItems(params: { startIso?: string; endIso?: string; limit?: number }) {
  console.log('[REPORTS-DEBUG] topSellingItems called', params)
  const limit = params.limit ?? 10

  // Try SQLite first (Electron mode)
  if (isElectron()) {
    try {
      if (params.startIso && params.endIso) {
        const res = await query(
          'SELECT oi.product_id AS productId, COALESCE(p.name, NULL) AS name, SUM(oi.qty) AS qty FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id WHERE oi.order_id IN (SELECT id FROM orders WHERE status = ? AND datetime(closed_at) >= datetime(?) AND datetime(closed_at) <= datetime(?)) GROUP BY oi.product_id, p.name ORDER BY qty DESC LIMIT ?',
          ['closed', params.startIso, params.endIso, limit],
        )
        const result = (res?.rows ?? []).map((r: any) => ({ productId: String(r.productId), name: r.name ?? null, qty: Number(r.qty ?? 0) }))
        console.log('[REPORTS-DEBUG] topSellingItems SQLite result:', result.length, 'items')
        return result
      } else {
        const res = await query(
          'SELECT oi.product_id AS productId, COALESCE(p.name, NULL) AS name, SUM(oi.qty) AS qty FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id GROUP BY oi.product_id, p.name ORDER BY qty DESC LIMIT ?',
          [limit],
        )
        const result = (res?.rows ?? []).map((r: any) => ({ productId: String(r.productId), name: r.name ?? null, qty: Number(r.qty ?? 0) }))
        console.log('[REPORTS-DEBUG] topSellingItems SQLite result:', result.length, 'items')
        return result
      }
    } catch (err) {
      console.warn('[REPORTS-DEBUG] topSellingItems SQLite error:', err)
    }
  }

  // Fallback: Supabase (Web mode)
  if (supabase) {
    try {
      let orderIds: string[] = []

      if (params.startIso && params.endIso) {
        const { data: orders } = await supabase
          .from('orders')
          .select('id')
          .in('status', ['closed', 'DELIVERED'])
          .gte('completed_at', params.startIso)
          .lte('completed_at', params.endIso + 'T23:59:59.999Z')
        orderIds = (orders || []).map(o => o.id)
      }

      // Get order items
      let itemsQuery = supabase.from('order_items').select('product_id, product_name, quantity')
      if (orderIds.length > 0) {
        itemsQuery = itemsQuery.in('order_id', orderIds)
      }

      const { data: items, error } = await itemsQuery

      if (error) {
        console.error('[REPORTS-DEBUG] topSellingItems Supabase error:', error)
        return []
      }

      // Aggregate by product
      const salesMap: Record<string, { name: string; qty: number }> = {}
      for (const item of (items || [])) {
        const pid = String(item.product_id || 'unknown')
        const qty = Number(item.quantity || 1)
        if (!salesMap[pid]) {
          salesMap[pid] = { name: item.product_name || 'Item', qty: 0 }
        }
        salesMap[pid].qty += qty
      }

      const result = Object.entries(salesMap)
        .map(([productId, data]) => ({ productId, name: data.name, qty: data.qty }))
        .sort((a, b) => b.qty - a.qty)
        .slice(0, limit)

      console.log('[REPORTS-DEBUG] topSellingItems Supabase result:', result.length, 'items')
      return result
    } catch (err) {
      console.error('[REPORTS-DEBUG] topSellingItems Supabase exception:', err)
    }
  }

  console.warn('[REPORTS-DEBUG] topSellingItems: No data source available')
  return []
}

export async function ticketsByStatus() {
  console.log('[REPORTS-DEBUG] ticketsByStatus called')

  // Try SQLite first (Electron mode)
  if (isElectron()) {
    try {
      const res = await query('SELECT status, COUNT(*) AS count FROM kds_tickets GROUP BY status', [])
      const rows = res?.rows ?? []
      const out: Record<string, number> = {}
      for (const r of rows) out[String(r.status)] = Number(r.count ?? 0)
      console.log('[REPORTS-DEBUG] ticketsByStatus SQLite result:', out)
      return out
    } catch (err) {
      console.warn('[REPORTS-DEBUG] ticketsByStatus SQLite error:', err)
    }
  }

  // Fallback: Supabase (Web mode)
  if (supabase) {
    try {
      const { data: tickets, error } = await supabase
        .from('kds_tickets')
        .select('status')

      if (error) {
        console.error('[REPORTS-DEBUG] ticketsByStatus Supabase error:', error)
        return {}
      }

      const out: Record<string, number> = {}
      for (const t of (tickets || [])) {
        const status = String(t.status || 'NEW')
        out[status] = (out[status] || 0) + 1
      }

      console.log('[REPORTS-DEBUG] ticketsByStatus Supabase result:', out)
      return out
    } catch (err) {
      console.error('[REPORTS-DEBUG] ticketsByStatus Supabase exception:', err)
    }
  }

  console.warn('[REPORTS-DEBUG] ticketsByStatus: No data source available')
  return {}
}
