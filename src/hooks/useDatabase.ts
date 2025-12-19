import { useState, useEffect, useCallback } from 'react'
import { useLocalStorage } from './useLocalStorage'
import * as kitchenService from '@/offline/services/kitchenService'
import * as configService from '@/offline/services/configService'
import * as storeService from '@/offline/services/storeService'
import * as ordersCompleteService from '@/offline/services/ordersCompleteService'
import { db } from '@/offline/db/client'
import { Order, OperationalSession, KitchenOperator } from '@/types'
import { supabase } from '@/utils/supabase'

// Verifica se o SQLite está disponível
const isDbAvailable = !!db

// ====== HOOK GENÉRICO PARA DADOS COM FALLBACK ======

export function useDatabaseValue<T>(
  key: string,
  defaultValue: T,
  fetchFromDb: () => Promise<T>,
  saveToDb: (value: T) => Promise<void>
) {
  const [localStorage, setLocalStorage] = useLocalStorage<T>(key, defaultValue)
  const [value, setValue] = useState<T>(localStorage)
  const [loading, setLoading] = useState(true)

  // Carrega do banco na inicialização
  useEffect(() => {
    let mounted = true
    
    const load = async () => {
      if (isDbAvailable) {
        try {
          const dbValue = await fetchFromDb()
          if (mounted && dbValue !== undefined && dbValue !== null) {
            setValue(dbValue)
            // Sincroniza com localStorage para compatibilidade
            setLocalStorage(dbValue)
          }
        } catch (err) {
          console.warn(`Erro ao carregar ${key} do DB, usando localStorage:`, err)
        }
      }
      if (mounted) setLoading(false)
    }
    
    load()
    return () => { mounted = false }
  }, [key])

  // Função para atualizar valor
  const updateValue = useCallback(async (newValue: T | ((prev: T) => T)) => {
    const resolved = typeof newValue === 'function' 
      ? (newValue as (prev: T) => T)(value) 
      : newValue
    
    setValue(resolved)
    setLocalStorage(resolved)
    
    if (isDbAvailable) {
      try {
        await saveToDb(resolved)
      } catch (err) {
        console.warn(`Erro ao salvar ${key} no DB:`, err)
      }
    }
  }, [value, key, setLocalStorage, saveToDb])

  return { value, setValue: updateValue, loading }
}

// ====== HOOKS ESPECÍFICOS ======

// Hook para cozinhas
export interface Kitchen {
  id: string
  name: string
  unitId?: string | null
  isActive: boolean
  displayOrder: number
}

export function useKitchens() {
  const [kitchens, setKitchensState] = useState<Kitchen[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    
    const load = async () => {
      try {
        setLoading(true)
        // SEMPRE carrega do Supabase/DB (nada de localStorage)
        const dbKitchens = await kitchenService.listKitchens()
        
        if (mounted) {
          const mapped = dbKitchens.map(k => ({
            id: k.id,
            name: k.name,
            unitId: k.unitId,
            isActive: k.isActive ?? true,
            displayOrder: k.displayOrder ?? 0,
          }))
          setKitchensState(mapped)
        }
      } catch (err) {
        console.error('Erro ao carregar cozinhas:', err)
        if (mounted) {
          setKitchensState([])
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }
    
    load()
    
    // Subscreve mudanças em tempo real do Supabase (se disponível)
    let subscription: any = null
    if (supabase) {
      subscription = supabase
        .channel('kitchens-changes')
        .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'kitchens' },
          () => {
            // Recarrega quando há mudanças
            if (mounted) {
              load()
            }
          }
        )
        .subscribe()
    }
    
    return () => { 
      mounted = false
      if (subscription) {
        subscription.unsubscribe()
      }
    }
  }, [])

  const addKitchen = useCallback(async (kitchen: Omit<Kitchen, 'id'>) => {
    const id = crypto.randomUUID()
    const newKitchen = { ...kitchen, id }
    
    try {
      console.log('[useKitchens] Tentando adicionar cozinha:', newKitchen)
      
      // SEMPRE salva no Supabase/DB (nada de localStorage)
      await kitchenService.upsertKitchen(newKitchen)
      
      console.log('[useKitchens] Cozinha salva com sucesso, ID:', id)
      
      // Recarrega do banco para garantir sincronização
      const updated = await kitchenService.listKitchens()
      const mapped = updated.map(k => ({
        id: k.id,
        name: k.name,
        unitId: k.unitId,
        isActive: k.isActive ?? true,
        displayOrder: k.displayOrder ?? 0,
      }))
      setKitchensState(mapped)
      
      return id
    } catch (err: any) {
      console.error('[useKitchens] Erro ao adicionar cozinha:', err)
      throw new Error(err?.message || 'Erro ao salvar cozinha no banco de dados')
    }
  }, [])

  const deleteKitchen = useCallback(async (id: string) => {
    // SEMPRE remove do Supabase/DB (nada de localStorage)
    await kitchenService.deleteKitchen(id)
    
    // Atualiza estado local
    setKitchensState(prev => prev.filter(k => k.id !== id))
  }, [])

  return { 
    kitchens, 
    addKitchen, 
    deleteKitchen, 
    loading 
  }
}

