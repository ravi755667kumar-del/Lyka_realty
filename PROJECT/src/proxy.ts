import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { isOriginAllowed } from './lib/serverAuth';

const CORS_HEADERS = {
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, X-CRM-Webhook-Secret',
  'Access-Control-Max-Age': '86400',
};

// Patterns matching sensitive, secret, or internal configuration files
const RESTRICTED_PATH_PATTERNS = [
  /^\/\.env/i,
  /^\/\.git/i,
  /^\/\.system/i,
  /^\/gemini-config\.local\.json/i,
  /^\/groq-config\.local\.json/i,
  /^\/speechify-config\.local\.json/i,
  /docker-compose/i,
  /Dockerfile/i,
  /\.(sql|bak|py|sh|yaml|yml|md)$/i,
  /\.(env|local\.json)$/i,
];

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: data: https:",
  "connect-src 'self' https: wss:",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

function applySecurityHeaders(response: NextResponse, isApiRoute: boolean) {
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-DNS-Prefetch-Control', 'off');
  response.headers.set('X-Permitted-Cross-Domain-Policies', 'none');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Content-Security-Policy', CONTENT_SECURITY_POLICY);
  response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  response.headers.set(
    'Permissions-Policy',
    'camera=(), geolocation=(), payment=(), usb=(), microphone=(self)'
  );
  if (isApiRoute) {
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    response.headers.set('Pragma', 'no-cache');
  }
}

/**
 * Next.js 16 Proxy enforcing strict CORS allowlisting, sensitive path rejection,
 * clickjacking protection, and defense-in-depth HTTP security headers.
 */
export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Immediately block attempts to access sensitive files or configuration
  for (const pattern of RESTRICTED_PATH_PATTERNS) {
    if (pattern.test(pathname)) {
      return new NextResponse(
        JSON.stringify({ error: 'Access Denied: Restricted destination.' }),
        {
          status: 403,
          headers: {
            'Content-Type': 'application/json',
            'X-Content-Type-Options': 'nosniff',
          },
        }
      );
    }
  }

  const isApiRoute = pathname.startsWith('/api');
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  const originAllowed = isOriginAllowed(origin, host);

  if (isApiRoute && request.method === 'OPTIONS') {
    if (origin && !originAllowed) {
      return new NextResponse(JSON.stringify({ error: 'Origin not allowed' }), {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
          Vary: 'Origin',
        },
      });
    }
    const headers: Record<string, string> = {
      ...CORS_HEADERS,
      Vary: 'Origin',
    };
    if (origin && originAllowed) {
      headers['Access-Control-Allow-Origin'] = origin;
    }
    return new NextResponse(null, {
      status: 204,
      headers,
    });
  }

  const response = NextResponse.next();
  applySecurityHeaders(response, isApiRoute);

  if (isApiRoute) {
    response.headers.set('Vary', 'Origin');
    if (origin && originAllowed) {
      response.headers.set('Access-Control-Allow-Origin', origin);
      response.headers.set('Access-Control-Allow-Methods', CORS_HEADERS['Access-Control-Allow-Methods']);
      response.headers.set('Access-Control-Allow-Headers', CORS_HEADERS['Access-Control-Allow-Headers']);
    }
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
