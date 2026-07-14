import { getModelPrice } from "@/lib/model-pricing";
import {
  SupabaseDataError,
  chargeGeneration,
  refundChargedGeneration,
} from "@/lib/supabase-data";

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
}): Promise<{
  generationId: string;
  priceCharged: number;
  balance: number;
  dailySpent?: number;
  dailyLimit?: number;
}> {
  const price = getModelPrice(model);

  if (price === null) {
    throw new BillingError("Unsupported model");
  }

  try {
    return await chargeGeneration({ userId, prompt, model, price });
  } catch (error) {
    if (
      error instanceof SupabaseDataError &&
      error.code === "insufficient_balance"
    ) {
      throw new BillingError("Insufficient balance", 402);
    }

    if (
      error instanceof SupabaseDataError &&
      error.code === "daily_limit_exceeded"
    ) {
      throw new BillingError("Daily limit exceeded", 429);
    }

    throw error;
  }
}

export async function refundGeneration(
  generationId: string
): Promise<{ refunded: boolean; balance?: number }> {
  return refundChargedGeneration(generationId);
}
