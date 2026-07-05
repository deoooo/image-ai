import { beforeEach, describe, expect, test, vi } from "vitest";

const dataMock = vi.hoisted(() => ({
  findUserByUsername: vi.fn(),
  findUserById: vi.fn(),
}));

vi.mock("@/lib/supabase-data", () => ({
  findUserByUsername: dataMock.findUserByUsername,
  findUserById: dataMock.findUserById,
}));

vi.mock("@/lib/password", () => ({
  verifyPassword: vi.fn(async (password: string, hash: string) => {
    return password === "secret123" && hash === "stored-hash";
  }),
}));

import { POST as loginPost } from "@/app/api/auth/login/route";
import { GET as meGet } from "@/app/api/auth/me/route";

describe("built-in regular user routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("logs in deo without requiring database access", async () => {
    const response = await loginPost(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: "deo", password: "deo2026" }),
      })
    );
    const body = (await response.json()) as {
      token?: string;
      user?: { role: string; id: string; username: string; balance: number };
    };

    expect(response.status).toBe(200);
    expect(body.user).toEqual({
      role: "user",
      id: "builtin_deo",
      username: "deo",
      balance: 0,
    });
    expect(typeof body.token).toBe("string");
    expect(dataMock.findUserByUsername).not.toHaveBeenCalled();
  });

  test("returns the built-in user from /me without requiring database access", async () => {
    const login = await loginPost(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: "deo", password: "deo2026" }),
      })
    );
    const { token } = (await login.json()) as { token: string };

    const response = await meGet(
      new Request("http://localhost/api/auth/me", {
        headers: { authorization: `Bearer ${token}` },
      })
    );
    const body = (await response.json()) as {
      user?: { role: string; id: string; username: string; balance: number };
    };

    expect(response.status).toBe(200);
    expect(body.user).toEqual({
      role: "user",
      id: "builtin_deo",
      username: "deo",
      balance: 0,
    });
    expect(dataMock.findUserById).not.toHaveBeenCalled();
  });

  test("logs in a Supabase-backed regular user", async () => {
    dataMock.findUserByUsername.mockResolvedValueOnce({
      id: "7ed6c045-dc14-4127-94d5-6dd64abb9dcb",
      username: "alice",
      passwordHash: "stored-hash",
      balance: 12.5,
      createdAt: "2026-07-02T10:00:00.000Z",
    });

    const response = await loginPost(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: "alice", password: "secret123" }),
      })
    );
    const body = (await response.json()) as {
      token?: string;
      user?: { role: string; id: string; username: string; balance: number };
    };

    expect(response.status).toBe(200);
    expect(dataMock.findUserByUsername).toHaveBeenCalledWith("alice");
    expect(body.user).toEqual({
      role: "user",
      id: "7ed6c045-dc14-4127-94d5-6dd64abb9dcb",
      username: "alice",
      balance: 12.5,
    });
    expect(typeof body.token).toBe("string");
  });
});
