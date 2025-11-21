import { supabase } from '@/utils/supabase'

export async function pushBatch(table: string, rows: any[]) {
  if (!supabase || !rows?.length) return
  const { error } = await supabase.from(table).upsert(rows, { onConflict: 'id' })
  if (error) throw new Error(`Push ${table} failed: ${error.message}`)
}

export async function pullSince(table: string, sinceIso: string): Promise<any[]> {
  if (!supabase) return []
  const { data, error } = await supabase.from(table).select('*').gte('updated_at', sinceIso)
  if (error) throw new Error(`Pull ${table} failed: ${error.message}`)
  return data ?? []
}

