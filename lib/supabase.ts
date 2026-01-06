import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn("Supabase credentials missing! Check .env.local");
}

// Create a single supabase client for interacting with your database
// using the service role key (admin access)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
