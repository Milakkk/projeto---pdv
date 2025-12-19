import * as ordersService from '../offline/services/ordersService'
import * as kdsService from '../offline/services/kdsService'
import { supabaseSync } from './supabaseSync'

/**
 * Utilitário para validação do sistema em cenários de estresse e erro.
 */

export async function runLoadTest(count = 20) {
  console.log(`[Test] Iniciando teste de carga: ${count} pedidos...`)
  const start = performance.now()
  const orderIds: string[] = []

  for (let i = 0; i < count; i++) {
    try {
      const id = await ordersService.createOrder({
        notes: `Teste de Carga #${i + 1}`,
      })
      orderIds.push(id)
      
      // Adiciona um item para gerar ticket KDS
      await ordersService.addItem({
        orderId: id,
        productId: null, // Item genérico
        qty: 1,
        unitPriceCents: 1000,
        notes: 'Item de teste'
      })
      
      if ((i + 1) % 5 === 0) console.log(`[Test] Criados ${i + 1} pedidos...`)
    } catch (err) {
      console.error(`[Test] Falha no pedido ${i + 1}:`, err)
    }
  }

  const end = performance.now()
  console.log(`[Test] Teste de carga concluído em ${Math.round(end - start)}ms. Total: ${orderIds.length} pedidos.`)
  return orderIds
}

export async function simulateIntermittentConnection(durationMs = 30000) {
  console.log('[Test] Simulando conexão intermitente...')
  
  // Como não podemos desligar o Wi-Fi via JS, vamos "sabotar" o utilitário de sync temporariamente
  const originalWithRetry = (supabaseSync as any).withRetry
  
  let isOffline = false
  const interval = setInterval(() => {
    isOffline = !isOffline
    if (isOffline) {
      console.warn('[Test] MODO OFFLINE SIMULADO ATIVADO')
      ;(supabaseSync as any).withRetry = async () => ({ data: null, error: { message: 'Conexão perdida (Simulado)', code: 'OFFLINE' } })
    } else {
      console.log('[Test] MODO ONLINE RESTAURADO')
      ;(supabaseSync as any).withRetry = originalWithRetry
    }
  }, 5000)

  setTimeout(() => {
    clearInterval(interval)
    ;(supabaseSync as any).withRetry = originalWithRetry
    console.log('[Test] Simulação de conexão intermitente finalizada.')
  }, durationMs)
}

export async function validateDataConsistency() {
  console.log('[Test] Validando consistência de dados...')
  const orders = await ordersService.listAllLocalOrders()
  const tickets = await kdsService.listAllLocalTickets()
  
  const pendingSyncOrders = orders.filter(o => o.pending_sync || o.pendingSync)
  const pendingSyncTickets = tickets.filter(t => t.pending_sync || t.pendingSync)
  
  console.log(`[Test] Resultados:
  - Total Pedidos: ${orders.length} (${pendingSyncOrders.length} pendentes de sync)
  - Total Tickets: ${tickets.length} (${pendingSyncTickets.length} pendentes de sync)
  `)
  
  return {
    ordersCount: orders.length,
    ticketsCount: tickets.length,
    pendingOrders: pendingSyncOrders.length,
    pendingTickets: pendingSyncTickets.length
  }
}
