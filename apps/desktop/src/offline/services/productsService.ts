import { getCurrentUnitId } from './deviceProfileService'
export { getCurrentUnitId }

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

export async function listProducts() {
  try {
    const rawUnitId = await getCurrentUnitId()
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    const unitId = rawUnitId && uuidRegex.test(rawUnitId) ? rawUnitId : null

    const api = (window as any)?.api?.db?.query
    if (typeof api === 'function') {
      const sql = unitId ? 'SELECT * FROM products WHERE unit_id = ? OR unit_id IS NULL' : 'SELECT * FROM products'
      let res = await query(sql, unitId ? [unitId] : [])
      const rows = res?.rows ?? []
      if (unitId && rows.length === 0) {
        res = await query('SELECT * FROM products')
      }
      return res?.rows ?? []
    }
    const { supabase } = await import('../../utils/supabase')
    if (supabase) {
      let q = supabase.from('products').select('id, sku, name, category_id, unit_id, price_cents, is_active')
      if (unitId) q = q.or(`unit_id.eq.${unitId},unit_id.is.null`)
      const { data, error } = await q
      if (error) throw error
      const mapped = (data || []).map(p => ({
        id: p.id,
        sku: (p as any).sku ?? null,
        name: (p as any).name,
        categoryId: (p as any).category_id ?? null,
        unitId: (p as any).unit_id ?? null,
        priceCents: Math.max(0, Number((p as any).price_cents ?? 0)),
        isActive: ((p as any).is_active ?? true) ? 1 : 0,
      }))

      // Fallback: Se Supabase retornar vazio mas tivermos dados locais (ex: falha de sync/409), usar local
      if (mapped.length === 0) {
        // Verifica se existe dado local antes de lançar erro para fallback
        const raw = localStorage.getItem('menuItems')
        if (raw && JSON.parse(raw).length > 0) {
          throw new Error('Fallback to local')
        }
      }
      return mapped
    }
    const raw = localStorage.getItem('menuItems')
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr.map((p: any) => ({ id: p.id, sku: p.code, name: p.name, categoryId: p.categoryId, priceCents: Math.round((p.price || 0) * 100), isActive: p.active ? 1 : 0 })) : []
  } catch { return [] }
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
      return Array.isArray(arr) ? arr.filter((p: any) => String(p.name || '').toLowerCase().includes(q) || String(p.code || '').toLowerCase().includes(q)) : []
    } catch { return [] }
  }
}

