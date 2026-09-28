import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);
const COOKIE_NAME = 'wcc_admin_token';
const TOKEN_EXPIRY = '8h';

export interface AdminTokenPayload {
  adminId: string;
  email: string;
  role: string;
}

/**
 * Sign a JWT token for admin authentication.
 */
export async function signAdminToken(payload: AdminTokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(JWT_SECRET);
}

/**
 * Verify and decode a JWT token.
 */
export async function verifyAdminToken(
  token: string
): Promise<AdminTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as AdminTokenPayload;
  } catch {
    return null;
  }
}

/**
 * Get the admin token from cookies.
 */
export async function getAdminTokenFromCookies(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME);
  return token?.value ?? null;
}

/**
 * Get the authenticated admin from the current request cookies.
 * Returns null if not authenticated.
 */
export async function getAuthenticatedAdmin(): Promise<AdminTokenPayload | null> {
  const token = await getAdminTokenFromCookies();
  if (!token) return null;
  return verifyAdminToken(token);
}

/**
 * Set the admin auth cookie on a response.
 */
export function setAuthCookie(response: NextResponse, token: string): NextResponse {
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 8 * 60 * 60, // 8 hours
    path: '/',
  });
  return response;
}

/**
 * Clear the admin auth cookie.
 */
export function clearAuthCookie(response: NextResponse): NextResponse {
  response.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });
  return response;
}

/**
 * Middleware helper to require admin auth on API routes.
 * Returns the admin payload or a 401 NextResponse.
 */
export async function requireAdminAuth(
  request: NextRequest
): Promise<AdminTokenPayload | NextResponse> {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const admin = await verifyAdminToken(token);
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return admin;
}

export { COOKIE_NAME };
