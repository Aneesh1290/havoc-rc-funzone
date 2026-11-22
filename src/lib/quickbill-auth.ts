import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

export const QUICKBILL_DEFAULT_API_KEY = "qb_live_havoc_rc";
export const QUICKBILL_DEFAULT_SECRET_KEY = "qb_sec_havoc_rc_live_key";
export const QUICKBILL_DEFAULT_TOKEN = "qb_live_havoc_rc_token";

export interface RateLimitRecord {
  count: number;
  resetAt: number; // unix ms
}

export interface QuickbillAuthResult {
  success: boolean;
  clientIp: string;
  rateLimit: {
    limit: number;
    remaining: number;
    reset: number;
  };
  error?: string;
  statusCode?: number;
}

// In-memory sliding window rate limiter: 60 requests per minute per IP
const rateLimitMap = new Map<string, RateLimitRecord>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 60;

/**
 * Constant-time string comparison using SHA-256 digest
 * to prevent timing attacks regardless of string length.
 */
function safeCompare(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const hashA = crypto.createHash("sha256").update(a).digest();
  const hashB = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

/**
 * Extract client IP from proxy headers (x-forwarded-for, x-real-ip) or fallback.
 */
export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0].trim();
    if (first) return first;
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  const cfConnectingIp = req.headers.get("cf-connecting-ip");
  if (cfConnectingIp) return cfConnectingIp.trim();
  return "127.0.0.1";
}

/**
 * Verify if client IP is permitted if QUICKBILL_ALLOWED_IPS is configured.
 */
function isIpAllowed(clientIp: string): boolean {
  const allowed = process.env.QUICKBILL_ALLOWED_IPS?.trim();
  if (!allowed) return true;
  const list = allowed.split(",").map(ip => ip.trim()).filter(Boolean);
  if (list.length === 0) return true;
  return list.includes(clientIp) || list.includes("0.0.0.0") || list.includes("*");
}

/**
 * Rate limit check: 60 req/min
 */
function checkRateLimit(clientIp: string): { allowed: boolean; limit: number; remaining: number; reset: number } {
  const now = Date.now();
  let record = rateLimitMap.get(clientIp);

  if (!record || now >= record.resetAt) {
    record = {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS
    };
    rateLimitMap.set(clientIp, record);
    return {
      allowed: true,
      limit: RATE_LIMIT_MAX,
      remaining: RATE_LIMIT_MAX - 1,
      reset: Math.ceil(record.resetAt / 1000)
    };
  }

  if (record.count >= RATE_LIMIT_MAX) {
    return {
      allowed: false,
      limit: RATE_LIMIT_MAX,
      remaining: 0,
      reset: Math.ceil(record.resetAt / 1000)
    };
  }

  record.count += 1;
  return {
    allowed: true,
    limit: RATE_LIMIT_MAX,
    remaining: Math.max(0, RATE_LIMIT_MAX - record.count),
    reset: Math.ceil(record.resetAt / 1000)
  };
}

/**
 * Authentication & Security Middleware for Quickbill POS endpoints.
 * Supports:
 * 1. HTTP Basic Auth (`Authorization: Basic base64(apiKey:secretKey)`)
 * 2. Custom Headers (`X-API-Key` & `X-Secret-Key` OR `X-Quickbill-Token`)
 * 3. Query Parameters (`?api_key=...&secret_key=...` OR `?token=...`)
 * 4. Timing safe comparison and IP whitelisting
 * 5. Rate limiting (60 req/min per IP)
 */
