import { next } from '@vercel/functions';

export const config = { matcher: '/api/:path*', runtime: 'nodejs' };

export default function middleware(request) {
  const headers = new Headers(request.headers);
  headers.set('x-internal-proxy-secret', process.env.INTERNAL_PROXY_SECRET ?? '');
  return next({ request: { headers } });
}
