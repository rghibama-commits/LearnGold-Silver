import Decimal from 'decimal.js';
import { prisma } from '../lib/prisma';
import { HttpError } from '../middleware/errorHandler';
import { getLatestRates, priceVariant, computeOrderTotals } from './pricing.service';
import { toNumber, add } from '../lib/money';
import { generateOrderNumber, generateTransactionRef } from '../utils/orderNumber';

export async function getStoreSettings() {
  let settings = await prisma.storeSetting.findUnique({ where: { id: 'singleton' } });
  if (!settings) settings = await prisma.storeSetting.create({ data: { id: 'singleton' } });
  return settings;
}

export interface CheckoutLine {
  variantId: string;
  productName: string;
  purityLabel: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  stockQuantity: number;
}

export interface CheckoutSummary {
  lines: CheckoutLine[];
  subtotal: number;
  taxAmount: number;
  shippingAmount: number;
  total: number;
  currency: string;
  taxPercent: number;
}

/** Recomputes cart pricing from current DB state. Never trusts client-submitted totals. */
export async function computeCheckoutSummary(cartId: string): Promise<CheckoutSummary> {
  const cart = await prisma.cart.findUnique({
    where: { id: cartId },
    include: { items: { include: { variant: { include: { product: true } } } } },
  });
  if (!cart || cart.items.length === 0) throw new HttpError(400, 'Your cart is empty.');

  const settings = await getStoreSettings();
  const rates = await getLatestRates();

  const lines: CheckoutLine[] = [];
  const lineTotalsDecimal: Decimal[] = [];

  for (const item of cart.items) {
    const variant = item.variant;
    if (!variant.isActive) throw new HttpError(409, `${variant.product.name} is no longer available.`);
    const rate = rates[variant.product.metal];
    const breakdown = priceVariant(variant, rate);
    const lineTotal = breakdown.unitPrice.mul(item.quantity);
    lineTotalsDecimal.push(lineTotal);
    lines.push({
      variantId: variant.id,
      productName: variant.product.name,
      purityLabel: variant.purityLabel,
      quantity: item.quantity,
      unitPrice: toNumber(breakdown.unitPrice),
      lineTotal: toNumber(lineTotal),
      stockQuantity: variant.stockQuantity,
    });
  }

  const totals = computeOrderTotals(
    lineTotalsDecimal,
    new Decimal(settings.taxPercent.toString()),
    new Decimal(settings.shippingFlatFee.toString()),
    new Decimal(settings.freeShippingThreshold.toString())
  );

  return {
    lines,
    subtotal: toNumber(totals.subtotal),
    taxAmount: toNumber(totals.taxAmount),
    shippingAmount: toNumber(totals.shippingAmount),
    total: toNumber(totals.total),
    currency: settings.currency,
    taxPercent: toNumber(new Decimal(settings.taxPercent.toString())),
  };
}

export interface PlaceOrderInput {
  userId: string;
  cartId: string;
  idempotencyKey: string;
  acceptedTotal: number;
  address: {
    fullName: string;
    phone: string;
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
}

export type PlaceOrderResult =
  | { kind: 'created'; order: Awaited<ReturnType<typeof serializeOrder>> }
  | { kind: 'price_changed'; summary: CheckoutSummary }
  | { kind: 'duplicate'; order: Awaited<ReturnType<typeof serializeOrder>> };

async function serializeOrder(orderId: string) {
  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { items: true, payment: true },
  });
  return {
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    currency: order.currency,
    subtotalAmount: toNumber(order.subtotalAmount),
    taxAmount: toNumber(order.taxAmount),
    shippingAmount: toNumber(order.shippingAmount),
    totalAmount: toNumber(order.totalAmount),
    addressSnapshot: order.addressSnapshot,
    createdAt: order.createdAt,
    items: order.items.map((it) => ({
      productName: it.productNameSnapshot,
      purityLabel: it.purityLabelSnapshot,
      netWeightGrams: Number(it.netWeightGramsSnapshot),
      quantity: it.quantity,
      unitPrice: toNumber(it.unitPriceSnapshot),
      lineTotal: toNumber(it.lineTotalSnapshot),
    })),
    payment: order.payment
      ? { status: order.payment.status, isSimulated: order.payment.isSimulated, transactionRef: order.payment.transactionRef }
      : null,
  };
}

const PRICE_TOLERANCE = 0.01;

