const query = async (sql: string, params?: any[]) => {
  const fn = (window as any)?.api?.db?.query
  if (typeof fn !== 'function') throw new Error('Canal de DB indisponível')
  const res = await fn(sql, params)
  if (res?.error) throw new Error(String(res.error))
  return res as { rows?: any[] }
}

type UUID = string
const uuid = () => typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`

export async function listIngredients() {
  try {
    const res = await query('SELECT * FROM ingredients ORDER BY name')
    return res.rows ?? []
  } catch {
    const raw = localStorage.getItem('ingredients')
    return raw ? JSON.parse(raw) : []
  }
}

export async function upsertIngredient(params: { id?: UUID; name: string }) {
  const now = new Date().toISOString()
  try {
    const existing = await query('SELECT id FROM ingredients WHERE name = ?', [params.name])
    const foundId = existing.rows && existing.rows[0]?.id
    if (foundId) return String(foundId)
    const id = params.id ?? uuid()
    await query('INSERT INTO ingredients (id, name, updated_at) VALUES (?, ?, ?)', [id, params.name, now])
    return id
  } catch {
    const raw = localStorage.getItem('ingredients')
    const list = raw ? JSON.parse(raw) : []
    const dup = (list || []).find((i:any)=> String(i.name).toLowerCase() === String(params.name).toLowerCase())
    if (dup) return String(dup.id)
    const id = params.id ?? uuid()
    const next = [{ id, name: params.name, updated_at: now }, ...list]
    localStorage.setItem('ingredients', JSON.stringify(next))
    return id
  }
}

export async function listPrices() {
  try {
    const res = await query('SELECT * FROM ingredient_prices ORDER BY updated_at DESC')
    return res.rows ?? []
  } catch {
    const raw = localStorage.getItem('ingredientPrices')
    return raw ? JSON.parse(raw) : []
  }
}

export async function upsertPrice(params: { id?: UUID; ingredientId: string; unit: string; pricePerUnitCents: number }) {
  const id = params.id ?? uuid()
  const now = new Date().toISOString()
  const cents = Math.max(0, params.pricePerUnitCents)
  try {
    const prev = await query('SELECT id, price_per_unit_cents FROM ingredient_prices WHERE ingredient_id = ? AND unit = ?', [params.ingredientId, params.unit])
    const oldCents = prev.rows && prev.rows[0]?.price_per_unit_cents
    await query(
      'INSERT INTO ingredient_prices (id, ingredient_id, unit, price_per_unit_cents, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET ingredient_id=excluded.ingredient_id, unit=excluded.unit, price_per_unit_cents=excluded.price_per_unit_cents, updated_at=excluded.updated_at',
      [id, params.ingredientId, params.unit, cents, now]
    )
    if (typeof oldCents === 'number' && oldCents !== cents) {
      const hid = uuid()
      await query('INSERT INTO ingredient_price_history (id, ingredient_id, unit, old_price_cents, new_price_cents, changed_at) VALUES (?, ?, ?, ?, ?, ?)', [hid, params.ingredientId, params.unit, oldCents, cents, now])
    }
  } catch {
    const list = await listPrices()
    const next = [{ id, ingredient_id: params.ingredientId, unit: params.unit, price_per_unit_cents: cents, updated_at: now }, ...list.filter((p:any)=>p.id!==id)]
    localStorage.setItem('ingredientPrices', JSON.stringify(next))
    try {
      const historyRaw = localStorage.getItem('ingredientPriceHistory')
      const hist = historyRaw ? JSON.parse(historyRaw) : []
      const old = list.find((p:any)=> String(p.ingredient_id) === String(params.ingredientId) && String(p.unit).toLowerCase() === String(params.unit).toLowerCase())
      if (old && old.price_per_unit_cents !== cents) {
        hist.push({ id: uuid(), ingredient_id: params.ingredientId, unit: params.unit, old_price_cents: old.price_per_unit_cents, new_price_cents: cents, changed_at: now })
        localStorage.setItem('ingredientPriceHistory', JSON.stringify(hist))
      }
    } catch {}
  }
  return id
}

export async function deletePrice(id: string) {
  try {
    await query('DELETE FROM ingredient_prices WHERE id = ?', [id])
  } catch {
    const raw = localStorage.getItem('ingredientPrices')
    const list = raw ? JSON.parse(raw) : []
    localStorage.setItem('ingredientPrices', JSON.stringify(list.filter((p:any)=> String(p.id)!==String(id))))
  }
}

export async function listRecipeByProduct(productId: string) {
  try {
    const res = await query('SELECT * FROM product_ingredients WHERE product_id = ?', [productId])
    return res.rows ?? []
  } catch {
    const raw = localStorage.getItem('recipes')
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr.filter((r:any)=>String(r.product_id)===String(productId)) : []
  }
}

export async function upsertRecipeLine(params: { id?: UUID; productId: string; ingredientId: string; quantity: number; unit: string }) {
  const id = params.id ?? uuid()
  const now = new Date().toISOString()
  try {
    let old: any = null
    try {
      const prev = await query('SELECT quantity, unit FROM product_ingredients WHERE id = ?', [id])
      old = prev.rows && prev.rows[0] ? prev.rows[0] : null
    } catch {}
    await query(
      'INSERT INTO product_ingredients (id, product_id, ingredient_id, quantity, unit, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET product_id=excluded.product_id, ingredient_id=excluded.ingredient_id, quantity=excluded.quantity, unit=excluded.unit, updated_at=excluded.updated_at',
      [id, params.productId, params.ingredientId, Math.max(0, Number(params.quantity || 0)), params.unit, now]
    )
    if (old && ((Number(old.quantity||0) !== Math.max(0, Number(params.quantity||0))) || (String(old.unit) !== String(params.unit)))) {
      await query('INSERT INTO recipe_history (id, product_id, ingredient_id, action, old_quantity, old_unit, new_quantity, new_unit, changed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [uuid(), params.productId, params.ingredientId, 'update', Number(old.quantity||0), String(old.unit||''), Math.max(0, Number(params.quantity||0)), String(params.unit), now])
    }
  } catch {
    const raw = localStorage.getItem('recipes')
    const arr = raw ? JSON.parse(raw) : []
    const next = [{ id, product_id: params.productId, ingredient_id: params.ingredientId, quantity: Math.max(0, Number(params.quantity || 0)), unit: params.unit, updated_at: now }, ...arr.filter((r:any)=>r.id!==id)]
    localStorage.setItem('recipes', JSON.stringify(next))
    try {
      const historyRaw = localStorage.getItem('recipeHistory')
      const hist = historyRaw ? JSON.parse(historyRaw) : []
      const old = arr.find((r:any)=> String(r.id)===String(id))
      if (old && ((Number(old.quantity||0) !== Math.max(0, Number(params.quantity||0))) || (String(old.unit) !== String(params.unit)))) {
        hist.push({ id: uuid(), product_id: params.productId, ingredient_id: params.ingredientId, action: 'update', old_quantity: Number(old.quantity||0), old_unit: String(old.unit||''), new_quantity: Math.max(0, Number(params.quantity||0)), new_unit: String(params.unit), changed_at: now })
        localStorage.setItem('recipeHistory', JSON.stringify(hist))
      }
    } catch {}
  }
  return id
}

export async function deleteRecipeLine(id: string) {
  try {
    await query('DELETE FROM product_ingredients WHERE id = ?', [id])
    try {
      await query('INSERT INTO recipe_history (id, product_id, ingredient_id, action, changed_at) SELECT ?, product_id, ingredient_id, ?, ? FROM product_ingredients WHERE id = ?', [uuid(), 'delete', new Date().toISOString(), id])
    } catch {}
  } catch {
    const raw = localStorage.getItem('recipes')
    const arr = raw ? JSON.parse(raw) : []
    localStorage.setItem('recipes', JSON.stringify(arr.filter((r:any)=>String(r.id)!==String(id))))
    try {
      const historyRaw = localStorage.getItem('recipeHistory')
      const hist = historyRaw ? JSON.parse(historyRaw) : []
      const old = arr.find((r:any)=> String(r.id)===String(id))
      if (old) {
        hist.push({ id: uuid(), product_id: old.product_id, ingredient_id: old.ingredient_id, action: 'delete', changed_at: new Date().toISOString() })
        localStorage.setItem('recipeHistory', JSON.stringify(hist))
      }
    } catch {}
  }
}

export function convert(unitFrom: string, unitTo: string, quantity: number) {
  const uF = unitFrom.toLowerCase()
  const uT = unitTo.toLowerCase()
  if (uF === uT) return quantity
  if (uF === 'g' && uT === 'kg') return quantity / 1000
  if (uF === 'kg' && uT === 'g') return quantity * 1000
  if (uF === 'ml' && uT === 'l') return quantity / 1000
  if (uF === 'l' && uT === 'ml') return quantity * 1000
  return quantity
}