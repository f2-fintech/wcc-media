import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken, COOKIE_NAME } from '@/lib/auth/auth';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isLoginRoute = pathname === '/admin/login';
  const isAdminRoot = pathname === '/admin';

  // 1. Root /admin entry point
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

  // 2. /admin/login page: if already logged in, go straight to dashboard
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

  // 3. Protect all other /admin routes (/admin/dashboard, /admin/events, etc.)
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
  matcher: ['/admin/:path*'],
};
