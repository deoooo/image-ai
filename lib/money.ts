export const MONEY_DECIMAL_PLACES = 3;
export const MONEY_FACTOR = 10 ** MONEY_DECIMAL_PLACES;
export const MAX_MONEY = 999_999_999.999;

const moneyFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: MONEY_DECIMAL_PLACES,
});

export function normalizeMoney(value: number): number {
  return Math.round(value * MONEY_FACTOR) / MONEY_FACTOR;
}

export function isValidMoney(value: unknown, options: { positive?: boolean } = {}): value is number {
  if (typeof value !== "number" || !Number.isFinite(value) || Math.abs(value) > MAX_MONEY) {
    return false;
  }

  if (options.positive ? value <= 0 : value < 0) {
    return false;
  }

  const scaled = value * MONEY_FACTOR;
  const scaleTolerance = Number.EPSILON * Math.max(1, Math.abs(scaled)) * 4;
  return Math.abs(scaled - Math.round(scaled)) <= scaleTolerance;
}

export function toMoneyUnits(value: number): number {
  return Math.round(value * MONEY_FACTOR);
}

export function hasEnoughMoney(available: number, required: number): boolean {
  return toMoneyUnits(available) >= toMoneyUnits(required);
}

export function subtractMoney(left: number, right: number): number {
  return (toMoneyUnits(left) - toMoneyUnits(right)) / MONEY_FACTOR;
}

export function addMoney(left: number, right: number): number {
  return (toMoneyUnits(left) + toMoneyUnits(right)) / MONEY_FACTOR;
}

export function formatMoney(value: number): string {
  return moneyFormatter.format(normalizeMoney(value));
}