// Hook para pedidos completos
export function useOrders() {
  const [localOrders, setLocalOrders] = useLocalStorage<Order[]>('orders', [])
  const [orders, setOrdersState] = useState<Order[]>(localOrders)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    
    const load = async () => {
      if (isDbAvailable) {
        try {
          const dbOrders = await ordersCompleteService.listOrdersComplete()
          if (mounted && dbOrders.length > 0) {
            setOrdersState(dbOrders)
            setLocalOrders(dbOrders)
          }
        } catch (err) {
          console.warn('Erro ao carregar pedidos do DB:', err)
        }
      }
      if (mounted) setLoading(false)
    }
    
    load()
    return () => { mounted = false }
  }, [])

  const setOrders = useCallback(async (newOrders: Order[] | ((prev: Order[]) => Order[])) => {
    const resolved = typeof newOrders === 'function' 
      ? newOrders(orders) 
      : newOrders
    
    setOrdersState(resolved)
    setLocalOrders(resolved)
    
    if (isDbAvailable) {
      await ordersCompleteService.saveAllOrders(resolved)
    }
  }, [orders, setLocalOrders])

  const addOrder = useCallback(async (order: Order) => {
    if (isDbAvailable) {
      await ordersCompleteService.upsertOrderComplete(order)
    }
    
    setOrdersState(prev => [...prev, order])
    setLocalOrders(prev => [...prev, order])
  }, [setLocalOrders])

  const updateOrder = useCallback(async (id: string, updates: Partial<Order>) => {
    const updated = orders.map(o => o.id === id ? { ...o, ...updates } as Order : o)
    setOrdersState(updated)
    setLocalOrders(updated)
    
    if (isDbAvailable) {
      const order = updated.find(o => o.id === id)
      if (order) {
        await ordersCompleteService.upsertOrderComplete(order)
      }
    }
  }, [orders, setLocalOrders])

  return { orders, setOrders, addOrder, updateOrder, loading }
}

// Hook para operadores de cozinha
export function useKitchenOperators() {
  const [localOperators, setLocalOperators] = useLocalStorage<KitchenOperator[]>('kitchenOperators', [])
  const [operators, setOperatorsState] = useState<KitchenOperator[]>(localOperators)
  const [loading, setLoading] = useState(false) // Inicializa como false - dados já vêm do localStorage

  useEffect(() => {
    let mounted = true
    
    const load = async () => {
      // Timeout de segurança para evitar loading infinito
      const timeout = setTimeout(() => {
        if (mounted) setLoading(false)
      }, 3000)
      
      if (isDbAvailable) {
        try {
          const dbOperators = await kitchenService.listKitchenOperators()
          if (mounted && dbOperators.length > 0) {
            const mapped = dbOperators.map(op => ({
              id: op.id,
              name: op.name,
            }))
            setOperatorsState(mapped)
            setLocalOperators(mapped)
          }
        } catch (err) {
          console.warn('Erro ao carregar operadores do DB:', err)
        }
      }
      
      clearTimeout(timeout)
      if (mounted) setLoading(false)
    }
    
    load()
    return () => { mounted = false }
  }, [])

  const setOperators = useCallback(async (newOperators: KitchenOperator[] | ((prev: KitchenOperator[]) => KitchenOperator[])) => {
    const resolved = typeof newOperators === 'function' 
      ? newOperators(operators) 
      : newOperators
    
    setOperatorsState(resolved)
    setLocalOperators(resolved)
    
    if (isDbAvailable) {
      for (const op of resolved) {
        try {
          await kitchenService.upsertKitchenOperator(op)
        } catch (err) {
          console.warn('Erro ao salvar operador:', err)
        }
      }
    }
  }, [operators, setLocalOperators])

  const addOperator = useCallback(async (name: string) => {
    const id = crypto.randomUUID()
    const newOperator = { id, name }
    
    if (isDbAvailable) {
      await kitchenService.upsertKitchenOperator(newOperator)
    }
    
    setOperatorsState(prev => [...prev, newOperator])
    setLocalOperators(prev => [...prev, newOperator])
    
    return id
  }, [setLocalOperators])

  const deleteOperator = useCallback(async (id: string) => {
    const filtered = operators.filter(op => op.id !== id)
    setOperatorsState(filtered)
    setLocalOperators(filtered)
    
    if (isDbAvailable) {
      await kitchenService.deleteKitchenOperator(id)
    }
  }, [operators, setLocalOperators])

  return { operators, setOperators, addOperator, deleteOperator, loading }
}

