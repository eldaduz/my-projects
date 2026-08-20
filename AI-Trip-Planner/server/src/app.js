import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { healthRouter } from './routes/health.routes.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { travelersRouter } from './modules/travelers/travelers.routes.js';
import { createTripsRouter } from './modules/trips/trips.routes.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';
import { requireExpectedOrigin } from './middleware/requireExpectedOrigin.js';

export function createApp({ geminiAdapter } = {}) {
  const app = express();

  // Production is Vercel (an /api rewrite) -> Render -> this app
  // (SYSTEM_DESIGN.md's frozen deployment diagram) — two reverse-proxy hops
  // between the real client and this process, not one. Trusting only 1 hop
  // would still resolve req.ip to Vercel's egress address, collapsing every
  // user behind it into one shared rate-limit bucket (the auth and AI
  // per-IP limiters both rely on req.ip). ponytail: this hop count is a
  // best-effort match to the documented architecture, not something
  // verifiable from this dev sandbox — confirm the real X-Forwarded-For
  // chain against a live Render deployment and adjust if Render's own
  // front-end adds more than one additional hop.
  app.set('trust proxy', 2);

  app.use(cors({ origin: env.corsOrigin, credentials: true }));
  app.use(express.json({ limit: env.jsonBodyLimit }));
  app.use(cookieParser());
  app.use(requireExpectedOrigin);

  // Morgan's default tokens (method/url/status/etc.) never include the request
  // body or cookies, so this can't leak passwords/JWTs into logs (SYSTEM_DESIGN §7).
  if (env.nodeEnv !== 'test') {
    app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));
  }

  app.use('/api/health', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/traveler-profiles', travelersRouter);
  app.use('/api/trips', createTripsRouter({ geminiAdapter }));

  // This server is API-only (no HTML pages), so a JSON 404 applies to any
  // unmatched route, not just /api/*.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
