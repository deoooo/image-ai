import { describe, expect, test } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/password";

describe("password hashing", () => {
  test("verifies the original password", async () => {
    const hash = await hashPassword("secret123");
    expect(await verifyPassword("secret123", hash)).toBe(true);
  });

  test("rejects a different password", async () => {
    const hash = await hashPassword("secret123");
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });

  test("rejects a stored hash with extra colon-separated segments", async () => {
    const hash = await hashPassword("secret123");

    expect(await verifyPassword("secret123", `${hash}:junk`)).toBe(false);
  });
});
