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

      const orderIds = (orders || []).map((o: any) => o.id)
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
        orderIds = (orders || []).map((o: any) => o.id)
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

// Função unificada para buscar pedidos COMPLETOS para o relatório
export async function getOrdersForReport(params: { startIso: string; endIso: string }) {
  console.log('[REPORTS-DEBUG] getOrdersForReport called', params)
  const endTimestamp = params.endIso.includes('T') ? params.endIso : (params.endIso + 'T23:59:59.999Z')

  // 1. Tentar SQLite (Desktop / Electron)
  if (isElectron()) {
    try {
      console.log('[REPORTS-DEBUG] Buscando pedidos no SQLite...')

      // Buscar Pedidos
      const ordersRes = await query(
        `SELECT 
          o.*, 
          od.pin, od.password, 
          kpt.new_start, kpt.preparing_start, kpt.ready_at, kpt.delivered_at 
         FROM orders o 
         LEFT JOIN orders_details od ON o.id = od.order_id 
         LEFT JOIN kds_phase_times kpt ON o.id = kpt.order_id 
         WHERE datetime(o.created_at) >= datetime(?) AND datetime(o.created_at) <= datetime(?)
         ORDER BY o.created_at DESC`,
        [params.startIso, endTimestamp]
      )

      const orders = ordersRes?.rows || []
      console.log(`[REPORTS-DEBUG] ${orders.length} pedidos encontrados no SQLite`)

      if (orders.length === 0) return []

      const orderIds = orders.map((o: any) => o.id)
      const placeholders = orderIds.map(() => '?').join(',')

      // Buscar Itens
      const itemsRes = await query(
        `SELECT oi.*, p.name as product_name, p.category_id, p.code as product_code, p.unit_delivery_count, p.skip_kitchen, p.sla_minutes 
         FROM order_items oi 
         LEFT JOIN products p ON oi.product_id = p.id 
         WHERE oi.order_id IN (${placeholders})`,
        orderIds
      )
      const allItems = itemsRes?.rows || []

      // Buscar Unidades de Produção (kds_unit_states)
      const unitsRes = await query(
        `SELECT * FROM kds_unit_states WHERE order_id IN (${placeholders})`,
        orderIds
      )
      const allUnits = unitsRes?.rows || []

      // Buscar Pagamentos
      const paymentsRes = await query(
        `SELECT * FROM payments WHERE order_id IN (${placeholders})`,
        orderIds
      )
      const allPayments = paymentsRes?.rows || []

      // Montar Objetos Completos
      const result = orders.map((o: any) => {
        const orderItems = allItems
          .filter((i: any) => i.order_id === o.id)
          .map((i: any) => {
            // Anexar unidades de produção ao item correspondente
            const itemUnits = allUnits.filter((u: any) => u.order_item_id === i.id);
            return {
              ...i,
              production_units: itemUnits
            }
          });

        const orderPayments = allPayments.filter((p: any) => p.order_id === o.id)

        // Mapear para o formato Order esperado pelo frontend
        return mapToOrderInterface({
          ...o,
          items: orderItems,
          payments: orderPayments
        })
      })

      return result

    } catch (err) {
      console.warn('[REPORTS-DEBUG] getOrdersForReport SQLite error:', err)
      // Fallback para Supabase se falhar o SQLite
    }
  }

  // 2. Fallback: Supabase (Web)
  if (supabase) {
    try {
      console.log('[REPORTS-DEBUG] Buscando pedidos no Supabase...')

      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          kds_phase_times (*),
          order_items (
            *,
            products (name, category_id, code, unit_delivery_count, skip_kitchen, sla_minutes),
            kds_unit_states (*)
          ),
          payments (*)
        `)
        .gte('created_at', params.startIso)
        .lte('created_at', endTimestamp)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('[REPORTS-DEBUG] getOrdersForReport Supabase error:', error)
        return []
      }

      console.log(`[REPORTS-DEBUG] ${data?.length || 0} pedidos encontrados no Supabase`)

      return (data || []).map((o: any) => mapToOrderInterface(o))

    } catch (err) {
      console.error('[REPORTS-DEBUG] getOrdersForReport Supabase exception:', err)
    }
  }

  return []
}

// Função Helper para normalizar dados para a interface Order
function mapToOrderInterface(data: any): any {
  // Ajustes de campos do Supabase/SQLite para o CamelCase do frontend

  // 1. Extrair detalhes (pin, password)
  const details = Array.isArray(data.orders_details) ? data.orders_details[0] : (data.orders_details || {})
  const pin = details.pin || data.pin || data.id.substring(0, 4)
  const password = details.password || data.password || ''

  // 2. Extrair tempos das fases
  const phaseTimes = Array.isArray(data.kds_phase_times) ? data.kds_phase_times[0] : (data.kds_phase_times || {})
  // Fallback: se não tiver na tabela kds_phase_times, tenta pegar da tabela orders (legado) ou do próprio objeto se veio do SQLite flat
  const newStart = phaseTimes.new_start || data.new_start || data.created_at
  const preparingStart = phaseTimes.preparing_start || data.preparing_start || data.preparing_started_at
  const readyAt = phaseTimes.ready_at || data.ready_at
  const deliveredAt = phaseTimes.delivered_at || data.delivered_at || data.completed_at || data.closed_at

  // 3. Processar Itens
  // No Supabase vem como 'order_items', no SQLite query manual montamos 'items' ou filtramos fora
  const rawItems = data.order_items || data.items || []
  const items = rawItems.map((item: any) => {
    // Resolver produto (Supabase aninha em 'products', SQLite join traz colunas 'product_name' etc)
    const product = Array.isArray(item.products) ? item.products[0] : (item.products || {})

    // Fallback para campos flat do SQLite
    const productName = product.name || item.product_name || item.name || 'Item sem nome'
    const categoryId = product.category_id || item.category_id
    const productCode = product.code || item.product_code
    const skipKitchen = product.skip_kitchen ?? item.skip_kitchen ?? false
    const unitDeliveryCount = product.unit_delivery_count ?? item.unit_delivery_count ?? 1
    const sla = product.sla_minutes ?? item.sla_minutes ?? 0

    return {
      id: item.id,
      quantity: Number(item.qty ?? item.quantity ?? 1),
      unitPrice: Number(item.unit_price_cents ?? item.unitPriceCents ?? 0) / 100,
      observations: item.notes || item.observations || '',
      menuItem: {
        id: item.product_id || 'unknown',
        name: productName,
        categoryId: categoryId,
        code: productCode,
        skipKitchen,
        unitDeliveryCount,
        sla
      },
      productionUnits: item.production_units || item.kds_unit_states || [], // Unidades de produção
      skipKitchen,
      directDeliveredUnitCount: item.direct_delivered_unit_count || 0
    }
  })

  // 4. Processar Pagamentos e Totais
  const rawPayments = data.payments || []
  const payments = rawPayments.map((p: any) => ({
    method: p.method,
    amount: Number(p.amount_cents ?? 0) / 100
  }))

  const paidAmount = payments.reduce((sum: number, p: any) => sum + p.amount, 0)
  const totalAmount = Number(data.total_cents ?? 0) / 100

  // Identificar método principal ou MÚLTIPLO
  let paymentMethod = 'Não informado'
  let paymentBreakdown: any = undefined

  if (payments.length === 1) {
    paymentMethod = String(payments[0].method).toUpperCase()
  } else if (payments.length > 1) {
    paymentMethod = 'MÚLTIPLO'
    paymentBreakdown = {}
    payments.forEach((p: any) => {
      const method = String(p.method).toUpperCase()
      paymentBreakdown[method] = (paymentBreakdown[method] || 0) + p.amount
    })
  }

  return {
    id: data.id,
    pin: String(pin),
    password: String(password),
    status: (data.status || 'NEW').toUpperCase(),
    total: totalAmount > 0 ? totalAmount : paidAmount, // Fallback se total_cents vier 0
    items: items,
    paymentMethod,
    paymentBreakdown,
    amountPaid: paidAmount, // Total pago
    changeAmount: 0, // Calcular troco se necessário na UI
    createdAt: new Date(newStart || new Date()), // Use new_start as creation time base
    preparingStartedAt: preparingStart ? new Date(preparingStart) : undefined,
    readyAt: readyAt ? new Date(readyAt) : undefined,
    deliveredAt: deliveredAt ? new Date(deliveredAt) : undefined,
    updatedAt: data.updated_at ? new Date(data.updated_at) : undefined,
    customerWhatsApp: data.customer_phone || '',
    customerName: data.customer_name || '',
    slaMinutes: Number(data.sla_minutes || 15)
  }
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
