import { beforeEach, describe, expect, test, vi } from "vitest";

const apiAuthMock = vi.hoisted(() => ({
  ApiAuthError: class extends Error {
    constructor(message: string, public status = 401) {
      super(message);
    }
  },
  requireAdmin: vi.fn(),
}));

const hashPasswordMock = vi.hoisted(() => ({
  hashPassword: vi.fn(),
}));

const prismaMock = vi.hoisted(() => ({
  user: {
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/lib/api-auth", () => ({
  ApiAuthError: apiAuthMock.ApiAuthError,
  requireAdmin: apiAuthMock.requireAdmin,
}));

vi.mock("@/lib/password", () => ({
  hashPassword: hashPasswordMock.hashPassword,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

import { GET, POST } from "@/app/api/admin/users/route";
import { PATCH } from "@/app/api/admin/users/[id]/route";

describe("admin users API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiAuthMock.requireAdmin.mockReturnValue({ role: "admin", username: "lynn" });
  });

  test("lists users in reverse creation order with only public fields", async () => {
    prismaMock.user.findMany.mockResolvedValueOnce([
      {
        id: "user_2",
        username: "bravo",
        balance: 9,
        createdAt: new Date("2026-07-02T10:00:00.000Z"),
      },
      {
        id: "user_1",
        username: "alpha",
        balance: 4,
        createdAt: new Date("2026-07-01T10:00:00.000Z"),
      },
    ]);

    const response = await GET(new Request("http://localhost/api/admin/users"));
    const body = (await response.json()) as {
      users: Array<{ id: string; username: string; balance: number; createdAt: string }>;
    };

    expect(response.status).toBe(200);
    expect(prismaMock.user.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: "desc" },
      select: { id: true, username: true, balance: true, createdAt: true },
    });
    expect(body.users).toEqual([
      {
        id: "user_2",
        username: "bravo",
        balance: 9,
        createdAt: "2026-07-02T10:00:00.000Z",
      },
      {
        id: "user_1",
        username: "alpha",
        balance: 4,
        createdAt: "2026-07-01T10:00:00.000Z",
      },
    ]);
  });

  test("creates a user with a trimmed username and hashed password", async () => {
    hashPasswordMock.hashPassword.mockResolvedValueOnce("hashed-secret");
    prismaMock.user.create.mockResolvedValueOnce({
      id: "user_3",
      username: "alice",
      balance: 12,
      createdAt: new Date("2026-07-02T12:00:00.000Z"),
    });

    const response = await POST(
      new Request("http://localhost/api/admin/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          username: "  alice  ",
          password: "secret123",
          balance: 12,
        }),
      })
    );
    const body = (await response.json()) as {
      user: { id: string; username: string; balance: number; createdAt: string };
    };

    expect(response.status).toBe(201);
    expect(hashPasswordMock.hashPassword).toHaveBeenCalledWith("secret123");
    expect(prismaMock.user.create).toHaveBeenCalledWith({
      data: {
        username: "alice",
        passwordHash: "hashed-secret",
        balance: 12,
      },
      select: { id: true, username: true, balance: true, createdAt: true },
    });
    expect(body.user).toEqual({
      id: "user_3",
      username: "alice",
      balance: 12,
      createdAt: "2026-07-02T12:00:00.000Z",
    });
  });

  test("returns 409 when the username already exists", async () => {
    hashPasswordMock.hashPassword.mockResolvedValueOnce("hashed-secret");
    prismaMock.user.create.mockRejectedValueOnce({ code: "P2002" });

    const response = await POST(
      new Request("http://localhost/api/admin/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          username: "alice",
          password: "secret123",
          balance: 12,
        }),
      })
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "Username already exists" });
  });

  test("rejects non-admin access with the auth error status", async () => {
    apiAuthMock.requireAdmin.mockImplementationOnce(() => {
      throw new apiAuthMock.ApiAuthError("Forbidden", 403);
    });

    const response = await GET(new Request("http://localhost/api/admin/users"));

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Forbidden" });
  });

  test("updates a user's balance", async () => {
    prismaMock.user.update.mockResolvedValueOnce({
      id: "user_1",
      username: "alice",
      balance: 27,
      createdAt: new Date("2026-07-01T12:00:00.000Z"),
    });

    const response = await PATCH(
      new Request("http://localhost/api/admin/users/user_1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ balance: 27 }),
      }),
      { params: Promise.resolve({ id: "user_1" }) }
    );
    const body = (await response.json()) as {
      user: { id: string; username: string; balance: number; createdAt: string };
    };

    expect(response.status).toBe(200);
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "user_1" },
      data: { balance: 27 },
      select: { id: true, username: true, balance: true, createdAt: true },
    });
    expect(body.user).toEqual({
      id: "user_1",
      username: "alice",
      balance: 27,
      createdAt: "2026-07-01T12:00:00.000Z",
    });
  });

  test("returns 404 when the user does not exist", async () => {
    prismaMock.user.update.mockRejectedValueOnce({ code: "P2025" });

    const response = await PATCH(
      new Request("http://localhost/api/admin/users/missing", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ balance: 27 }),
      }),
      { params: Promise.resolve({ id: "missing" }) }
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "User not found" });
  });

  test("rejects negative balances before updating", async () => {
    const response = await PATCH(
      new Request("http://localhost/api/admin/users/user_1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ balance: -1 }),
      }),
      { params: Promise.resolve({ id: "user_1" }) }
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Balance must be a non-negative integer",
    });
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });
});
