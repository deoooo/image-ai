import { describe, expect, test } from "vitest";
import {
  getModelPrice,
  isSupportedModel,
  listModelPrices,
  MODEL_PRICES,
} from "@/lib/model-pricing";

describe("model pricing", () => {
  test("returns configured prices for supported models", () => {
    expect(getModelPrice("gpt-image-2")).toBe(0.25);
    expect(getModelPrice("nano-banana-fast")).toBe(0.08);
    expect(getModelPrice("nano-banana-pro")).toBe(0.25);
    expect(MODEL_PRICES).toEqual({
      "gpt-image-2": 0.25,
      "nano-banana-fast": 0.08,
      "nano-banana-pro": 0.25,
    });
  });

  test("rejects unknown models", () => {
    expect(getModelPrice("unknown-model")).toBeNull();
    expect(isSupportedModel("unknown-model")).toBe(false);
  });

  test("lists model prices for the UI", () => {
    expect(listModelPrices()).toEqual([
      { model: "gpt-image-2", price: 0.25 },
      { model: "nano-banana-fast", price: 0.08 },
      { model: "nano-banana-pro", price: 0.25 },
    ]);
  });
});
