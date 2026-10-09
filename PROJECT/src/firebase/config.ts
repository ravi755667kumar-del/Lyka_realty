import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence,
} from 'firebase/auth';
import type { UserCredential } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId); /* CRITICAL: The app will break without this line */
export const auth = getAuth(app);

// Always let the user choose which Google account to use.
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Session persistence is required for the redirect flow to survive the round trip.
void setPersistence(auth, browserLocalPersistence).catch(() => {
  /* Persistence is best-effort; popup sign-in still works without it. */
});

/**
 * Popup failures that mean the popup can never complete in this browser.
 * For these we transparently retry with a full-page redirect.
 */
const REDIRECT_FALLBACK_CODES = new Set([
  'auth/popup-blocked',
  'auth/operation-not-supported-in-this-environment',
  'auth/web-storage-unsupported',
]);

/**
 * Sign in with Google using a popup (preferred, keeps the page state).
 * Falls back to a full-page redirect when the popup cannot be used at all.
 */
export async function loginWithGoogle(): Promise<UserCredential | void> {
  try {
    return await signInWithPopup(auth, googleProvider);
  } catch (err: any) {
    if (REDIRECT_FALLBACK_CODES.has(err?.code)) {
      // Navigation will begin; the result is picked up by resolveRedirectSignIn().
      await signInWithRedirect(auth, googleProvider);
      return;
    }
    throw err;
  }
}

/**
 * Explicit Google sign-in via full-page redirect. Use this when popups are
 * blocked / close immediately in the current browser.
 */
export async function loginWithGoogleRedirect(): Promise<void> {
  await signInWithRedirect(auth, googleProvider);
}

/**
 * Completes a pending redirect sign-in, if any. Safe to call on every load.
 * Resolves to null when there was no redirect in progress.
 */
export async function resolveRedirectSignIn(): Promise<UserCredential | null> {
  return getRedirectResult(auth);
}

/** Sign in with an existing email/password account. */
export async function loginWithEmail(email: string, pass: string): Promise<UserCredential> {
  return signInWithEmailAndPassword(auth, email, pass);
}

/** Create a new email/password account. */
export async function registerWithEmail(email: string, pass: string): Promise<UserCredential> {
  return createUserWithEmailAndPassword(auth, email, pass);
}

export async function logout() {
  return signOut(auth);
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

testConnection();
