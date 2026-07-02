import { describe, expect, test } from "vitest";
import { resolveDatabaseUrl } from "@/lib/database-url";

describe("database URL resolution", () => {
  test("skips an invalid non-pooling URL and uses DATABASE_URL", () => {
    expect(
      resolveDatabaseUrl({
        POSTGRES_URL_NON_POOLING: "base",
        DATABASE_URL: "postgresql://user:password@db.example.com:5432/app",
      })
    ).toBe("postgresql://user:password@db.example.com:5432/app");
  });

  test("uses POSTGRES_URL when earlier database URL candidates are invalid", () => {
    expect(
      resolveDatabaseUrl({
        POSTGRES_URL_NON_POOLING: "base",
        DATABASE_URL: "",
        POSTGRES_URL: "postgresql://user:password@db.example.com:5432/app",
      })
    ).toBe("postgresql://user:password@db.example.com:5432/app");
  });

  test("throws a clear error when no valid PostgreSQL URL is configured", () => {
    expect(() =>
      resolveDatabaseUrl({
        POSTGRES_URL_NON_POOLING: "base",
        DATABASE_URL: "not-a-url",
      })
    ).toThrow("A valid PostgreSQL connection string is required");
  });
});
