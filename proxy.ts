import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken, COOKIE_NAME } from '@/lib/auth/auth';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Rate limiting on all /api endpoints
  if (pathname.startsWith('/api')) {
    const clientKey = `${getClientIp(request)}:${pathname.split('/')[2] || 'root'}`;
    const isSensitive = pathname.includes('/auth/login') || pathname.includes('/presign');
    const limit = isSensitive ? 40 : 120; // 40 req/min for auth/presign, 120 req/min for standard data APIs
    const rate = checkRateLimit(clientKey, limit, 60 * 1000);

    if (!rate.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please wait a moment before trying again.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(rate.resetInSec),
            'X-RateLimit-Limit': String(rate.limit),
            'X-RateLimit-Remaining': '0',
          },
        }
      );
    }

    const response = NextResponse.next();
    response.headers.set('X-RateLimit-Limit', String(rate.limit));
    response.headers.set('X-RateLimit-Remaining', String(rate.remaining));
    return response;
  }

  const isLoginRoute = pathname === '/admin/login';
  const isAdminRoot = pathname === '/admin';

  // 2. Root /admin entry point
  if (isAdminRoot) {
    const token = request.cookies.get(COOKIE_NAME)?.value;
    if (token) {
      const admin = await verifyAdminToken(token);
      if (admin) {
        return NextResponse.redirect(new URL('/admin/dashboard', request.url));
      }
    }
    return NextResponse.redirect(new URL('/admin/login', request.url));
  }

  // 3. /admin/login page: if already logged in, go straight to dashboard
  if (isLoginRoute) {
    const token = request.cookies.get(COOKIE_NAME)?.value;
    if (token) {
      const admin = await verifyAdminToken(token);
      if (admin) {
        return NextResponse.redirect(new URL('/admin/dashboard', request.url));
      }
    }
    return NextResponse.next();
  }

  // 4. Protect all other /admin routes (/admin/dashboard, /admin/events, etc.)
  if (pathname.startsWith('/admin')) {
    const token = request.cookies.get(COOKIE_NAME)?.value;
    if (!token) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
    const admin = await verifyAdminToken(token);
    if (!admin) {
      const response = NextResponse.redirect(new URL('/admin/login', request.url));
      response.cookies.set(COOKIE_NAME, '', { maxAge: 0, path: '/' });
      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/:path*'],
};
