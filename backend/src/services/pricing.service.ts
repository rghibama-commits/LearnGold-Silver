import { prisma } from '../lib/prisma';
import { money, add } from '../lib/money';
import Decimal from 'decimal.js';
import { Metal, ProductVariant, MakingChargeType } from '@prisma/client';

export interface RateInfo {
  metal: Metal;
  ratePerGram: Decimal;
  source: string;
  effectiveAt: Date;
}

export interface VariantPriceBreakdown {
  metalValue: Decimal;
  makingCharge: Decimal;
  stoneCharge: Decimal;
  unitPrice: Decimal;
  rate: RateInfo;
}

/** Fetches the most recently effective rate for a metal. Rates are manually entered by admins. */
export async function getLatestRate(metal: Metal): Promise<RateInfo> {
  const rate = await prisma.metalRate.findFirst({
    where: { metal },
    orderBy: { effectiveAt: 'desc' },
  });
  if (!rate) {
    throw new Error(`No metal rate configured for ${metal}. An administrator must add one.`);
  }
  return {
    metal: rate.metal,
    ratePerGram: new Decimal(rate.ratePerGram.toString()),
    source: rate.source,
    effectiveAt: rate.effectiveAt,
  };
}

export async function getLatestRates(): Promise<Record<Metal, RateInfo>> {
  const [gold, silver] = await Promise.all([getLatestRate('GOLD'), getLatestRate('SILVER')]);
  return { GOLD: gold, SILVER: silver };
}

/**
 * Computes the price of a single variant unit from its net weight, purity fraction and the
 * current metal rate (per gram of pure metal). Purity is applied exactly once here.
 */
export function priceVariant(
  variant: Pick<
    ProductVariant,
    'netWeightGrams' | 'purityFraction' | 'makingChargeType' | 'makingChargeValue' | 'stoneChargeAmount'
  >,
  rate: RateInfo
): VariantPriceBreakdown {
  const netWeight = new Decimal(variant.netWeightGrams.toString());
  const purity = new Decimal(variant.purityFraction.toString());
  const metalValue = money(netWeight.mul(rate.ratePerGram).mul(purity));

  const makingValue = new Decimal(variant.makingChargeValue.toString());
  const makingCharge =
    variant.makingChargeType === MakingChargeType.PERCENT_OF_METAL
      ? money(metalValue.mul(makingValue).div(100))
      : money(makingValue);

  const stoneCharge = money(new Decimal(variant.stoneChargeAmount.toString()));
  const unitPrice = add(metalValue, makingCharge, stoneCharge);

  return { metalValue, makingCharge, stoneCharge, unitPrice, rate };
}

export interface OrderTotals {
  subtotal: Decimal;
  taxAmount: Decimal;
  shippingAmount: Decimal;
  total: Decimal;
}

export function computeOrderTotals(
  lineTotals: Decimal[],
  taxPercent: Decimal,
  shippingFlatFee: Decimal,
  freeShippingThreshold: Decimal
): OrderTotals {
  const subtotal = add(...lineTotals);
  const taxAmount = money(subtotal.mul(taxPercent).div(100));
  const shippingAmount = subtotal.greaterThanOrEqualTo(freeShippingThreshold)
    ? money(0)
    : money(shippingFlatFee);
  const total = add(subtotal, taxAmount, shippingAmount);
  return { subtotal, taxAmount, shippingAmount, total };
}
