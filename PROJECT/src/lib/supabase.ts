import { createClient, User as SupabaseUser, Session } from '@supabase/supabase-js';

const rawSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || '';
const supabaseUrl = rawSupabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || '';

// Local switch: NEXT_PUBLIC_SUPABASE_ENABLED=false runs the app on its built-in local stores
// without contacting Supabase at all (e.g. when the project is unreachable or no longer exists).
const supabaseEnabled =
  (process.env.NEXT_PUBLIC_SUPABASE_ENABLED || 'true').trim().toLowerCase() !== 'false';

export const isSupabaseConfigured = Boolean(
  supabaseEnabled &&
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl !== '' &&
  supabaseAnonKey !== '' &&
  !supabaseUrl.includes('YOUR_SUPABASE')
);

// Fallback placeholder so createClient never throws in development if keys are blank
const safeUrl = isSupabaseConfigured ? supabaseUrl : 'https://placeholder-project.supabase.co';
const safeKey = isSupabaseConfigured ? supabaseAnonKey : 'placeholder-anon-key';

export const supabase = createClient(safeUrl, safeKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

// User type alias
export type AuthUser = SupabaseUser;

/**
 * Checks whether the signed-in user is permitted based on NEXT_PUBLIC_ADMIN_EMAILS (if configured).
 * When NEXT_PUBLIC_ADMIN_EMAILS is unset, any authenticated Supabase user is allowed.
 */
export function isAuthorizedAdminUser(user: AuthUser | null): boolean {
  if (!user) return false;
  const rawAllowlist =
    typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_ADMIN_EMAILS || '' : '';
  const allowedEmails = rawAllowlist
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (allowedEmails.length === 0) return true;
  const email = (user.email || '').trim().toLowerCase();
  return Boolean(email && allowedEmails.includes(email));
}

export async function getCurrentAccessToken(): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token || null;
  } catch {
    return null;
  }
}

function isProtectedInternalApiUrl(url: string): boolean {
  if (!url) return false;
  if (url.startsWith('/api/') || url === '/api') return true;
  if (typeof window === 'undefined') return false;

  try {
    const parsed = new URL(url, window.location.origin);
    if (!parsed.pathname.startsWith('/api/') && parsed.pathname !== '/api') {
      return false;
    }

    if (parsed.origin === window.location.origin) {
      return true;
    }

    const configuredBase =
      typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_API_BASE_URL?.trim() || '' : '';
    if (configuredBase) {
      const allowedBase = new URL(configuredBase);
      if (parsed.origin === allowedBase.origin) {
        return true;
      }
    }
  } catch {
    return false;
  }
  return false;
}

/**
 * Wraps window.fetch so every call to our backend /api/* endpoints automatically attaches
 * the active Supabase session's Bearer JWT without exposing tokens to third-party origins.
 */
export function installSecureApiFetchInterceptor(): void {
  if (typeof window === 'undefined') return;
  const w = window as unknown as { __lykaSecureFetchInstalled?: boolean };
  if (w.__lykaSecureFetchInstalled) return;
  w.__lykaSecureFetchInstalled = true;

  const currentFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const urlStr =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    if (!isProtectedInternalApiUrl(urlStr)) {
      return currentFetch(input, init);
    }

    const token = await getCurrentAccessToken();
    const headers = new Headers(
      init?.headers || (input instanceof Request ? input.headers : undefined)
    );

    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    return currentFetch(input, {
      ...init,
      headers,
    });
  };
}

// ─── Supabase Auth Helpers ───────────────────────────────────────────────────

export async function logout() {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem('lyka_local_leads_v2');
      localStorage.removeItem('lyka_local_calls_v2');
    } catch {
      // ignore storage errors
    }
  }
  if (!isSupabaseConfigured) return;
  await supabase.auth.signOut();
}

export function onAuthStateChanged(callback: (user: AuthUser | null) => void) {
  if (!isSupabaseConfigured) {
    callback(null);
    return () => {};
  }

  // Initial fetch
  supabase.auth
    .getSession()
    .then(({ data: { session } }) => {
      callback(session?.user || null);
    })
    .catch(() => {
      callback(null);
    });

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user || null);
  });

  return () => {
    subscription.unsubscribe();
  };
}
