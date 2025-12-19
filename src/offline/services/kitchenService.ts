import { db } from '@/offline/db/client'
import { kitchens, categoryKitchens, kitchenOperators } from '@/offline/db/schema'
import { eq, and } from 'drizzle-orm'
import { supabase } from '@/utils/supabase'

type UUID = string

const uuid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`

// ====== COZINHAS ======

export async function listKitchens() {
  // SEMPRE usa Supabase quando disponível
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('kitchens')
        .select('*')
        .order('display_order', { ascending: true })
      
      if (error) {
        console.error('Erro ao buscar cozinhas do Supabase:', error)
        throw error
      }
      
      if (data) {
        // Mapeia para o formato esperado
        return data.map(k => ({
          id: k.id,
          name: k.name,
          unitId: k.unit_id || null,
          isActive: k.is_active ?? true,
          displayOrder: k.display_order ?? 0,
        }))
      }
      
      return []
    } catch (err) {
      console.error('Erro ao buscar cozinhas do Supabase:', err)
      throw err // Propaga o erro em vez de fazer fallback
    }
  }
  
  // Fallback apenas para Electron (DB local)
  if (!db) {
    console.warn('Supabase não disponível e DB local não disponível')
    return []
  }
  
  try {
    const rows = await db.select().from(kitchens)
    return rows || []
  } catch (err) {
    console.error('Erro ao buscar cozinhas do DB local:', err)
    return []
  }
}

export async function getKitchenById(id: string) {
  if (!db) return null
  try {
    const row = (await db.select().from(kitchens).where(eq(kitchens.id, id)))?.[0]
    return row ?? null
  } catch {
    return null
  }
}

export async function upsertKitchen(payload: {
  id?: UUID
  name: string
  unitId?: string | null
  isActive?: boolean
  displayOrder?: number
}) {
  const id = payload.id ?? uuid()
  const now = new Date().toISOString()
  
  console.log('[kitchenService] upsertKitchen chamado:', { id, name: payload.name, supabase: !!supabase })
  
  // SEMPRE usa Supabase quando disponível
  if (supabase) {
    try {
      // Verifica se já existe
      const { data: existing, error: selectError } = await supabase
        .from('kitchens')
        .select('id')
        .eq('id', id)
        .maybeSingle()
      
      if (selectError && selectError.code !== 'PGRST116') { // PGRST116 = not found (ok)
        console.error('[kitchenService] Erro ao verificar cozinha existente:', selectError)
        throw selectError
      }
      
      const kitchenData = {
        id,
        name: payload.name,
        unit_id: payload.unitId || null,
        is_active: payload.isActive ?? true,
        display_order: payload.displayOrder ?? 0,
        updated_at: now,
      }
      
      if (existing) {
        // Update
        console.log('[kitchenService] Atualizando cozinha existente:', id)
        const { data, error } = await supabase
          .from('kitchens')
          .update(kitchenData)
          .eq('id', id)
          .select()
        
        if (error) {
          console.error('[kitchenService] Erro ao atualizar cozinha no Supabase:', error)
          throw new Error(`Erro ao atualizar: ${error.message} (code: ${error.code})`)
        }
        console.log('[kitchenService] Cozinha atualizada:', data)
      } else {
        // Insert
        console.log('[kitchenService] Inserindo nova cozinha:', kitchenData)
        const { data, error } = await supabase
          .from('kitchens')
          .insert({
            ...kitchenData,
            created_at: now,
            version: 1,
            pending_sync: false,
          })
          .select()
        
        if (error) {
          console.error('[kitchenService] Erro ao inserir cozinha no Supabase:', error)
          console.error('[kitchenService] Detalhes do erro:', JSON.stringify(error, null, 2))
          throw new Error(`Erro ao inserir: ${error.message} (code: ${error.code || 'unknown'})`)
        }
        console.log('[kitchenService] Cozinha inserida:', data)
      }
      
      return id
    } catch (err: any) {
      console.error('[kitchenService] Erro ao salvar cozinha no Supabase:', err)
      throw err // Propaga o erro em vez de fazer fallback
    }
  }
  
  // Fallback apenas para Electron (DB local)
  if (!db) {
    throw new Error('Supabase não disponível e DB local não disponível')
  }
  
  try {
    const existing = (await db.select().from(kitchens).where(eq(kitchens.id, id)))?.[0]
    
    if (existing) {
      await db
        .update(kitchens)
        .set({
          name: payload.name,
          unitId: payload.unitId ?? existing.unitId,
          isActive: payload.isActive ?? existing.isActive,
          displayOrder: payload.displayOrder ?? existing.displayOrder,
          updatedAt: now,
          pendingSync: true,
        })
        .where(eq(kitchens.id, id))
        .run()
      return id
    }
    
    await db
      .insert(kitchens)
      .values({
        id,
        name: payload.name,
        unitId: payload.unitId ?? null,
        isActive: payload.isActive ?? true,
        displayOrder: payload.displayOrder ?? 0,
        createdAt: now,
        updatedAt: now,
        version: 1,
        pendingSync: true,
      })
      .run()
    return id
  } catch (err) {
    console.error('Erro ao salvar cozinha no DB local:', err)
    throw err
  }
}

export async function deleteKitchen(id: UUID) {
  // SEMPRE usa Supabase quando disponível
  if (supabase) {
    try {
      const { error } = await supabase
        .from('kitchens')
        .delete()
        .eq('id', id)
      
      if (error) {
        console.error('Erro ao deletar cozinha do Supabase:', error)
        throw error
      }
      return true
    } catch (err) {
      console.error('Erro ao deletar cozinha do Supabase:', err)
      throw err // Propaga o erro em vez de fazer fallback
    }
  }
  
  // Fallback apenas para Electron (DB local)
  if (!db) {
    throw new Error('Supabase não disponível e DB local não disponível')
  }
  
  try {
    await db.delete(kitchens).where(eq(kitchens.id, id)).run()
    return true
  } catch (err) {
    console.error('Erro ao deletar cozinha do DB local:', err)
    throw err
  }
}

// ====== CATEGORIA-COZINHA ======

export async function getCategoryKitchens(categoryId: string) {
  // Primeiro tenta do DB
  if (db) {
    try {
      const rows = await db
        .select()
        .from(categoryKitchens)
        .where(eq(categoryKitchens.categoryId, categoryId))
      return rows || []
    } catch {
      // Fallback para localStorage
    }
  }
  
  // Fallback: localStorage
  try {
    const raw = localStorage.getItem('categoryKitchens')
    const list = raw ? JSON.parse(raw) : []
    return list.filter((ck: any) => ck.categoryId === categoryId)
  } catch {
    return []
  }
}

export async function setCategoryKitchens(categoryId: string, kitchenIds: string[]) {
  const now = new Date().toISOString()
  
  // Salva no DB se disponível
  if (db) {
    try {
      // Remove associações existentes
      await db.delete(categoryKitchens).where(eq(categoryKitchens.categoryId, categoryId)).run()
      
      // Adiciona novas associações
      for (const kitchenId of kitchenIds) {
        await db
          .insert(categoryKitchens)
          .values({
            id: uuid(),
            categoryId,
            kitchenId,
            updatedAt: now,
          })
          .run()
      }
    } catch (err) {
      console.error('Erro ao definir cozinhas da categoria no DB:', err)
    }
  }
  
  // Sempre salva no localStorage como backup
  try {
    const raw = localStorage.getItem('categoryKitchens')
    const list = raw ? JSON.parse(raw) : []
    
    // Remove associações existentes desta categoria
    const filtered = list.filter((ck: any) => ck.categoryId !== categoryId)
    
    // Adiciona novas associações
    const newAssociations = kitchenIds.map(kitchenId => ({
      id: uuid(),
      categoryId,
      kitchenId,
      updatedAt: now,
    }))
    
    localStorage.setItem('categoryKitchens', JSON.stringify([...filtered, ...newAssociations]))
  } catch (err) {
    console.error('Erro ao definir cozinhas da categoria no localStorage:', err)
  }
}

export async function getKitchenCategories(kitchenId: string) {
  if (!db) return []
  try {
    const rows = await db
      .select()
      .from(categoryKitchens)
      .where(eq(categoryKitchens.kitchenId, kitchenId))
    return rows || []
  } catch {
    return []
  }
}

// ====== OPERADORES DE COZINHA ======

export async function listKitchenOperators() {
  if (!db) return []
  try {
    const rows = await db.select().from(kitchenOperators)
    return rows || []
  } catch {
    return []
  }
}

export async function upsertKitchenOperator(payload: {
  id?: UUID
  name: string
  role?: string | null
}) {
  if (!db) return payload.id ?? uuid()
  
  const id = payload.id ?? uuid()
  const now = new Date().toISOString()
  
  try {
    const existing = (await db.select().from(kitchenOperators).where(eq(kitchenOperators.id, id)))?.[0]
    
    if (existing) {
      await db
        .update(kitchenOperators)
        .set({
          name: payload.name,
          role: payload.role ?? existing.role,
          updatedAt: now,
          pendingSync: true,
        })
        .where(eq(kitchenOperators.id, id))
        .run()
      return id
    }
    
    await db
      .insert(kitchenOperators)
      .values({
        id,
        name: payload.name,
        role: payload.role ?? null,
        updatedAt: now,
        version: 1,
        pendingSync: true,
      })
      .run()
    return id
  } catch (err) {
    console.error('Erro ao salvar operador:', err)
    return id
  }
}

export async function deleteKitchenOperator(id: UUID) {
  if (!db) return false
  try {
    await db.delete(kitchenOperators).where(eq(kitchenOperators.id, id)).run()
    return true
  } catch {
    return false
  }
}

