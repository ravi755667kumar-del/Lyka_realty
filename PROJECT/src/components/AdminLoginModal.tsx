import React, { useState, useEffect } from 'react';
import { Building2, KeyRound, Mail, AlertCircle, LogIn, UserPlus, X, Loader2 } from 'lucide-react';
import {
  loginWithEmail,
  registerWithEmail,
  loginWithGoogle,
} from '../lib/supabase';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Mode = 'signin' | 'signup';
type Busy = null | 'google' | 'redirect' | 'email';

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({ isOpen, onClose }) => {
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<Busy>(null);

  useEffect(() => {
    if (!isOpen) {
      setError(null);
      setMode('signin');
      setEmail('');
      setPassword('');
      setBusy(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const run = async (kind: Exclude<Busy, null>, action: () => Promise<unknown>) => {
    setError(null);
    setBusy(kind);
    try {
      await action();
      // A redirect navigates the page away, so only close on popup/email success.
      if (kind !== 'redirect') onClose();
    } catch (err: any) {
      setError(err?.message || 'Authentication failed. Please verify your credentials.');
    } finally {
      setBusy(null);
    }
  };

  const handleGoogleLogin = () => run('google', () => loginWithGoogle());
  const handleGoogleRedirect = () => run('redirect', () => loginWithGoogle());

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Please enter both your email and password.');
      return;
    }
    run('email', () =>
      mode === 'signin'
        ? loginWithEmail(email.trim(), password)
        : registerWithEmail(email.trim(), password)
    );
  };

  const anyBusy = busy !== null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden max-h-[92vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={busy === 'redirect'}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors z-10 disabled:opacity-40"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-5 sm:p-8 space-y-5 sm:space-y-6">
          <div className="text-center space-y-4">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-amber-500/20 mx-auto">
              <Building2 className="w-10 h-10" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">
                {mode === 'signin' ? 'Admin Login' : 'Create Admin Account'}
              </h2>
              <p className="text-sm text-slate-400 mt-2">
                Sign in to manage CRM leads and active campaigns.
              </p>
            </div>
          </div>

          {error && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start space-x-3 text-rose-400 text-xs leading-relaxed">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold text-rose-300 mb-1">Authentication Error</strong>
                <span>{error}</span>
              </div>
            </div>
          )}

          {/* Google */}
          <div className="pt-2 space-y-3">
            <button
              onClick={handleGoogleLogin}
              type="button"
              disabled={anyBusy}
              className="w-full flex items-center justify-center space-x-3 px-4 py-4 rounded-xl font-bold bg-white text-slate-900 hover:bg-slate-100 transition-all hover:scale-[1.02] shadow-sm disabled:opacity-60 disabled:hover:scale-100"
            >
              {busy === 'google' ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
              )}
              <span>{busy === 'google' ? 'Opening Google…' : 'Sign in with Google'}</span>
            </button>

            <button
              onClick={handleGoogleRedirect}
              type="button"
              disabled={anyBusy}
              className="w-full text-center text-xs font-medium text-amber-400 hover:text-amber-300 underline disabled:opacity-60"
            >
              {busy === 'redirect' ? 'Redirecting to Google…' : 'Popup blocked? Sign in with redirect instead'}
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center space-x-3">
            <span className="h-px flex-1 bg-slate-800" />
            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
              or use email
            </span>
            <span className="h-px flex-1 bg-slate-800" />
          </div>

          {/* Email / password */}
          <form onSubmit={handleEmailSubmit} className="space-y-3">
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                autoComplete="email"
                className="w-full pl-10 pr-3 py-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400/60 focus:ring-1 focus:ring-amber-400/40"
              />
            </div>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password (min 6 characters)"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                className="w-full pl-10 pr-3 py-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400/60 focus:ring-1 focus:ring-amber-400/40"
              />
            </div>
            <button
              type="submit"
              disabled={anyBusy}
              className="w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-xl font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 transition-colors shadow-md disabled:opacity-60"
            >
              {busy === 'email' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : mode === 'signin' ? (
                <LogIn className="w-4 h-4" />
              ) : (
                <UserPlus className="w-4 h-4" />
              )}
              <span>{mode === 'signin' ? 'Sign in with Email' : 'Create Account'}</span>
            </button>
          </form>

          <p className="text-center text-xs text-slate-500">
            {mode === 'signin' ? (
              <>
                New here?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('signup');
                    setError(null);
                  }}
                  className="text-amber-400 hover:text-amber-300 font-semibold underline"
                >
                  Create an account
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('signin');
                    setError(null);
                  }}
                  className="text-amber-400 hover:text-amber-300 font-semibold underline"
                >
                  Sign in
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
};
