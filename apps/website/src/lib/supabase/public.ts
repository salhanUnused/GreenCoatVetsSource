import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { supabaseAnonKey, supabaseUrl } from "./env";

/**
 * Cookie-free anon client for public marketing reads.
 * Avoids `cookies()` so public pages are not forced fully dynamic solely for CMS fetches.
 */
export function createPublicClient() {
  return createSupabaseJsClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
