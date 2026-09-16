import Decimal from 'decimal.js';

// All currency amounts are rounded to 2 decimal places using ROUND_HALF_UP for
// consistent, predictable results regardless of the underlying float representation.
Decimal.set({ rounding: Decimal.ROUND_HALF_UP });

export function money(value: Decimal.Value): Decimal {
  return new Decimal(value).toDecimalPlaces(2);
}

export function toNumber(value: Decimal.Value): number {
  return new Decimal(value).toDecimalPlaces(2).toNumber();
}

export function add(...values: Decimal.Value[]): Decimal {
  return values.reduce((acc: Decimal, v) => acc.plus(v), new Decimal(0)).toDecimalPlaces(2);
}
