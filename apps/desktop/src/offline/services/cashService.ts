import { supabase } from '../../utils/supabase'
import { getCurrentUnitId } from './deviceProfileService'
import { uuid } from '../../utils/uuid'

// Renderer: usar IPC seguro exposto pelo preload
const query = async (sql: string, params?: any[]) => {
  const fn = (window as any)?.api?.db?.query
  if (typeof fn !== 'function') throw new Error('Canal de DB indisponível')
  try {
    const res = await fn(sql, params)
    if (res?.error) throw new Error(String(res.error))
    return res as { rows?: any[]; meta?: any; error?: any }
  } catch (e) {
    await new Promise(r => setTimeout(r, 200))
    const res2 = await fn(sql, params)
    if (res2?.error) throw new Error(String(res2.error))
    return res2 as { rows?: any[]; meta?: any; error?: any }
  }
}

type UUID = string

// local uuid removed, now using shared utility

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

export async function openSession(params: { openedBy?: string | null; openingAmountCents?: number }) {
  const id = uuid()
  const now = new Date().toISOString()

  // Identifica Estação
  const stationId = localStorage.getItem('currentStationId')
  let operatorName = params.openedBy ?? null

  if (stationId) {
    try {
      const unitId = await getCurrentUnitId()
      if (unitId) {
        const raw = localStorage.getItem(`stations_${unitId}`)
        if (raw) {
          const stations = JSON.parse(raw)
          const st = stations.find((s: any) => String(s.id) === String(stationId))
          if (st) operatorName = `${operatorName || 'Operador'} (${st.name})`
        }
      }
    } catch { }
    // Adiciona ID para filtro futuro (apenas se já não tiver sido formatado antes)
    if (!operatorName?.includes(`[${stationId}]`)) {
      operatorName = `${operatorName || 'Operador'} [${stationId}]`
    }
  }

  if (supabase) {
    try {
      const { error } = await supabase.from('cash_sessions').insert({
        id,
        opened_at: now,
        operator_name: operatorName,
        initial_amount_cents: Math.max(0, Math.round(params.openingAmountCents ?? 0)),
        updated_at: now,
        version: 1,
        pending_sync: false
      })
      if (error) throw error

      const session = {
        id,
        opened_at: now,
        opened_by: operatorName,
        opening_amount_cents: Math.max(0, Math.round(params.openingAmountCents ?? 0)),
        updated_at: now,
        version: 1,
        pending_sync: 0,
        status: 'OPEN'
      }
      localStorage.setItem('currentCashSession', JSON.stringify(session))
    } catch (e) {
      console.warn('[cashService] Falha ao abrir sessão no Supabase, tentando local:', e)
      await openSessionLocal(id, now, { ...params, openedBy: operatorName })
    }
  } else {
    await openSessionLocal(id, now, { ...params, openedBy: operatorName })
  }
  return id
}

async function openSessionLocal(id: string, now: string, params: { openedBy?: string | null; openingAmountCents?: number }) {
  try {
    await query(
      'INSERT INTO cash_sessions (id, opened_at, opened_by, opening_amount_cents, updated_at, version, pending_sync) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        id,
        now,
        params.openedBy ?? null,
        Math.max(0, Math.round(params.openingAmountCents ?? 0)),
        now,
        1,
        1,
      ],
    )
    saveLocalStorageSession(id, now, params)
    await pushLanEvents([{ table: 'cash_sessions', row: { id, opened_at: now, opened_by: params.openedBy, opening_amount_cents: params.openingAmountCents } }])
  } catch (e) {
    saveLocalStorageSession(id, now, params)
  }
}

function saveLocalStorageSession(id: string, now: string, params: any) {
  try {
    const fallback = {
      id,
      opened_at: now,
      opened_by: params.openedBy ?? null,
      opening_amount_cents: Math.max(0, Math.round(params.openingAmountCents ?? 0)),
      updated_at: now,
      version: 1,
      pending_sync: 1,
      status: 'OPEN'
    }
    const sessions = JSON.parse(localStorage.getItem('cashSessions') || '[]')
    localStorage.setItem('cashSessions', JSON.stringify([fallback, ...sessions.filter((s: any) => s.id !== id)]))
    localStorage.setItem('currentCashSession', JSON.stringify(fallback))
  } catch { }
}

export async function closeSession(id: UUID, params?: { closedBy?: string | null; closingAmountCents?: number }) {
  const now = new Date().toISOString()

  if (supabase) {
    try {
      const { error } = await supabase.from('cash_sessions').update({
        closed_at: now,
        // closed_by não existe no schema
        final_amount_cents: Math.max(0, Math.round(params?.closingAmountCents ?? 0)),
        updated_at: now,
        pending_sync: false
      }).eq('id', id)
      if (error) throw error

      localStorage.removeItem('currentCashSession')
    } catch (e) {
      console.warn('[cashService] Falha ao fechar sessão no Supabase, tentando local:', e)
      await closeSessionLocal(id, now, params)
    }
  } else {
    await closeSessionLocal(id, now, params)
  }
}

async function closeSessionLocal(id: string, now: string, params?: { closedBy?: string | null; closingAmountCents?: number }) {
  try {
    await query(
      'UPDATE cash_sessions SET closed_at = ?, closed_by = ?, closing_amount_cents = ?, updated_at = ?, pending_sync = 1 WHERE id = ?',
      [now, params?.closedBy ?? null, Math.max(0, Math.round(params?.closingAmountCents ?? 0)), now, id],
    )
    updateLocalStorageClosure(id, now, params)
  } catch (e) {
    updateLocalStorageClosure(id, now, params)
  }
}

