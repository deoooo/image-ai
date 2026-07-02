import { describe, expect, test, vi } from "vitest";

describe("Prisma client module", () => {
  test("does not require a database URL when the module is imported", async () => {
    vi.resetModules();
    vi.stubEnv("POSTGRES_URL_NON_POOLING", "base");
    vi.stubEnv("DATABASE_URL", "");

    await expect(import("@/lib/prisma")).resolves.toHaveProperty("prisma");

    vi.unstubAllEnvs();
  });
});
