import { getSupabaseAdmin } from '@/app/../lib/supabaseAdmin'

export const runtime = 'edge'

export async function GET() {
  // @ts-ignore
  const pair = new (globalThis as any).WebSocketPair()
  const client = pair[0]
  const server = pair[1]
  server.accept()
  let unitId = ''
  let channel: any = null
  const supabase = getSupabaseAdmin() as any
  server.addEventListener('message', async (ev: any) => {
    try {
      const msg = JSON.parse(String(ev.data || '{}'))
      if (msg?.unit_id && !unitId) {
        unitId = String(msg.unit_id)
        server.send(JSON.stringify({ type: 'hello', unit_id: unitId }))
        channel = supabase.channel(`kds_${unitId}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'kds_tickets' }, (payload: any) => {
            const e = { table: 'kds_tickets', row: payload.new, unit_id: unitId, updated_at: payload.commit_timestamp }
            server.send(JSON.stringify({ type: 'events', unit_id: unitId, events: [e] }))
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload: any) => {
            const e = { table: 'orders', row: payload.new, unit_id: unitId, updated_at: payload.commit_timestamp }
            server.send(JSON.stringify({ type: 'events', unit_id: unitId, events: [e] }))
          })
          .subscribe()
      }
    } catch {}
  })
  server.addEventListener('close', () => {
    if (channel) {
      try { supabase.removeChannel(channel) } catch {}
    }
  })
  // @ts-ignore
  return new Response(null, { status: 101, webSocket: client })
}
