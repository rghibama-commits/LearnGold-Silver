import path from 'path';
import fs from 'fs';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import { attachUser } from './middleware/auth';
import { ensureCsrfCookie, verifyCsrf } from './middleware/csrf';
import { apiRateLimiter } from './middleware/rateLimit';
import { errorHandler } from './middleware/errorHandler';

import authRoutes from './routes/auth.routes';
import productRoutes from './routes/products.routes';
import cartRoutes from './routes/cart.routes';
import orderRoutes from './routes/orders.routes';
import adminRoutes from './routes/admin.routes';
import settingsRoutes from './routes/settings.routes';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

  const allowedOrigin = process.env.CORS_ORIGIN;
  app.use(
    cors({
      origin: allowedOrigin ? allowedOrigin.split(',') : true,
      credentials: true,
    })
  );

  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(attachUser);
  app.use(ensureCsrfCookie);

  app.get('/api/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));
  app.get('/api/csrf-token', (req, res) => res.json({ csrfToken: req.csrfToken }));

  app.use('/api', apiRateLimiter);
  app.use('/api', verifyCsrf);

  app.use('/api/auth', authRoutes);
  app.use('/api/products', productRoutes);
  app.use('/api/cart', cartRoutes);
  app.use('/api/orders', orderRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/settings', settingsRoutes);

  // Serve the built frontend as static files from this single web service.
  const staticDir = path.join(__dirname, '..', 'public');
  if (fs.existsSync(staticDir)) {
    app.use(express.static(staticDir));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(path.join(staticDir, 'index.html'));
    });
  }

  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found.' }));
  app.use(errorHandler);

  return app;
}
