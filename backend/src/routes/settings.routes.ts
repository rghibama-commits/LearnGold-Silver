import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../middleware/errorHandler';
import { getLatestRates } from '../services/pricing.service';
import { toNumber } from '../lib/money';

const router = Router();

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    let settings = await prisma.storeSetting.findUnique({ where: { id: 'singleton' } });
    if (!settings) {
      settings = await prisma.storeSetting.create({ data: { id: 'singleton' } });
    }
    const rates = await getLatestRates().catch(() => null);

    res.json({
      storeName: settings.storeName,
      currency: settings.currency,
      currencySymbol: settings.currencySymbol,
      taxPercent: toNumber(settings.taxPercent),
      shippingFlatFee: toNumber(settings.shippingFlatFee),
      freeShippingThreshold: toNumber(settings.freeShippingThreshold),
      isDemoMode: settings.isDemoMode,
      rates: rates
        ? {
            GOLD: { ratePerGram: toNumber(rates.GOLD.ratePerGram), source: rates.GOLD.source, effectiveAt: rates.GOLD.effectiveAt },
            SILVER: { ratePerGram: toNumber(rates.SILVER.ratePerGram), source: rates.SILVER.source, effectiveAt: rates.SILVER.effectiveAt },
          }
        : null,
    });
  })
);

export default router;
