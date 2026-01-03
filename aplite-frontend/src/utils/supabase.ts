import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY || "";

let client: SupabaseClient | null = null;

export function getSupabaseClient() {
  if (client) return client;
  if (!supabaseUrl || !supabaseKey) {
    return null;
  }
  client = createClient(supabaseUrl, supabaseKey);
  return client;
}
