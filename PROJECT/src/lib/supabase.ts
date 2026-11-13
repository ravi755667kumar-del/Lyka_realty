import { createClient, User as SupabaseUser, Session } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || '';

export const isSupabaseConfigured = Boolean(
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

const allowSelfSignup =
  typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_ALLOW_SIGNUP !== 'false';

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

// ─── Supabase Auth Helpers (Fail-Closed) ─────────────────────────────────────

export async function loginWithEmail(email: string, password: string) {
  if (!isSupabaseConfigured) {
    throw new Error('Authentication service is not configured. Contact your administrator.');
  }
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return { data, error: null };
}

export async function registerWithEmail(email: string, password: string) {
  if (!isSupabaseConfigured) {
    throw new Error('Authentication service is not configured. Contact your administrator.');
  }
  if (!allowSelfSignup) {
    throw new Error('Self-registration is disabled. Contact your administrator for access.');
  }
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });
  if (error) throw error;
  return { data, error: null };
}

export async function loginWithGoogle() {
  if (!isSupabaseConfigured) {
    throw new Error('Authentication service is not configured. Contact your administrator.');
  }
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${origin}/`,
    },
  });
  if (error) throw error;
  return data;
}

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
