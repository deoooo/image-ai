import { describe, expect, test } from "vitest";
import {
  addMoney,
  formatMoney,
  hasEnoughMoney,
  isValidMoney,
  normalizeMoney,
  subtractMoney,
  toMoneyUnits,
} from "@/lib/money";

describe("money", () => {
  test("normalizes legacy floating-point tails to three decimal places", () => {
    expect(normalizeMoney(7.32000000000007)).toBe(7.32);
    expect(formatMoney(7.32000000000007)).toBe("7.32");
  });

  test("validates the supported monetary scale", () => {
    expect(isValidMoney(0)).toBe(true);
    expect(isValidMoney(12.345)).toBe(true);
    expect(isValidMoney(0.001, { positive: true })).toBe(true);
    expect(isValidMoney(0, { positive: true })).toBe(false);
    expect(isValidMoney(0.0000000001)).toBe(false);
    expect(isValidMoney(12.3456)).toBe(false);
    expect(isValidMoney(Number.POSITIVE_INFINITY)).toBe(false);
  });

  test("compares and calculates in integer milli-yuan units", () => {
    expect(toMoneyUnits(0.07999999999999931)).toBe(80);
    expect(hasEnoughMoney(0.07999999999999931, 0.08)).toBe(true);
    expect(subtractMoney(2, 0.08)).toBe(1.92);
    expect(addMoney(7.32000000000007, 0.08)).toBe(7.4);
  });
});
