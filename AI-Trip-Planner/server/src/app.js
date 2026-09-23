// ╔══════════════════════════════════════════════════════════════════╗
// ║ EXPRESS APPLICATION FACTORY                                      ║
// ║                                                                  ║
// ║ PATTERN: Factory Function — createApp() returns a configured     ║
// ║ Express app. Dependencies (adapters) are INJECTED as parameters. ║
// ║ This makes the whole app testable — tests pass fake adapters.    ║
// ║                                                                  ║
// ║ MIDDLEWARE CHAIN (runs in order for every request):               ║
// ║   cors → json parser → cookie parser → origin check →           ║
// ║   morgan logger → route handlers → 404 → error handler          ║
// ║                                                                  ║
// ║ REUSE: requireAuth, loadOwnedResource, and errorHandler are      ║
// ║ shared across ALL route modules (auth, trips, travelers, etc.)   ║
// ╚══════════════════════════════════════════════════════════════════╝
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { healthRouter } from './routes/health.routes.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { travelersRouter } from './modules/travelers/travelers.routes.js';
import { createTripsRouter } from './modules/trips/trips.routes.js';
import { createEnrichmentRouter } from './modules/enrichment/enrichment.routes.js';
import { createPlacesAdapter } from './modules/enrichment/placesAdapter.js';
import { createWeatherAdapter } from './modules/enrichment/weatherAdapter.js';
import { createPhotoAdapter } from './modules/enrichment/photoAdapter.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';
import { requireExpectedOrigin } from './middleware/requireExpectedOrigin.js';
import { requireProxySecret } from './middleware/requireProxySecret.js';

// STUDY NOTE: This is a FACTORY FUNCTION. It receives external dependencies
// (adapters) as parameters with sensible defaults. If you don't pass anything,
// it creates real adapters. In tests, you pass fakes.
// TEACHER Q: "Why not just import the adapters directly?" → Because tests
// need to control what the adapters return without calling real external APIs.
export function createApp({
  geminiAdapter,
  placesAdapter = createPlacesAdapter(),
  weatherAdapter = createWeatherAdapter(),
  photoAdapter = createPhotoAdapter({ apiKey: env.pexelsApiKey }),
} = {}) {
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

  // STUDY NOTE: CORS (Cross-Origin Resource Sharing) controls which domains
  // can call this API. credentials:true allows cookies to be sent cross-origin.
  app.use(cors({ origin: env.corsOrigin, credentials: true }));
  // STUDY NOTE: Parses incoming JSON request bodies. limit prevents oversized
  // payloads from overwhelming the server (a basic DoS protection).
  app.use(express.json({ limit: env.jsonBodyLimit }));
  // STUDY NOTE: Parses cookies from the Cookie header into req.cookies object.
  // Required because our JWT session token is stored in an httpOnly cookie.
  app.use(cookieParser());
  // STUDY NOTE: CSRF protection — rejects cross-origin POST/PATCH/DELETE
  // requests from unauthorized origins. See requireExpectedOrigin.js.
  app.use(requireExpectedOrigin);

  // Morgan's default tokens (method/url/status/etc.) never include the request
  // body or cookies, so this can't leak passwords/JWTs into logs (SYSTEM_DESIGN §7).
  if (env.nodeEnv !== 'test') {
    app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));
  }

  // Render's own platform health check hits this service's public URL
  // directly (never through Vercel), so /api/health must stay reachable
  // without the proxy secret — it carries no user data and isn't rate-limit
  // sensitive, so exempting it doesn't reopen the ATP-85 gap.
  // STUDY NOTE: Health check is public (no proxy secret) — Render's own
  // health monitor hits it directly, not through Vercel.
  app.use('/api/health', healthRouter);
  // STUDY NOTE: Every other route is protected by requireProxySecret in
  // production — ensures requests came through Vercel's reverse proxy.
  // Each module gets its own sub-router mounted at its API path.
  app.use('/api/auth', requireProxySecret, authRouter);
  app.use('/api/traveler-profiles', requireProxySecret, travelersRouter);
  // STUDY NOTE: Trips router is created via factory because it needs the
  // geminiAdapter for AI generation/replan endpoints.
  app.use('/api/trips', requireProxySecret, createTripsRouter({ geminiAdapter }));
  app.use(
    '/api/enrichment',
    requireProxySecret,
    createEnrichmentRouter({ placesAdapter, weatherAdapter, photoAdapter }),
  );

  // STUDY NOTE: These two middleware MUST be last. notFoundHandler catches
  // any unmatched route (404). errorHandler catches any error thrown or passed
  // via next(err) from any middleware or controller above it.
  // TEACHER Q: "Why does errorHandler need 4 parameters?" → Express identifies
  // error-handling middleware by its (err, req, res, next) signature.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
