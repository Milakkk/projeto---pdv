import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined

export const supabaseClient = url && anon ? createClient(url, anon) : null as any

