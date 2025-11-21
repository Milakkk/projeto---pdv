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

import type { Task, TaskStatusKey, TaskComment } from '../../types'
import { getCurrentUnitId } from './deviceProfileService'

type UUID = string

const uuid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`

function mapRow(r: any): Task {
  return {
    id: String(r.id),
    title: String(r.title ?? ''),
    description: r.description ? String(r.description) : undefined,
    dueDate: String(r.due_at ?? ''),
    priority: (String(r.priority ?? 'medium') as any),
    status: String(r.status ?? 'pending') as TaskStatusKey,
    assignedToId: r.assigned_to ? String(r.assigned_to) : undefined,
    assignedToName: r.assigned_to_name ? String(r.assigned_to_name) : undefined,
    storeId: String(r.unit_id ?? ''),
    createdAt: r.created_at ? new Date(String(r.created_at)) : new Date(),
    completedAt: r.completed_at ? new Date(String(r.completed_at)) : undefined,
    comments: r.comments_json ? safeParseComments(String(r.comments_json)) : [],
  }
}

function safeParseComments(s: string): TaskComment[] {
  try {
    const arr = JSON.parse(s)
    return Array.isArray(arr) ? arr.map((c: any) => ({
      id: String(c.id),
      userId: String(c.userId),
      userName: String(c.userName),
      timestamp: c.timestamp ? new Date(String(c.timestamp)) : new Date(),
      content: String(c.content ?? ''),
    })) : []
  } catch { return [] }
}

export async function listTasks(): Promise<Task[]> {
  try {
    const unitId = await getCurrentUnitId()
    const sql = unitId ? 'SELECT * FROM tasks WHERE unit_id = ? OR unit_id IS NULL' : 'SELECT * FROM tasks'
    const res = await query(sql, unitId ? [unitId] : [])
    const rows = res?.rows ?? []
    return rows.map(mapRow)
  } catch {
    try {
      const raw = localStorage.getItem('tasks')
      const arr = raw ? JSON.parse(raw) : []
      return Array.isArray(arr) ? arr : []
    } catch { return [] }
  }
}

export async function upsertTask(payload: Omit<Task, 'id' | 'createdAt'> & { id?: UUID }): Promise<string> {
  const id = payload.id ?? uuid()
  try {
    const unitId = await getCurrentUnitId()
    const now = new Date().toISOString()
    const commentsJson = JSON.stringify(payload.comments ?? [])
    await query(
      'INSERT INTO tasks (id, unit_id, title, description, status, priority, assigned_to, assigned_to_name, due_at, created_at, completed_at, comments_json, updated_at, version, pending_sync) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET unit_id=excluded.unit_id, title=excluded.title, description=excluded.description, status=excluded.status, priority=excluded.priority, assigned_to=excluded.assigned_to, assigned_to_name=excluded.assigned_to_name, due_at=excluded.due_at, completed_at=excluded.completed_at, comments_json=excluded.comments_json, updated_at=excluded.updated_at, version=excluded.version, pending_sync=excluded.pending_sync',
      [
        id,
        unitId ?? null,
        payload.title,
        payload.description ?? null,
        payload.status,
        payload.priority,
        payload.assignedToId ?? null,
        payload.assignedToName ?? null,
        payload.dueDate,
        payload.createdAt ? new Date(payload.createdAt as any).toISOString() : now,
        payload.completedAt ? new Date(payload.completedAt as any).toISOString() : null,
        commentsJson,
        now,
        1,
        1,
      ],
    )
    return id
  } catch {
    try {
      const raw = localStorage.getItem('tasks')
      const arr: Task[] = raw ? JSON.parse(raw) : []
      const created: Task = {
        id,
        title: payload.title,
        description: payload.description ?? undefined,
        dueDate: payload.dueDate,
        priority: payload.priority as any,
        status: payload.status,
        assignedToId: payload.assignedToId ?? undefined,
        assignedToName: payload.assignedToName ?? undefined,
        storeId: String(payload.storeId ?? ''),
        createdAt: new Date(),
        completedAt: payload.completedAt ? new Date(payload.completedAt as any) : undefined,
        comments: payload.comments ?? [],
      }
      const next = [created, ...arr.filter(t => t.id !== id)]
      localStorage.setItem('tasks', JSON.stringify(next))
      return id
    } catch {
      return id
    }
  }
}

export async function updateTaskStatus(id: UUID, status: TaskStatusKey, setCompletedAt: boolean): Promise<void> {
  try {
    const now = new Date().toISOString()
    const completedAt = setCompletedAt ? now : null
    await query('UPDATE tasks SET status = ?, completed_at = ?, updated_at = ?, pending_sync = 1 WHERE id = ?', [status, completedAt, now, id])
  } catch {
    try {
      const raw = localStorage.getItem('tasks')
      const arr: Task[] = raw ? JSON.parse(raw) : []
      const next = arr.map(t => t.id === id ? { ...t, status, completedAt: setCompletedAt ? new Date() : undefined } : t)
      localStorage.setItem('tasks', JSON.stringify(next))
    } catch {}
  }
}

export async function deleteTask(id: UUID): Promise<void> {
  try {
    await query('DELETE FROM tasks WHERE id = ?', [id])
  } catch {
    try {
      const raw = localStorage.getItem('tasks')
      const arr: Task[] = raw ? JSON.parse(raw) : []
      const next = arr.filter(t => t.id !== id)
      localStorage.setItem('tasks', JSON.stringify(next))
    } catch {}
  }
}
