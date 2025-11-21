// Renderer: usar IPC seguro exposto pelo preload
const query = async (sql: string, params?: any[]) => {
  // @ts-expect-error preload inject
  return (window?.api?.db?.query?.(sql, params)) as Promise<{ rows?: any[]; meta?: any; error?: any }>
}

export async function revenueByPeriod(params: { startIso: string; endIso: string }) {
  // Soma pagamentos por método no período, considerando pedidos fechados
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
  return { totalCents: total, byMethod }
}

export async function topSellingItems(params: { startIso?: string; endIso?: string; limit?: number }) {
  // Top itens por quantidade vendida (opcionalmente por período, baseado em closedAt)
  const limit = params.limit ?? 10
  if (params.startIso && params.endIso) {
    const res = await query(
      'SELECT oi.product_id AS productId, COALESCE(p.name, NULL) AS name, SUM(oi.qty) AS qty FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id WHERE oi.order_id IN (SELECT id FROM orders WHERE status = ? AND datetime(closed_at) >= datetime(?) AND datetime(closed_at) <= datetime(?)) GROUP BY oi.product_id, p.name ORDER BY qty DESC LIMIT ?',
      ['closed', params.startIso, params.endIso, limit],
    )
    return (res?.rows ?? []).map((r: any) => ({ productId: String(r.productId), name: r.name ?? null, qty: Number(r.qty ?? 0) }))
  } else {
    const res = await query(
      'SELECT oi.product_id AS productId, COALESCE(p.name, NULL) AS name, SUM(oi.qty) AS qty FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id GROUP BY oi.product_id, p.name ORDER BY qty DESC LIMIT ?',
      [limit],
    )
    return (res?.rows ?? []).map((r: any) => ({ productId: String(r.productId), name: r.name ?? null, qty: Number(r.qty ?? 0) }))
  }
}

export async function ticketsByStatus() {
  const res = await query('SELECT status, COUNT(*) AS count FROM kds_tickets GROUP BY status', [])
  const rows = res?.rows ?? []
  const out: Record<string, number> = {}
  for (const r of rows) out[String(r.status)] = Number(r.count ?? 0)
  return out
}