// Hook para sessões operacionais
export function useOperationalSession() {
  const [localSession, setLocalSession] = useLocalStorage<OperationalSession | null>('currentOperationalSession', null)
  const [session, setSessionState] = useState<OperationalSession | null>(localSession)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    
    const load = async () => {
      if (isDbAvailable) {
        try {
          const dbSession = await ordersCompleteService.getCurrentOperationalSession()
          if (mounted && dbSession) {
            setSessionState(dbSession)
            setLocalSession(dbSession)
          }
        } catch (err) {
          console.warn('Erro ao carregar sessão do DB:', err)
        }
      }
      if (mounted) setLoading(false)
    }
    
    load()
    return () => { mounted = false }
  }, [])

  const setSession = useCallback(async (newSession: OperationalSession | null) => {
    setSessionState(newSession)
    setLocalSession(newSession)
    
    if (isDbAvailable && newSession) {
      await ordersCompleteService.upsertOperationalSession(newSession)
    }
  }, [setLocalSession])

  const closeSession = useCallback(async () => {
    if (session) {
      const closed = { ...session, status: 'CLOSED' as const, closingTime: new Date() }
      setSessionState(null)
      setLocalSession(null)
      
      if (isDbAvailable) {
        await ordersCompleteService.closeOperationalSession(session.id)
      }
    }
  }, [session, setLocalSession])

  return { session, setSession, closeSession, loading }
}

// Hook para configurações do app
export function useAppConfig() {
  const [localConfig, setLocalConfig] = useLocalStorage<configService.AppSettings>('appConfig', {
    checkoutShortcut: 'F',
    soundAlert: true,
    darkMode: false,
    defaultSla: 15,
    establishmentName: 'Meu Estabelecimento',
    passwordFormat: 'numeric',
    maxKitchens: 5,
  })
  const [config, setConfigState] = useState<configService.AppSettings>(localConfig)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    
    const load = async () => {
      if (isDbAvailable) {
        try {
          const dbConfig = await configService.getAppSettings()
          if (mounted) {
            setConfigState(dbConfig)
            setLocalConfig(dbConfig)
          }
        } catch (err) {
          console.warn('Erro ao carregar configurações do DB:', err)
        }
      }
      if (mounted) setLoading(false)
    }
    
    load()
    return () => { mounted = false }
  }, [])

  const setConfig = useCallback(async (newConfig: Partial<configService.AppSettings>) => {
    const updated = { ...config, ...newConfig }
    setConfigState(updated)
    setLocalConfig(updated)
    
    if (isDbAvailable) {
      await configService.setAppSettings(newConfig)
    }
  }, [config, setLocalConfig])

  return { config, setConfig, loading }
}

// Hook para observações globais
// ====== SESSÕES DE COZINHA (Cozinha Aberta/Online) ======
export interface KitchenSession {
  id: string
  kitchenId: string
  kitchenName: string
  operatorId?: string
  operatorName?: string
  openedAt: Date
  closedAt?: Date
  status: 'OPEN' | 'CLOSED'
}

export function useKitchenSessions() {
  const [localSessions, setLocalSessions] = useLocalStorage<KitchenSession[]>('kitchenSessions', [])
  const [sessions, setSessionsState] = useState<KitchenSession[]>(localSessions)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      // Por ora, usa localStorage (pode integrar com DB futuramente)
      if (mounted) setLoading(false)
    }
    load()
    return () => { mounted = false }
  }, [])

  // Sessões abertas (cozinhas online)
  const openSessions = sessions.filter(s => s.status === 'OPEN')
  
  // IDs das cozinhas atualmente online
  const onlineKitchenIds = openSessions.map(s => s.kitchenId)

  const openKitchenSession = useCallback((kitchenId: string, kitchenName: string, operatorId?: string, operatorName?: string) => {
    // Verifica se já está aberta
    const existing = sessions.find(s => s.kitchenId === kitchenId && s.status === 'OPEN')
    if (existing) return existing.id

    const newSession: KitchenSession = {
      id: crypto.randomUUID(),
      kitchenId,
      kitchenName,
      operatorId,
      operatorName,
      openedAt: new Date(),
      status: 'OPEN',
    }
    
    const updated = [...sessions, newSession]
    setSessionsState(updated)
    setLocalSessions(updated)
    return newSession.id
  }, [sessions, setLocalSessions])

  const closeKitchenSession = useCallback((kitchenId: string) => {
    const updated = sessions.map(s => 
      s.kitchenId === kitchenId && s.status === 'OPEN' 
        ? { ...s, status: 'CLOSED' as const, closedAt: new Date() }
        : s
    )
    setSessionsState(updated)
    setLocalSessions(updated)
  }, [sessions, setLocalSessions])

  const isKitchenOnline = useCallback((kitchenId: string) => {
    return onlineKitchenIds.includes(kitchenId)
  }, [onlineKitchenIds])

  const getKitchenSession = useCallback((kitchenId: string) => {
    return sessions.find(s => s.kitchenId === kitchenId && s.status === 'OPEN')
  }, [sessions])

  return { 
    sessions, 
    openSessions,
    onlineKitchenIds,
    openKitchenSession, 
    closeKitchenSession, 
    isKitchenOnline,
    getKitchenSession,
    loading 
  }
}

