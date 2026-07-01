import { prisma } from "@/lib/prisma";
import { getModelPrice } from "@/lib/model-pricing";

export class BillingError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
    this.name = "BillingError";
  }
}

export async function chargeForGeneration({
  userId,
  prompt,
  model,
}: {
  userId: string;
  prompt: string;
  model: string;
}): Promise<{ generationId: string; priceCharged: number; balance: number }> {
  const price = getModelPrice(model);

  if (price === null) {
    throw new BillingError("Unsupported model");
  }

  return prisma.$transaction(async (tx) => {
    const charged = await tx.user.updateMany({
      where: { id: userId, balance: { gte: price } },
      data: { balance: { decrement: price } },
    });

    if (charged.count !== 1) {
      throw new BillingError("Insufficient balance", 402);
    }

    const generation = await tx.generation.create({
      data: {
        userId,
        prompt,
        model,
        status: "pending",
        priceCharged: price,
        chargeStatus: "charged",
      },
    });

    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { balance: true },
    });

    return {
      generationId: generation.id,
      priceCharged: price,
      balance: user?.balance ?? 0,
    };
  });
}

export async function refundGeneration(
  generationId: string
): Promise<{ refunded: boolean; balance?: number }> {
  return prisma.$transaction(async (tx) => {
    const generation = await tx.generation.findUnique({
      where: { id: generationId },
      select: {
        id: true,
        userId: true,
        priceCharged: true,
        chargeStatus: true,
      },
    });

    if (!generation || generation.chargeStatus !== "charged") {
      return { refunded: false };
    }

    const updated = await tx.generation.updateMany({
      where: { id: generation.id, chargeStatus: "charged" },
      data: { chargeStatus: "refunded", status: "failed" },
    });

    if (updated.count !== 1) {
      return { refunded: false };
    }

    const user = await tx.user.update({
      where: { id: generation.userId },
      data: { balance: { increment: generation.priceCharged } },
      select: { balance: true },
    });

    return { refunded: true, balance: user.balance };
  });
}
