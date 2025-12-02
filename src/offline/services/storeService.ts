import { db } from '@/offline/db/client'
import { stores, users, roles, paymentMethods } from '@/offline/db/schema'
import { eq } from 'drizzle-orm'

type UUID = string

const uuid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`

// ====== LOJAS ======

export async function listStores() {
  if (!db) return []
  try {
    const rows = await db.select().from(stores)
    return rows || []
  } catch {
    return []
  }
}

export async function getStoreById(id: string) {
  if (!db) return null
  try {
    const row = (await db.select().from(stores).where(eq(stores.id, id)))?.[0]
    return row ?? null
  } catch {
    return null
  }
}

export async function upsertStore(payload: {
  id?: UUID
  name: string
  address?: string | null
  isActive?: boolean
}) {
  if (!db) return payload.id ?? uuid()
  
  const id = payload.id ?? uuid()
  const now = new Date().toISOString()
  
  try {
    const existing = (await db.select().from(stores).where(eq(stores.id, id)))?.[0]
    
    if (existing) {
      await db
        .update(stores)
        .set({
          name: payload.name,
          address: payload.address ?? existing.address,
          isActive: payload.isActive ?? existing.isActive,
          updatedAt: now,
          pendingSync: true,
        })
        .where(eq(stores.id, id))
        .run()
      return id
    }
    
    await db
      .insert(stores)
      .values({
        id,
        name: payload.name,
        address: payload.address ?? null,
        isActive: payload.isActive ?? true,
        createdAt: now,
        updatedAt: now,
        version: 1,
        pendingSync: true,
      })
      .run()
    return id
  } catch (err) {
    console.error('Erro ao salvar loja:', err)
    return id
  }
}

export async function deleteStore(id: UUID) {
  if (!db) return false
  try {
    await db.delete(stores).where(eq(stores.id, id)).run()
    return true
  } catch {
    return false
  }
}

// ====== PERFIS (ROLES) ======

export async function listRoles() {
  if (!db) return []
  try {
    const rows = await db.select().from(roles)
    return (rows || []).map(r => ({
      ...r,
      permissions: r.permissions ? JSON.parse(r.permissions) : [],
    }))
  } catch {
    return []
  }
}

export async function getRoleById(id: string) {
  if (!db) return null
  try {
    const row = (await db.select().from(roles).where(eq(roles.id, id)))?.[0]
    if (!row) return null
    return {
      ...row,
      permissions: row.permissions ? JSON.parse(row.permissions) : [],
    }
  } catch {
    return null
  }
}

export async function upsertRole(payload: {
  id?: UUID
  name: string
  permissions?: string[]
}) {
  if (!db) return payload.id ?? uuid()
  
  const id = payload.id ?? uuid()
  const now = new Date().toISOString()
  const permissionsJson = JSON.stringify(payload.permissions || [])
  
  try {
    const existing = (await db.select().from(roles).where(eq(roles.id, id)))?.[0]
    
    if (existing) {
      await db
        .update(roles)
        .set({
          name: payload.name,
          permissions: permissionsJson,
          updatedAt: now,
          pendingSync: true,
        })
        .where(eq(roles.id, id))
        .run()
      return id
    }
    
    await db
      .insert(roles)
      .values({
        id,
        name: payload.name,
        permissions: permissionsJson,
        createdAt: now,
        updatedAt: now,
        version: 1,
        pendingSync: true,
      })
      .run()
    return id
  } catch (err) {
    console.error('Erro ao salvar perfil:', err)
    return id
  }
}

export async function deleteRole(id: UUID) {
  if (!db) return false
  try {
    await db.delete(roles).where(eq(roles.id, id)).run()
    return true
  } catch {
    return false
  }
}

// ====== USUÁRIOS ======

export async function listUsers() {
  if (!db) return []
  try {
    const rows = await db.select().from(users)
    return rows || []
  } catch {
    return []
  }
}

export async function getUserById(id: string) {
  if (!db) return null
  try {
    const row = (await db.select().from(users).where(eq(users.id, id)))?.[0]
    return row ?? null
  } catch {
    return null
  }
}

export async function getUserByUsername(username: string) {
  if (!db) return null
  try {
    const row = (await db.select().from(users).where(eq(users.username, username)))?.[0]
    return row ?? null
  } catch {
    return null
  }
}

export async function upsertUser(payload: {
  id?: UUID
  username: string
  name: string
  passwordHash: string
  storeId?: string | null
  roleId?: string | null
  isActive?: boolean
}) {
  if (!db) return payload.id ?? uuid()
  
  const id = payload.id ?? uuid()
  const now = new Date().toISOString()
  
  try {
    const existing = (await db.select().from(users).where(eq(users.id, id)))?.[0]
    
    if (existing) {
      await db
        .update(users)
        .set({
          username: payload.username,
          name: payload.name,
          passwordHash: payload.passwordHash,
          storeId: payload.storeId ?? existing.storeId,
          roleId: payload.roleId ?? existing.roleId,
          isActive: payload.isActive ?? existing.isActive,
          updatedAt: now,
          pendingSync: true,
        })
        .where(eq(users.id, id))
        .run()
      return id
    }
    
    await db
      .insert(users)
      .values({
        id,
        username: payload.username,
        name: payload.name,
        passwordHash: payload.passwordHash,
        storeId: payload.storeId ?? null,
        roleId: payload.roleId ?? null,
        isActive: payload.isActive ?? true,
        createdAt: now,
        updatedAt: now,
        version: 1,
        pendingSync: true,
      })
      .run()
    return id
  } catch (err) {
    console.error('Erro ao salvar usuário:', err)
    return id
  }
}

export async function deleteUser(id: UUID) {
  if (!db) return false
  try {
    await db.delete(users).where(eq(users.id, id)).run()
    return true
  } catch {
    return false
  }
}

// ====== MÉTODOS DE PAGAMENTO ======

export async function listPaymentMethods() {
  if (!db) return []
  try {
    const rows = await db.select().from(paymentMethods)
    return rows || []
  } catch {
    return []
  }
}

export async function upsertPaymentMethod(payload: {
  id?: UUID
  name: string
  shortcut?: string | null
  isActive?: boolean
  displayOrder?: number
}) {
  if (!db) return payload.id ?? uuid()
  
  const id = payload.id ?? uuid()
  const now = new Date().toISOString()
  
  try {
    const existing = (await db.select().from(paymentMethods).where(eq(paymentMethods.id, id)))?.[0]
    
    if (existing) {
      await db
        .update(paymentMethods)
        .set({
          name: payload.name,
          shortcut: payload.shortcut ?? existing.shortcut,
          isActive: payload.isActive ?? existing.isActive,
          displayOrder: payload.displayOrder ?? existing.displayOrder,
          updatedAt: now,
          pendingSync: true,
        })
        .where(eq(paymentMethods.id, id))
        .run()
      return id
    }
    
    await db
      .insert(paymentMethods)
      .values({
        id,
        name: payload.name,
        shortcut: payload.shortcut ?? null,
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
    console.error('Erro ao salvar método de pagamento:', err)
    return id
  }
}

export async function deletePaymentMethod(id: UUID) {
  if (!db) return false
  try {
    await db.delete(paymentMethods).where(eq(paymentMethods.id, id)).run()
    return true
  } catch {
    return false
  }
}

// ====== INICIALIZAÇÃO DE DADOS PADRÃO ======

export async function initializeDefaultData() {
  if (!db) return
  
  try {
    // Verifica se já existem lojas
    const existingStores = await listStores()
    if (existingStores.length === 0) {
      // Cria lojas padrão
      await upsertStore({ id: 'store_1', name: 'Matriz - Centro', address: 'Rua Principal, 100' })
      await upsertStore({ id: 'store_2', name: 'Filial - Shopping', address: 'Av. Comercial, 500' })
    }
    
    // Verifica se já existem perfis
    const existingRoles = await listRoles()
    if (existingRoles.length === 0) {
      // Cria perfis padrão
      await upsertRole({ 
        id: 'role_master', 
        name: 'Administrador Master', 
        permissions: ['CAIXA', 'COZINHA', 'GESTAO', 'MASTER', 'TAREFAS', 'CHECKLIST', 'PROCEDIMENTOS', 'RH'] 
      })
      await upsertRole({ 
        id: 'role_cashier', 
        name: 'Operador de Caixa', 
        permissions: ['CAIXA'] 
      })
      await upsertRole({ 
        id: 'role_kitchen', 
        name: 'Cozinheiro', 
        permissions: ['COZINHA'] 
      })
      await upsertRole({ 
        id: 'role_manager', 
        name: 'Gerente', 
        permissions: ['CAIXA', 'COZINHA', 'GESTAO', 'TAREFAS', 'CHECKLIST', 'PROCEDIMENTOS', 'RH'] 
      })
    }
    
    // Verifica se já existem usuários
    const existingUsers = await listUsers()
    if (existingUsers.length === 0) {
      // Cria usuários padrão
      await upsertUser({ 
        id: 'user_1', 
        username: 'master', 
        name: 'Admin Master', 
        passwordHash: '123456', 
        storeId: 'store_1', 
        roleId: 'role_master' 
      })
      await upsertUser({ 
        id: 'user_2', 
        username: 'caixa', 
        name: 'Operador Caixa', 
        passwordHash: '111', 
        storeId: 'store_1', 
        roleId: 'role_cashier' 
      })
      await upsertUser({ 
        id: 'user_3', 
        username: 'cozinha', 
        name: 'Chef Cozinha', 
        passwordHash: '222', 
        storeId: 'store_2', 
        roleId: 'role_kitchen' 
      })
      await upsertUser({ 
        id: 'user_4', 
        username: 'gerente', 
        name: 'Gerente Geral', 
        passwordHash: '333', 
        storeId: 'store_1', 
        roleId: 'role_manager' 
      })
    }
    
    // Verifica se já existem métodos de pagamento
    const existingMethods = await listPaymentMethods()
    if (existingMethods.length === 0) {
      await upsertPaymentMethod({ id: 'pm_pix', name: 'PIX', shortcut: 'P', displayOrder: 1 })
      await upsertPaymentMethod({ id: 'pm_cash', name: 'Dinheiro', shortcut: 'D', displayOrder: 2 })
      await upsertPaymentMethod({ id: 'pm_debit', name: 'Cartão de Débito', shortcut: 'E', displayOrder: 3 })
      await upsertPaymentMethod({ id: 'pm_credit', name: 'Cartão de Crédito', shortcut: 'C', displayOrder: 4 })
    }
    
    console.log('Dados padrão inicializados com sucesso.')
  } catch (err) {
    console.error('Erro ao inicializar dados padrão:', err)
  }
}

