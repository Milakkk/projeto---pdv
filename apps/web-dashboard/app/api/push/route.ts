import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/app/../lib/supabaseAdmin'

export const runtime = 'nodejs'

type Event = { table: string; rows?: any[]; row?: any; unit_id?: string; created_at?: string; updated_at?: string }

const ALLOWED = new Set(['orders', 'order_items', 'kds_tickets', 'payments'])

export async function POST(req: Request) {
  const secret = process.env.LAN_SYNC_SECRET
  const auth = req.headers.get('authorization') || req.headers.get('Authorization' as any)
  const token = auth && auth.startsWith('Bearer ') ? auth.slice(7) : auth || ''
  if (secret && token !== secret) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  try {
    const body = await req.json()
    const events = (body?.events || []) as Event[]
    if (!events.length) {
      return NextResponse.json({ ok: true, count: 0 })
    }
    const supabase = getSupabaseAdmin()
    let count = 0
    for (const e of events) {
      const table = String(e.table || '').trim()
      if (!ALLOWED.has(table)) continue
      const rows = e.rows && Array.isArray(e.rows) ? e.rows : e.row ? [e.row] : []
      if (!rows.length) continue
      const { error } = await supabase.from(table).upsert(rows, { onConflict: 'id' })
      if (!error) count += rows.length
      if (table === 'kds_tickets') {
        for (const r of rows) {
          const s = String(r.status || '').toLowerCase()
          let orderStatus: 'NEW' | 'PREPARING' | 'READY' | 'DELIVERED' | undefined
          if (s === 'queued') orderStatus = 'NEW'
          else if (s === 'prep') orderStatus = 'PREPARING'
          else if (s === 'ready') orderStatus = 'READY'
          else if (s === 'done') orderStatus = 'DELIVERED'
          if (orderStatus && r.order_id) {
            await supabase.from('orders').update({ status: orderStatus }).eq('id', r.order_id)
          }
        }
      }
    }
    return NextResponse.json({ ok: true, count })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message ?? 'bad request' }, { status: 400 })
  }
}
