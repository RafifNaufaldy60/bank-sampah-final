import express from 'express';
import cors from 'cors';
import { randomUUID } from 'node:crypto';
import { config } from './config.js';
import { apiRoutes } from './routes/api.js';
import { ApiError, errorHandler } from './utils/errors.js';

export function createApp(db, settings = config) {
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    req.requestId = randomUUID();
    res.set('X-Request-Id', req.requestId);
    res.set('Cache-Control', 'no-store');
    res.set('X-Content-Type-Options', 'nosniff');
    next();
  });
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || settings.origins.includes(origin)) return callback(null, true);
      callback(new ApiError(403, 'ORIGIN_DITOLAK', 'Origin frontend tidak diizinkan.'));
    },
    methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
    exposedHeaders: ['Content-Disposition', 'X-Request-Id', 'Retry-After'],
  }));
  app.use(express.json({ limit: '32kb' }));
  app.use('/api', apiRoutes(db, settings));
  app.use((req, res, next) => next(new ApiError(404, 'ENDPOINT_TIDAK_DITEMUKAN', 'Endpoint tidak ditemukan.')));
  app.use(errorHandler);
  return app;
}
