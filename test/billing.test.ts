import { beforeEach, describe, expect, test, vi } from "vitest";

const dataMock = vi.hoisted(() => ({
  SupabaseDataError: class extends Error {
    constructor(message: string, public code: string) {
      super(message);
    }
  },
  chargeGeneration: vi.fn(),
  refundChargedGeneration: vi.fn(),
}));

vi.mock("@/lib/supabase-data", () => ({
  SupabaseDataError: dataMock.SupabaseDataError,
  chargeGeneration: dataMock.chargeGeneration,
  refundChargedGeneration: dataMock.refundChargedGeneration,
}));

import { chargeForGeneration, refundGeneration } from "@/lib/billing";

describe("billing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("rejects unknown models before charging", async () => {
    await expect(
      chargeForGeneration({ userId: "u1", prompt: "prompt", model: "unknown" })
    ).rejects.toThrow("Unsupported model");
    expect(dataMock.chargeGeneration).not.toHaveBeenCalled();
  });

  test("rejects insufficient balance", async () => {
    dataMock.chargeGeneration.mockRejectedValueOnce(
      new dataMock.SupabaseDataError("Insufficient balance", "insufficient_balance")
    );

    await expect(
      chargeForGeneration({ userId: "u1", prompt: "prompt", model: "nano-banana-pro" })
    ).rejects.toThrow("Insufficient balance");
  });

  test("deducts price and creates a charged generation", async () => {
    dataMock.chargeGeneration.mockResolvedValueOnce({
      generationId: "g1",
      priceCharged: 0.25,
      balance: 9.75,
    });

    const result = await chargeForGeneration({
      userId: "u1",
      prompt: "prompt",
      model: "nano-banana-pro",
    });

    expect(dataMock.chargeGeneration).toHaveBeenCalledWith({
      userId: "u1",
      prompt: "prompt",
      model: "nano-banana-pro",
      price: 0.25,
    });
    expect(result).toEqual({ generationId: "g1", priceCharged: 0.25, balance: 9.75 });
  });

  test("refunds a charged generation once", async () => {
    dataMock.refundChargedGeneration.mockResolvedValueOnce({
      refunded: true,
      balance: 10,
    });

    const result = await refundGeneration("g1");

    expect(dataMock.refundChargedGeneration).toHaveBeenCalledWith("g1");
    expect(result).toEqual({ refunded: true, balance: 10 });
  });

  test("does not refund a generation twice", async () => {
    dataMock.refundChargedGeneration.mockResolvedValueOnce({ refunded: false });

    const result = await refundGeneration("g1");

    expect(dataMock.refundChargedGeneration).toHaveBeenCalledWith("g1");
    expect(result).toEqual({ refunded: false });
  });
});
