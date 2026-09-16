import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { asyncHandler, HttpError } from '../middleware/errorHandler';
import { validateBody } from '../middleware/validate';
import { getOrCreateCart } from '../services/cart.service';
import { getLatestRates, priceVariant } from '../services/pricing.service';
import { toNumber } from '../lib/money';

const router = Router();

async function serializeCart(cartId: string) {
  const cart = await prisma.cart.findUnique({
    where: { id: cartId },
    include: { items: { include: { variant: { include: { product: true } } } } },
  });
  if (!cart) return { items: [], subtotal: 0 };

  const rates = await getLatestRates();
  let subtotal = 0;
  const items = cart.items.map((item) => {
    const variant = item.variant;
    const rate = rates[variant.product.metal];
    const breakdown = priceVariant(variant, rate);
    const unitPrice = toNumber(breakdown.unitPrice);
    const lineTotal = Math.round(unitPrice * item.quantity * 100) / 100;
    subtotal += lineTotal;
    return {
      id: item.id,
      variantId: variant.id,
      productSlug: variant.product.slug,
      productName: variant.product.name,
      image: variant.images[0] ?? variant.product.images[0] ?? null,
      purityLabel: variant.purityLabel,
      netWeightGrams: Number(variant.netWeightGrams),
      unitPrice,
      quantity: item.quantity,
      lineTotal,
      stockQuantity: variant.stockQuantity,
      maxAvailable: variant.stockQuantity,
    };
  });

  return { items, subtotal: Math.round(subtotal * 100) / 100 };
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const cart = await getOrCreateCart(req, res);
    res.json(await serializeCart(cart.id));
  })
);

const addItemSchema = z.object({
  variantId: z.string().min(1),
  quantity: z.coerce.number().int().min(1).max(50),
});

router.post(
  '/items',
  validateBody(addItemSchema),
  asyncHandler(async (req, res) => {
    const cart = await getOrCreateCart(req, res);
    const variant = await prisma.productVariant.findUnique({ where: { id: req.body.variantId } });
    if (!variant || !variant.isActive) throw new HttpError(404, 'Product variant not found.');

    const existing = await prisma.cartItem.findUnique({
      where: { cartId_variantId: { cartId: cart.id, variantId: variant.id } },
    });
    const desiredQty = (existing?.quantity ?? 0) + req.body.quantity;
    if (desiredQty > variant.stockQuantity) {
      throw new HttpError(409, `Only ${variant.stockQuantity} unit(s) available in stock.`);
    }

    if (existing) {
      await prisma.cartItem.update({ where: { id: existing.id }, data: { quantity: desiredQty } });
    } else {
      await prisma.cartItem.create({ data: { cartId: cart.id, variantId: variant.id, quantity: req.body.quantity } });
    }
    res.status(201).json(await serializeCart(cart.id));
  })
);

const updateItemSchema = z.object({ quantity: z.coerce.number().int().min(1).max(50) });

router.patch(
  '/items/:itemId',
  validateBody(updateItemSchema),
  asyncHandler(async (req, res) => {
    const cart = await getOrCreateCart(req, res);
    const item = await prisma.cartItem.findFirst({ where: { id: req.params.itemId, cartId: cart.id }, include: { variant: true } });
    if (!item) throw new HttpError(404, 'Cart item not found.');
    if (req.body.quantity > item.variant.stockQuantity) {
      throw new HttpError(409, `Only ${item.variant.stockQuantity} unit(s) available in stock.`);
    }
    await prisma.cartItem.update({ where: { id: item.id }, data: { quantity: req.body.quantity } });
    res.json(await serializeCart(cart.id));
  })
);

router.delete(
  '/items/:itemId',
  asyncHandler(async (req, res) => {
    const cart = await getOrCreateCart(req, res);
    await prisma.cartItem.deleteMany({ where: { id: req.params.itemId, cartId: cart.id } });
    res.json(await serializeCart(cart.id));
  })
);

router.delete(
  '/',
  asyncHandler(async (req, res) => {
    const cart = await getOrCreateCart(req, res);
    await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    res.json(await serializeCart(cart.id));
  })
);

export default router;