// ====== INSUMOS ESGOTADOS ======
export interface OutOfStockIngredient {
  ingredientId: string
  ingredientName: string
  outOfStockAt: Date
}

export function useOutOfStockIngredients() {
  const [localIngredients, setLocalIngredients] = useLocalStorage<OutOfStockIngredient[]>('outOfStockIngredients', [])
  const [ingredients, setIngredientsState] = useState<OutOfStockIngredient[]>(localIngredients)
  const [loading, setLoading] = useState(false)

  // IDs dos insumos esgotados para consulta rápida
  const outOfStockIds = ingredients.map(i => i.ingredientId)

  const markAsOutOfStock = useCallback((ingredientId: string, ingredientName: string) => {
    const exists = ingredients.find(i => i.ingredientId === ingredientId)
    if (exists) return
    
    const newItem: OutOfStockIngredient = {
      ingredientId,
      ingredientName,
      outOfStockAt: new Date(),
    }
    
    const updated = [...ingredients, newItem]
    setIngredientsState(updated)
    setLocalIngredients(updated)
  }, [ingredients, setLocalIngredients])

  const markAsAvailable = useCallback((ingredientId: string) => {
    const updated = ingredients.filter(i => i.ingredientId !== ingredientId)
    setIngredientsState(updated)
    setLocalIngredients(updated)
  }, [ingredients, setLocalIngredients])

  const isOutOfStock = useCallback((ingredientId: string) => {
    return outOfStockIds.includes(ingredientId)
  }, [outOfStockIds])

  const clearAll = useCallback(() => {
    setIngredientsState([])
    setLocalIngredients([])
  }, [setLocalIngredients])

  return {
    outOfStockIngredients: ingredients,
    outOfStockIds,
    markAsOutOfStock,
    markAsAvailable,
    isOutOfStock,
    clearAll,
    loading,
  }
}

export function useGlobalObservations() {
  const [localObs, setLocalObs] = useLocalStorage<string[]>('globalObservations', [
    'Sem cebola',
    'Sem tomate',
    'Sem maionese',
    'Bem passado',
    'Mal passado',
    'Extra queijo',
    'Sem pimenta'
  ])
  const [observations, setObservationsState] = useState<string[]>(localObs)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    
    const load = async () => {
      if (isDbAvailable) {
        try {
          const dbObs = await configService.listGlobalObservations()
          if (mounted && dbObs.length > 0) {
            setObservationsState(dbObs)
            setLocalObs(dbObs)
          }
        } catch (err) {
          console.warn('Erro ao carregar observações do DB:', err)
        }
      }
      if (mounted) setLoading(false)
    }
    
    load()
    return () => { mounted = false }
  }, [])

  const setObservations = useCallback(async (newObs: string[]) => {
    setObservationsState(newObs)
    setLocalObs(newObs)
    
    if (isDbAvailable) {
      await configService.setGlobalObservations(newObs)
    }
  }, [setLocalObs])

  const addObservation = useCallback(async (obs: string) => {
    if (obs.trim() && !observations.includes(obs.trim())) {
      const updated = [...observations, obs.trim()]
      setObservationsState(updated)
      setLocalObs(updated)
      
      if (isDbAvailable) {
        await configService.addGlobalObservation(obs.trim())
      }
    }
  }, [observations, setLocalObs])

  const removeObservation = useCallback(async (obs: string) => {
    const updated = observations.filter(o => o !== obs)
    setObservationsState(updated)
    setLocalObs(updated)
    
    if (isDbAvailable) {
      await configService.removeGlobalObservation(obs)
    }
  }, [observations, setLocalObs])

  return { observations, setObservations, addObservation, removeObservation, loading }
}

