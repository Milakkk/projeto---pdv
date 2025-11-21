import { db } from '@/offline/db/client'
import { kdsTickets } from '@/offline/db/schema'
import { eq } from 'drizzle-orm'

type UUID = string

const uuid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`

export async function enqueueTicket(params: { orderId: UUID; station?: string | null }) {
  const id = uuid()
  const now = new Date().toISOString()
  await db
    .insert(kdsTickets)
    .values({
      id,
      orderId: params.orderId,
      status: 'queued',
      station: params.station ?? null,
      updatedAt: now,
      version: 1,
      pendingSync: 1,
    })
    .run()
  return id
}

export async function setTicketStatus(id: UUID, status: 'queued' | 'prep' | 'ready' | 'done') {
  const now = new Date().toISOString()
  await db.update(kdsTickets).set({ status, updatedAt: now, pendingSync: 1 }).where(eq(kdsTickets.id, id)).run()
}

export async function listTicketsByStatus(status: 'queued' | 'prep' | 'ready' | 'done') {
  const rows = await db.select().from(kdsTickets).where(eq(kdsTickets.status, status))
  return Array.isArray(rows) ? rows : []
}

export async function listTicketsByStation(station: string) {
  const rows = await db.select().from(kdsTickets).where(eq(kdsTickets.station, station))
  return Array.isArray(rows) ? rows : []
}
