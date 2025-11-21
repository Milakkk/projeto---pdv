import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { masterId, operatorName, items } = body || {}
    if (!masterId || !operatorName || !Array.isArray(items)) {
      return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 })
    }
    const supa = getSupabaseAdmin()
    const { data: master } = await supa
      .from('checklist_masters')
      .select('id,name,unit_id')
      .eq('id', masterId)
      .single()
    if (!master) return NextResponse.json({ error: 'Checklist inexistente' }, { status: 404 })

    const { data: execRow, error: execErr } = await supa
      .from('checklist_executions')
      .insert({ master_id: master.id, unit_id: master.unit_id, name: master.name, status: 'IN_PROGRESS', completion_percentage: 0 })
      .select('id')
      .single()
    if (execErr) throw execErr
    const execId = execRow.id as string

    const rows = (items as any[]).map((it) => ({
      execution_id: execId,
      item_id: it.id,
      description: it.description,
      required_photo: !!it.required_photo,
      is_completed: !!it.is_completed,
      notes: null,
    }))
    const doneCount = rows.filter(r => r.is_completed).length
    const pct = rows.length ? Math.round((doneCount / rows.length) * 100) : 0

    const { error: itemsErr } = await supa.from('checklist_execution_items').insert(rows)
    if (itemsErr) throw itemsErr

    await supa
      .from('checklist_executions')
      .update({ completion_percentage: pct, status: pct === 100 ? 'COMPLETED' : 'IN_PROGRESS', completed_at: pct === 100 ? new Date().toISOString() : null })
      .eq('id', execId)

    return NextResponse.json({ ok: true, executionId: execId })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Erro interno' }, { status: 500 })
  }
}

