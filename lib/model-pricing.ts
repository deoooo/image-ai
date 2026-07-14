import type { GenerationModel } from "@/types";

export const MODEL_PRICES: Record<GenerationModel, number> = {
  "gpt-image-2": 0.1,
  "nano-banana-fast": 0.08,
  "nano-banana-pro": 0.25,
};

export function isSupportedModel(model: string): model is GenerationModel {
  return Object.prototype.hasOwnProperty.call(MODEL_PRICES, model);
}

export function getModelPrice(model: string): number | null {
  if (!isSupportedModel(model)) return null;
  return MODEL_PRICES[model];
}

export function listModelPrices(): Array<{ model: GenerationModel; price: number }> {
  return Object.entries(MODEL_PRICES).map(([model, price]) => ({
    model: model as GenerationModel,
    price,
  }));
}
