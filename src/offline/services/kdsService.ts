import { db } from '@/offline/db/client'
import { kdsTickets, kdsPhaseTimes, kdsUnitStates, kitchenOperators, orders, ordersDetails, cashSessions, kdsSyncLogs } from '@/offline/db/schema'
import { eq, and, sql } from 'drizzle-orm'
import { supabase } from '@/utils/supabase'
import { supabaseSync } from '@/utils/supabaseSync'

type UUID = string

const uuid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`

const lanHubUrl: string | undefined = (() => {
  const envUrl = (import.meta as any)?.env?.VITE_LAN_HUB_URL
  if (envUrl) return envUrl
  const host = typeof window !== 'undefined' ? (window.location.hostname || 'localhost') : 'localhost'
  return `http://${host}:4000`
})()
const lanSecret: string | undefined = (import.meta as any)?.env?.VITE_LAN_SYNC_SECRET || undefined

let lastPushFailAt = 0
async function pushLanEvents(events: any[]) {
  if (!lanSecret) return
  const nowMs = Date.now()
  if (lastPushFailAt && nowMs - lastPushFailAt < 15000) return
  try {
    const unitDefault = 'default'
    const enriched = (Array.isArray(events) ? events : []).map((e: any) => ({ ...e, unit_id: e?.unit_id ?? unitDefault }))
    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${lanSecret}` }
    await fetch(`${lanHubUrl.replace(/\/$/, '')}/push`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ events: enriched }),
    })
  } catch {
    lastPushFailAt = nowMs
  }
}

export async function acknowledgeTicket(ticketId: string, orderId?: string) {
  const now = new Date().toISOString()
  
  // Log receipt if not already logged
  try {
    if (supabase) {
      const { data: ticket } = await supabaseSync.select('kds_tickets', (q) => 
        q.select('created_at, acknowledged_at').eq('id', ticketId).maybeSingle(),
        { silent: true }
      )
      
      if (ticket && !ticket.acknowledged_at) {
        const createdAt = new Date(ticket.created_at).getTime()
        const nowMs = Date.now()
        const latencyMs = nowMs - createdAt
        
        await supabaseSync.update('kds_tickets', 
          { acknowledged_at: now, updated_at: now }, 
          { id: ticketId }
        )
          
        await supabaseSync.insert('kds_sync_logs', {
          id: uuid(),
          ticket_id: ticketId,
          order_id: orderId || null,
          event_type: 'RECEIVED',
          latency_ms: latencyMs,
          created_at: now
        })
      }
    }
  } catch (err) {
    console.error('[KDS] Acknowledge error:', err)
  }

  // SQLite local update
  try {
    await db.update(kdsTickets)
      .set({ acknowledgedAt: now, updatedAt: now, pendingSync: 1 })
      .where(eq(kdsTickets.id, ticketId))
      .run()
  } catch { }
}

export async function logSyncDelay(ticketId: string, orderId: string, latencyMs: number) {
  const now = new Date().toISOString()
  if (supabase) {
    try {
      await supabaseSync.insert('kds_sync_logs', {
        id: uuid(),
        ticket_id: ticketId,
        order_id: orderId,
        event_type: 'SYNC_DELAY',
        latency_ms: latencyMs,
        created_at: now
      }, { silent: true })
    } catch { }
  }
}

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

export async function getPhaseTimes(orderId: string): Promise<any> {
  try {
    if (supabase) {
      const { data } = await supabaseSync.select('kds_phase_times', (q) => 
        q.select('*').eq('order_id', orderId).maybeSingle(),
        { silent: true }
      )
      if (data) {
        const row: any = data
        return {
          ...row,
          orderId: row.orderId ?? row.order_id ?? orderId,
          newStart: row.newStart ?? row.new_start ?? null,
          preparingStart: row.preparingStart ?? row.preparing_start ?? null,
          readyAt: row.readyAt ?? row.ready_at ?? null,
          deliveredAt: row.deliveredAt ?? row.delivered_at ?? null,
          updatedAt: row.updatedAt ?? row.updated_at ?? null,
        }
      }
    }
  } catch { /* ignore */ }
  
  try {
    const rows = await db.select().from(kdsPhaseTimes).where(eq(kdsPhaseTimes.orderId, orderId))
    return rows[0] || {}
  } catch { return {} }
}

export async function setPhaseTime(orderId: string, patch: any) {
  const now = new Date().toISOString()
  
  // 1. Try SQLite (Local DB)
  try {
    await db.insert(kdsPhaseTimes)
      .values({
        orderId,
        newStart: patch?.newStart ?? null,
        preparingStart: patch?.preparingStart ?? null,
        readyAt: patch?.readyAt ?? null,
        deliveredAt: patch?.deliveredAt ?? null,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: kdsPhaseTimes.orderId,
        set: {
          newStart: sql`COALESCE(new_start, excluded.new_start)`,
          preparingStart: sql`COALESCE(preparing_start, excluded.preparing_start)`,
          readyAt: sql`COALESCE(ready_at, excluded.ready_at)`,
          deliveredAt: sql`COALESCE(delivered_at, excluded.delivered_at)`,
          updatedAt: sql`excluded.updated_at`,
        }
      })
      .run()
  } catch (err) {
    console.error('[KDS] SQLite phase time error:', err)
  }

  // 2. Try Supabase (Web Mode)
  if (supabase) {
    try {
      const { data: existing } = await supabase
        .from('kds_phase_times')
        .select('id, new_start, preparing_start, ready_at, delivered_at')
        .eq('order_id', orderId)
        .maybeSingle()

      const payload: any = {
        order_id: orderId,
        updated_at: now
      }
      
      const ex: any = existing || {}
      if (patch?.newStart && !ex.new_start) payload.new_start = patch.newStart
      if (patch?.preparingStart && !ex.preparing_start) payload.preparing_start = patch.preparingStart
      if (patch?.readyAt && !ex.ready_at) payload.ready_at = patch.readyAt
      if (patch?.deliveredAt && !ex.delivered_at) payload.delivered_at = patch.deliveredAt

      if (existing?.id) {
        await supabase.from('kds_phase_times').update(payload).eq('id', existing.id)
      } else {
        await supabase.from('kds_phase_times').insert(payload)
      }
    } catch (err) {
      console.error('[KDS] Supabase phase time persistence error:', err)
    }
  }

  // 3. LAN Sync
  try { await pushLanEvents([{ table: 'kds_phase_times', row: { orderId, ...patch } }]) } catch { }
}

export async function persistUnitStateDb(orderId: string, itemId: string, unitId: string, patch: any) {
  const id = `${orderId}:${itemId}:${unitId}`
  const now = new Date().toISOString()
  const operatorName = patch?.operatorName ?? null
  const unitStatus = patch?.unitStatus ?? null
  const completedObservationsJson = Array.isArray(patch?.completedObservations)
    ? JSON.stringify(patch.completedObservations)
    : null
  const completedAt = patch?.completedAt ?? null
  const deliveredAt = patch?.deliveredAt ?? null
  
  try {
    await db.insert(kdsUnitStates)
      .values({
        id,
        orderId,
        orderItemId: itemId,
        productionUnitId: unitId,
        operatorName,
        unitStatus,
        completedObservationsJson,
        completedAt,
        deliveredAt,
        updatedAt: now,
        version: 1,
        pendingSync: 1,
      })
      .onConflictDoUpdate({
        target: kdsUnitStates.id,
        set: {
          operatorName: sql`COALESCE(excluded.operator_name, operator_name)`,
          unitStatus: sql`COALESCE(excluded.unit_status, unit_status)`,
          completedObservationsJson: sql`COALESCE(excluded.completed_observations_json, completed_observations_json)`,
          completedAt: sql`COALESCE(excluded.completed_at, completed_at)`,
          deliveredAt: sql`COALESCE(excluded.delivered_at, delivered_at)`,
          updatedAt: sql`excluded.updated_at`,
          pendingSync: 1,
        }
      })
      .run()
  } catch (err) {
    console.error('[KDS] SQLite unit state error:', err)
  }
    
  // Web Mode (Supabase)
  if (supabase) {
    try {
      const { data: ticket } = await supabase
        .from('kds_tickets')
        .select('id')
        .eq('order_id', orderId)
        .maybeSingle()
      
      const ticketId = ticket?.id ?? null

      let query = supabase.from('kds_unit_states').select('id')
      if (unitId) {
        query = query.eq('production_unit_id', unitId).eq('order_item_id', itemId)
      } else {
        query = query.eq('order_item_id', itemId)
        if (ticketId) query = query.eq('ticket_id', ticketId)
      }

      const { data: existingList } = await query.limit(1)
      const existing = existingList?.[0]

      let operatorId = null
      if (operatorName) {
        const { data: op } = await supabase
          .from('kitchen_operators')
          .select('id')
          .eq('name', operatorName)
          .maybeSingle()
        operatorId = op?.id
      }

      const payload: any = {
        order_item_id: itemId,
        status: unitStatus || 'PENDING',
        updated_at: now,
        version: 1,
        pending_sync: false,
        operator_name: operatorName,
        production_unit_id: unitId,
        order_id: orderId
      }
      
      if (ticketId) payload.ticket_id = ticketId
      if (operatorId) payload.operator_id = operatorId
      if (completedAt) payload.completed_at = completedAt
      
      if (existing?.id) {
        await supabase.from('kds_unit_states').update(payload).eq('id', existing.id)
      } else {
        await supabase.from('kds_unit_states').insert(payload)
      }
    } catch (err) {
      console.error('[KDS] Error persisting unit state to Supabase:', err)
    }
  }
}

export async function loadUnitStatesForOrder(orderId: string): Promise<Record<string, any>> {
  const map: Record<string, any> = {}
  try {
    const rows = await db.select().from(kdsUnitStates).where(eq(kdsUnitStates.orderId, orderId))
    for (const r of rows) {
      const itemId = r.orderItemId
      const unitId = r.productionUnitId
      const key = `${String(r.orderId)}:${String(itemId)}:${String(unitId)}`
      map[key] = {
        operatorName: r.operatorName ?? undefined,
        unitStatus: r.unitStatus ?? undefined,
        completedObservations: (() => { try { const arr = JSON.parse(String(r.completedObservationsJson ?? 'null')); return Array.isArray(arr) ? arr : [] } catch { return [] } })(),
        completedAt: r.completedAt ?? undefined,
      }
    }
    return map
  } catch {
    if (supabase) {
      const { data } = await supabaseSync.select('kds_unit_states', (q) =>
        q.select('*').eq('order_id', orderId),
        { silent: true }
      )
      const out: Record<string, any> = {}
      for (const r of (data || [])) {
        const unitId = r.production_unit_id || r.unit_id
        const key = `${String(r.order_id)}:${String(r.order_item_id || r.item_id)}:${String(unitId)}`
        out[key] = {
          operatorName: r.operator_name ?? undefined,
          unitStatus: r.status || r.unit_status || undefined,
          completedObservations: (() => { try { const arr = JSON.parse(String(r.completed_observations_json ?? 'null')); return Array.isArray(arr) ? arr : [] } catch { return [] } })(),
          completedAt: r.completed_at || r.updated_at || undefined,
        }
      }
      return out
    }
    return {}
  }
}

export async function applyHubEvents(events: any[]) {
  const arr = Array.isArray(events) ? events : []
  if (!arr.length) return
  const now = new Date().toISOString()
  for (const e of arr) {
    const table = String(e?.table || '')
    const row = e?.row || {}
    if (table === 'kdsTickets') {
      const id = String(row.id || '')
      if (!id) continue
      const orderId = row.order_id ?? row.orderId ?? null
      const unitId = row.unit_id ?? row.unitId ?? null
      const rawStatus = String(row.status ?? 'queued')
      const normalizedStatus = (() => {
        const up = rawStatus.toUpperCase()
        if (up === 'NEW') return 'queued'
        if (up === 'PREPARING') return 'prep'
        if (up === 'READY') return 'ready'
        if (up === 'DELIVERED') return 'done'
        const low = rawStatus.toLowerCase()
        if (low === 'queued' || low === 'prep' || low === 'ready' || low === 'done') return low
        return 'queued'
      })()
      const station = row.station ?? null
      const updatedAt = row.updated_at ?? row.updatedAt ?? now
      try {
        await db.insert(kdsTickets)
          .values({
            id,
            orderId,
            unitId,
            status: normalizedStatus as any,
            station,
            updatedAt,
            version: 1,
            pendingSync: 0,
          })
          .onConflictDoUpdate({
            target: kdsTickets.id,
            set: {
              orderId,
              unitId,
              status: normalizedStatus as any,
              station,
              updatedAt,
              pendingSync: 0,
            }
          })
          .run()
      } catch { }
    } else if (table === 'orders') {
      const id = String(row.id || '')
      if (!id) continue
      const incomingStatus = row.status ?? null
      const total = row.total_cents ?? row.totalCents ?? null
      const openedAt = row.opened_at ?? row.openedAt ?? null
      const deliveredAt = row.deliveredAt ?? row.delivered_at ?? null
      const closedAtRaw = row.closed_at ?? row.closedAt ?? null
      const deviceId = row.device_id ?? row.deviceId ?? null
      const unitId = row.unit_id ?? row.unitId ?? null
      const notes = row.notes ?? null
      const updatedAt = row.updated_at ?? row.updatedAt ?? now
      const statusStr = String(incomingStatus || '').toUpperCase()
      // Apenas atualizar status para fechamento (closed/cancelled), não para status intermediários
      const dbStatus = statusStr === 'DELIVERED' || statusStr === 'CLOSED' ? 'closed' : statusStr === 'CANCELLED' ? 'cancelled' : null
      const dbClosedAt = dbStatus === 'closed' || dbStatus === 'cancelled' ? (deliveredAt ?? closedAtRaw ?? updatedAt) : null
      
      try {
        if (dbStatus === 'closed' || dbStatus === 'cancelled') {
          await db.insert(orders)
            .values({
              id,
              status: dbStatus as any,
              totalCents: total,
              openedAt,
              closedAt: dbClosedAt,
              deviceId,
              unitId,
              notes,
              updatedAt,
              version: 1,
              pendingSync: 0,
            })
            .onConflictDoUpdate({
              target: orders.id,
              set: {
                status: dbStatus as any,
                closedAt: dbClosedAt,
                updatedAt,
                pendingSync: 0,
              }
            })
            .run()
        } else {
          await db.insert(orders)
            .values({
              id,
              status: (incomingStatus || 'open') as any,
              totalCents: total,
              openedAt,
              closedAt: closedAtRaw,
              deviceId,
              unitId,
              notes,
              updatedAt,
              version: 1,
              pendingSync: 0,
            })
            .onConflictDoUpdate({
              target: orders.id,
              set: {
                totalCents: sql`COALESCE(excluded.total_cents, orders.total_cents)`,
                notes: sql`COALESCE(excluded.notes, orders.notes)`,
                updatedAt,
                pendingSync: 0,
              }
            })
            .run()
        }

        const pin = row.pin ?? null
        const password = row.password ?? null
        if (pin || password) {
          await db.insert(ordersDetails)
            .values({
              orderId: id,
              pin,
              password,
              updatedAt,
            })
            .onConflictDoUpdate({
              target: ordersDetails.orderId,
              set: {
                pin: sql`COALESCE(excluded.pin, orders_details.pin)`,
                password: sql`COALESCE(excluded.password, orders_details.password)`,
                updatedAt,
              }
            })
            .run()
        }
      } catch { }
    } else if (table === 'cash_sessions') {
      const id = String(row.id || '')
      if (!id) continue
      const openedAt = row.opened_at ?? row.openedAt ?? null
      const closedAt = row.closed_at ?? row.closedAt ?? null
      const openedBy = row.opened_by ?? row.openedBy ?? null
      const closedBy = row.closed_by ?? row.closedBy ?? null
      const openingAmount = row.opening_amount_cents ?? row.openingAmountCents ?? null
      const closingAmount = row.closing_amount_cents ?? row.closingAmountCents ?? null
      const updatedAt = row.updated_at ?? row.updatedAt ?? now
      try {
        await db.insert(cashSessions)
          .values({
            id,
            openedAt,
            closedAt,
            openedBy,
            closedBy,
            openingAmountCents: openingAmount,
            closingAmountCents: closingAmount,
            updatedAt,
            version: 1,
            pendingSync: 0,
          })
          .onConflictDoUpdate({
            target: cashSessions.id,
            set: {
              openedAt: sql`COALESCE(excluded.opened_at, cash_sessions.opened_at)`,
              closedAt: sql`COALESCE(excluded.closed_at, cash_sessions.closed_at)`,
              openedBy: sql`COALESCE(excluded.opened_by, cash_sessions.opened_by)`,
              closedBy: sql`COALESCE(excluded.closed_by, cash_sessions.closed_by)`,
              openingAmountCents: sql`COALESCE(excluded.opening_amount_cents, cash_sessions.opening_amount_cents)`,
              closingAmountCents: sql`COALESCE(excluded.closing_amount_cents, cash_sessions.closing_amount_cents)`,
              updatedAt,
              pendingSync: 0,
            }
          })
          .run()
      } catch { }
    }
  }
}
