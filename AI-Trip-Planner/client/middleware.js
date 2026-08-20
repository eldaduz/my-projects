import { next } from '@vercel/edge';

// ATP-85: the server rejects direct hits to Render's own public URL because
// trust-proxy assumes exactly 2 hops (Vercel -> Render). This Edge Middleware
// runs on Vercel's network before vercel.json's /api rewrite forwards the
// request to Render, attaching a shared secret the browser never sees (this
// file executes server-side on Vercel, isn't shipped in the client bundle).
// The backend (requireProxySecret.js) checks this header in production and
// is otherwise a no-op, so a mismatched/missing INTERNAL_PROXY_SECRET here
// only blocks traffic — it can't accidentally weaken the check.
export const config = {
  matcher: '/api/:path*',
};

export default function middleware(request) {
  const headers = new Headers(request.headers);
  headers.set('x-internal-proxy-secret', process.env.INTERNAL_PROXY_SECRET ?? '');
  return next({ request: { headers } });
}
