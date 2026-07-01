import { afterEach, describe, expect, test, vi } from "vitest";
import {
  createSessionToken,
  verifyAdminCredentials,
  verifySessionToken,
  validateAccessKey,
  type Session,
} from "@/lib/auth";

describe("auth sessions", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("keeps the legacy access-key compatibility export", () => {
    vi.stubEnv("ACCESS_KEYS", "alpha, beta");

    expect(validateAccessKey("alpha")).toBe(true);
    expect(validateAccessKey("beta")).toBe(true);
    expect(validateAccessKey("wrong")).toBe(false);
    expect(validateAccessKey(null)).toBe(false);
  });

  test("accepts the fixed temporary admin credential", () => {
    expect(verifyAdminCredentials("lynn", "lynn2026")).toBe(true);
    expect(verifyAdminCredentials("lynn", "wrong")).toBe(false);
  });

  test("round-trips a user session token", () => {
    vi.stubEnv("SESSION_SECRET", "test-secret");
    const session: Session = { role: "user", userId: "user_1", username: "alice" };

    const token = createSessionToken(session);

    expect(verifySessionToken(token)).toEqual(session);
  });

  test("rejects a tampered token", () => {
    vi.stubEnv("SESSION_SECRET", "test-secret");
    const token = createSessionToken({ role: "admin", username: "lynn" });
    const tampered = token.replace(/.$/, token.endsWith("a") ? "b" : "a");

    expect(verifySessionToken(tampered)).toBeNull();
  });
});
