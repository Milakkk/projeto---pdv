import { db } from '@/offline/db/client'
import { orders, orderItems, payments, kdsTickets, kdsPhaseTimes, ordersDetails } from '@/offline/db/schema'
import { sql, eq } from 'drizzle-orm'
import { supabase } from '@/utils/supabase'
import { supabaseSync } from '@/utils/supabaseSync'
import { getProductById } from './productsService'
import { setPhaseTime } from './kdsService'

type UUID = string

const uuid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`

async function getCurrentUnitId() {
  try {
    return localStorage.getItem('auth_store_id')
  } catch {
    return null
  }
}

async function setDeliveredPhaseTime(orderId: UUID, deliveredAtIso: string) {
  const now = new Date().toISOString()

  try {
    await db.insert(kdsPhaseTimes)
      .values({
        orderId,
        deliveredAt: deliveredAtIso,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: kdsPhaseTimes.orderId,
        set: {
          deliveredAt: sql`COALESCE(delivered_at, excluded.delivered_at)`,
          updatedAt: sql`excluded.updated_at`,
        }
      })
      .run()
  } catch {}

  if (supabase) {
    try {
      const { data: existing } = await supabaseSync.select('kds_phase_times', (q) =>
        q.select('id, delivered_at').eq('order_id', orderId).maybeSingle(),
        { silent: true }
      )

      const payload: any = { order_id: orderId, updated_at: now }
      if (!existing?.delivered_at) payload.delivered_at = deliveredAtIso
      if (existing?.id) {
        await supabaseSync.update('kds_phase_times', payload, { id: existing.id })
      } else {
        await supabaseSync.insert('kds_phase_times', { ...payload, delivered_at: deliveredAtIso })
      }
    } catch {}
  }
}

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
        const createdAtMs = data.created_at ? new Date(String(data.created_at)).getTime() : sentAtMs
        const updatedAtMs = data.updated_at ? new Date(String(data.updated_at)).getTime() : NaN
        const acked = data.created_at && data.updated_at && String(data.created_at) !== String(data.updated_at)
        const transferMs = Number.isFinite(updatedAtMs) ? Math.max(0, updatedAtMs - createdAtMs) : null
        if (acked) {
          try { console.log('[PDV->KDS] Confirmação de recebimento', { orderId: params.orderId, ticketId: params.ticketId, kitchenId: data.kitchen_id ?? params.kitchenId, status: data.status, transferMs }) } catch {}
        } else {
          try { console.warn('[PDV->KDS] Sem confirmação de recebimento (ainda)', { orderId: params.orderId, ticketId: params.ticketId, kitchenId: data.kitchen_id ?? params.kitchenId, status: data.status }) } catch {}
        }
      } catch {}
    }, 1500)
  } catch {}
}

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
  let persisted = false
  
  const rand = () => Math.max(1000, Math.floor(Math.random() * 9999))
  const pin = String(rand())
  const password = String(rand())

  if (supabase) {
    try {
      const { error } = await supabaseSync.insert('orders', {
        id,
        unit_id: unitId,
        status: 'NEW',
        total_cents: 0,
        observations: payload?.notes ?? null,
        created_at: payload?.openedAt ?? now,
        updated_at: now,
        pin,
        password,
        version: 1,
        pending_sync: false,
      })
      if (!error) persisted = true
    } catch (err) {
      console.warn('[ordersService] Falha ao criar pedido no Supabase:', err)
    }
  }

  await db.transaction(async (tx) => {
    await tx
      .insert(orders)
      .values({
        id,
        unitId: unitId ?? null,
        operationalSessionId: payload?.operationalSessionId ?? null,
        status: 'open',
        totalCents: 0,
        openedAt: payload?.openedAt ?? now,
        deviceId: payload?.deviceId ?? null,
        notes: payload?.notes ?? null,
        updatedAt: now,
        version: 1,
        pendingSync: persisted ? 0 : 1,
      })
      .run()

    await tx
      .insert(ordersDetails)
      .values({
        orderId: id,
        pin,
        password,
        updatedAt: now,
      })
      .run()
  })

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

  // Tenta Supabase primeiro se estiver online
  if (supabase) {
    try {
      const transferStart = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()
      
      // Busca categoria do produto para roteamento
      let categoryId = null
      if (params.productId) {
        const prod = await getProductById(params.productId)
        categoryId = prod?.categoryId
      }

      const { error: errItem } = await supabaseSync.insert('order_items', {
        id,
        order_id: params.orderId,
        product_id: params.productId,
        qty: params.qty,
        unit_price_cents: params.unitPriceCents,
        notes: params.notes ?? null,
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
        const current = Number(ordRow?.total_cents ?? 0)
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
        kitchenIds = (cats || []).map((r: any) => String(r.kitchen_id)).filter(Boolean)
      }
      const baseTicket = { order_id: params.orderId, status: 'NEW', updated_at: now, version: 1, pending_sync: false } as any
      const inserted: { ticketId: UUID; kitchenId: string | null }[] = []

      if (kitchenIds.length > 0) {
        const { data: existing } = await supabaseSync.select('kds_tickets', (q) =>
          q.select('id,kitchen_id').eq('order_id', params.orderId).in('kitchen_id', kitchenIds),
          { silent: true }
        )
        const existingSet = new Set((existing || []).map((r: any) => String(r.kitchen_id)))
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
        if ((existingNull || []).length === 0) {
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
      } catch {}

      try {
        for (const it of inserted) {
          scheduleTicketReceiptCheck({ orderId: params.orderId, ticketId: it.ticketId, kitchenId: it.kitchenId, sentAtIso: now })
        }
      } catch {}
      persisted = true
    } catch (err) {
      console.warn('[ordersService] Falha ao adicionar item no Supabase, tentando local:', err)
    }
  }

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
          pendingSync: persisted ? 0 : 1,
        })
        .run()

      const current = await tx.select({ total: orders.totalCents }).from(orders).where(eq(orders.id, params.orderId))
      const total = (current[0]?.total ?? 0) + subtotal
      await tx.update(orders).set({ totalCents: total, updatedAt: now, pendingSync: persisted ? 0 : 1 }).where(eq(orders.id, params.orderId)).run()

      // Local KDS Ticket fallback if not persisted to Supabase
      if (!persisted) {
        const unitId = await getCurrentUnitId()
        const ticketId = uuid()
        await tx.insert(kdsTickets)
          .values({
            id: ticketId,
            orderId: params.orderId,
            unitId: unitId ?? null,
            status: 'queued',
            updatedAt: now,
            version: 1,
            pendingSync: 1,
          })
          .onConflictDoNothing()
          .run()
      }
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
  }

  await db
    .update(orders)
    .set({ status: 'closed', closedAt: now, updatedAt: now, pendingSync: 1 })
    .where(eq(orders.id, orderId))
    .run()

  await setDeliveredPhaseTime(orderId, now)
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
  }

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
