import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { asyncHandler, HttpError } from '../middleware/errorHandler';
import { validateBody } from '../middleware/validate';
import { loginRateLimiter, registerRateLimiter } from '../middleware/rateLimit';
import { signAuthToken, setAuthCookie, clearAuthCookie, requireAuth } from '../middleware/auth';

const router = Router();

const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(200),
  password: z.string().min(8).max(200),
});

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

router.post(
  '/register',
  registerRateLimiter,
  validateBody(registerSchema),
  asyncHandler(async (req, res) => {
    const { name, email, password } = req.body;
    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) throw new HttpError(409, 'An account with this email already exists.');

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { name, email: email.toLowerCase(), passwordHash, role: 'CUSTOMER' },
    });

    const token = signAuthToken({ userId: user.id, role: user.role });
    setAuthCookie(res, token);
    res.status(201).json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  })
);

router.post(
  '/login',
  loginRateLimiter,
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    // Generic error message avoids leaking which accounts exist.
    if (!user) throw new HttpError(401, 'Invalid email or password.');

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new HttpError(401, 'Invalid email or password.');

    const token = signAuthToken({ userId: user.id, role: user.role });
    setAuthCookie(res, token);
    res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  })
);

router.post('/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ user: req.user });
  })
);

export default router;
