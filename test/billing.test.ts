import { beforeEach, describe, expect, test, vi } from "vitest";

const prismaMock = vi.hoisted(() => {
  const mock = {
    user: {
      updateMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    generation: {
      create: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
    },
  };

  return {
    ...mock,
    $transaction: vi.fn(async (callback: (tx: typeof mock) => Promise<unknown>) => callback(mock)),
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
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
    expect(prismaMock.user.updateMany).not.toHaveBeenCalled();
  });

  test("rejects insufficient balance", async () => {
    prismaMock.user.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      chargeForGeneration({ userId: "u1", prompt: "prompt", model: "nano-banana-pro" })
    ).rejects.toThrow("Insufficient balance");
  });

  test("deducts price and creates a charged generation", async () => {
    prismaMock.user.updateMany.mockResolvedValueOnce({ count: 1 });
    prismaMock.generation.create.mockResolvedValueOnce({
      id: "g1",
      priceCharged: 0.25,
    });
    prismaMock.user.findUnique.mockResolvedValueOnce({ balance: 9.75 });

    const result = await chargeForGeneration({
      userId: "u1",
      prompt: "prompt",
      model: "nano-banana-pro",
    });

    expect(prismaMock.user.updateMany).toHaveBeenCalledWith({
      where: { id: "u1", balance: { gte: 0.25 } },
      data: { balance: { decrement: 0.25 } },
    });
    expect(prismaMock.generation.create).toHaveBeenCalledWith({
      data: {
        userId: "u1",
        prompt: "prompt",
        model: "nano-banana-pro",
        status: "pending",
        priceCharged: 0.25,
        chargeStatus: "charged",
      },
    });
    expect(result).toEqual({ generationId: "g1", priceCharged: 0.25, balance: 9.75 });
  });

  test("refunds a charged generation once", async () => {
    prismaMock.generation.findUnique.mockResolvedValueOnce({
      id: "g1",
      userId: "u1",
      priceCharged: 0.25,
      chargeStatus: "charged",
    });
    prismaMock.generation.updateMany.mockResolvedValueOnce({ count: 1 });
    prismaMock.user.update.mockResolvedValueOnce({ balance: 10 });

    const result = await refundGeneration("g1");

    expect(prismaMock.generation.updateMany).toHaveBeenCalledWith({
      where: { id: "g1", chargeStatus: "charged" },
      data: { chargeStatus: "refunded", status: "failed" },
    });
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { balance: { increment: 0.25 } },
      select: { balance: true },
    });
    expect(result).toEqual({ refunded: true, balance: 10 });
  });

  test("does not refund a generation twice", async () => {
    prismaMock.generation.findUnique.mockResolvedValueOnce({
      id: "g1",
      userId: "u1",
      priceCharged: 0.25,
      chargeStatus: "refunded",
    });

    const result = await refundGeneration("g1");

    expect(prismaMock.user.update).not.toHaveBeenCalled();
    expect(result).toEqual({ refunded: false });
  });
});
