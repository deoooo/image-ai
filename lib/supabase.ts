import { createClient } from "@supabase/supabase-js";
import nodeFetch from "node-fetch";
import type { RequestInit as NodeFetchRequestInit } from "node-fetch";
import { HttpsProxyAgent } from "https-proxy-agent";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn("Supabase credentials missing! Check .env.local");
}

const supabaseProxyUrl = process.env.SUPABASE_PROXY_URL;

let proxyAgent: HttpsProxyAgent<string> | undefined;

if (supabaseProxyUrl) {
  console.log(`Using explicit proxy for Supabase: ${supabaseProxyUrl}`);
  proxyAgent = new HttpsProxyAgent(supabaseProxyUrl);
}

const options: NonNullable<Parameters<typeof createClient>[2]> = {
  global: {
    fetch: async (url, init) => {
      try {
        return (await nodeFetch(url.toString(), {
          ...(init as NodeFetchRequestInit | undefined),
          agent: proxyAgent,
        })) as unknown as Response;
      } catch (error) {
        console.error("Supabase fetch failed:", {
          host: new URL(url.toString()).host,
          message: error instanceof Error ? error.message : String(error),
          cause:
            error instanceof Error && "cause" in error
              ? String(error.cause)
              : undefined,
        });
        throw error;
      }
    },
  },
};

// Create a single supabase client for interacting with your database
// using the service role key (admin access)
export const supabaseAdmin = createClient(
  supabaseUrl,
  supabaseServiceKey,
  options
);
