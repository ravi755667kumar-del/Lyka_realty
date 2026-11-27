import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export interface ApiAuthOutcome {
  ok: boolean;
  mode?: 'jwt' | 'webhook';
  userId?: string;
  email?: string | null;
  /** Non-null whenever ok === false; typed as NextResponse for strict/non-strict TS compatibility */
  response: NextResponse;
}

export interface ApiAuthOptions {
  allowWebhookSecret?: boolean;
  maxRequestsPerMinute?: number;
  rateLimitBucket?: string;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface CachedTokenEntry {
  userId: string;
  email: string | null;
  expiresAt: number;
}

const RATE_LIMIT_STORE = new Map<string, RateLimitEntry>();
const TOKEN_CACHE = new Map<string, CachedTokenEntry>();
const MAX_RATE_LIMIT_ENTRIES = 5000;
const TOKEN_CACHE_TTL_MS = 30_000;

let cachedSupabaseClient: SupabaseClient | null = null;

function getSupabaseServerAuthClient(): SupabaseClient | null {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || '';
  const url = rawUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    '';

  if (!url || !key || !url.startsWith('http') || url.includes('placeholder')) {
    return null;
  }

  if (!cachedSupabaseClient) {
    cachedSupabaseClient = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cachedSupabaseClient;
}

function normalizeOriginValue(value: string): string {
  return value.trim().replace(/\/+$/, '').toLowerCase();
}

function parseCommaList(raw?: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * Checks whether an authenticated user email is permitted to access admin data.
 * If no explicit allowlist is set via ADMIN_ALLOWED_EMAILS or NEXT_PUBLIC_ADMIN_EMAILS,
 * any authenticated user in the configured Supabase project is permitted.
 */
export function isEmailAuthorizedAdmin(
  email?: string | null,
  rawAllowlist?: string
): boolean {
  const normalizedEmail = (email || '').trim().toLowerCase();
  if (!normalizedEmail) return false;

  const allowlistRaw =
    rawAllowlist !== undefined
      ? rawAllowlist
      : process.env.ADMIN_ALLOWED_EMAILS || process.env.NEXT_PUBLIC_ADMIN_EMAILS || '';

  const allowedEmails = parseCommaList(allowlistRaw).map((entry) => entry.toLowerCase());
  if (allowedEmails.length === 0) {
    return true;
  }
  return allowedEmails.includes(normalizedEmail);
}

/**
 * Strict CORS origin allowlist:
 * Allows same-host requests, Capacitor mobile shell origins, local dev servers,
 * configured NEXT_PUBLIC_APP_URL / NEXT_PUBLIC_API_BASE_URL origins, and explicit ALLOWED_ORIGINS.
 * Rejects arbitrary third-party websites and `'null'` origins.
 */
export function isOriginAllowed(
  origin: string | null | undefined,
  hostHeader?: string | null,
  rawExtraOrigins?: string
): boolean {
  if (!origin) return true; // Non-CORS / same-origin requests without Origin header

  const normalized = normalizeOriginValue(origin);
  if (!normalized || normalized === 'null') return false;

  // Capacitor iOS / Android shells & local loopback dev
  if (
    normalized === 'https://localhost' ||
    normalized === 'http://localhost' ||
    normalized === 'capacitor://localhost' ||
    normalized === 'ionic://localhost' ||
    /^https?:\/\/localhost(?::\d{1,5})?$/.test(normalized) ||
    /^https?:\/\/127\.0\.0\.1(?::\d{1,5})?$/.test(normalized)
  ) {
    return true;
  }

  // Exact same host as incoming request
  if (hostHeader) {
    const normalizedHost = hostHeader.trim().toLowerCase();
    if (
      normalized === `https://${normalizedHost}` ||
      normalized === `http://${normalizedHost}`
    ) {
      return true;
    }
  }

  // Configured application / API base URLs
  for (const envUrl of [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_API_BASE_URL,
  ]) {
    if (envUrl) {
      try {
        const parsed = new URL(envUrl.trim());
        if (normalizeOriginValue(parsed.origin) === normalized) {
          return true;
        }
      } catch {
        // Ignore invalid URL env
      }
    }
  }

  // Explicit ALLOWED_ORIGINS allowlist
  const extraRaw = rawExtraOrigins !== undefined ? rawExtraOrigins : process.env.ALLOWED_ORIGINS;
  const extraOrigins = parseCommaList(extraRaw).map(normalizeOriginValue);
  return extraOrigins.includes(normalized);
}

/**
 * Constant-time comparison for shared secrets (e.g., CRM webhook secret).
 */
export function timingSafeSecretEquals(
  provided: string | null | undefined,
  expected: string | null | undefined
): boolean {
  if (!provided || !expected) return false;
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length === 0 || a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Fixed-window in-memory rate limiter with bounded map size.
 */
export function checkRateLimit(
  key: string,
  maxRequests = 120,
  windowMs = 60_000,
  now = Date.now()
): RateLimitResult {
  if (RATE_LIMIT_STORE.size > MAX_RATE_LIMIT_ENTRIES) {
    for (const [k, entry] of RATE_LIMIT_STORE.entries()) {
      if (entry.resetAt <= now) {
        RATE_LIMIT_STORE.delete(k);
      }
    }
    if (RATE_LIMIT_STORE.size > MAX_RATE_LIMIT_ENTRIES) {
      RATE_LIMIT_STORE.clear();
    }
  }

  const existing = RATE_LIMIT_STORE.get(key);
  if (!existing || existing.resetAt <= now) {
    RATE_LIMIT_STORE.set(key, { count: 1, resetAt: now + windowMs });
    return {
      allowed: true,
      remaining: Math.max(0, maxRequests - 1),
      retryAfterSeconds: Math.ceil(windowMs / 1000),
    };
  }

  existing.count += 1;
  const remaining = Math.max(0, maxRequests - existing.count);
  const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
  return {
    allowed: existing.count <= maxRequests,
    remaining,
    retryAfterSeconds,
  };
}

export function resetRateLimitStoreForTests(): void {
  RATE_LIMIT_STORE.clear();
  TOKEN_CACHE.clear();
}

/**
 * Masks an account identifier or phone number before returning it to clients.
 */
export function maskSensitiveValue(
  value: string | null | undefined,
  visiblePrefix = 4,
  visibleSuffix = 4
): string {
  const clean = (value || '').trim();
  if (!clean) return '';
  if (clean.length <= visiblePrefix + visibleSuffix) {
    return '••••••••';
  }
  return `${clean.slice(0, visiblePrefix)}••••••••${clean.slice(-visibleSuffix)}`;
}

/**
 * Avoids returning internal DB connection strings, file paths, or stack traces to callers.
 */
export function redactErrorMessage(err: unknown, fallback = 'Operation failed'): string {
  if (!err || typeof err !== 'object') return fallback;
  const msg = String((err as { message?: unknown }).message || '');
  if (!msg) return fallback;
  if (
    /postgres|neon|supabase|password|token|secret|key|ECONN|ENOTFOUND|SQL|:\\|\/Users\/|\/home\//i.test(
      msg
    )
  ) {
    return fallback;
  }
  return msg.slice(0, 160);
}

export function getClientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.headers.get('x-real-ip')?.trim() || 'unknown';
}

export function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function unauthJson(message: string, status: number, extraHeaders?: Record<string, string>) {
  return NextResponse.json(
    { error: message },
    {
      status,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        ...extraHeaders,
      },
    }
  );
}

/**
 * Enforces rate limiting + authenticated Supabase Bearer JWT (or optional CRM webhook secret)
 * on server API routes.
 */
export async function requireAuthenticatedApi(
  req: Request,
  options: ApiAuthOptions = {}
): Promise<ApiAuthOutcome> {
  const ip = getClientIp(req);
  const bucket = options.rateLimitBucket || 'api';
  const maxRequests = options.maxRequestsPerMinute ?? 180;
  const rl = checkRateLimit(`${bucket}:${ip}`, maxRequests, 60_000);
  if (!rl.allowed) {
    return {
      ok: false,
      response: unauthJson('Too many requests. Please try again shortly.', 429, {
        'Retry-After': String(rl.retryAfterSeconds),
      }),
    };
  }

  // Local opt-out (do NOT use in production): set API_REQUIRE_AUTH=false to skip
  // session verification while the UI login gate is disabled.
  if ((process.env.API_REQUIRE_AUTH || '').trim().toLowerCase() === 'false') {
    return {
      ok: true,
      userId: 'local-open',
      email: null,
      response: null as unknown as NextResponse,
    };
  }

  if (options.allowWebhookSecret) {
    const expectedSecret = process.env.CRM_WEBHOOK_SECRET?.trim();
    const providedSecret = req.headers.get('x-crm-webhook-secret')?.trim();
    if (expectedSecret && providedSecret) {
      if (timingSafeSecretEquals(providedSecret, expectedSecret)) {
        return {
          ok: true,
          mode: 'webhook',
          userId: 'crm-webhook',
          email: null,
          response: null as unknown as NextResponse,
        };
      }
      return {
        ok: false,
        response: unauthJson('Invalid webhook secret.', 401),
      };
    }
  }

  const token = extractBearerToken(req);
  if (!token) {
    return {
      ok: false,
      response: unauthJson('Authentication required.', 401),
    };
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const now = Date.now();
  const cached = TOKEN_CACHE.get(tokenHash);
  if (cached && cached.expiresAt > now) {
    if (!isEmailAuthorizedAdmin(cached.email)) {
      return {
        ok: false,
        response: unauthJson('Forbidden: account is not authorized.', 403),
      };
    }
    return {
      ok: true,
      mode: 'jwt',
      userId: cached.userId,
      email: cached.email,
      response: null as unknown as NextResponse,
    };
  }

  const client = getSupabaseServerAuthClient();
  if (!client) {
    return {
      ok: false,
      response: unauthJson('Authentication service is not configured on the server.', 503),
    };
  }

  try {
    const { data, error } = await client.auth.getUser(token);
    if (error || !data?.user) {
      TOKEN_CACHE.delete(tokenHash);
      return {
        ok: false,
        response: unauthJson('Invalid or expired session token.', 401),
      };
    }

    const email = data.user.email || null;
    if (!isEmailAuthorizedAdmin(email)) {
      return {
        ok: false,
        response: unauthJson('Forbidden: account is not authorized.', 403),
      };
    }

    if (TOKEN_CACHE.size > 1000) {
      TOKEN_CACHE.clear();
    }
    TOKEN_CACHE.set(tokenHash, {
      userId: data.user.id,
      email,
      expiresAt: now + TOKEN_CACHE_TTL_MS,
    });

    return {
      ok: true,
      mode: 'jwt',
      userId: data.user.id,
      email,
      response: null as unknown as NextResponse,
    };
  } catch {
    return {
      ok: false,
      response: unauthJson('Session verification failed.', 401),
    };
  }
}
