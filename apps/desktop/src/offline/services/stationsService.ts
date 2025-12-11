
import { supabase } from '../../utils/supabase'

// Renderer: usar IPC seguro exposto pelo preload
const query = async (sql: string, params?: any[]) => {
  const fn = (window as any)?.api?.db?.query
  if (typeof fn !== 'function') throw new Error('Canal de DB indisponível')
  try {
    const res = await fn(sql, params)
    if (res?.error) throw new Error(String(res.error))
    return res as { rows?: any[]; meta?: any; error?: any }
  } catch (e) {
    await new Promise(r => setTimeout(r, 200))
    const res2 = await fn(sql, params)
    if (res2?.error) throw new Error(String(res2.error))
    return res2 as { rows?: any[]; meta?: any; error?: any }
  }
}

export type Station = {
  id: string
  name: string
  unit_id: string
  is_active: boolean
}

export async function listStations(unitId: string): Promise<Station[]> {
  // 1. Tentar Supabase
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('stations')
        .select('*')
        .eq('unit_id', unitId)
        .eq('is_active', true)
        .order('name')
      
      if (error) throw error
      
      if (data) {
        // Cache local
        localStorage.setItem(`stations_${unitId}`, JSON.stringify(data))
        return data as Station[]
      }
    } catch (e) {
      console.warn('[stationsService] Erro ao listar estações no Supabase:', e)
    }
  }

  // 2. Fallback SQLite
  try {
    const res = await query('SELECT * FROM stations WHERE unit_id = ? AND is_active = 1 ORDER BY name', [unitId])
    if (res?.rows && res.rows.length > 0) {
      return res.rows.map((r: any) => ({
        id: String(r.id),
        name: String(r.name),
        unit_id: String(r.unit_id),
        is_active: Boolean(r.is_active)
      }))
    }
  } catch {}

  // 3. Fallback LocalStorage
  try {
    const raw = localStorage.getItem(`stations_${unitId}`)
    if (raw) return JSON.parse(raw) as Station[]
  } catch {}

  return []
}
