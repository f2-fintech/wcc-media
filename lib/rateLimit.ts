/**
 * In-memory sliding window rate limiter for protecting API routes
 */

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

// Global cache for rate limiting
const rateLimitMap = new Map<string, RateLimitRecord>();

// Periodic cleanup of expired rate limits every 2 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of rateLimitMap.entries()) {
      if (record.resetAt <= now) {
        rateLimitMap.delete(key);
      }
    }
  }, 2 * 60 * 1000);
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetInSec: number;
}

/**
 * Checks if a given identifier (e.g. IP or user ID) is within rate limits.
 *
 * @param identifier Unique client key (IP, token, or session ID)
 * @param limit Maximum requests allowed in window (default 120)
 * @param windowMs Time window in milliseconds (default 60,000ms = 1 min)
 */
export function checkRateLimit(
  identifier: string,
  limit: number = 120,
  windowMs: number = 60 * 1000
): RateLimitResult {
  const now = Date.now();
  const record = rateLimitMap.get(identifier);

  if (!record || record.resetAt <= now) {
    rateLimitMap.set(identifier, {
      count: 1,
      resetAt: now + windowMs,
    });
    return {
      allowed: true,
      limit,
      remaining: limit - 1,
      resetInSec: Math.ceil(windowMs / 1000),
    };
  }

  if (record.count >= limit) {
    return {
      allowed: false,
      limit,
      remaining: 0,
      resetInSec: Math.max(1, Math.ceil((record.resetAt - now) / 1000)),
    };
  }

  record.count += 1;
  return {
    allowed: true,
    limit,
    remaining: limit - record.count,
    resetInSec: Math.ceil((record.resetAt - now) / 1000),
  };
}

/**
 * Helper to extract client identifier (IP address) from NextRequest
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = req.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }
  return '127.0.0.1';
}
