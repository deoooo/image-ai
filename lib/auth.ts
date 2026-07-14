import { createHmac, timingSafeEqual } from "node:crypto";

export type Session =
  | { role: "admin"; username: string }
  | { role: "team_admin"; userId: string; username: string; teamId: string }
  | { role: "user"; userId: string; username: string };

const ADMIN_USERNAME = "lynn";
const ADMIN_PASSWORD = "lynn2026";
const DEFAULT_SESSION_SECRET = "D6K86aLpVlwH1mDhheGgxV8+qXCAhRutmJgsQ47o758=";

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "test") {
      return "test-secret";
    }

    return DEFAULT_SESSION_SECRET;
  }

  return secret;
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(payload: string): string {
  return createHmac("sha256", getSessionSecret()).update(payload).digest("base64url");
}

function isSession(value: unknown): value is Session {
  if (!value || typeof value !== "object") {
    return false;
  }

  if (!("role" in value) || typeof (value as { role?: unknown }).role !== "string") {
    return false;
  }

  if (value.role === "admin") {
    return typeof (value as { username?: unknown }).username === "string";
  }

  if (value.role === "user") {
    return (
      typeof (value as { userId?: unknown }).userId === "string" &&
      typeof (value as { username?: unknown }).username === "string"
    );
  }

  if (value.role === "team_admin") {
    return (
      typeof (value as { userId?: unknown }).userId === "string" &&
      typeof (value as { username?: unknown }).username === "string" &&
      typeof (value as { teamId?: unknown }).teamId === "string"
    );
  }

  return false;
}

export function verifyAdminCredentials(username: string, password: string): boolean {
  return username === ADMIN_USERNAME && password === ADMIN_PASSWORD;
}

export function createSessionToken(session: Session): string {
  const payload = base64UrlEncode(JSON.stringify(session));
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string): Session | null {
  const parts = token.split(".");
  if (parts.length !== 2) {
    return null;
  }

  const [payload, signature] = parts;
  if (!payload || !signature) {
    return null;
  }

  const expected = sign(payload);
  const actualSignature = Buffer.from(signature);
  const expectedSignature = Buffer.from(expected);

  if (actualSignature.length !== expectedSignature.length) {
    return null;
  }

  if (!timingSafeEqual(actualSignature, expectedSignature)) {
    return null;
  }

  try {
    const session = JSON.parse(base64UrlDecode(payload)) as unknown;
    if (isSession(session)) {
      return session;
    }
    return null;
  } catch {
    return null;
  }
}
