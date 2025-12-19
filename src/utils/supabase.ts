import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

// Se variáveis não estiverem definidas (modo offline/Electron), exporta null e
// os módulos de sync/realtime farão short-circuit sem quebrar a UI.
export const supabase = url && anonKey
  ? createClient(url, anonKey, { auth: { persistSession: false } })
  : null as any

// Log para debug (apenas em desenvolvimento)
if (import.meta.env.DEV) {
  if (supabase) {
    console.log('[Supabase] Cliente inicializado com sucesso:', url)
  } else {
    console.warn('[Supabase] Cliente NÃO inicializado. URL:', url, 'Key:', anonKey ? 'presente' : 'ausente')
  }
}
