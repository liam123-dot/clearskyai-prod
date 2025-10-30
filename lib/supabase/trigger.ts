import { createClient } from '@supabase/supabase-js'

/**
 * Create a Supabase client for use in Trigger.dev tasks
 * Uses service role key and doesn't require cookies
 */
export function createTriggerClient() {
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

