import { createClient } from "@supabase/supabase-js";
import nodeFetch from "node-fetch";
import type { RequestInit as NodeFetchRequestInit } from "node-fetch";
import { HttpsProxyAgent } from "https-proxy-agent";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn("Supabase credentials missing! Check .env.local");
}

// Check for proxy environment variables
const proxyUrl =
  process.env.HTTPS_PROXY ||
  process.env.HTTP_PROXY ||
  process.env.https_proxy ||
  process.env.http_proxy;

let options: NonNullable<Parameters<typeof createClient>[2]> = {};

if (proxyUrl) {
  console.log(`Using proxy for Supabase: ${proxyUrl}`);
  const agent = new HttpsProxyAgent(proxyUrl);

  options = {
    global: {
      fetch: async (url, init) => {
        return nodeFetch(url.toString(), {
          ...(init as NodeFetchRequestInit | undefined),
          agent,
        }) as unknown as Response;
      },
    },
  };
}

// Create a single supabase client for interacting with your database
// using the service role key (admin access)
export const supabaseAdmin = createClient(
  supabaseUrl,
  supabaseServiceKey,
  options
);
