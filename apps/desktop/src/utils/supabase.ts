import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

// Logs para debug (apenas em desenvolvimento)
if (import.meta.env.DEV) {
  console.log('[Supabase] Verificando variáveis de ambiente...')
  console.log('[Supabase] VITE_SUPABASE_URL:', url ? `${url.substring(0, 30)}...` : 'NÃO DEFINIDO')
  console.log('[Supabase] VITE_SUPABASE_ANON_KEY:', anonKey ? 'DEFINIDO' : 'NÃO DEFINIDO')
}

// Se variáveis não estiverem definidas (modo offline/Electron), exporta null e
// os módulos de sync/realtime farão short-circuit sem quebrar a UI.
export const supabase = url && anonKey
  ? (() => {
      const client = createClient(url, anonKey, { 
        auth: { 
          persistSession: false,
          autoRefreshToken: true,
          detectSessionInUrl: false
        },
        global: {
          headers: { 'x-application-name': 'pdv-kds-desktop' }
        },
        db: {
          schema: 'public'
        }
      })
      if (import.meta.env.DEV) {
        console.log('[Supabase] ✅ Cliente inicializado com sucesso!')
      }
      return client
    })()
  : (() => {
      if (import.meta.env.DEV) {
        console.warn('[Supabase] ⚠️ Cliente NÃO inicializado. Variáveis de ambiente ausentes.')
      }
      return null as any
    })()

/**
 * Valida a conexão com o Supabase realizando um simples SELECT 1
 */
export async function validateSupabaseConnection(): Promise<{ success: boolean; message: string }> {
  if (!supabase) {
    return { success: false, message: 'Supabase não inicializado (variáveis ausentes)' }
  }

  try {
    const { error } = await supabase.from('units').select('id').limit(1)
    if (error) {
      console.error('[Supabase] Falha na validação da conexão:', error.message)
      return { success: false, message: `Erro na conexão: ${error.message}` }
    }
    return { success: true, message: 'Conexão estabelecida com sucesso' }
  } catch (err: any) {
    console.error('[Supabase] Erro inesperado na validação:', err.message)
    return { success: false, message: `Erro inesperado: ${err.message}` }
  }
}
