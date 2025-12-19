import { supabase } from './supabase'
import { supabaseSync } from './supabaseSync'

/**
 * Utilitário para verificação de integridade de dados entre o estado local e o Supabase.
 * Focado em identificar discrepâncias em pedidos e tickets KDS.
 */

export interface IntegrityIssue {
  type: 'MISSING_REMOTE' | 'MISSING_LOCAL' | 'STATUS_MISMATCH' | 'VALUE_MISMATCH'
  table: string
  id: string
  details: string
  severity: 'low' | 'medium' | 'high'
}

export async function checkOrdersIntegrity(localOrders: any[]): Promise<IntegrityIssue[]> {
  if (!supabase) return []
  
  const issues: IntegrityIssue[] = []
  const localIds = localOrders.map(o => String(o.id))
  
  if (localIds.length === 0) return []

  try {
    // 1. Verificar se pedidos locais existem no remoto
    const { data: remoteOrders, error } = await supabaseSync.select('orders', (q) => 
      q.select('id, status, total_cents, updated_at').in('id', localIds),
      { silent: true }
    )

    if (error) {
      console.error('[Integrity] Erro ao buscar pedidos remotos:', error)
      return []
    }

    const remoteMap = new Map(remoteOrders?.map(o => [String(o.id), o]) || [])

    for (const local of localOrders) {
      const remote = remoteMap.get(String(local.id))

      if (!remote) {
        issues.push({
          type: 'MISSING_REMOTE',
          table: 'orders',
          id: String(local.id),
          details: 'Pedido existe localmente mas não foi encontrado no Supabase.',
          severity: 'high'
        })
        continue
      }

      // 2. Verificar discrepância de status
      // Normalizar status para comparação (local pode usar 'open'/'closed', remoto usa 'NEW'/'DELIVERED' etc)
      const localStatus = String(local.status).toUpperCase()
      const remoteStatus = String(remote.status).toUpperCase()
      
      const statusMap: Record<string, string> = {
        'OPEN': 'NEW',
        'CLOSED': 'DELIVERED',
        'CANCELLED': 'CANCELLED'
      }

      const normalizedLocal = statusMap[localStatus] || localStatus

      if (normalizedLocal !== remoteStatus) {
        issues.push({
          type: 'STATUS_MISMATCH',
          table: 'orders',
          id: String(local.id),
          details: `Status divergente. Local: ${localStatus}, Remoto: ${remoteStatus}`,
          severity: 'medium'
        })
      }

      // 3. Verificar discrepância de valor (permitindo pequena diferença de arredondamento se houver)
      const localTotal = Number(local.total_cents || 0)
      const remoteTotal = Number(remote.total_cents || 0)

      if (Math.abs(localTotal - remoteTotal) > 0) {
        issues.push({
          type: 'VALUE_MISMATCH',
          table: 'orders',
          id: String(local.id),
          details: `Total divergente. Local: ${localTotal}, Remoto: ${remoteTotal}`,
          severity: 'medium'
        })
      }
    }

  } catch (err) {
    console.error('[Integrity] Erro inesperado na verificação de pedidos:', err)
  }

  return issues
}

export async function checkKdsIntegrity(localTickets: any[]): Promise<IntegrityIssue[]> {
  if (!supabase) return []
  
  const issues: IntegrityIssue[] = []
  const localIds = localTickets.map(t => String(t.id))
  
  if (localIds.length === 0) return []

  try {
    const { data: remoteTickets, error } = await supabaseSync.select('kds_tickets', (q) => 
      q.select('id, status, order_id').in('id', localIds),
      { silent: true }
    )

    if (error) {
      console.error('[Integrity] Erro ao buscar tickets remotos:', error)
      return []
    }

    const remoteMap = new Map(remoteTickets?.map(t => [String(t.id), t]) || [])

    for (const local of localTickets) {
      const remote = remoteMap.get(String(local.id))

      if (!remote) {
        issues.push({
          type: 'MISSING_REMOTE',
          table: 'kds_tickets',
          id: String(local.id),
          details: `Ticket KDS (Pedido ${local.order_id}) não encontrado no Supabase.`,
          severity: 'high'
        })
        continue
      }

      if (String(local.status).toLowerCase() !== String(remote.status).toLowerCase()) {
        issues.push({
          type: 'STATUS_MISMATCH',
          table: 'kds_tickets',
          id: String(local.id),
          details: `Status do ticket divergente. Local: ${local.status}, Remoto: ${remote.status}`,
          severity: 'medium'
        })
      }
    }
  } catch (err) {
    console.error('[Integrity] Erro inesperado na verificação do KDS:', err)
  }

  return issues
}

/**
 * Executa uma verificação completa e loga os resultados.
 */
export async function runFullIntegrityCheck(data: { orders: any[], kdsTickets: any[] }) {
  console.log('[Integrity] Iniciando verificação completa...')
  
  const orderIssues = await checkOrdersIntegrity(data.orders)
  const kdsIssues = await checkKdsIntegrity(data.kdsTickets)
  
  const allIssues = [...orderIssues, ...kdsIssues]
  
  if (allIssues.length === 0) {
    console.log('[Integrity] ✅ Nenhuma inconsistência detectada.')
    return { success: true, issues: [] }
  }

  console.warn(`[Integrity] ⚠️ Detectadas ${allIssues.length} inconsistências:`)
  allIssues.forEach(issue => {
    console.warn(`- [${issue.table}] ${issue.type} ID:${issue.id}: ${issue.details} (Severidade: ${issue.severity})`)
  })

  // Aqui poderíamos enviar um log para o Supabase ou sistema de monitoramento
  if (supabase) {
    try {
      await supabaseSync.insert('integrity_logs', allIssues.map(i => ({
        type: i.type,
        table_name: i.table,
        record_id: i.id,
        details: i.details,
        severity: i.severity,
        created_at: new Date().toISOString()
      })))
    } catch (err) {
      console.error('[Integrity] Falha ao persistir logs de integridade:', err)
    }
  }

  return { success: false, issues: allIssues }
}
