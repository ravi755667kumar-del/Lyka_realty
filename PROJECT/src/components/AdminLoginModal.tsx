import React, { useState, useEffect } from 'react';
import { Building2, KeyRound, Mail, AlertCircle, LogIn, X } from 'lucide-react';
import { loginWithEmail, loginWithGoogle } from '../firebase/config';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({ isOpen, onClose }) => {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleGoogleLogin = async () => {
    try {
      await loginWithGoogle();
      onClose();
    } catch (err: any) {
      if (err.code === 'auth/unauthorized-domain') {
        setError('Error: localhost is not authorized for Google Sign-In. Go to Firebase Console > Authentication > Settings > Authorized domains, and add "localhost".');
      } else {
        setError(err.message || 'Failed to sign in with Google.');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-8 space-y-6">
          <div className="text-center space-y-4">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-amber-500/20 mx-auto">
              <Building2 className="w-10 h-10" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Admin Login</h2>
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

          <div className="pt-2">
            <button
              onClick={handleGoogleLogin}
              type="button"
              className="w-full flex items-center justify-center space-x-3 px-4 py-4 rounded-xl font-bold bg-white text-slate-900 hover:bg-slate-100 transition-all hover:scale-[1.02] shadow-sm"
            >
              <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
              <span>Sign in with Google</span>
            </button>
            <p className="text-center text-xs text-slate-500 mt-4">
              Requires Google Authentication to be enabled in your Firebase Console.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
