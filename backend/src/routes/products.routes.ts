import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { asyncHandler, HttpError } from '../middleware/errorHandler';
import { validateQuery } from '../middleware/validate';
import { getLatestRates, priceVariant } from '../services/pricing.service';
import { toNumber } from '../lib/money';

const router = Router();

const listQuerySchema = z.object({
  search: z.string().trim().optional(),
  metal: z.enum(['GOLD', 'SILVER']).optional(),
  category: z.enum(['JEWELLERY', 'COIN', 'BAR']).optional(),
  purity: z.string().optional(),
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().nonnegative().optional(),
  inStockOnly: z.coerce.boolean().optional(),
  sort: z.enum(['price_asc', 'price_desc', 'newest', 'name_asc']).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});

router.get(
  '/',
  validateQuery(listQuerySchema),
  asyncHandler(async (req, res) => {
    const q = req.query as unknown as z.infer<typeof listQuerySchema>;
    const rates = await getLatestRates();

    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        ...(q.metal ? { metal: q.metal } : {}),
        ...(q.category ? { category: q.category } : {}),
        ...(q.search
          ? {
              OR: [
                { name: { contains: q.search, mode: 'insensitive' } },
                { description: { contains: q.search, mode: 'insensitive' } },
                { sku: { contains: q.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: { variants: { where: { isActive: true } } },
      orderBy: q.sort === 'name_asc' ? { name: 'asc' } : q.sort === 'newest' ? { createdAt: 'desc' } : undefined,
    });

    type CardVariant = ReturnType<typeof priceVariant> & { id: string; purityLabel: string; stockQuantity: number; netWeightGrams: number };
    let cards = products.map((p) => {
      let variants = p.variants
        .filter((v) => !q.purity || v.purityLabel === q.purity)
        .map((v) => {
          const breakdown = priceVariant(v, rates[p.metal]);
          return {
            id: v.id,
            purityLabel: v.purityLabel,
            stockQuantity: v.stockQuantity,
            netWeightGrams: Number(v.netWeightGrams),
            ...breakdown,
          } as CardVariant;
        });

      if (q.inStockOnly) variants = variants.filter((v) => v.stockQuantity > 0);
      if (q.minPrice !== undefined) variants = variants.filter((v) => toNumber(v.unitPrice) >= q.minPrice!);
      if (q.maxPrice !== undefined) variants = variants.filter((v) => toNumber(v.unitPrice) <= q.maxPrice!);

      const cheapest = variants.reduce<CardVariant | null>((min, v) => {
        if (!min) return v;
        return toNumber(v.unitPrice) < toNumber(min.unitPrice) ? v : min;
      }, null);

      return {
        id: p.id,
        slug: p.slug,
        sku: p.sku,
        name: p.name,
        category: p.category,
        metal: p.metal,
        images: p.images,
        variantCount: variants.length,
        fromPrice: cheapest ? toNumber(cheapest.unitPrice) : null,
        inStock: variants.some((v) => v.stockQuantity > 0),
        purities: variants.map((v) => v.purityLabel),
      };
    });

    cards = cards.filter((c) => c.variantCount > 0);

    if (q.sort === 'price_asc') cards.sort((a, b) => (a.fromPrice ?? 0) - (b.fromPrice ?? 0));
    if (q.sort === 'price_desc') cards.sort((a, b) => (b.fromPrice ?? 0) - (a.fromPrice ?? 0));

    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 12;
    const start = (page - 1) * pageSize;
    const pageItems = cards.slice(start, start + pageSize);

    res.json({
      items: pageItems,
      total: cards.length,
      page,
      pageSize,
      rates: {
        GOLD: { ratePerGram: toNumber(rates.GOLD.ratePerGram), source: rates.GOLD.source, effectiveAt: rates.GOLD.effectiveAt },
        SILVER: { ratePerGram: toNumber(rates.SILVER.ratePerGram), source: rates.SILVER.source, effectiveAt: rates.SILVER.effectiveAt },
      },
    });
  })
);

router.get(
  '/:slug',
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findUnique({
      where: { slug: req.params.slug },
      include: { variants: { where: { isActive: true } } },
    });
    if (!product || !product.isActive) throw new HttpError(404, 'Product not found.');

    const rates = await getLatestRates();
    const rate = rates[product.metal];
    const variants = product.variants.map((v) => {
      const breakdown = priceVariant(v, rate);
      return {
        id: v.id,
        sku: v.sku,
        purityLabel: v.purityLabel,
        purityFraction: Number(v.purityFraction),
        netWeightGrams: Number(v.netWeightGrams),
        grossWeightGrams: v.grossWeightGrams ? Number(v.grossWeightGrams) : null,
        stockQuantity: v.stockQuantity,
        images: v.images.length ? v.images : product.images,
        priceBreakdown: {
          metalValue: toNumber(breakdown.metalValue),
          makingCharge: toNumber(breakdown.makingCharge),
          stoneCharge: toNumber(breakdown.stoneCharge),
          unitPrice: toNumber(breakdown.unitPrice),
          ratePerGram: toNumber(rate.ratePerGram),
          rateSource: rate.source,
          rateEffectiveAt: rate.effectiveAt,
        },
      };
    });

    res.json({
      id: product.id,
      slug: product.slug,
      sku: product.sku,
      name: product.name,
      description: product.description,
      category: product.category,
      metal: product.metal,
      images: product.images,
      variants,
    });
  })
);

export default router;
