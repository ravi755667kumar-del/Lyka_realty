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

// ─── Supabase Auth Helpers ───────────────────────────────────────────────────

export async function loginWithEmail(email: string, password: string) {
  if (!isSupabaseConfigured) {
    // Return mock user if keys are blank
    return {
      data: {
        user: { id: 'mock_admin', email } as AuthUser,
        session: null,
      },
      error: null,
    };
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
    return {
      data: {
        user: { id: 'mock_admin', email } as AuthUser,
        session: null,
      },
      error: null,
    };
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
    return { data: { user: { id: 'mock_google_admin', email: 'admin@lyka.local' } }, error: null };
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
  if (!isSupabaseConfigured) return;
  await supabase.auth.signOut();
}

export function onAuthStateChanged(callback: (user: AuthUser | null) => void) {
  if (!isSupabaseConfigured) {
    // In local mode, default to logged in as admin for smooth preview
    callback({ id: 'local_admin', email: 'admin@lykarealty.com' } as AuthUser);
    return () => {};
  }

  // Initial fetch
  supabase.auth.getSession().then(({ data: { session } }) => {
    callback(session?.user || null);
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
