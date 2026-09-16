import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { asyncHandler, HttpError } from '../middleware/errorHandler';
import { validateBody } from '../middleware/validate';
import { requireAdmin } from '../middleware/auth';

const router = Router();
router.use(requireAdmin);

async function audit(adminUserId: string, action: string, entityType: string, entityId: string, before: unknown, after: unknown) {
  await prisma.adminAuditLog.create({
    data: { adminUserId, action, entityType, entityId, beforeJson: before as never, afterJson: after as never },
  });
}

// ---------- Products & variants ----------

router.get(
  '/products',
  asyncHandler(async (_req, res) => {
    const products = await prisma.product.findMany({ include: { variants: true }, orderBy: { createdAt: 'desc' } });
    res.json({ products });
  })
);

const variantInputSchema = z.object({
  sku: z.string().min(1),
  purityLabel: z.string().min(1),
  purityFraction: z.coerce.number().min(0).max(1),
  netWeightGrams: z.coerce.number().positive(),
  grossWeightGrams: z.coerce.number().positive().optional(),
  makingChargeType: z.enum(['FLAT', 'PERCENT_OF_METAL']),
  makingChargeValue: z.coerce.number().nonnegative(),
  stoneChargeAmount: z.coerce.number().nonnegative().default(0),
  stockQuantity: z.coerce.number().int().nonnegative(),
  images: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
});

const productInputSchema = z.object({
  sku: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  category: z.enum(['JEWELLERY', 'COIN', 'BAR']),
  metal: z.enum(['GOLD', 'SILVER']),
  images: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
  variants: z.array(variantInputSchema).min(1),
});

router.post(
  '/products',
  validateBody(productInputSchema),
  asyncHandler(async (req, res) => {
    const data = req.body as z.infer<typeof productInputSchema>;
    const existing = await prisma.product.findFirst({ where: { OR: [{ sku: data.sku }, { slug: data.slug }] } });
    if (existing) throw new HttpError(409, 'A product with this SKU or slug already exists.');

    const product = await prisma.product.create({
      data: {
        sku: data.sku,
        slug: data.slug,
        name: data.name,
        description: data.description,
        category: data.category,
        metal: data.metal,
        images: data.images,
        isActive: data.isActive,
        variants: { create: data.variants },
      },
      include: { variants: true },
    });
    await audit(req.user!.id, 'CREATE', 'Product', product.id, null, product);
    res.status(201).json({ product });
  })
);

const productUpdateSchema = productInputSchema.partial().extend({ variants: z.array(variantInputSchema).optional() });

router.put(
  '/products/:id',
  validateBody(productUpdateSchema),
  asyncHandler(async (req, res) => {
    const before = await prisma.product.findUnique({ where: { id: req.params.id }, include: { variants: true } });
    if (!before) throw new HttpError(404, 'Product not found.');

    const { variants, ...rest } = req.body as z.infer<typeof productUpdateSchema>;
    const product = await prisma.product.update({ where: { id: req.params.id }, data: rest, include: { variants: true } });

    if (variants) {
      for (const v of variants) {
        await prisma.productVariant.upsert({
          where: { sku: v.sku },
          update: { ...v, productId: product.id },
          create: { ...v, productId: product.id },
        });
      }
    }

    const after = await prisma.product.findUnique({ where: { id: product.id }, include: { variants: true } });
    await audit(req.user!.id, 'UPDATE', 'Product', product.id, before, after);
    res.json({ product: after });
  })
);

const stockUpdateSchema = z.object({ stockQuantity: z.coerce.number().int().nonnegative() });

router.put(
  '/variants/:id/stock',
  validateBody(stockUpdateSchema),
  asyncHandler(async (req, res) => {
    const before = await prisma.productVariant.findUnique({ where: { id: req.params.id } });
    if (!before) throw new HttpError(404, 'Variant not found.');
    const after = await prisma.productVariant.update({ where: { id: req.params.id }, data: { stockQuantity: req.body.stockQuantity } });
    await audit(req.user!.id, 'UPDATE_STOCK', 'ProductVariant', after.id, before, after);
    res.json({ variant: after });
  })
);

