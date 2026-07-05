import { afterEach, describe, expect, test, vi } from "vitest";

const createClientMock = vi.hoisted(() => vi.fn(() => ({ from: vi.fn() })));
const nodeFetchMock = vi.hoisted(() => vi.fn());
const agentMock = vi.hoisted(() => vi.fn());

vi.mock("@supabase/supabase-js", () => ({
  createClient: createClientMock,
}));

vi.mock("node-fetch", () => ({
  default: nodeFetchMock,
}));

vi.mock("https-proxy-agent", () => ({
  HttpsProxyAgent: agentMock,
}));

async function importSupabase() {
  vi.resetModules();
  createClientMock.mockClear();
  nodeFetchMock.mockClear();
  agentMock.mockClear();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
  return import("@/lib/supabase");
}

describe("Supabase client", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("uses a server fetch wrapper for Supabase requests", async () => {
    await importSupabase();

    const options = createClientMock.mock.calls[0]?.[2] as {
      global?: { fetch?: unknown };
    };

    expect(typeof options.global?.fetch).toBe("function");
    expect(agentMock).not.toHaveBeenCalled();
  });

  test("ignores ambient proxy variables on Vercel", async () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("HTTPS_PROXY", "http://127.0.0.1:7890");

    await importSupabase();

    const options = createClientMock.mock.calls[0]?.[2] as {
      global?: { fetch?: unknown };
    };

    expect(typeof options.global?.fetch).toBe("function");
    expect(agentMock).not.toHaveBeenCalled();
  });

  test("uses an explicit Supabase proxy when configured", async () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("HTTPS_PROXY", "http://127.0.0.1:7890");
    vi.stubEnv("SUPABASE_PROXY_URL", "http://proxy.example:8080");

    await importSupabase();

    expect(agentMock).toHaveBeenCalledWith("http://proxy.example:8080");
  });
});
