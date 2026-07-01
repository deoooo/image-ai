import { describe, expect, test } from "vitest";
import {
  getModelPrice,
  isSupportedModel,
  listModelPrices,
  MODEL_PRICES,
} from "@/lib/model-pricing";

describe("model pricing", () => {
  test("returns configured prices for supported models", () => {
    expect(getModelPrice("nano-banana-fast")).toBe(MODEL_PRICES["nano-banana-fast"]);
    expect(getModelPrice("nano-banana-pro")).toBe(MODEL_PRICES["nano-banana-pro"]);
  });

  test("rejects unknown models", () => {
    expect(getModelPrice("unknown-model")).toBeNull();
    expect(isSupportedModel("unknown-model")).toBe(false);
  });

  test("lists model prices for the UI", () => {
    expect(listModelPrices()).toEqual([
      { model: "nano-banana-fast", price: MODEL_PRICES["nano-banana-fast"] },
      { model: "nano-banana-pro", price: MODEL_PRICES["nano-banana-pro"] },
    ]);
  });
});
