import { supabase } from './supabase'

export interface SyncOptions {
  retries?: number
  delay?: number
  silent?: boolean
}

const DEFAULT_OPTIONS: SyncOptions = {
  retries: 3,
  delay: 1000,
  silent: false
}

/**
 * Utilitário para operações robustas no Supabase com retentativas automáticas e logs detalhados.
 */
export const supabaseSync = {
  /**
   * Executa uma operação com retentativas
   */
  async withRetry<T>(
    operation: () => Promise<{ data: T | null; error: any }>,
    options: SyncOptions = {}
  ): Promise<{ data: T | null; error: any }> {
    const opts = { ...DEFAULT_OPTIONS, ...options }
    let lastError: any = null

    for (let i = 0; i < (opts.retries || 3); i++) {
      try {
        const result = await operation()
        if (!result.error) {
          return result
        }
        lastError = result.error
        
        // Se for erro de permissão (401/403), não adianta tentar novamente
        if (lastError.code === '401' || lastError.code === '403' || lastError.code === 'PGRST301') {
          break
        }

        if (!opts.silent) {
          console.warn(`[SupabaseSync] Tentativa ${i + 1} falhou: ${lastError.message}. Retentando em ${opts.delay}ms...`)
        }
        await new Promise(resolve => setTimeout(resolve, opts.delay))
      } catch (err: any) {
        lastError = err
        if (!opts.silent) {
          console.warn(`[SupabaseSync] Erro inesperado na tentativa ${i + 1}: ${err.message}. Retentando...`)
        }
        await new Promise(resolve => setTimeout(resolve, opts.delay))
      }
    }

    return { data: null, error: lastError }
  },

  /**
   * Create (Insert)
   */
  async insert<T = any>(table: string, values: any, options: SyncOptions = {}) {
    if (!supabase) return { data: null, error: new Error('Supabase não inicializado') }
    
    if (!options.silent) console.log(`[SupabaseSync] INSERT em ${table}:`, values)
    
    return this.withRetry(() => supabase.from(table).insert(values).select(), options)
  },

  /**
   * Read (Select)
   */
  async select<T = any>(
    table: string, 
    query: (qb: any) => any = (qb) => qb.select('*'),
    options: SyncOptions = {}
  ) {
    if (!supabase) return { data: null, error: new Error('Supabase não inicializado') }
    
    if (!options.silent) console.log(`[SupabaseSync] SELECT em ${table}`)
    
    return this.withRetry(() => query(supabase.from(table)), options)
  },

  /**
   * Update
   */
  async update<T = any>(table: string, values: any, match: any, options: SyncOptions = {}) {
    if (!supabase) return { data: null, error: new Error('Supabase não inicializado') }
    
    if (!options.silent) console.log(`[SupabaseSync] UPDATE em ${table}:`, { values, match })
    
    return this.withRetry(() => supabase.from(table).update(values).match(match).select(), options)
  },

  /**
   * Delete
   */
  async delete(table: string, match: any, options: SyncOptions = {}) {
    if (!supabase) return { data: null, error: new Error('Supabase não inicializado') }
    
    if (!options.silent) console.log(`[SupabaseSync] DELETE em ${table}:`, match)
    
    return this.withRetry(() => supabase.from(table).delete().match(match), options)
  },

  /**
   * Upsert
   */
  async upsert<T = any>(table: string, values: any, options: SyncOptions = {}) {
    if (!supabase) return { data: null, error: new Error('Supabase não inicializado') }
    
    if (!options.silent) console.log(`[SupabaseSync] UPSERT em ${table}:`, values)
    
    return this.withRetry(() => supabase.from(table).upsert(values, { onConflict: 'id' }).select(), options)
  }
}
