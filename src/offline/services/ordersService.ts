import { db } from '@/offline/db/client'
import { orders, orderItems, payments } from '@/offline/db/schema'
import { sql, eq } from 'drizzle-orm'

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
  await db
    .insert(orders)
    .values({
      id,
      status: 'open',
      totalCents: 0,
      openedAt: payload?.openedAt ?? now,
      deviceId: payload?.deviceId ?? null,
      notes: payload?.notes ?? null,
      updatedAt: now,
      version: 1,
      pendingSync: 1,
    })
    .run()
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

  await db
    .transaction(async (tx) => {
      await tx
        .insert(orderItems)
        .values({
          id,
          orderId: params.orderId,
          productId: params.productId,
          qty: params.qty,
          unitPriceCents: params.unitPriceCents,
          notes: params.notes ?? null,
          updatedAt: now,
          version: 1,
          pendingSync: 1,
        })
        .run()

      const current = await tx.select({ total: orders.totalCents }).from(orders).where(eq(orders.id, params.orderId))
      const total = (current[0]?.total ?? 0) + subtotal
      await tx.update(orders).set({ totalCents: total, updatedAt: now, pendingSync: 1 }).where(eq(orders.id, params.orderId)).run()
    })

  return id
}

export async function removeItem(itemId: UUID) {
  const now = new Date().toISOString()
  const items = await db.select().from(orderItems).where(eq(orderItems.id, itemId))
  const it = items[0]
  if (!it) return false

  const subtotal = Math.max(0, Math.round((it.qty ?? 1) * (it.unitPriceCents ?? 0)))

  await db.transaction(async (tx) => {
    await tx.delete(orderItems).where(eq(orderItems.id, itemId)).run()
    const current = await tx.select({ total: orders.totalCents }).from(orders).where(eq(orders.id, it.orderId))
    const total = Math.max(0, (current[0]?.total ?? 0) - subtotal)
    await tx.update(orders).set({ totalCents: total, updatedAt: now, pendingSync: 1 }).where(eq(orders.id, it.orderId)).run()
  })
  return true
}

export async function addPayment(params: {
  orderId: UUID
  method: 'cash' | 'pix' | 'debit' | 'credit' | 'voucher'
  amountCents: number
  changeCents?: number
  authCode?: string | null
}) {
  const id = uuid()
  const now = new Date().toISOString()
  await db
    .insert(payments)
    .values({
      id,
      orderId: params.orderId,
      method: params.method,
      amountCents: Math.max(0, Math.round(params.amountCents ?? 0)),
      changeCents: Math.max(0, Math.round(params.changeCents ?? 0)),
      authCode: params.authCode ?? null,
      updatedAt: now,
      version: 1,
      pendingSync: 1,
    })
    .run()
  return id
}

export async function closeOrder(orderId: UUID) {
  const now = new Date().toISOString()
  await db
    .update(orders)
    .set({ status: 'closed', closedAt: now, updatedAt: now, pendingSync: 1 })
    .where(eq(orders.id, orderId))
    .run()
}

export async function cancelOrder(orderId: UUID) {
  const now = new Date().toISOString()
  await db
    .update(orders)
    .set({ status: 'cancelled', closedAt: now, updatedAt: now, pendingSync: 1 })
    .where(eq(orders.id, orderId))
    .run()
}

export async function listOrders(limit = 100) {
  const rows = await db
    .select()
    .from(orders)
    .orderBy(sql`datetime(${orders.updatedAt}) DESC`)
    .run?.() // compat: some drizzle versions don't need run()
  return Array.isArray(rows) ? rows.slice(0, limit) : []
}

export async function getOrderById(id: UUID) {
  const ord = (await db.select().from(orders).where(eq(orders.id, id)))?.[0]
  if (!ord) return null
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, id))
  const pays = await db.select().from(payments).where(eq(payments.orderId, id))
  return { order: ord, items, payments: pays }
}