export async function placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> {
  const existing = await prisma.order.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (existing) {
    return { kind: 'duplicate', order: await serializeOrder(existing.id) };
  }

  const freshSummary = await computeCheckoutSummary(input.cartId);
  if (Math.abs(freshSummary.total - input.acceptedTotal) > PRICE_TOLERANCE) {
    return { kind: 'price_changed', summary: freshSummary };
  }

  for (const line of freshSummary.lines) {
    if (line.quantity > line.stockQuantity) {
      throw new HttpError(409, `${line.productName} (${line.purityLabel}) only has ${line.stockQuantity} unit(s) left.`);
    }
  }

  const settings = await getStoreSettings();
  const rates = await getLatestRates();
  const orderNumber = generateOrderNumber();

  try {
    const orderId = await prisma.$transaction(async (tx) => {
      const cart = await tx.cart.findUniqueOrThrow({
        where: { id: input.cartId },
        include: { items: { include: { variant: { include: { product: true } } } } },
      });

      const order = await tx.order.create({
        data: {
          orderNumber,
          userId: input.userId,
          status: 'CONFIRMED',
          paymentStatus: 'PENDING',
          idempotencyKey: input.idempotencyKey,
          currency: settings.currency,
          subtotalAmount: freshSummary.subtotal,
          taxAmount: freshSummary.taxAmount,
          shippingAmount: freshSummary.shippingAmount,
          totalAmount: freshSummary.total,
          addressSnapshot: input.address as never,
        },
      });

      for (const item of cart.items) {
        const variant = item.variant;
        // Atomic, race-safe stock decrement: fails (count 0) if stock dropped below quantity concurrently.
        const updated = await tx.productVariant.updateMany({
          where: { id: variant.id, stockQuantity: { gte: item.quantity } },
          data: { stockQuantity: { decrement: item.quantity } },
        });
        if (updated.count === 0) {
          throw new HttpError(409, `${variant.product.name} (${variant.purityLabel}) is out of stock.`);
        }

        const rate = rates[variant.product.metal];
        const breakdown = priceVariant(variant, rate);
        await tx.orderItem.create({
          data: {
            orderId: order.id,
            variantId: variant.id,
            productNameSnapshot: variant.product.name,
            skuSnapshot: variant.sku,
            metalSnapshot: variant.product.metal,
            purityLabelSnapshot: variant.purityLabel,
            purityFractionSnapshot: variant.purityFraction,
            netWeightGramsSnapshot: variant.netWeightGrams,
            ratePerGramSnapshot: rate.ratePerGram.toNumber(),
            rateSourceSnapshot: rate.source,
            metalValueSnapshot: toNumber(breakdown.metalValue),
            makingChargeSnapshot: toNumber(breakdown.makingCharge),
            stoneChargeSnapshot: toNumber(breakdown.stoneCharge),
            unitPriceSnapshot: toNumber(breakdown.unitPrice),
            quantity: item.quantity,
            lineTotalSnapshot: toNumber(add(breakdown.unitPrice.mul(item.quantity))),
          },
        });
      }

      // Simulated payment: no real card data or gateway is involved.
      await tx.payment.create({
        data: {
          orderId: order.id,
          provider: 'SIMULATED',
          isSimulated: true,
          status: 'PAID',
          amount: freshSummary.total,
          transactionRef: generateTransactionRef(),
        },
      });
      await tx.order.update({ where: { id: order.id }, data: { paymentStatus: 'PAID' } });

      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

      return order.id;
    });

    return { kind: 'created', order: await serializeOrder(orderId) };
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw err;
  }
}

export async function cancelOrder(userId: string, orderNumber: string, isAdmin: boolean) {
  const order = await prisma.order.findUnique({ where: { orderNumber }, include: { items: true } });
  if (!order) throw new HttpError(404, 'Order not found.');
  if (!isAdmin && order.userId !== userId) throw new HttpError(403, 'You do not have access to this order.');
  if (!['PENDING', 'CONFIRMED', 'PROCESSING'].includes(order.status)) {
    throw new HttpError(409, `Order in status ${order.status} cannot be cancelled.`);
  }

  await prisma.$transaction(async (tx) => {
    const result = await tx.order.updateMany({
      where: { id: order.id, stockRestored: false, status: { in: ['PENDING', 'CONFIRMED', 'PROCESSING'] } },
      data: { status: 'CANCELLED', stockRestored: true },
    });
    if (result.count === 0) return; // Already cancelled elsewhere; avoid double stock restore.

    for (const item of order.items) {
      await tx.productVariant.update({
        where: { id: item.variantId },
        data: { stockQuantity: { increment: item.quantity } },
      });
    }
  });

  return serializeOrder(order.id);
}

export { serializeOrder };
