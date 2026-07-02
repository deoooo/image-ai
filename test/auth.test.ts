import { afterEach, describe, expect, test, vi } from "vitest";
import {
  createSessionToken,
  verifyAdminCredentials,
  verifySessionToken,
  type Session,
} from "@/lib/auth";

describe("auth sessions", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
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

  test("falls back to the built-in production session secret", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SESSION_SECRET", "");

    const session: Session = { role: "admin", username: "lynn" };
    const token = createSessionToken(session);

    expect(verifySessionToken(token)).toEqual(session);
  });

  test("rejects a tampered token", () => {
    vi.stubEnv("SESSION_SECRET", "test-secret");
    const token = createSessionToken({ role: "admin", username: "lynn" });
    const tampered = token.replace(/.$/, token.endsWith("a") ? "b" : "a");

    expect(verifySessionToken(tampered)).toBeNull();
  });

  test("rejects a token with extra dot-separated segments", () => {
    vi.stubEnv("SESSION_SECRET", "test-secret");
    const token = createSessionToken({ role: "admin", username: "lynn" });

    expect(verifySessionToken(`${token}.junk`)).toBeNull();
  });
});
