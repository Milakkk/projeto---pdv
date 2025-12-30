import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const url = process.env.SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !serviceKey) {
      res.status(500).json({ error: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing' })
      return
    }
    const supa = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
    const limit = Math.max(1, Math.min(500, Number(req.query.limit ?? 120)))

    const { data: ords, error: ordErr } = await supa
      .from('orders')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(limit)
    if (ordErr) {
      res.status(500).json({ error: ordErr.message })
      return
    }
    const ids = (ords || []).map((r: any) => String(r.id)).filter(Boolean)
    if (!ids.length) {
      res.status(200).json([])
      return
    }

    const [{ data: itemsData, error: itemsErr }, { data: paysData, error: paysErr }, { data: timesData }] =
      await Promise.all([
        supa.from('order_items').select('id, order_id, product_id, product_name, quantity, unit_price_cents, total_cents').in('order_id', ids),
        supa.from('payments').select('order_id, method, amount_cents, change_cents').in('order_id', ids),
        supa.from('kds_phase_times').select('*').in('order_id', ids),
      ])
    if (itemsErr) {
      res.status(500).json({ error: itemsErr.message })
      return
    }
    if (paysErr) {
      res.status(500).json({ error: paysErr.message })
      return
    }

    const prodIds = Array.from(
      new Set((itemsData || []).map((it: any) => String(it.product_id)).filter((id) => id && id !== 'null' && id !== 'undefined')),
    )
    const { data: prods } =
      prodIds.length > 0
        ? await supa.from('products').select('id, category_id, name').in('id', prodIds)
        : { data: [] as any[] }
    const catByProd: Record<string, string | null> = {}
    for (const p of prods || []) catByProd[String((p as any).id)] = (p as any).category_id ?? null

    const itemsByOrder: Record<string, any[]> = {}
    for (const it of (itemsData || []) as any[]) {
      const oid = String((it as any).order_id)
      itemsByOrder[oid] = itemsByOrder[oid] || []
      itemsByOrder[oid].push({ ...it, category_id: catByProd[String((it as any).product_id)] ?? null })
    }

    const paysByOrder: Record<string, any[]> = {}
    for (const p of (paysData || []) as any[]) {
      const oid = String((p as any).order_id)
      paysByOrder[oid] = paysByOrder[oid] || []
      paysByOrder[oid].push(p)
    }

    const timesByOrder: Record<string, any> = {}
    for (const t of (timesData || []) as any[]) {
      const oid = String((t as any).order_id)
      timesByOrder[oid] = {
        newStart: (t as any).new_start,
        preparingStart: (t as any).preparing_start,
        readyAt: (t as any).ready_at,
        deliveredAt: (t as any).delivered_at,
      }
    }

    const out = (ords || []).map((r: any) => ({
      order: r,
      items: itemsByOrder[String(r.id)] || [],
      payments: paysByOrder[String(r.id)] || [],
      details: { pin: (r as any).pin, password: (r as any).password },
      phaseTimes: timesByOrder[String(r.id)],
    }))
    res.status(200).json(out)
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? 'Unexpected error' })
  }
}
