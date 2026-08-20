import { env } from '../config/env.js';
import { HttpError } from './errorHandler.js';

const HEADER = 'x-internal-proxy-secret';

// ATP-85: trust-proxy is fixed at 2 hops to match the frozen Vercel -> Render
// topology (app.js). A caller hitting Render's own public onrender.com URL
// directly is one hop short of that assumption and can forge an extra
// X-Forwarded-For entry that Express then trusts as req.ip, rotating spoofed
// IPs to evade the per-IP rate limiters. Only requests carrying the secret
// Vercel's Edge Middleware attaches (never shipped to the browser bundle) are
// let through in production; non-production environments have no Vercel hop
// in front of them at all, so the check is skipped there.
export function requireProxySecret(req, res, next) {
  if (env.nodeEnv !== 'production') {
    return next();
  }

  if (req.get(HEADER) !== env.internalProxySecret) {
    return next(new HttpError(403, 'Direct access to this origin is not allowed.', 'FORBIDDEN_ORIGIN'));
  }

  next();
}
