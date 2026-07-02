import nodeFetch from "node-fetch";
import type { RequestInit as NodeFetchRequestInit } from "node-fetch";
import { HttpsProxyAgent } from "https-proxy-agent";

// Check for proxy environment variables
const proxyUrl =
  process.env.HTTPS_PROXY ||
  process.env.HTTP_PROXY ||
  process.env.https_proxy ||
  process.env.http_proxy;

let agent: HttpsProxyAgent<string> | undefined;

if (proxyUrl) {
  console.log(`Using proxy for fetch: ${proxyUrl}`);
  agent = new HttpsProxyAgent(proxyUrl);
}

export async function fetchWithProxy(
  url: string,
  init?: RequestInit
): Promise<Response> {
  // Use node-fetch with agent if proxy is set
  if (proxyUrl) {
    return nodeFetch(url, {
      ...(init as NodeFetchRequestInit | undefined),
      agent,
    }) as unknown as Response;
  }

  // Fallback to native fetch if no proxy (or use node-fetch without agent)
  return fetch(url, init);
}
