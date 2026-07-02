import { beforeEach, describe, expect, test, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
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
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
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
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });
});
