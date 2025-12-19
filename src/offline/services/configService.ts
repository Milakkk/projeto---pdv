import { db } from '@/offline/db/client'
import { appConfig, globalObservations } from '@/offline/db/schema'
import { eq } from 'drizzle-orm'

type UUID = string

const uuid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`

// ====== CONFIGURAÇÕES DO APP ======

export async function getConfig(key: string): Promise<string | null> {
  if (!db) return null
  try {
    const row = (await db.select().from(appConfig).where(eq(appConfig.key, key)))?.[0]
    return row?.value ?? null
  } catch {
    return null
  }
}

export async function getConfigJson<T>(key: string, defaultValue: T): Promise<T> {
  const value = await getConfig(key)
  if (!value) return defaultValue
  try {
    return JSON.parse(value) as T
  } catch {
    return defaultValue
  }
}

export async function setConfig(key: string, value: string): Promise<boolean> {
  if (!db) return false
  
  const now = new Date().toISOString()
  
  try {
    const existing = (await db.select().from(appConfig).where(eq(appConfig.key, key)))?.[0]
    
    if (existing) {
      await db
        .update(appConfig)
        .set({ value, updatedAt: now })
        .where(eq(appConfig.key, key))
        .run()
    } else {
      await db
        .insert(appConfig)
        .values({ key, value, updatedAt: now })
        .run()
    }
    return true
  } catch (err) {
    console.error('Erro ao salvar configuração:', err)
    return false
  }
}

export async function setConfigJson<T>(key: string, value: T): Promise<boolean> {
  return setConfig(key, JSON.stringify(value))
}

export async function deleteConfig(key: string): Promise<boolean> {
  if (!db) return false
  try {
    await db.delete(appConfig).where(eq(appConfig.key, key)).run()
    return true
  } catch {
    return false
  }
}

export async function getAllConfigs(): Promise<Record<string, string>> {
  if (!db) return {}
  try {
    const rows = await db.select().from(appConfig)
    const result: Record<string, string> = {}
    for (const row of rows || []) {
      result[row.key] = row.value ?? ''
    }
    return result
  } catch {
    return {}
  }
}

// ====== OBSERVAÇÕES GLOBAIS ======

export async function listGlobalObservations(): Promise<string[]> {
  if (!db) return []
  try {
    const rows = await db.select().from(globalObservations)
    return (rows || []).map(r => r.value).filter((v): v is string => v !== null)
  } catch {
    return []
  }
}

export async function addGlobalObservation(value: string): Promise<string> {
  if (!db) return uuid()
  
  const id = uuid()
  const now = new Date().toISOString()
  
  try {
    await db
      .insert(globalObservations)
      .values({
        id,
        key: id,
        value,
        updatedAt: now,
        version: 1,
        pendingSync: true,
      })
      .run()
    return id
  } catch (err) {
    console.error('Erro ao adicionar observação global:', err)
    return id
  }
}

export async function removeGlobalObservation(value: string): Promise<boolean> {
  if (!db) return false
  try {
    const rows = await db.select().from(globalObservations)
    const toDelete = (rows || []).find(r => r.value === value)
    if (toDelete) {
      await db.delete(globalObservations).where(eq(globalObservations.id, toDelete.id)).run()
    }
    return true
  } catch {
    return false
  }
}

export async function setGlobalObservations(values: string[]): Promise<boolean> {
  if (!db) return false
  
  const now = new Date().toISOString()
  
  try {
    // Limpa todas as observações existentes
    const existing = await db.select().from(globalObservations)
    for (const row of existing || []) {
      await db.delete(globalObservations).where(eq(globalObservations.id, row.id)).run()
    }
    
    // Adiciona as novas
    for (const value of values) {
      const id = uuid()
      await db
        .insert(globalObservations)
        .values({
          id,
          key: id,
          value,
          updatedAt: now,
          version: 1,
          pendingSync: true,
        })
        .run()
    }
    return true
  } catch (err) {
    console.error('Erro ao definir observações globais:', err)
    return false
  }
}

// ====== CONFIGURAÇÕES ESPECÍFICAS ======

export interface AppSettings {
  checkoutShortcut: string
  soundAlert: boolean
  darkMode: boolean
  defaultSla: number
  establishmentName: string
  passwordFormat: 'numeric' | 'alphabetic' | 'alphanumeric'
  maxKitchens: number
}

const DEFAULT_SETTINGS: AppSettings = {
  checkoutShortcut: 'F',
  soundAlert: true,
  darkMode: false,
  defaultSla: 15,
  establishmentName: 'Meu Estabelecimento',
  passwordFormat: 'numeric',
  maxKitchens: 5,
}

export async function getAppSettings(): Promise<AppSettings> {
  return getConfigJson<AppSettings>('appSettings', DEFAULT_SETTINGS)
}

export async function setAppSettings(settings: Partial<AppSettings>): Promise<boolean> {
  const current = await getAppSettings()
  return setConfigJson('appSettings', { ...current, ...settings })
}

// ====== ATALHOS DE PAGAMENTO ======

export async function getPaymentShortcuts(): Promise<Record<string, string>> {
  return getConfigJson<Record<string, string>>('paymentShortcuts', {})
}

export async function setPaymentShortcuts(shortcuts: Record<string, string>): Promise<boolean> {
  return setConfigJson('paymentShortcuts', shortcuts)
}



