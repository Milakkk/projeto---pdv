import { db } from '@/offline/db/client'
import { products, categories } from '@/offline/db/schema'
import { eq } from 'drizzle-orm'

type UUID = string

const uuid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`

export async function listProducts() {
  return db.select().from(products)
}

export async function getProductById(id: string) {
  const p = (await db.select().from(products).where(eq(products.id, id)))?.[0]
  return p ?? null
}

export async function searchProducts(query: string) {
  const q = (query || '').toLowerCase()
  const rows = await db.select().from(products)
  return rows.filter((p: any) =>
    String(p.name ?? '').toLowerCase().includes(q) || String(p.sku ?? '').toLowerCase().includes(q),
  )
}

export async function listCategories() {
  return db.select().from(categories)
}

export async function upsertCategory(payload: { id?: UUID; name: string; unitId?: string | null; defaultStation?: string | null }) {
  const id = payload.id ?? uuid()
  const now = new Date().toISOString()
  // Try update; if not exists, insert
  const existing = (await db.select().from(categories).where(eq(categories.id, id)))?.[0]
  if (existing) {
    await db
      .update(categories)
      .set({ name: payload.name, unitId: payload.unitId ?? existing.unitId, defaultStation: payload.defaultStation ?? existing.defaultStation, updatedAt: now, pendingSync: 1 })
      .where(eq(categories.id, id))
      .run()
    return id
  }
  await db
    .insert(categories)
    .values({ id, name: payload.name, unitId: payload.unitId ?? null, defaultStation: payload.defaultStation ?? null, updatedAt: now, version: 1, pendingSync: 1 })
    .run()
  return id
}

export async function deleteCategory(id: UUID) {
  await db.delete(categories).where(eq(categories.id, id)).run()
}

export async function upsertProduct(payload: {
  id?: UUID
  sku?: string | null
  name: string
  categoryId?: UUID | null
  unitId?: UUID | null
  priceCents: number
  isActive?: boolean
}) {
  const id = payload.id ?? uuid()
  const now = new Date().toISOString()
  const existing = (await db.select().from(products).where(eq(products.id, id)))?.[0]
  const base = {
    sku: payload.sku ?? (existing?.sku ?? null),
    name: payload.name,
    categoryId: payload.categoryId ?? (existing?.categoryId ?? null),
    unitId: payload.unitId ?? (existing?.unitId ?? null),
    priceCents: Math.max(0, Math.round(payload.priceCents ?? 0)),
    isActive: payload.isActive ?? (existing?.isActive ?? true),
    updatedAt: now,
    pendingSync: 1,
  }
  if (existing) {
    await db.update(products).set(base).where(eq(products.id, id)).run()
    return id
  }
  await db.insert(products).values({ id, ...base, version: 1 }).run()
  return id
}

export async function deleteProduct(id: UUID) {
  await db.delete(products).where(eq(products.id, id)).run()
}
