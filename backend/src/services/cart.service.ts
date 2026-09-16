import crypto from 'crypto';
import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

const CART_COOKIE = 'gss_cart';

/** Retrieves the cart bound to the current cart cookie / logged-in user, creating one if needed. */
export async function getOrCreateCart(req: Request, res: Response) {
  const userId = req.user?.id;
  let token = req.cookies?.[CART_COOKIE];

  if (userId) {
    let cart = await prisma.cart.findFirst({ where: { userId } });
    if (!cart && token) {
      // Adopt an anonymous cart created before login.
      cart = await prisma.cart.update({ where: { token }, data: { userId } }).catch(() => null);
    }
    if (!cart) {
      cart = await prisma.cart.create({ data: { token: crypto.randomUUID(), userId } });
    }
    if (cart.token !== token) {
      res.cookie(CART_COOKIE, cart.token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/' });
    }
    return cart;
  }

  if (token) {
    const cart = await prisma.cart.findUnique({ where: { token } });
    if (cart) return cart;
  }

  token = crypto.randomUUID();
  const cart = await prisma.cart.create({ data: { token } });
  res.cookie(CART_COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/' });
  return cart;
}
