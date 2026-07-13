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

const dataMock = vi.hoisted(() => ({
  SupabaseDataError: class extends Error {
    constructor(message: string, public code: string) {
      super(message);
    }
  },
  listUsers: vi.fn(),
  createUser: vi.fn(),
  adjustUserBalance: vi.fn(),
}));

vi.mock("@/lib/api-auth", () => ({
  ApiAuthError: apiAuthMock.ApiAuthError,
  requireAdmin: apiAuthMock.requireAdmin,
}));

vi.mock("@/lib/password", () => ({
  hashPassword: hashPasswordMock.hashPassword,
}));

vi.mock("@/lib/supabase-data", () => ({
  SupabaseDataError: dataMock.SupabaseDataError,
  listUsers: dataMock.listUsers,
  createUser: dataMock.createUser,
  adjustUserBalance: dataMock.adjustUserBalance,
}));

import { GET, POST } from "@/app/api/admin/users/route";
import { PATCH } from "@/app/api/admin/users/[id]/route";

describe("admin users API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiAuthMock.requireAdmin.mockReturnValue({ role: "admin", username: "lynn" });
  });

  test("lists users in reverse creation order with only public fields", async () => {
    dataMock.listUsers.mockResolvedValueOnce([
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

    const response = await GET(new Request("http://localhost/api/admin/users"));
    const body = (await response.json()) as {
      users: Array<{ id: string; username: string; balance: number; createdAt: string }>;
    };

    expect(response.status).toBe(200);
    expect(dataMock.listUsers).toHaveBeenCalledWith();
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
    dataMock.createUser.mockResolvedValueOnce({
      id: "user_3",
      username: "alice",
      balance: 12.345,
      createdAt: "2026-07-02T12:00:00.000Z",
    });

    const response = await POST(
      new Request("http://localhost/api/admin/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          username: "  alice  ",
          password: "secret123",
          balance: 12.345,
        }),
      })
    );
    const body = (await response.json()) as {
      user: { id: string; username: string; balance: number; createdAt: string };
    };

    expect(response.status).toBe(201);
    expect(hashPasswordMock.hashPassword).toHaveBeenCalledWith("secret123");
    expect(dataMock.createUser).toHaveBeenCalledWith({
      username: "alice",
      passwordHash: "hashed-secret",
      balance: 12.345,
    });
    expect(body.user).toEqual({
      id: "user_3",
      username: "alice",
      balance: 12.345,
      createdAt: "2026-07-02T12:00:00.000Z",
    });
  });

  test("returns 409 when the username already exists", async () => {
    hashPasswordMock.hashPassword.mockResolvedValueOnce("hashed-secret");
    dataMock.createUser.mockRejectedValueOnce(
      new dataMock.SupabaseDataError("Username already exists", "duplicate_username")
    );

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

  test("rejects the reserved admin username for regular users", async () => {
    const response = await POST(
      new Request("http://localhost/api/admin/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          username: "  LyNn  ",
          password: "secret123",
          balance: 12,
        }),
      })
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "Username is reserved" });
    expect(hashPasswordMock.hashPassword).not.toHaveBeenCalled();
    expect(dataMock.createUser).not.toHaveBeenCalled();
  });

  test("creates the built-in deo user without requiring database access", async () => {
    const response = await POST(
      new Request("http://localhost/api/admin/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          username: "deo",
          password: "deo2026",
          balance: 0,
        }),
      })
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      user: {
        id: "builtin_deo",
        username: "deo",
        balance: 0,
        createdAt: expect.any(String),
      },
    });
    expect(hashPasswordMock.hashPassword).not.toHaveBeenCalled();
    expect(dataMock.createUser).not.toHaveBeenCalled();
  });

  test("rejects non-admin access with the auth error status", async () => {
    apiAuthMock.requireAdmin.mockImplementationOnce(() => {
      throw new apiAuthMock.ApiAuthError("Forbidden", 403);
    });

    const response = await GET(new Request("http://localhost/api/admin/users"));

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Forbidden" });
  });

  test("recharges a user's balance", async () => {
    dataMock.adjustUserBalance.mockResolvedValueOnce({
      id: "user_1",
      username: "alice",
      balance: 27.125,
      createdAt: "2026-07-01T12:00:00.000Z",
    });

    const response = await PATCH(
      new Request("http://localhost/api/admin/users/user_1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amount: 7.125, operation: "credit" }),
      }),
      { params: Promise.resolve({ id: "user_1" }) }
    );
    const body = (await response.json()) as {
      user: { id: string; username: string; balance: number; createdAt: string };
    };

    expect(response.status).toBe(200);
    expect(dataMock.adjustUserBalance).toHaveBeenCalledWith(
      "user_1",
      7.125,
      "credit"
    );
    expect(body.user).toEqual({
      id: "user_1",
      username: "alice",
      balance: 27.125,
      createdAt: "2026-07-01T12:00:00.000Z",
    });
  });

  test("deducts from a user's balance", async () => {
    dataMock.adjustUserBalance.mockResolvedValueOnce({
      id: "user_1",
      username: "alice",
      balance: 17,
      createdAt: "2026-07-01T12:00:00.000Z",
    });

    const response = await PATCH(
      new Request("http://localhost/api/admin/users/user_1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amount: 3, operation: "debit" }),
      }),
      { params: Promise.resolve({ id: "user_1" }) }
    );

    expect(response.status).toBe(200);
    expect(dataMock.adjustUserBalance).toHaveBeenCalledWith("user_1", 3, "debit");
    expect(await response.json()).toMatchObject({ user: { balance: 17 } });
  });

  test("returns 404 when the user does not exist", async () => {
    dataMock.adjustUserBalance.mockRejectedValueOnce(
      new dataMock.SupabaseDataError("User not found", "not_found")
    );

    const response = await PATCH(
      new Request("http://localhost/api/admin/users/missing", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amount: 27, operation: "credit" }),
      }),
      { params: Promise.resolve({ id: "missing" }) }
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "User not found" });
  });

  test("rejects non-positive adjustment amounts", async () => {
    const response = await PATCH(
      new Request("http://localhost/api/admin/users/user_1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amount: 0, operation: "credit" }),
      }),
      { params: Promise.resolve({ id: "user_1" }) }
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Amount must be greater than zero",
    });
    expect(dataMock.adjustUserBalance).not.toHaveBeenCalled();
  });

  test("rejects an unsupported balance operation", async () => {
    const response = await PATCH(
      new Request("http://localhost/api/admin/users/user_1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amount: 5, operation: "replace" }),
      }),
      { params: Promise.resolve({ id: "user_1" }) }
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Operation must be credit or debit",
    });
    expect(dataMock.adjustUserBalance).not.toHaveBeenCalled();
  });

  test("returns 409 when a deduction exceeds the user's balance", async () => {
    dataMock.adjustUserBalance.mockRejectedValueOnce(
      new dataMock.SupabaseDataError("Insufficient balance", "insufficient_balance")
    );

    const response = await PATCH(
      new Request("http://localhost/api/admin/users/user_1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amount: 30, operation: "debit" }),
      }),
      { params: Promise.resolve({ id: "user_1" }) }
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "Insufficient balance" });
  });
});