function updateLocalStorageClosure(id: string, now: string, params: any) {
  try {
    const raw = localStorage.getItem('currentCashSession')
    const cur = raw ? JSON.parse(raw) : null
    if (cur && cur.id === id) {
      cur.closed_at = now
      cur.closed_by = params?.closedBy ?? null
      cur.closing_amount_cents = Math.max(0, Math.round(params?.closingAmountCents ?? 0))
      cur.updated_at = now
      cur.status = 'CLOSED'
      localStorage.setItem('currentCashSession', JSON.stringify(cur)) // Mantém mas como fechado ou remove? Melhor remover ou marcar
      const sessions = JSON.parse(localStorage.getItem('cashSessions') || '[]')
      localStorage.setItem('cashSessions', JSON.stringify([cur, ...sessions.filter((s: any) => s.id !== id)]))
    }
  } catch { }
}

export async function addMovement(params: {
  sessionId: UUID
  type: 'in' | 'out'
  reason?: string | null
  amountCents: number
}) {
  const id = uuid()
  const now = new Date().toISOString()

  if (supabase) {
    try {
      const { error } = await supabase.from('cash_movements').insert({
        id,
        session_id: params.sessionId,
        type: params.type,
        amount_cents: Math.max(0, Math.round(params.amountCents)),
        description: params.reason ?? null,
        created_at: now
      })
      if (error) throw error
    } catch (e) {
      console.warn('[cashService] Falha ao adicionar movimento no Supabase, tentando local:', e)
      await addMovementLocal(id, now, params)
    }
  } else {
    await addMovementLocal(id, now, params)
  }
  return id
}

async function addMovementLocal(id: string, now: string, params: any) {
  try {
    await query(
      'INSERT INTO cash_movements (id, session_id, type, amount_cents, reason, created_at, pending_sync) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        id,
        params.sessionId,
        params.type,
        Math.max(0, Math.round(params.amountCents)),
        params.reason ?? null,
        now,
        1,
      ],
    )
    const mov = {
      id,
      session_id: params.sessionId,
      type: params.type,
      amount_cents: Math.max(0, Math.round(params.amountCents)),
      reason: params.reason ?? null,
      created_at: now,
      pending_sync: 1,
    }
    const movs = JSON.parse(localStorage.getItem('cashMovements') || '[]')
    movs.push(mov)
    localStorage.setItem('cashMovements', JSON.stringify(movs))
  } catch { }
}

export async function getCurrentSession() {
  if (supabase) {
    try {
      let query = supabase
        .from('cash_sessions')
        .select('*')
        .is('closed_at', null)
        .order('opened_at', { ascending: false })

      const stationId = localStorage.getItem('currentStationId')
      if (stationId) {
        query = query.ilike('operator_name', `%[${stationId}]%`)
      }

      const { data, error } = await query
        .limit(1)
        .maybeSingle()

      if (data) {
        const session = {
          ...data,
          opening_amount_cents: data.initial_amount_cents,
          opened_by: data.operator_name,
          status: 'OPEN'
        }
        localStorage.setItem('currentCashSession', JSON.stringify(session))
        return session
      }
    } catch (e) {
      console.warn('[cashService] Erro ao buscar sessão no Supabase:', e)
    }
  }
  // Fallback Local
  try {
    const raw = localStorage.getItem('currentCashSession')
    const cur = raw ? JSON.parse(raw) : null
    if (cur && !cur.closed_at) return cur
  } catch { }
  return null
}

export async function listSessions(limit = 50) {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('cash_sessions')
        .select('*')
        .order('opened_at', { ascending: false })
        .limit(limit)

      if (error) throw error

      // Cache no localStorage e mapeamento
      if (data) {
        const mapped = data.map((d: any) => ({
          ...d,
          opening_amount_cents: d.initial_amount_cents,
          closing_amount_cents: d.final_amount_cents,
          opened_by: d.operator_name
        }))
        localStorage.setItem('cashSessions', JSON.stringify(mapped))
        return mapped
      }
    } catch (e) {
      console.warn('[cashService] Erro ao listar sessões no Supabase, tentando local:', e)
    }
  }

  try {
    const res = await query('SELECT * FROM cash_sessions ORDER BY datetime(opened_at) DESC LIMIT ?', [limit])
    const rows = res?.rows ?? []
    if (rows.length > 0) return rows
    try {
      const raw = localStorage.getItem('cashSessions')
      const arr = raw ? JSON.parse(raw) : []
      return Array.isArray(arr) ? arr.slice(0, limit) : []
    } catch { return [] }
  } catch {
    try {
      const raw = localStorage.getItem('cashSessions')
      const arr = raw ? JSON.parse(raw) : []
      return Array.isArray(arr) ? arr.slice(0, limit) : []
    } catch { return [] }
  }
}

export async function listMovementsBySession(sessionId: UUID) {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('cash_movements')
        .select('*')
        .eq('session_id', sessionId)

      if (error) throw error

      if (data) {
        const mapped = data.map((d: any) => ({
          ...d,
          reason: d.description
        }))
        return mapped
      }
    } catch (e) {
      console.warn('[cashService] Erro ao listar movimentos no Supabase, tentando local:', e)
    }
  }

  try {
    const res = await query('SELECT * FROM cash_movements WHERE session_id = ?', [sessionId])
    const rows = res?.rows ?? []
    if (rows.length > 0) return rows
    try {
      const raw = localStorage.getItem('cashMovements')
      const arr = raw ? JSON.parse(raw) : []
      return Array.isArray(arr) ? arr.filter((m: any) => String(m.session_id) === String(sessionId)) : []
    } catch { return [] }
  } catch {
    try {
      const raw = localStorage.getItem('cashMovements')
      const arr = raw ? JSON.parse(raw) : []
      return Array.isArray(arr) ? arr.filter((m: any) => String(m.session_id) === String(sessionId)) : []
    } catch { return [] }
  }
}
