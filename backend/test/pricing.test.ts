import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import { priceVariant, computeOrderTotals } from '../src/services/pricing.service';
import { MakingChargeType, Metal } from '@prisma/client';

const rate = { metal: 'GOLD' as Metal, ratePerGram: new Decimal(6500), source: 'test', effectiveAt: new Date() };

describe('priceVariant', () => {
  it('applies purity fraction exactly once to metal value', () => {
    const variant = {
      netWeightGrams: new Decimal(10) as unknown as never,
      purityFraction: new Decimal(0.75) as unknown as never,
      makingChargeType: MakingChargeType.PERCENT_OF_METAL,
      makingChargeValue: new Decimal(10) as unknown as never,
      stoneChargeAmount: new Decimal(0) as unknown as never,
    };
    const result = priceVariant(variant, rate);
    // metal value = 10g * 6500 * 0.75 = 48750
    expect(result.metalValue.toNumber()).toBe(48750);
    // making charge = 10% of metal value = 4875
    expect(result.makingCharge.toNumber()).toBe(4875);
    expect(result.unitPrice.toNumber()).toBe(53625);
  });

  it('supports flat making charges and stone charges', () => {
    const variant = {
      netWeightGrams: new Decimal(5) as unknown as never,
      purityFraction: new Decimal(0.999) as unknown as never,
      makingChargeType: MakingChargeType.FLAT,
      makingChargeValue: new Decimal(300) as unknown as never,
      stoneChargeAmount: new Decimal(150) as unknown as never,
    };
    const result = priceVariant(variant, rate);
    // metal value = 5 * 6500 * 0.999 = 32467.5
    expect(result.metalValue.toNumber()).toBe(32467.5);
    expect(result.makingCharge.toNumber()).toBe(300);
    expect(result.stoneCharge.toNumber()).toBe(150);
    expect(result.unitPrice.toNumber()).toBe(32917.5);
  });

  it('rounds currency amounts to 2 decimal places', () => {
    const variant = {
      netWeightGrams: new Decimal(3.333) as unknown as never,
      purityFraction: new Decimal(0.9167) as unknown as never,
      makingChargeType: MakingChargeType.PERCENT_OF_METAL,
      makingChargeValue: new Decimal(12.5) as unknown as never,
      stoneChargeAmount: new Decimal(0) as unknown as never,
    };
    const result = priceVariant(variant, rate);
    expect(result.metalValue.decimalPlaces()).toBeLessThanOrEqual(2);
    expect(result.unitPrice.decimalPlaces()).toBeLessThanOrEqual(2);
  });
});

describe('computeOrderTotals', () => {
  it('applies tax to subtotal and flat shipping when below free threshold', () => {
    const totals = computeOrderTotals([new Decimal(1000), new Decimal(500)], new Decimal(3), new Decimal(150), new Decimal(50000));
    expect(totals.subtotal.toNumber()).toBe(1500);
    expect(totals.taxAmount.toNumber()).toBe(45);
    expect(totals.shippingAmount.toNumber()).toBe(150);
    expect(totals.total.toNumber()).toBe(1695);
  });

  it('waives shipping at or above the free shipping threshold', () => {
    const totals = computeOrderTotals([new Decimal(60000)], new Decimal(3), new Decimal(150), new Decimal(50000));
    expect(totals.shippingAmount.toNumber()).toBe(0);
  });
});
