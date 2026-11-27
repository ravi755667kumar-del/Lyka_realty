'use client';

import React, { useState } from 'react';
import {
  Building2,
  PhoneCall,
  Settings,
  BookOpen,
  Upload,
  UserPlus,
  Plus,
  Menu,
  X,
  Sparkles,
  History,
} from 'lucide-react';

interface NavbarProps {
  user?: any;
  activeSection?: 'pipeline' | 'history';
  onSelectSection?: (section: 'pipeline' | 'history') => void;
  onOpenUpload: () => void;
  onOpenAddLead: () => void;
  onOpenAddProperty: () => void;
  onOpenSettings: () => void;
  onOpenKnowledge: () => void;
  onOpenSimulator: () => void;
  onOpenLogin?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  activeSection = 'pipeline',
  onSelectSection,
  onOpenUpload,
  onOpenAddLead,
  onOpenAddProperty,
  onOpenSettings,
  onOpenKnowledge,
  onOpenSimulator,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleMobileAction = (action: () => void) => {
    action();
    setMobileMenuOpen(false);
  };

  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40 backdrop-blur-md bg-slate-900/95 pt-safe">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <button
          type="button"
          onClick={() => onSelectSection?.('pipeline')}
          className="flex items-center space-x-2.5 sm:space-x-3 text-left"
        >
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center text-slate-950 font-black shadow-md shadow-amber-500/20 shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5 sm:space-x-2">
              <span className="font-extrabold text-white text-base sm:text-lg tracking-tight">LYKA REALTY</span>
              <span className="px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs font-semibold rounded-full bg-amber-400/10 text-amber-300 border border-amber-400/20">
                AI Telecaller
              </span>
            </div>
            <p className="text-[10px] sm:text-xs text-slate-400 hidden sm:block">
              Autonomous Outbound Voice Lead Qualification
            </p>
          </div>
        </button>

        {/* Desktop Quick Actions (Shown on >= md) */}
        <div className="hidden md:flex items-center space-x-2 lg:space-x-2.5">
          {onSelectSection && (
            <button
              type="button"
              onClick={() => onSelectSection(activeSection === 'history' ? 'pipeline' : 'history')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                activeSection === 'history'
                  ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                  : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
              }`}
              title="Open User History & Languages Section"
            >
              <History className={`w-3.5 h-3.5 ${activeSection === 'history' ? 'text-slate-950' : 'text-purple-400'}`} />
              <span>User History</span>
            </button>
          )}
          <button
            type="button"
            onClick={onOpenSimulator}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-950/60 text-purple-300 border border-purple-800/40 hover:bg-purple-900/60 transition-colors"
            title="Interactive Conversation Simulator"
          >
            <PhoneCall className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Simulator</span>
          </button>

          <button
            type="button"
            onClick={onOpenKnowledge}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700 transition-colors"
            title="Lyka Realty Property Knowledge"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Knowledge</span>
          </button>

          <button
            type="button"
            onClick={onOpenSettings}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700 transition-colors"
            title="AI Voice Engine & Telecalling Settings"
          >
            <Settings className="w-3.5 h-3.5 text-amber-400" />
            <span>AI Settings</span>
          </button>

          <button
            type="button"
            onClick={onOpenAddProperty}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition-all shadow-sm"
            title="Add Property"
          >
            <Plus className="w-3.5 h-3.5 text-amber-400" />
            <span>Property</span>
          </button>

          <button
            type="button"
            onClick={onOpenUpload}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/30 transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload CSV</span>
          </button>

          <button
            type="button"
            onClick={onOpenAddLead}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600/20 text-blue-300 border border-blue-500/30 hover:bg-blue-600/30 transition-colors"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Add Lead</span>
          </button>
        </div>

        {/* Mobile Header Quick Actions (Shown on < md) */}
        <div className="flex md:hidden items-center space-x-1.5">
          <button
            type="button"
            onClick={onOpenAddProperty}
            className="p-2 rounded-lg text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30"
            title="Add Property"
          >
            <Plus className="w-4 h-4 text-amber-400" />
          </button>

          <button
            type="button"
            onClick={onOpenSettings}
            className="p-2 rounded-lg bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700"
            title="AI Voice & Telephony Settings"
          >
            <Settings className="w-4 h-4 text-amber-400" />
          </button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="p-2 rounded-lg bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700 transition-colors"
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X className="w-4 h-4 text-amber-400" /> : <Menu className="w-4 h-4 text-slate-200" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer / Dropdown Menu (Smooth expansion on mobile) */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-800 bg-slate-900/98 px-4 pt-3 pb-5 space-y-2.5 animate-in slide-in-from-top duration-200 shadow-2xl">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              type="button"
              onClick={() => handleMobileAction(onOpenAddProperty)}
              className="flex items-center space-x-2 p-2.5 rounded-xl bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold"
            >
              <Plus className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Add Property</span>
            </button>

            <button
              type="button"
              onClick={() => handleMobileAction(onOpenAddLead)}
              className="flex items-center space-x-2 p-2.5 rounded-xl bg-blue-500/15 text-blue-300 border border-blue-500/30 font-medium"
            >
              <UserPlus className="w-4 h-4 text-blue-400 shrink-0" />
              <span>Add Lead</span>
            </button>

            <button
              type="button"
              onClick={() => handleMobileAction(onOpenUpload)}
              className="flex items-center space-x-2 p-2.5 rounded-xl bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-medium"
            >
              <Upload className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Upload CSV</span>
            </button>

            <button
              type="button"
              onClick={() => handleMobileAction(onOpenKnowledge)}
              className="flex items-center space-x-2 p-2.5 rounded-xl bg-slate-800 text-slate-200 border border-slate-700 font-medium"
            >
              <BookOpen className="w-4 h-4 text-purple-400 shrink-0" />
              <span>Knowledge Base</span>
            </button>

            <button
              type="button"
              onClick={() => handleMobileAction(onOpenSimulator)}
              className="flex items-center space-x-2 p-2.5 rounded-xl bg-purple-950/60 text-purple-300 border border-purple-800/40 font-medium"
            >
              <PhoneCall className="w-4 h-4 text-purple-400 shrink-0" />
              <span>Call Simulator</span>
            </button>

            <button
              type="button"
              onClick={() => handleMobileAction(onOpenSettings)}
              className="flex items-center space-x-2 p-2.5 rounded-xl bg-slate-800 text-slate-200 border border-slate-700 font-medium"
            >
              <Settings className="w-4 h-4 text-amber-400 shrink-0" />
              <span>AI Settings</span>
            </button>

            {onSelectSection && (
              <button
                type="button"
                onClick={() =>
                  handleMobileAction(() =>
                    onSelectSection(activeSection === 'history' ? 'pipeline' : 'history')
                  )
                }
                className={`col-span-2 flex items-center justify-center space-x-2 p-2.5 rounded-xl border font-semibold ${
                  activeSection === 'history'
                    ? 'bg-amber-500 text-slate-950 border-amber-400'
                    : 'bg-slate-800 text-purple-300 border-purple-500/30'
                }`}
              >
                <History className={`w-4 h-4 shrink-0 ${activeSection === 'history' ? 'text-slate-950' : 'text-purple-400'}`} />
                <span>{activeSection === 'history' ? 'Back to Lead Pipeline' : 'User History & Languages'}</span>
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
