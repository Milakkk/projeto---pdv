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

const uuid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`

export async function openSession(params: { openedBy?: string | null; openingAmountCents?: number }) {
  const id = uuid()
  const now = new Date().toISOString()
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
    try {
      const fallback = {
        id,
        opened_at: now,
        opened_by: params.openedBy ?? null,
        opening_amount_cents: Math.max(0, Math.round(params.openingAmountCents ?? 0)),
        updated_at: now,
        version: 1,
        pending_sync: 1,
      }
      const sessions = JSON.parse(localStorage.getItem('cashSessions') || '[]')
      localStorage.setItem('cashSessions', JSON.stringify([fallback, ...sessions.filter((s:any)=>s.id!==id)]))
      localStorage.setItem('currentCashSession', JSON.stringify(fallback))
    } catch {}
  } catch (e) {
    const fallback = {
      id,
      opened_at: now,
      opened_by: params.openedBy ?? null,
      opening_amount_cents: Math.max(0, Math.round(params.openingAmountCents ?? 0)),
      updated_at: now,
      version: 1,
      pending_sync: 1,
    }
    try {
      const sessions = JSON.parse(localStorage.getItem('cashSessions') || '[]')
      sessions.unshift(fallback)
      localStorage.setItem('cashSessions', JSON.stringify(sessions))
      localStorage.setItem('currentCashSession', JSON.stringify(fallback))
    } catch {}
  }
  return id
}

export async function closeSession(id: UUID, params?: { closedBy?: string | null; closingAmountCents?: number }) {
  const now = new Date().toISOString()
  try {
    await query(
      'UPDATE cash_sessions SET closed_at = ?, closed_by = ?, closing_amount_cents = ?, updated_at = ?, pending_sync = 1 WHERE id = ?',
      [now, params?.closedBy ?? null, Math.max(0, Math.round(params?.closingAmountCents ?? 0)), now, id],
    )
    try {
      const raw = localStorage.getItem('currentCashSession')
      const cur = raw ? JSON.parse(raw) : null
      const updated = cur && cur.id === id ? {
        ...cur,
        closed_at: now,
        closed_by: params?.closedBy ?? null,
        closing_amount_cents: Math.max(0, Math.round(params?.closingAmountCents ?? 0)),
        updated_at: now,
      } : null
      if (updated) {
        localStorage.setItem('currentCashSession', JSON.stringify(updated))
        const sessions = JSON.parse(localStorage.getItem('cashSessions') || '[]')
        localStorage.setItem('cashSessions', JSON.stringify([updated, ...sessions.filter((s:any)=>s.id!==id)]))
      }
    } catch {}
  } catch (e) {
    try {
      const raw = localStorage.getItem('currentCashSession')
      const cur = raw ? JSON.parse(raw) : null
      if (cur && cur.id === id) {
        cur.closed_at = now
        cur.closed_by = params?.closedBy ?? null
        cur.closing_amount_cents = Math.max(0, Math.round(params?.closingAmountCents ?? 0))
        cur.updated_at = now
        localStorage.setItem('currentCashSession', JSON.stringify(cur))
        const sessions = JSON.parse(localStorage.getItem('cashSessions') || '[]')
        localStorage.setItem('cashSessions', JSON.stringify([cur, ...sessions.filter((s:any)=>s.id!==id)]))
      }
    } catch {}
  }
}

export async function addMovement(params: {
  sessionId: UUID
  type: 'in' | 'out'
  reason?: string | null
  amountCents: number
}) {
  const id = uuid()
  const now = new Date().toISOString()
  try {
    await query(
      'INSERT INTO cash_movements (id, session_id, type, reason, amount_cents, created_at, updated_at, version, pending_sync) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        id,
        params.sessionId,
        params.type,
        params.reason ?? null,
        Math.max(0, Math.round(params.amountCents ?? 0)),
        now,
        now,
        1,
        1,
      ],
    )
  } catch (e) {
    try {
      const mov = {
        id,
        session_id: params.sessionId,
        type: params.type,
        reason: params.reason ?? null,
        amount_cents: Math.max(0, Math.round(params.amountCents ?? 0)),
        created_at: now,
        updated_at: now,
        version: 1,
        pending_sync: 1,
      }
      const movs = JSON.parse(localStorage.getItem('cashMovements') || '[]')
      movs.push(mov)
      localStorage.setItem('cashMovements', JSON.stringify(movs))
    } catch {}
  }
  return id
}

export async function getCurrentSession() {
  try {
    const res = await query(
      'SELECT * FROM cash_sessions WHERE closed_at IS NULL ORDER BY datetime(opened_at) DESC LIMIT 1',
      [],
    )
    const row = (res?.rows ?? [])[0]
    if (row) return row
    try {
      const raw = localStorage.getItem('currentCashSession')
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  } catch {
    try {
      const raw = localStorage.getItem('currentCashSession')
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  }
}

export async function listSessions(limit = 50) {
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
  try {
    const res = await query('SELECT * FROM cash_movements WHERE session_id = ?', [sessionId])
    const rows = res?.rows ?? []
    if (rows.length > 0) return rows
    try {
      const raw = localStorage.getItem('cashMovements')
      const arr = raw ? JSON.parse(raw) : []
      return Array.isArray(arr) ? arr.filter((m:any)=>String(m.session_id)===String(sessionId)) : []
    } catch { return [] }
  } catch {
    try {
      const raw = localStorage.getItem('cashMovements')
      const arr = raw ? JSON.parse(raw) : []
      return Array.isArray(arr) ? arr.filter((m:any)=>String(m.session_id)===String(sessionId)) : []
    } catch { return [] }
  }
}
