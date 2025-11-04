import { createClient } from '@supabase/supabase-js'

/**
 * Create a Supabase client that doesn't require cookies
 * Uses service role key and doesn't require cookies
 */
export function createNoCookieClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}

