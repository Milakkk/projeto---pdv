import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/app/../lib/supabaseAdmin'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { email, personId, unitId, role } = body as { email: string, personId?: string, unitId?: string, role?: string }

    if (!email) {
      return NextResponse.json({ error: 'E-mail é obrigatório' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    const { data: created, error } = await supabase.auth.admin.createUser({ email, email_confirm: true })
    if (error || !created?.user) {
      return NextResponse.json({ error: error?.message ?? 'Falha ao criar usuário' }, { status: 400 })
    }

    const userId = created.user.id

    // Associações iniciais de unidade/perfil (tabelas devem existir no Supabase)
    if (unitId) {
      await supabase.from('user_units').insert({ user_id: userId, unit_id: unitId, role: role ?? 'hr_manager' })
    }

    if (personId) {
      await supabase.from('person_users').insert({ person_id: personId, user_id: userId })
    }

    return NextResponse.json({ ok: true, userId })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Erro inesperado' }, { status: 500 })
  }
}

