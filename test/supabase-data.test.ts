import { beforeEach, describe, expect, test, vi } from "vitest";

const supabaseMock = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: supabaseMock,
}));

import {
  adjustUserBalance,
  SupabaseDataError,
  chargeGeneration,
  createUser,
  listSucceededGenerations,
  listUsers,
  refundChargedGeneration,
} from "@/lib/supabase-data";

function createQueryBuilder(result: unknown) {
  const builder = {
    select: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    single: vi.fn(async () => result),
  };
  return builder;
}

describe("Supabase data layer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("lists users with camelCase timestamps", async () => {
    const result = {
      data: [
        {
          id: "user_1",
          username: "alice",
          balance: 12.5,
          created_at: "2026-07-02T10:00:00.000Z",
        },
      ],
      error: null,
    };
    const builder = {
      select: vi.fn(() => builder),
      is: vi.fn(() => builder),
      order: vi.fn(async () => result),
    };
    supabaseMock.from.mockReturnValueOnce(builder);

    await expect(listUsers()).resolves.toEqual([
      {
        id: "user_1",
        username: "alice",
        balance: 12.5,
        createdAt: "2026-07-02T10:00:00.000Z",
        role: "user",
        teamId: null,
        dailyLimit: null,
        dailySpent: 0,
        dailySpentDate: null,
      },
    ]);
    expect(supabaseMock.from).toHaveBeenCalledWith("image_ai_users");
    expect(builder.select).toHaveBeenCalledWith(
      "id, username, balance, created_at, role, team_id, daily_limit, daily_spent, daily_spent_date"
    );
    expect(builder.is).toHaveBeenCalledWith("team_id", null);
    expect(builder.order).toHaveBeenCalledWith("created_at", { ascending: false });
  });

  test("creates users with snake_case password hash and maps duplicate usernames", async () => {
    const builder = createQueryBuilder({
      data: null,
      error: { code: "23505", message: "duplicate key value violates unique constraint" },
    });
    supabaseMock.from.mockReturnValueOnce(builder);

    await expect(
      createUser({
        username: "alice",
        passwordHash: "hash",
        balance: 4,
      })
    ).rejects.toMatchObject({
      code: "duplicate_username",
      message: "Username already exists",
    });
    expect(builder.insert).toHaveBeenCalledWith({
      username: "alice",
      password_hash: "hash",
      balance: 4,
    });
  });

  test("charges through the atomic Supabase RPC", async () => {
    supabaseMock.rpc.mockResolvedValueOnce({
      data: [{ generation_id: "gen_1", price_charged: 0.25, balance: 9.75 }],
      error: null,
    });

    await expect(
      chargeGeneration({
        userId: "user_1",
        prompt: "prompt",
        model: "nano-banana-pro",
        price: 0.25,
      })
    ).resolves.toEqual({
      generationId: "gen_1",
      priceCharged: 0.25,
      balance: 9.75,
    });
    expect(supabaseMock.rpc).toHaveBeenCalledWith("image_ai_charge_for_generation", {
      p_user_id: "user_1",
      p_prompt: "prompt",
      p_model: "nano-banana-pro",
      p_price: 0.25,
    });
  });

  test("returns team daily usage metadata from the charge RPC", async () => {
    supabaseMock.rpc.mockResolvedValueOnce({
      data: [{
        generation_id: "gen_2",
        price_charged: 0.25,
        balance: 19.75,
        daily_spent: 1.25,
        daily_limit: 5,
      }],
      error: null,
    });

    await expect(chargeGeneration({
      userId: "member_1",
      prompt: "prompt",
      model: "nano-banana-pro",
      price: 0.25,
    })).resolves.toEqual({
      generationId: "gen_2",
      priceCharged: 0.25,
      balance: 19.75,
      dailySpent: 1.25,
      dailyLimit: 5,
    });
  });

  test("adjusts balances through the atomic Supabase RPC", async () => {
    supabaseMock.rpc.mockResolvedValueOnce({
      data: [
        {
          id: "user_1",
          username: "alice",
          balance: 15,
          created_at: "2026-07-02T10:00:00.000Z",
        },
      ],
      error: null,
    });

    await expect(adjustUserBalance("user_1", 5, "credit")).resolves.toEqual({
      id: "user_1",
      username: "alice",
      balance: 15,
      createdAt: "2026-07-02T10:00:00.000Z",
      role: "user",
      teamId: null,
      dailyLimit: null,
      dailySpent: 0,
      dailySpentDate: null,
    });
    expect(supabaseMock.rpc).toHaveBeenCalledWith("image_ai_adjust_user_balance", {
      p_user_id: "user_1",
      p_amount: 5,
      p_operation: "credit",
    });
  });

  test("maps insufficient balance from the adjustment RPC", async () => {
    supabaseMock.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: "insufficient_balance" },
    });

    await expect(adjustUserBalance("user_1", 20, "debit")).rejects.toMatchObject({
      code: "insufficient_balance",
      message: "Insufficient balance",
    });
  });

  test("maps insufficient balance from the charge RPC", async () => {
    supabaseMock.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: "insufficient_balance" },
    });

    await expect(
      chargeGeneration({
        userId: "user_1",
        prompt: "prompt",
        model: "nano-banana-pro",
        price: 0.25,
      })
    ).rejects.toMatchObject({
      code: "insufficient_balance",
      message: "Insufficient balance",
    });
  });

  test("refunds through the idempotent Supabase RPC", async () => {
    supabaseMock.rpc.mockResolvedValueOnce({
      data: [{ refunded: true, balance: 10 }],
      error: null,
    });

    await expect(refundChargedGeneration("gen_1")).resolves.toEqual({
      refunded: true,
      balance: 10,
    });
    expect(supabaseMock.rpc).toHaveBeenCalledWith("image_ai_refund_generation", {
      p_generation_id: "gen_1",
    });
  });

  test("lists succeeded generations with camelCase rows", async () => {
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      not: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(async () => ({
        data: [
          {
            id: "gen_1",
            task_id: "task_1",
            prompt: "prompt",
            model: "nano-banana-pro",
            image_url: "https://cdn.example/image.png",
            status: "succeeded",
            user_id: "user_1",
            price_charged: 0.25,
            charge_status: "charged",
            created_at: "2026-07-02T10:00:00.000Z",
          },
        ],
        error: null,
      })),
    };
    supabaseMock.from.mockReturnValueOnce(builder);

    await expect(listSucceededGenerations("user_1", 20)).resolves.toEqual([
      {
        id: "gen_1",
        taskId: "task_1",
        prompt: "prompt",
        model: "nano-banana-pro",
        imageUrl: "https://cdn.example/image.png",
        status: "succeeded",
        userId: "user_1",
        priceCharged: 0.25,
        chargeStatus: "charged",
        createdAt: "2026-07-02T10:00:00.000Z",
      },
    ]);
    expect(builder.eq).toHaveBeenCalledWith("user_id", "user_1");
    expect(builder.eq).toHaveBeenCalledWith("status", "succeeded");
    expect(builder.not).toHaveBeenCalledWith("image_url", "is", null);
  });

  test("exposes a typed data error", () => {
    const error = new SupabaseDataError("User not found", "not_found");
    expect(error.code).toBe("not_found");
  });
});
