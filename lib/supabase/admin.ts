import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Service-role client. SERVER ONLY (seed script + cron route).
// Bypasses Row Level Security - never import this into client code.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
