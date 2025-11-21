import { db } from '@/offline/db/client'
import { cashSessions, cashMovements } from '@/offline/db/schema'
import { eq, isNull, sql } from 'drizzle-orm'

type UUID = string

const uuid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`

export async function openSession(params: { openedBy?: string | null; openingAmountCents?: number }) {
  const id = uuid()
  const now = new Date().toISOString()
  await db
    .insert(cashSessions)
    .values({
      id,
      openedAt: now,
      openedBy: params.openedBy ?? null,
      openingAmountCents: Math.max(0, Math.round(params.openingAmountCents ?? 0)),
      updatedAt: now,
      version: 1,
      pendingSync: 1,
    })
    .run()
  return id
}

export async function closeSession(id: UUID, params?: { closedBy?: string | null; closingAmountCents?: number }) {
  const now = new Date().toISOString()
  await db
    .update(cashSessions)
    .set({
      closedAt: now,
      closedBy: params?.closedBy ?? null,
      closingAmountCents: Math.max(0, Math.round(params?.closingAmountCents ?? 0)),
      updatedAt: now,
      pendingSync: 1,
    })
    .where(eq(cashSessions.id, id))
    .run()
}

export async function addMovement(params: {
  sessionId: UUID
  type: 'in' | 'out'
  reason?: string | null
  amountCents: number
}) {
  const id = uuid()
  const now = new Date().toISOString()
  await db
    .insert(cashMovements)
    .values({
      id,
      sessionId: params.sessionId,
      type: params.type,
      reason: params.reason ?? null,
      amountCents: Math.max(0, Math.round(params.amountCents ?? 0)),
      createdAt: now,
      updatedAt: now,
      version: 1,
      pendingSync: 1,
    })
    .run()
  return id
}

export async function getCurrentSession() {
  const rows = await db
    .select()
    .from(cashSessions)
    .where(isNull(cashSessions.closedAt))
    .orderBy(sql`datetime(${cashSessions.openedAt}) DESC`)
  return rows[0] ?? null
}

export async function listSessions(limit = 50) {
  const rows = await db.select().from(cashSessions).orderBy(sql`datetime(${cashSessions.openedAt}) DESC`)
  return rows.slice(0, limit)
}

export async function listMovementsBySession(sessionId: UUID) {
  return db.select().from(cashMovements).where(eq(cashMovements.sessionId, sessionId))
}

