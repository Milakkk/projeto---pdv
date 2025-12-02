import { db } from '@/offline/db/client'
import { ordersComplete, operationalSessions } from '@/offline/db/schema'
import { eq, sql, and } from 'drizzle-orm'
import { Order, OperationalSession } from '@/types'

type UUID = string

const uuid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`

// ====== PEDIDOS COMPLETOS ======

export async function listOrdersComplete(limit = 500) {
  if (!db) return []
  try {
    const rows = await db
      .select()
      .from(ordersComplete)
      .orderBy(sql`datetime(${ordersComplete.createdAt}) DESC`)
      .limit(limit)
    
    return (rows || []).map(row => {
      try {
        return JSON.parse(row.payload as string) as Order
      } catch {
        return null
      }
    }).filter((o): o is Order => o !== null)
  } catch {
    return []
  }
}

export async function getOrderCompleteById(id: string): Promise<Order | null> {
  if (!db) return null
  try {
    const row = (await db.select().from(ordersComplete).where(eq(ordersComplete.id, id)))?.[0]
    if (!row) return null
    return JSON.parse(row.payload as string) as Order
  } catch {
    return null
  }
}

export async function upsertOrderComplete(order: Order): Promise<string> {
  if (!db) return order.id
  
  const now = new Date().toISOString()
  const payload = JSON.stringify(order)
  
  try {
    const existing = (await db.select().from(ordersComplete).where(eq(ordersComplete.id, order.id)))?.[0]
    
    if (existing) {
      await db
        .update(ordersComplete)
        .set({
          payload,
          status: order.status,
          operationalSessionId: order.operationalSessionId ?? null,
          updatedAt: now,
          pendingSync: true,
        })
        .where(eq(ordersComplete.id, order.id))
        .run()
      return order.id
    }
    
    await db
      .insert(ordersComplete)
      .values({
        id: order.id,
        payload,
        status: order.status,
        operationalSessionId: order.operationalSessionId ?? null,
        createdAt: now,
        updatedAt: now,
        version: 1,
        pendingSync: true,
      })
      .run()
    return order.id
  } catch (err) {
    console.error('Erro ao salvar pedido completo:', err)
    return order.id
  }
}

export async function saveAllOrders(orders: Order[]): Promise<void> {
  if (!db) return
  
  for (const order of orders) {
    await upsertOrderComplete(order)
  }
}

export async function deleteOrderComplete(id: UUID): Promise<boolean> {
  if (!db) return false
  try {
    await db.delete(ordersComplete).where(eq(ordersComplete.id, id)).run()
    return true
  } catch {
    return false
  }
}

export async function getOrdersBySession(sessionId: string): Promise<Order[]> {
  if (!db) return []
  try {
    const rows = await db
      .select()
      .from(ordersComplete)
      .where(eq(ordersComplete.operationalSessionId, sessionId))
      .orderBy(sql`datetime(${ordersComplete.createdAt}) DESC`)
    
    return (rows || []).map(row => {
      try {
        return JSON.parse(row.payload as string) as Order
      } catch {
        return null
      }
    }).filter((o): o is Order => o !== null)
  } catch {
    return []
  }
}

export async function getOrdersByStatus(status: string): Promise<Order[]> {
  if (!db) return []
  try {
    const rows = await db
      .select()
      .from(ordersComplete)
      .where(eq(ordersComplete.status, status))
      .orderBy(sql`datetime(${ordersComplete.createdAt}) DESC`)
    
    return (rows || []).map(row => {
      try {
        return JSON.parse(row.payload as string) as Order
      } catch {
        return null
      }
    }).filter((o): o is Order => o !== null)
  } catch {
    return []
  }
}

// ====== SESSÕES OPERACIONAIS ======

export async function listOperationalSessions(limit = 100) {
  if (!db) return []
  try {
    const rows = await db
      .select()
      .from(operationalSessions)
      .orderBy(sql`datetime(${operationalSessions.openedAt}) DESC`)
      .limit(limit)
    
    return (rows || []).map(row => ({
      id: row.id,
      pin: row.pin,
      storeId: row.storeId ?? '',
      storeName: '', // Será preenchido pelo componente
      openedByUserId: row.openedByUserId ?? '',
      openedByUserName: '', // Será preenchido pelo componente
      openingTime: new Date(row.openedAt),
      closingTime: row.closedAt ? new Date(row.closedAt) : undefined,
      status: row.status === 'open' ? 'OPEN' : 'CLOSED',
    } as OperationalSession))
  } catch {
    return []
  }
}

export async function getCurrentOperationalSession(): Promise<OperationalSession | null> {
  if (!db) return null
  try {
    const rows = await db
      .select()
      .from(operationalSessions)
      .where(eq(operationalSessions.status, 'open'))
      .orderBy(sql`datetime(${operationalSessions.openedAt}) DESC`)
      .limit(1)
    
    const row = rows?.[0]
    if (!row) return null
    
    return {
      id: row.id,
      pin: row.pin,
      storeId: row.storeId ?? '',
      storeName: '',
      openedByUserId: row.openedByUserId ?? '',
      openedByUserName: '',
      openingTime: new Date(row.openedAt),
      closingTime: row.closedAt ? new Date(row.closedAt) : undefined,
      status: 'OPEN',
    } as OperationalSession
  } catch {
    return null
  }
}

export async function upsertOperationalSession(session: OperationalSession): Promise<string> {
  if (!db) return session.id
  
  const now = new Date().toISOString()
  
  try {
    const existing = (await db.select().from(operationalSessions).where(eq(operationalSessions.id, session.id)))?.[0]
    
    if (existing) {
      await db
        .update(operationalSessions)
        .set({
          pin: session.pin,
          storeId: session.storeId || null,
          openedByUserId: session.openedByUserId || null,
          closedAt: session.closingTime ? session.closingTime.toISOString() : null,
          status: session.status === 'OPEN' ? 'open' : 'closed',
          updatedAt: now,
          pendingSync: true,
        })
        .where(eq(operationalSessions.id, session.id))
        .run()
      return session.id
    }
    
    await db
      .insert(operationalSessions)
      .values({
        id: session.id,
        pin: session.pin,
        storeId: session.storeId || null,
        openedByUserId: session.openedByUserId || null,
        openedAt: session.openingTime.toISOString(),
        closedAt: session.closingTime ? session.closingTime.toISOString() : null,
        status: session.status === 'OPEN' ? 'open' : 'closed',
        updatedAt: now,
        version: 1,
        pendingSync: true,
      })
      .run()
    return session.id
  } catch (err) {
    console.error('Erro ao salvar sessão operacional:', err)
    return session.id
  }
}

export async function closeOperationalSession(sessionId: string): Promise<boolean> {
  if (!db) return false
  
  const now = new Date().toISOString()
  
  try {
    await db
      .update(operationalSessions)
      .set({
        closedAt: now,
        status: 'closed',
        updatedAt: now,
        pendingSync: true,
      })
      .where(eq(operationalSessions.id, sessionId))
      .run()
    return true
  } catch (err) {
    console.error('Erro ao fechar sessão operacional:', err)
    return false
  }
}

