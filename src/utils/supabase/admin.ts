import { createClient } from '@supabase/supabase-js';

// Note: You must add SUPABASE_SERVICE_ROLE_KEY to your .env.local file
// You can find this in your Supabase Dashboard under Project Settings -> API -> service_role secret
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// This client uses the service role key to bypass Row Level Security (RLS)
// Use ONLY in trusted server environments (like server actions)
export const createAdminClient = () => {
  if (!supabaseServiceKey) {
    console.warn("⚠️ SUPABASE_SERVICE_ROLE_KEY is missing. Admin actions bypassing RLS will fail or fall back to RLS restrictions.");
  }
  
  return createClient(supabaseUrl, supabaseServiceKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
};
