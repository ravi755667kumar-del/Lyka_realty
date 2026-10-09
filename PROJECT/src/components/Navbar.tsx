import React from 'react';
import { User } from 'firebase/auth';
import { Building2, PhoneCall, Settings, BookOpen, Upload, UserPlus, LogIn, LogOut, ShieldCheck } from 'lucide-react';
import { logout } from '../firebase/config';

interface NavbarProps {
  user: User | null;
  onOpenUpload: () => void;
  onOpenAddLead: () => void;
  onOpenSettings: () => void;
  onOpenKnowledge: () => void;
  onOpenSimulator: () => void;
  onOpenLogin: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  onOpenUpload,
  onOpenAddLead,
  onOpenSettings,
  onOpenKnowledge,
  onOpenSimulator,
  onOpenLogin,
}) => {
  const isAdmin = user?.email === '950323243501@gracecoe.org' || Boolean(user?.email);

  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center text-slate-950 font-black shadow-md shadow-amber-500/20">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-extrabold text-white text-lg tracking-tight">LYKA REALTY</span>
              <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-400/10 text-amber-300 border border-amber-400/20">
                AI Cold-Caller MVP
              </span>
            </div>
            <p className="text-xs text-slate-400">Autonomous Outbound Voice Lead Qualification</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          <button
            onClick={onOpenSimulator}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-950/60 text-purple-300 border border-purple-800/40 hover:bg-purple-900/60 transition-colors"
            title="Interactive Conversation Simulator"
          >
            <PhoneCall className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Call Simulator</span>
          </button>

          <button
            onClick={onOpenKnowledge}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700 transition-colors"
            title="Lyka Realty Property Knowledge"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Knowledge (PDF/RAG)</span>
          </button>

          <button
            onClick={onOpenSettings}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700 transition-colors"
            title="Vapi Phone & API Configuration"
          >
            <Settings className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Vapi Config</span>
          </button>

          <button
            onClick={onOpenUpload}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/30 transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload CSV</span>
          </button>

          <button
            onClick={onOpenAddLead}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600/20 text-blue-300 border border-blue-500/30 hover:bg-blue-600/30 transition-colors"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Add Lead</span>
          </button>

          {/* User Auth */}
          <div className="pl-2 border-l border-slate-700/80">
            {user ? (
              <div className="flex items-center space-x-2">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'Admin'}
                    className="w-8 h-8 rounded-full border border-amber-400/50"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-amber-500 text-slate-950 font-bold flex items-center justify-center text-xs">
                    {(user.displayName || user.email || 'A')[0].toUpperCase()}
                  </div>
                )}
                <div className="hidden lg:block text-left">
                  <div className="flex items-center space-x-1">
                    <span className="text-xs font-semibold text-slate-200 truncate max-w-[120px]">
                      {user.displayName || 'Admin'}
                    </span>
                    {isAdmin && (
                      <span title="Administrator">
                        <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 truncate max-w-[120px] block">
                    {user.email}
                  </span>
                </div>
                <button
                  onClick={logout}
                  className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={onOpenLogin}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500 text-slate-950 hover:bg-amber-400 font-semibold shadow-sm transition-colors"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Admin Login</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