// ---------- Metal rates ----------

router.get(
  '/rates',
  asyncHandler(async (_req, res) => {
    const rates = await prisma.metalRate.findMany({ orderBy: { effectiveAt: 'desc' }, take: 50 });
    res.json({ rates });
  })
);

const rateInputSchema = z.object({
  metal: z.enum(['GOLD', 'SILVER']),
  ratePerGram: z.coerce.number().positive(),
  source: z.string().min(2).max(200),
});

router.post(
  '/rates',
  validateBody(rateInputSchema),
  asyncHandler(async (req, res) => {
    const rate = await prisma.metalRate.create({
      data: { ...req.body, createdById: req.user!.id },
    });
    await audit(req.user!.id, 'CREATE', 'MetalRate', rate.id, null, rate);
    res.status(201).json({ rate });
  })
);

// ---------- Store settings ----------

const settingsSchema = z.object({
  storeName: z.string().min(1).optional(),
  currency: z.string().min(1).optional(),
  currencySymbol: z.string().min(1).optional(),
  taxPercent: z.coerce.number().min(0).max(100).optional(),
  shippingFlatFee: z.coerce.number().min(0).optional(),
  freeShippingThreshold: z.coerce.number().min(0).optional(),
  isDemoMode: z.boolean().optional(),
});

router.put(
  '/settings',
  validateBody(settingsSchema),
  asyncHandler(async (req, res) => {
    const before = await prisma.storeSetting.findUnique({ where: { id: 'singleton' } });
    const after = await prisma.storeSetting.upsert({
      where: { id: 'singleton' },
      update: req.body,
      create: { id: 'singleton', ...req.body },
    });
    await audit(req.user!.id, 'UPDATE', 'StoreSetting', 'singleton', before, after);
    res.json({ settings: after });
  })
);

// ---------- Orders ----------

router.get(
  '/orders',
  asyncHandler(async (req, res) => {
    const status = req.query.status as string | undefined;
    const orders = await prisma.order.findMany({
      where: status ? { status: status as never } : undefined,
      orderBy: { createdAt: 'desc' },
      include: { items: true, user: { select: { name: true, email: true } } },
      take: 200,
    });
    res.json({ orders });
  })
);

const statusUpdateSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED']),
});

const VALID_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

router.put(
  '/orders/:id/status',
  validateBody(statusUpdateSchema),
  asyncHandler(async (req, res) => {
    const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: { items: true } });
    if (!order) throw new HttpError(404, 'Order not found.');

    const target = req.body.status;
    if (target === 'CANCELLED') {
      if (!['PENDING', 'CONFIRMED', 'PROCESSING'].includes(order.status)) {
        throw new HttpError(409, `Cannot cancel an order in status ${order.status}.`);
      }
      await prisma.$transaction(async (tx) => {
        const result = await tx.order.updateMany({
          where: { id: order.id, stockRestored: false },
          data: { status: 'CANCELLED', stockRestored: true },
        });
        if (result.count > 0) {
          for (const item of order.items) {
            await tx.productVariant.update({ where: { id: item.variantId }, data: { stockQuantity: { increment: item.quantity } } });
          }
        }
      });
    } else {
      if (!VALID_TRANSITIONS[order.status]?.includes(target)) {
        throw new HttpError(409, `Cannot move order from ${order.status} to ${target}.`);
      }
      await prisma.order.update({ where: { id: order.id }, data: { status: target } });
    }

    const after = await prisma.order.findUnique({ where: { id: order.id } });
    await audit(req.user!.id, 'UPDATE_STATUS', 'Order', order.id, { status: order.status }, { status: after?.status });
    res.json({ order: after });
  })
);

router.get(
  '/audit-log',
  asyncHandler(async (_req, res) => {
    const logs = await prisma.adminAuditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { admin: { select: { name: true, email: true } } },
    });
    res.json({ logs });
  })
);

export default router;