export function verifyQuickbillRequest(req: NextRequest): QuickbillAuthResult {
  const clientIp = getClientIp(req);
  const rateLimit = checkRateLimit(clientIp);

  // 1. Check Rate Limit
  if (!rateLimit.allowed) {
    return {
      success: false,
      clientIp,
      rateLimit,
      statusCode: 429,
      error: "Too Many Requests. Rate limit of 60 req/min exceeded."
    };
  }

  // 2. Check Optional IP Whitelist
  if (!isIpAllowed(clientIp)) {
    return {
      success: false,
      clientIp,
      rateLimit,
      statusCode: 403,
      error: "Forbidden: Client IP not authorized for Quickbill API."
    };
  }

  // 3. Resolve Expected Credentials
  const expectedApiKey = process.env.QUICKBILL_API_KEY || QUICKBILL_DEFAULT_API_KEY;
  const expectedSecretKey = process.env.QUICKBILL_SECRET_KEY || QUICKBILL_DEFAULT_SECRET_KEY;
  const expectedToken = process.env.QUICKBILL_TOKEN || QUICKBILL_DEFAULT_TOKEN;

  let providedApiKey: string | null = null;
  let providedSecretKey: string | null = null;
  let providedToken: string | null = null;

  // A. Check Authorization header (HTTP Basic Auth or Bearer)
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  if (authHeader) {
    if (authHeader.startsWith("Basic ")) {
      try {
        const decoded = Buffer.from(authHeader.slice(6).trim(), "base64").toString("utf-8");
        const colonIdx = decoded.indexOf(":");
        if (colonIdx !== -1) {
          providedApiKey = decoded.substring(0, colonIdx);
          providedSecretKey = decoded.substring(colonIdx + 1);
        }
      } catch (_) {}
    } else if (authHeader.startsWith("Bearer ")) {
      providedToken = authHeader.slice(7).trim();
    }
  }

  // B. Check Custom Headers
  if (!providedApiKey && !providedToken) {
    providedApiKey = req.headers.get("x-api-key") || req.headers.get("X-API-Key");
    providedSecretKey = req.headers.get("x-secret-key") || req.headers.get("X-Secret-Key");
    providedToken = 
      req.headers.get("x-quickbill-token") || 
      req.headers.get("X-Quickbill-Token") || 
      req.headers.get("x-token") || 
      req.headers.get("X-Token");
  }

  // C. Check Query Parameters (fallback / testing)
  if (!providedApiKey && !providedToken) {
    const searchParams = req.nextUrl.searchParams;
    providedApiKey = searchParams.get("api_key") || searchParams.get("apiKey");
    providedSecretKey = searchParams.get("secret_key") || searchParams.get("secretKey");
    providedToken = searchParams.get("token") || searchParams.get("quickbill_token");
  }

  // D. Validate against expected credentials
  const isKeySecretValid = 
    Boolean(providedApiKey && providedSecretKey) &&
    safeCompare(providedApiKey, expectedApiKey) &&
    safeCompare(providedSecretKey, expectedSecretKey);

  const isTokenValid = 
    Boolean(providedToken) && 
    safeCompare(providedToken, expectedToken);

  if (isKeySecretValid || isTokenValid) {
    return {
      success: true,
      clientIp,
      rateLimit
    };
  }

  return {
    success: false,
    clientIp,
    rateLimit,
    statusCode: 401,
    error: "Unauthorized: Invalid Quickbill API credentials. Provide valid Basic Auth, X-API-Key/X-Secret-Key, or X-Quickbill-Token."
  };
}

/**
 * Attaches X-RateLimit headers (and Retry-After if 429) to response
 */
export function withRateLimitHeaders(res: NextResponse, auth: QuickbillAuthResult): NextResponse {
  res.headers.set("X-RateLimit-Limit", String(auth.rateLimit.limit));
  res.headers.set("X-RateLimit-Remaining", String(auth.rateLimit.remaining));
  res.headers.set("X-RateLimit-Reset", String(auth.rateLimit.reset));

  if (auth.statusCode === 429) {
    const retryAfterSeconds = Math.max(1, auth.rateLimit.reset - Math.floor(Date.now() / 1000));
    res.headers.set("Retry-After", String(retryAfterSeconds));
  }

  return res;
}