export async function listCategories() {
  try {
    const unitId = (await getCurrentUnitId())
    const api = (window as any)?.api?.db?.query
    if (typeof api === 'function') {
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
    }
    const { supabase } = await import('../../utils/supabase')
    if (supabase) {
      const { data, error } = await supabase.from('categories').select('id, name, unit_id, updated_at')
      if (error) throw error
      const list = data || []
      const map = new Map<string, any>()
      for (const c of list) {
        const key = String((c as any).name || '').trim().toLowerCase()
        if (!key) continue
        const prev = map.get(key)
        if (!prev) {
          map.set(key, c)
        } else {
          const preferCurrent = Boolean((c as any).unit_id) && !Boolean((prev as any).unit_id)
          map.set(key, preferCurrent ? c : prev)
        }
      }
      return Array.from(map.values()).map(c => ({ id: (c as any).id, name: (c as any).name }))
    }
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
    return unique.map((c: any) => ({ id: c.id, name: c.name }))
  } catch { return [] }
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
  const rawUnitId = await getCurrentUnitId()
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const unitId = rawUnitId && uuidRegex.test(rawUnitId) ? rawUnitId : null
  const now = new Date().toISOString()
  const isElectron = typeof (window as any)?.api?.db?.query === 'function'

  try {
    if (isElectron) {
      // Modo Electron - usa banco local
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
    } else {
      // Modo Navegador - usa Supabase
      const { supabase } = await import('../../utils/supabase')
      if (!supabase) {
        console.warn('[productsService] Supabase não disponível para salvar produto')
        throw new Error('Supabase não disponível')
      }

      const productData = {
        id,
        sku: params.sku ?? null,
        name: params.name,
        // Validate category_id is a UUID before sending to Supabase
        category_id: (params.categoryId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.categoryId)) 
          ? params.categoryId 
          : null,
        unit_id: unitId ?? null,
        price_cents: Math.max(0, Number(params.priceCents ?? 0)),
        is_active: params.isActive ?? true,
        updated_at: now,
        version: 1,
        pending_sync: false,
      }

      const { error } = await supabase
        .from('products')
        .upsert(productData, { onConflict: 'id' })

      if (error) {
        // Se for erro de FK (categoria não existe/inválida), tenta salvar sem categoria
        if (error.code === '23503' || error.details?.includes('Key is not present in table "categories"')) {
          console.warn('[productsService] Erro de FK na categoria due to missing ID. Retrying with category_id=null', { failedId: params.categoryId })
          const fallbackData = { ...productData, category_id: null }
          const { error: retryError } = await supabase.from('products').upsert(fallbackData, { onConflict: 'id' })
          if (retryError) throw retryError
          return id
        }

        console.error('[productsService] Erro ao salvar produto no Supabase:', error)
        throw error
      }
      return id
    }
  } catch (err) {
    // Fallback: tenta salvar no localStorage
    try {
      const raw = localStorage.getItem('menuItems')
      const arr = raw ? JSON.parse(raw) : []
      const idx = arr.findIndex((p: any) => String(p.id) === String(id))
      // Se falhou por FK (Supabase), devemos salvar LOCALMENTE sem categoria também, para evitar "sumiço"
      // Se falhou por conexão (catch geral), salvamos com a categoria original para tentar sync depois
      const isFkError = (err as any)?.code === '23503' || (err as any)?.details?.includes('Key is not present')

      const item = {
        id,
        code: params.sku,
        name: params.name,
        categoryId: isFkError ? null : params.categoryId, // HARD FIX: Se DB rejeitou a categoria, removemos ela local também
        price: params.priceCents / 100,
        active: params.isActive ?? true,
      }
      if (idx >= 0) {
        arr[idx] = { ...arr[idx], ...item }
      } else {
        arr.push(item)
      }
      localStorage.setItem('menuItems', JSON.stringify(arr))
      console.warn('[productsService] Produto salvo no localStorage como fallback', { wasFkError: isFkError })
      return id
    } catch { }
    throw err
  }
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
  // Sempre gera um UUID válido para Supabase (não usa IDs antigos como "cat_xxx")
  // Valida se o ID fornecido é um UUID válido
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const id = params.id && uuidRegex.test(params.id)
    ? params.id
    : crypto.randomUUID()

  if (params.id && !uuidRegex.test(params.id)) {
    console.warn(`[productsService] ID "${params.id}" não é um UUID válido, gerando novo UUID: ${id}`)
  }
  const rawUnitId = await getCurrentUnitId()
  const unitId = rawUnitId && uuidRegex.test(rawUnitId) ? rawUnitId : null
  const now = new Date().toISOString()
  const isElectron = typeof (window as any)?.api?.db?.query === 'function'

  try {
    if (isElectron) {
      // Modo Electron - usa banco local
      const found = await query('SELECT id, unit_id FROM categories WHERE LOWER(name) = LOWER(?) AND (unit_id = ? OR unit_id IS NULL)', [params.name, unitId ?? null])
      const rows = found?.rows ?? []
      const preferred = rows.find((r: any) => String(r.unit_id || '') === String(unitId || '')) || rows[0]
      const targetId = preferred?.id ? String(preferred.id) : null
      if (targetId) {
        await query('UPDATE categories SET name = ?, unit_id = ?, updated_at = ?, pending_sync = 1 WHERE id = ?', [params.name, unitId ?? null, now, targetId])
        return targetId
      }
      await query(
        'INSERT INTO categories (id, name, unit_id, default_station, updated_at, version, pending_sync) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, unit_id=excluded.unit_id, default_station=excluded.default_station, updated_at=excluded.updated_at, version=excluded.version, pending_sync=excluded.pending_sync',
        [id, params.name, unitId ?? null, null, now, 1, 1],
      )
      return id
    } else {
      // Modo Navegador - usa Supabase
      const { supabase } = await import('../../utils/supabase')
      if (!supabase) {
        console.warn('[productsService] Supabase não disponível para salvar categoria')
        throw new Error('Supabase não disponível')
      }

      console.log('[productsService] Salvando categoria no Supabase:', { id, name: params.name })

      // Verifica se já existe pelo ID
      const { data: existingById, error: selectErrorById } = await supabase
        .from('categories')
        .select('id, name')
        .eq('id', id)
        .maybeSingle()

      if (selectErrorById && selectErrorById.code !== 'PGRST116') {
        console.error('[productsService] Erro ao verificar categoria existente pelo ID:', selectErrorById)
        throw selectErrorById
      }

      // Se não encontrou pelo ID, tenta encontrar pelo nome
      let existing = existingById;
      let finalId = id;

      if (!existing) {
        console.log('[productsService] Categoria não encontrada pelo ID, buscando pelo nome...');
        const { data: existingByName, error: selectErrorByName } = await supabase
          .from('categories')
          .select('id, name')
          .eq('name', params.name)
          .maybeSingle();

        if (selectErrorByName && selectErrorByName.code !== 'PGRST116') {
          console.error('[productsService] Erro ao buscar categoria pelo nome:', selectErrorByName);
          throw selectErrorByName;
        } else if (existingByName) {
          console.log('[productsService] ✅ Categoria encontrada pelo nome:', existingByName);
          existing = existingByName;
          finalId = existing.id; // Usa o ID existente
          console.log(`[productsService] Usando ID existente: ${finalId} (ao invés de ${id})`);
        }
      } else {
        finalId = existing.id; // Garante que usa o ID encontrado
      }

      const categoryData = {
        id: finalId,
        name: params.name,
        unit_id: unitId ?? null,
        default_station: null,
        updated_at: now,
        version: 1,
        pending_sync: false,
      }

      if (existing) {
        // Atualiza categoria existente
        console.log('[productsService] Atualizando categoria existente com ID:', finalId);
        const { data: updatedData, error: updateError } = await supabase
          .from('categories')
          .update(categoryData)
          .eq('id', finalId)
          .select()

        if (updateError) {
          console.error('[productsService] Erro ao atualizar categoria:', updateError)
          throw updateError
        }

        if (updatedData && updatedData.length > 0) {
          console.log('[productsService] ✅ Categoria atualizada no Supabase:', updatedData[0])
          // Aguarda um pouco e verifica se a categoria foi realmente atualizada
          await new Promise(resolve => setTimeout(resolve, 300))
          const { data: verifyData } = await supabase
            .from('categories')
            .select('id')
            .eq('id', updatedData[0].id)
            .maybeSingle()
          if (verifyData) {
            return updatedData[0].id
          } else {
            console.warn('[productsService] ⚠️ Categoria não encontrada após atualização, mas retornando ID:', finalId)
            return finalId
          }
        } else {
          console.warn('[productsService] ⚠️ Categoria atualizada mas não retornada. Verificando...')
          // Aguarda e verifica se a categoria existe
          await new Promise(resolve => setTimeout(resolve, 300))
          const { data: verifyData } = await supabase
            .from('categories')
            .select('id')
            .eq('id', finalId)
            .maybeSingle()
          if (verifyData) {
            return finalId
          } else {
            throw new Error('Categoria não encontrada após atualização')
          }
        }
      } else {
        // Insere nova categoria
        console.log('[productsService] Inserindo nova categoria com ID:', finalId);
        const { data: insertedData, error: insertError } = await supabase
          .from('categories')
          .insert(categoryData)
          .select()

        if (insertError) {
          console.error('[productsService] Erro ao inserir categoria:', insertError)
          console.error('[productsService] Detalhes:', {
            code: insertError.code,
            message: insertError.message,
            details: insertError.details,
            hint: insertError.hint
          })
          throw insertError
        }

        if (insertedData && insertedData.length > 0) {
          console.log('[productsService] ✅ Categoria inserida no Supabase com sucesso:', insertedData[0])
          // Aguarda um pouco e verifica se a categoria foi realmente inserida
          await new Promise(resolve => setTimeout(resolve, 300))
          const { data: verifyData } = await supabase
            .from('categories')
            .select('id')
            .eq('id', insertedData[0].id)
            .maybeSingle()
          if (verifyData) {
            return insertedData[0].id
          } else {
            console.warn('[productsService] ⚠️ Categoria não encontrada após inserção, mas retornando ID:', finalId)
            return finalId
          }
        } else {
          console.warn('[productsService] ⚠️ Categoria inserida mas não retornada pelo .select(). Verificando...')
          // Aguarda e verifica se a categoria existe
          await new Promise(resolve => setTimeout(resolve, 300))
          const { data: verifyData } = await supabase
            .from('categories')
            .select('id')
            .eq('id', finalId)
            .maybeSingle()
          if (verifyData) {
            return finalId
          } else {
            throw new Error('Categoria não encontrada após inserção')
          }
        }
      }
    }
  } catch (err: any) {
    console.error('[productsService] Erro ao salvar categoria:', err)
    // Fallback para localStorage se Supabase falhar
    if (!isElectron) {
      try {
        const raw = localStorage.getItem('categories')
        const arr = raw ? JSON.parse(raw) : []
        const existing = arr.find((c: any) => c.id === id)
        if (existing) {
          existing.name = params.name
          existing.updated_at = now
        } else {
          arr.push({ id, name: params.name, updated_at: now })
        }
        localStorage.setItem('categories', JSON.stringify(arr))
        console.warn('[productsService] Categoria salva no localStorage como fallback')
        return id
      } catch { }
    }
    throw err
  }
}

