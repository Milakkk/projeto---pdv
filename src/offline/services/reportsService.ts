import { db } from '@/offline/db/client'
import { orders, orderItems, payments, products } from '@/offline/db/schema'
import { and, between, eq, sql } from 'drizzle-orm'

export async function revenueByPeriod(params: { startIso: string; endIso: string }) {
  // Soma pagamentos por método no período, considerando pedidos fechados
  const closed = await db.select({ id: orders.id }).from(orders).where(and(
    sql`datetime(${orders.closedAt}) >= datetime(${params.startIso})`,
    sql`datetime(${orders.closedAt}) <= datetime(${params.endIso})`,
    eq(orders.status, 'closed')
  ))
  const orderIds = closed.map((o) => o.id)
  if (!orderIds.length) return { totalCents: 0, byMethod: {} as Record<string, number> }
  const pays = await db.select().from(payments).where(sql`order_id IN (${sql.join(orderIds)})`)
  const byMethod: Record<string, number> = {}
  let total = 0
  for (const p of pays) {
    total += p.amountCents ?? 0
    const k = String(p.method)
    byMethod[k] = (byMethod[k] ?? 0) + (p.amountCents ?? 0)
  }
  return { totalCents: total, byMethod }
}

export async function topSellingItems(params: { startIso?: string; endIso?: string; limit?: number }) {
  // Top itens por quantidade vendida (opcionalmente por período, baseado em closedAt)
  let ids: string[] | null = null
  if (params.startIso && params.endIso) {
    const closed = await db.select({ id: orders.id }).from(orders).where(and(
      sql`datetime(${orders.closedAt}) >= datetime(${params.startIso})`,
      sql`datetime(${orders.closedAt}) <= datetime(${params.endIso})`,
      eq(orders.status, 'closed')
    ))
    ids = closed.map((o) => o.id)
  }

  const items = ids && ids.length
    ? await db.select().from(orderItems).where(sql`order_id IN (${sql.join(ids)})`)
    : await db.select().from(orderItems)

  const qtyByProduct: Record<string, number> = {}
  for (const it of items) {
    const pid = String(it.productId ?? 'unknown')
    qtyByProduct[pid] = (qtyByProduct[pid] ?? 0) + (it.qty ?? 0)
  }
  const entries = Object.entries(qtyByProduct)
    .sort((a, b) => b[1] - a[1])
    .slice(0, params.limit ?? 10)

  const result = [] as Array<{ productId: string; name: string | null; qty: number }>
  for (const [pid, qty] of entries) {
    const prod = (await db.select().from(products).where(eq(products.id, pid)))?.[0]
    result.push({ productId: pid, name: prod?.name ?? null, qty })
  }
  return result
}

export async function ticketsByStatus() {
  // Delegue para KDS: contagem será mais simples lá; aqui apenas placeholder
  // Caso precise, implemente SELECT COUNT(*) FROM kds_tickets GROUP BY status
  return {}
}

