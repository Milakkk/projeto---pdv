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

import { getCurrentUnitId } from './deviceProfileService'

export async function listProducts() {
  try {
    const unitId = (await getCurrentUnitId())
    const sql = unitId ? 'SELECT * FROM products WHERE unit_id = ? OR unit_id IS NULL' : 'SELECT * FROM products'
    let res = await query(sql, unitId ? [unitId] : [])
    const rows = res?.rows ?? []
    if (unitId && rows.length === 0) {
      res = await query('SELECT * FROM products')
    }
    return res?.rows ?? []
  } catch {
    try {
      const raw = localStorage.getItem('menuItems')
      const arr = raw ? JSON.parse(raw) : []
      return Array.isArray(arr) ? arr.map((p:any)=>({ id:p.id, sku:p.code, name:p.name, categoryId:p.categoryId, priceCents: Math.round((p.price||0)*100), isActive: p.active ? 1 : 0 })) : []
    } catch { return [] }
  }
}

export async function getProductById(id: string) {
  const res = await query('SELECT * FROM products WHERE id = ?', [id])
  return (res?.rows ?? [])[0] ?? null
}

export async function searchProducts(term: string) {
  try {
    const q = (term || '').toLowerCase()
    const unitId = (await getCurrentUnitId())
    const sql = unitId ? 'SELECT * FROM products WHERE unit_id = ? OR unit_id IS NULL' : 'SELECT * FROM products'
    const res = await query(sql, unitId ? [unitId] : [])
    const rows = res?.rows ?? []
    return rows.filter((p: any) => String(p.name ?? '').toLowerCase().includes(q) || String(p.sku ?? '').toLowerCase().includes(q))
  } catch {
    try {
      const q = (term || '').toLowerCase()
      const raw = localStorage.getItem('menuItems')
      const arr = raw ? JSON.parse(raw) : []
      return Array.isArray(arr) ? arr.filter((p:any)=> String(p.name||'').toLowerCase().includes(q) || String(p.code||'').toLowerCase().includes(q)) : []
    } catch { return [] }
  }
}

export async function listCategories() {
  try {
    const unitId = (await getCurrentUnitId())
    const sql = unitId ? 'SELECT * FROM categories WHERE unit_id = ? OR unit_id IS NULL' : 'SELECT * FROM categories'
    let res = await query(sql, unitId ? [unitId] : [])
    const rows = res?.rows ?? []
    if (unitId && rows.length === 0) {
      res = await query('SELECT * FROM categories')
    }
    const list = res?.rows ?? []
    const map = new Map<string, any>()
    for (const c of list) {
      const key = String(c.name || '').trim().toLowerCase()
      if (!key) continue
      const prev = map.get(key)
      if (!prev) {
        map.set(key, c)
      } else {
        const preferCurrent = Boolean(c.unit_id) && !Boolean(prev.unit_id)
        map.set(key, preferCurrent ? c : prev)
      }
    }
    return Array.from(map.values())
  } catch {
    try {
      const raw = localStorage.getItem('categories')
      const arr = raw ? JSON.parse(raw) : []
      if (!Array.isArray(arr)) return []
      const set = new Set<string>()
      const unique: any[] = []
      for (const c of arr) {
        const key = String(c?.name || '').trim().toLowerCase()
        if (!key) continue
        if (set.has(key)) continue
        set.add(key)
        unique.push(c)
      }
      return unique.map((c:any)=>({ id:c.id, name:c.name }))
    } catch { return [] }
  }
}

// --- Write APIs ---
type UUID = string

const uuid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`

export async function upsertProduct(params: {
  id?: UUID
  sku?: string | null
  name: string
  categoryId?: string | null
  priceCents: number
  isActive?: boolean
}) {
  const id = params.id ?? uuid()
  const unitId = await getCurrentUnitId()
  const now = new Date().toISOString()
  await query(
    'INSERT INTO products (id, sku, name, category_id, unit_id, price_cents, is_active, updated_at, version, pending_sync) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET sku=excluded.sku, name=excluded.name, category_id=excluded.category_id, unit_id=excluded.unit_id, price_cents=excluded.price_cents, is_active=excluded.is_active, updated_at=excluded.updated_at, version=excluded.version, pending_sync=excluded.pending_sync',
    [
      id,
      params.sku ?? null,
      params.name,
      params.categoryId ?? null,
      unitId ?? null,
      Math.max(0, Number(params.priceCents ?? 0)),
      params.isActive ? 1 : 0,
      now,
      1,
      1,
    ],
  )
  return id
}

export async function deleteProducts(ids: string[]) {
  for (const id of ids) {
    await query('DELETE FROM products WHERE id = ?', [id])
  }
}

export async function setProductActive(id: UUID, isActive: boolean) {
  const now = new Date().toISOString()
  await query('UPDATE products SET is_active = ?, updated_at = ?, pending_sync = 1 WHERE id = ?', [isActive ? 1 : 0, now, id])
}

export async function upsertCategory(params: { id?: UUID; name: string }) {
  const id = params.id ?? uuid()
  const unitId = await getCurrentUnitId()
  const now = new Date().toISOString()
  try {
    const found = await query('SELECT id, unit_id FROM categories WHERE LOWER(name) = LOWER(?) AND (unit_id = ? OR unit_id IS NULL)', [params.name, unitId ?? null])
    const rows = found?.rows ?? []
    const preferred = rows.find((r:any)=> String(r.unit_id||'') === String(unitId||'')) || rows[0]
    const targetId = preferred?.id ? String(preferred.id) : null
    if (targetId) {
      await query('UPDATE categories SET name = ?, unit_id = ?, updated_at = ?, pending_sync = 1 WHERE id = ?', [params.name, unitId ?? null, now, targetId])
      return targetId
    }
  } catch {}
  await query(
    'INSERT INTO categories (id, name, unit_id, default_station, updated_at, version, pending_sync) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, unit_id=excluded.unit_id, default_station=excluded.default_station, updated_at=excluded.updated_at, version=excluded.version, pending_sync=excluded.pending_sync',
    [id, params.name, unitId ?? null, null, now, 1, 1],
  )
  return id
}

export async function deleteCategories(ids: string[]) {
  for (const id of ids) {
    await query('DELETE FROM categories WHERE id = ?', [id])
  }
}

export async function migrateLocalStorageCatalog() {
  try {
    const rawCats = localStorage.getItem('categories')
    const rawItems = localStorage.getItem('menuItems')
    const cats = rawCats ? JSON.parse(rawCats) : []
    const items = rawItems ? JSON.parse(rawItems) : []
    if (Array.isArray(cats)) {
      for (const c of cats) {
        const id = String(c.id ?? '') || undefined
        const name = String(c.name ?? '').trim()
        if (!name) continue
        await upsertCategory({ id, name })
      }
    }
    if (Array.isArray(items)) {
      for (const p of items) {
        const id = String(p.id ?? '') || undefined
        const sku = p.code ? String(p.code) : null
        const name = String(p.name ?? '').trim()
        const categoryId = p.categoryId ? String(p.categoryId) : null
        const priceCents = Math.max(0, Math.round(((p.price ?? 0) as number) * 100))
        const isActive = Boolean(p.active ?? true)
        if (!name) continue
        await upsertProduct({ id, sku, name, categoryId, priceCents, isActive })
      }
    }
  } catch {}
}
