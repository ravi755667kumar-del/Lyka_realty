/**
 * Maps Firebase Auth error codes to actionable, user-facing messages.
 * See https://firebase.google.com/docs/auth/web/errors for the full list.
 */
const AUTH_ERROR_MESSAGES: Record<string, string> = {
  // Configuration / environment
  'auth/unauthorized-domain':
    'This domain is not authorized for Google sign-in. Add it in Firebase Console → Authentication → Settings → Authorized domains.',
  'auth/operation-not-allowed':
    'This sign-in method is disabled for the Firebase project. Enable it in Firebase Console → Authentication → Sign-in method.',
  'auth/api-key-not-valid':
    'The Firebase API key is invalid or restricted. Check the key configuration in the Google Cloud console.',
  'auth/network-request-failed':
    'Network error. Check your internet connection and try again.',

  // Popup / redirect
  'auth/popup-blocked':
    'Your browser blocked the sign-in popup. Allow popups for this site, or use "Sign in with redirect instead".',
  'auth/popup-closed-by-user':
    'The sign-in window closed before it finished. Please try again, or use "Sign in with redirect instead".',
  'auth/cancelled-popup-request':
    'Another sign-in attempt was already in progress. Please try again.',
  'auth/operation-not-supported-in-this-environment':
    'This browser does not support popup sign-in. Use "Sign in with redirect instead".',
  'auth/web-storage-unsupported':
    'Your browser blocks the storage Firebase needs. Allow cookies/site data, or try a different browser.',
  'auth/redirect-cancelled-by-user':
    'The sign-in redirect was cancelled. Please try again.',

  // Google / OAuth provider
  'auth/access_denied':
    'Google denied the sign-in. If this persists, add your Google account as a Test user in the OAuth consent screen, or publish the app.',
  'auth/account-exists-with-different-credential':
    'An account already exists with this email using a different sign-in method.',

  // Email / password
  'auth/invalid-email': 'That email address is not valid.',
  'auth/missing-password': 'Please enter your password.',
  'auth/weak-password': 'Please choose a password with at least 6 characters.',
  'auth/email-already-in-use':
    'An account with this email already exists. Switch to "Sign in" instead.',
  'auth/user-not-found': 'No account found for this email. Switch to "Create account" instead.',
  'auth/wrong-password': 'Incorrect password. Please try again.',
  'auth/invalid-credential': 'Incorrect email or password. Please try again.',
  'auth/user-disabled': 'This account has been disabled.',
  'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
};

/**
 * Returns a friendly message for a Firebase Auth error (or any thrown value).
 * Google redirect errors can arrive as a bare "access_denied" code.
 */
export function getAuthErrorMessage(err: unknown): string {
  const code = (err as { code?: string } | null)?.code ?? '';
  if (code && AUTH_ERROR_MESSAGES[code]) return AUTH_ERROR_MESSAGES[code];
  if (code === 'access_denied') return AUTH_ERROR_MESSAGES['auth/access_denied'];

  const message = (err as { message?: string } | null)?.message;
  return message || 'Sign-in failed. Please try again.';
}
