import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY || "";

const clients = new Map<string, SupabaseClient>();

export function getSupabaseClient(storage: 'local' | 'session' = 'local') {
  if (!supabaseUrl || !supabaseKey) {
    return null;
  }
  const key = storage;
  const existing = clients.get(key);
  if (existing) return existing;
  const storageProvider = storage === 'session' ? sessionStorage : localStorage;
  const client = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: true,
      storage: storageProvider,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  clients.set(key, client);
  return client;
}
