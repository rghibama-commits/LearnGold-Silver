import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { asyncHandler, HttpError } from '../middleware/errorHandler';
import { validateBody } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import { getOrCreateCart } from '../services/cart.service';
import { computeCheckoutSummary, placeOrder, cancelOrder, serializeOrder } from '../services/order.service';

const router = Router();

router.get(
  '/checkout/summary',
  requireAuth,
  asyncHandler(async (req, res) => {
    const cart = await getOrCreateCart(req, res);
    const summary = await computeCheckoutSummary(cart.id);
    res.json(summary);
  })
);

const addressSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(6).max(20),
  line1: z.string().trim().min(3).max(200),
  line2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(1).max(100),
  state: z.string().trim().min(1).max(100),
  postalCode: z.string().trim().min(2).max(20),
  country: z.string().trim().min(2).max(100),
});

const placeOrderSchema = z.object({
  address: addressSchema,
  acceptedTotal: z.coerce.number().nonnegative(),
  idempotencyKey: z.string().min(10).max(200),
});

router.post(
  '/',
  requireAuth,
  validateBody(placeOrderSchema),
  asyncHandler(async (req, res) => {
    const cart = await getOrCreateCart(req, res);
    const result = await placeOrder({
      userId: req.user!.id,
      cartId: cart.id,
      idempotencyKey: req.body.idempotencyKey,
      acceptedTotal: req.body.acceptedTotal,
      address: req.body.address,
    });

    if (result.kind === 'price_changed') {
      return res.status(409).json({ error: 'Prices changed since you loaded checkout. Please review and confirm the new total.', summary: result.summary });
    }
    res.status(result.kind === 'duplicate' ? 200 : 201).json({ order: result.order, duplicate: result.kind === 'duplicate' });
  })
);

router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const orders = await prisma.order.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      include: { items: true, payment: true },
    });
    res.json({
      orders: orders.map((o) => ({
        orderNumber: o.orderNumber,
        status: o.status,
        paymentStatus: o.paymentStatus,
        totalAmount: Number(o.totalAmount),
        currency: o.currency,
        createdAt: o.createdAt,
        itemCount: o.items.reduce((sum, it) => sum + it.quantity, 0),
      })),
    });
  })
);

router.get(
  '/:orderNumber',
  requireAuth,
  asyncHandler(async (req, res) => {
    const order = await prisma.order.findUnique({ where: { orderNumber: req.params.orderNumber } });
    if (!order) throw new HttpError(404, 'Order not found.');
    if (order.userId !== req.user!.id && req.user!.role !== 'ADMIN') {
      throw new HttpError(403, 'You do not have access to this order.');
    }
    res.json({ order: await serializeOrder(order.id) });
  })
);

router.post(
  '/:orderNumber/cancel',
  requireAuth,
  asyncHandler(async (req, res) => {
    const order = await cancelOrder(req.user!.id, req.params.orderNumber, req.user!.role === 'ADMIN');
    res.json({ order });
  })
);

export default router;