export async function deleteCategories(ids: string[]) {
  for (const id of ids) {
    await query('DELETE FROM categories WHERE id = ?', [id])
  }
}

export async function migrateLocalStorageCatalog() {
  // Migration logic
  const MIGRATION_KEY = 'catalog_migration_done_v5'

  // Skip if not Electron (Web mode should rely on Supabase sync, not local storage migration)
  const isElectron = typeof (window as any)?.api?.db?.query === 'function'
  if (!isElectron) {
    console.log('[Migration] Web mode detected. Skipping localStorage migration to prevent conflicts.')
    return
  }

  // Skip if already migrated
  if (localStorage.getItem(MIGRATION_KEY)) {
    return
  }

  try {
    const rawCats = localStorage.getItem('categories')
    const rawItems = localStorage.getItem('menuItems')
    const cats = rawCats ? JSON.parse(rawCats) : []
    const items = rawItems ? JSON.parse(rawItems) : []

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    const idMap: Record<string, string> = {} // old ID -> new UUID

    // Migrate categories and build ID mapping
    const nameToIdMap: Record<string, string> = {}

    if (Array.isArray(cats)) {
      const updatedCats = []
      for (const c of cats) {
        const oldId = String(c.id ?? '')
        const name = String(c.name ?? '').trim()
        if (!name) continue

        // Generate new UUID if old ID is not valid
        const newId = oldId && uuidRegex.test(oldId) ? oldId : crypto.randomUUID()

        // IMPORTANT: Capture the ACTUAL ID returned by upsert (it might find existing by name)
        const actualId = await upsertCategory({ id: newId, name })

        nameToIdMap[name.toLowerCase()] = actualId

        // Update map: Old ID -> Actual DB ID
        if (oldId) {
          idMap[oldId] = actualId
        }
        // Also map the generated newId -> Actual ID (in case logic mixed them)
        if (newId !== actualId) {
          idMap[newId] = actualId
        }

        console.log(`[Migration] Mapped Category: '${name}' | Old: ${oldId} -> New: ${actualId}`)

        updatedCats.push({ ...c, id: actualId })
      }
      // Update localStorage with new UUIDs
      localStorage.setItem('categories', JSON.stringify(updatedCats))
    }

    // Migrate products with updated category IDs
    if (Array.isArray(items)) {
      const updatedItems = []
      for (const p of items) {
        const oldId = String(p.id ?? '')
        const sku = p.code ? String(p.code) : null
        const name = String(p.name ?? '').trim()
        let categoryId = p.categoryId ? String(p.categoryId) : null
        const priceCents = Math.max(0, Math.round(((p.price ?? 0) as number) * 100))
        const isActive = Boolean(p.active ?? true)
        if (!name) continue

        // 1. Try mapping via ID Map (Old ID -> New ID)
        if (categoryId && idMap[categoryId]) {
          console.log(`[Migration] Product '${name}': remaped cat ${categoryId} -> ${idMap[categoryId]}`)
          categoryId = idMap[categoryId]
        } else if (categoryId) {
          console.warn(`[Migration] Product '${name}': category ${categoryId} NOT FOUND in map. Keys:`, Object.keys(idMap).slice(0, 5))
          // Tenta encontrar por nome no nameToIdMap se não achou por ID? 
          // Não temos o nome da categoria no produto, infelizmente.
        }
        // However, if we failed, maybe categoryId IS actually a valid UUID that we missed?
        // Or maybe it's orphan.

        // Generate new UUID for product if needed
        const newId = oldId && uuidRegex.test(oldId) ? oldId : crypto.randomUUID()

        await upsertProduct({ id: newId, sku, name, categoryId, priceCents, isActive })
        updatedItems.push({ ...p, id: newId, categoryId })
      }
      // Update localStorage with new UUIDs
      localStorage.setItem('menuItems', JSON.stringify(updatedItems))
    }

    // Mark migration as complete
    localStorage.setItem(MIGRATION_KEY, 'true')
    console.log('[productsService] ✅ Catalog migration completed successfully')
  } catch (err) {
    console.error('[productsService] Migration error:', err)
  }
}

