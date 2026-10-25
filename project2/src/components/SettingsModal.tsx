import React, { useState } from 'react';
import { TermsAndPolicyModal } from './TermsAndPolicyModal';
import {
  Settings,
  X,
  Palette, 
  ShieldCheck, 
  Cpu, 
  User, 
  Check, 
  Building2, 
  Copy, 
  Sparkles, 
  Zap, 
  CheckCircle2, 
  LogOut, 
  KeyRound, 
  Database,
  Moon,
  Sun,
  Layers,
  ArrowRight
} from 'lucide-react';

export type AppTheme = 'ivory' | 'dark' | 'navy';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Appearance / Background
  currentTheme: AppTheme;
  onSelectTheme: (theme: AppTheme) => void;
  customBgColor?: string;
  onSelectCustomBg?: (color: string) => void;
  onResetCustomBg?: () => void;
  // Admin & Management
  adminAuthenticated: boolean;
  propertyManagerAuthenticated: boolean;
  salesManagerAuthenticated?: boolean;
  adminTargetPortal: 'admin' | 'property_manager' | 'sales_manager';
  onSelectPortal: (portal: 'admin' | 'property_manager' | 'sales_manager') => void;
  onOpenAdminPanel: () => void;
  onOpenCredentialsConfig: () => void;
  onAdminLogout: () => void;
  // AI Engine
  engineProvider: 'groq' | 'gemini';
  onSelectEngineProvider: (provider: 'groq' | 'gemini') => void;
  activeModel: string;
  onSelectModel: (model: string) => void;
  // Account
  userLoggedIn: boolean;
  userName?: string;
  userEmail?: string;
  userAge?: string;
  onOpenAuthModal: () => void;
  onUserLogout: () => void;
}


export interface ColorBoxOption {
  name: string;
  hex: string;
  border?: string;
  isDark: boolean;
  themeMatch: AppTheme;
  description: string;
}

export function isDarkHex(hex: string): boolean {
  if (!hex) return false;
  const clean = hex.replace('#', '').trim();
  let r = 255, g = 255, b = 255;
  if (clean.length === 3) {
    r = parseInt(clean[0] + clean[0], 16);
    g = parseInt(clean[1] + clean[1], 16);
    b = parseInt(clean[2] + clean[2], 16);
  } else if (clean.length === 6) {
    r = parseInt(clean.substring(0, 2), 16);
    g = parseInt(clean.substring(2, 4), 16);
    b = parseInt(clean.substring(4, 6), 16);
  }
  return (0.299 * r + 0.587 * g + 0.114 * b) < 145;
}

export const PRESET_COLOR_BOXES: ColorBoxOption[] = [
  { 
    name: 'Warm Ivory', 
    hex: '#fdfbf5', 
    border: '#d6cbb4', 
    isDark: false, 
    themeMatch: 'ivory',
    description: 'Signature Dubai luxury champagne gold tones on warm ivory'
  },
  { 
    name: 'Obsidian Midnight Dark', 
    hex: '#0b0f17', 
    border: '#334155', 
    isDark: true, 
    themeMatch: 'dark',
    description: 'Sleek dark mode with warm gold accents for low-light comfort'
  },
  { 
    name: 'Royal Sapphire Navy', 
    hex: '#070d1e', 
    border: '#1e3a8a', 
    isDark: true, 
    themeMatch: 'navy',
    description: 'Executive deep celestial blue with bright azure luxury accents'
  },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  currentTheme,
  onSelectTheme,
  customBgColor,
  onSelectCustomBg,
  onResetCustomBg,
  adminAuthenticated,
  propertyManagerAuthenticated,
  salesManagerAuthenticated,
  adminTargetPortal,
  onSelectPortal,
  onOpenAdminPanel,
  onOpenCredentialsConfig,
  onAdminLogout,
  engineProvider,
  onSelectEngineProvider,
  activeModel,
  onSelectModel,
  userLoggedIn,
  userName,
  userEmail,
  userAge,
  onOpenAuthModal,
  onUserLogout
}) => {
  const [activeTab, setActiveTab] = useState<'appearance' | 'admin' | 'engine' | 'account'>('appearance');
  const [showTermsModal, setShowTermsModal] = useState(false);

  const activeBgHex = customBgColor || (currentTheme === 'dark' ? '#0b0f17' : currentTheme === 'navy' ? '#070d1e' : '#fdfbf5');

  const handlePickPreset = (opt: ColorBoxOption) => {
    onSelectCustomBg?.(opt.hex);
    onSelectTheme(opt.themeMatch);
  };


  if (!isOpen) return null;

  const isAnyAdminAuthed = adminAuthenticated || propertyManagerAuthenticated || Boolean(salesManagerAuthenticated);
return (
    <div className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 select-none">
      <div className="bg-[#ffffff] dark:bg-slate-900 border border-[#e2d9c6] dark:border-slate-800 rounded-3xl max-w-2xl w-full shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-[#2d2216] dark:text-slate-100 transition-colors">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#f0e6d2] dark:border-slate-800 flex items-center justify-between bg-[#faf6ec] dark:bg-slate-900/80 shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-700 dark:text-amber-400">
              <Settings className="w-5 h-5 animate-[spin_10s_linear_infinite]" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-[#1c1611] dark:text-white">
                Settings & Preferences
              </h2>
              <p className="text-[11px] text-[#6b5843] dark:text-slate-400">
                Customise appearance background, admin controls, AI engines, and account
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-[#6b5843] hover:text-[#1c1611] hover:bg-[#eee4cf] dark:hover:bg-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors"
            title="Close Settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-5 pt-3 pb-0 bg-[#faf6ec] dark:bg-slate-900/60 border-b border-[#f0e6d2] dark:border-slate-800 flex space-x-1.5 overflow-x-auto shrink-0">
          <button
            onClick={() => setActiveTab('appearance')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-t-xl text-xs font-bold transition-all border-b-2 ${
              activeTab === 'appearance'
                ? 'border-amber-600 text-amber-700 dark:text-amber-400 bg-white dark:bg-slate-900 shadow-xs'
                : 'border-transparent text-[#6b5843] dark:text-slate-400 hover:text-[#1c1611] hover:bg-white/60 dark:hover:bg-slate-800/60'
            }`}
          >
            <Palette className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span>Appearance & Background</span>
          </button>

          <button
            onClick={() => setActiveTab('admin')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-t-xl text-xs font-bold transition-all border-b-2 ${
              activeTab === 'admin'
                ? 'border-violet-600 text-violet-700 dark:text-violet-400 bg-white dark:bg-slate-900 shadow-xs'
                : 'border-transparent text-[#6b5843] dark:text-slate-400 hover:text-[#1c1611] hover:bg-white/60 dark:hover:bg-slate-800/60'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-violet-600 dark:text-violet-400" />
            <span>Admin Controls</span>
            {isAnyAdminAuthed && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Admin Active" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('engine')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-t-xl text-xs font-bold transition-all border-b-2 ${
              activeTab === 'engine'
                ? 'border-cyan-600 text-cyan-700 dark:text-cyan-400 bg-white dark:bg-slate-900 shadow-xs'
                : 'border-transparent text-[#6b5843] dark:text-slate-400 hover:text-[#1c1611] hover:bg-white/60 dark:hover:bg-slate-800/60'
            }`}
          >
            <Cpu className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            <span>AI Engine</span>
          </button>

          <button
            onClick={() => setActiveTab('account')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-t-xl text-xs font-bold transition-all border-b-2 ${
              activeTab === 'account'
                ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400 bg-white dark:bg-slate-900 shadow-xs'
                : 'border-transparent text-[#6b5843] dark:text-slate-400 hover:text-[#1c1611] hover:bg-white/60 dark:hover:bg-slate-800/60'
            }`}
          >
            <User className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Account</span>
            {userLoggedIn && (
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            )}
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1 bg-white dark:bg-slate-900">

          {/* ══════════════════════════════════════════════════════════════════════
              TAB 1: APPEARANCE & BACKGROUND (EXACTLY 3 COLOR BOXES)
          ══════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'appearance' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#6b5843] dark:text-slate-400 mb-1 flex items-center space-x-1.5">
                  <Palette className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>Website Background Color</span>
                </h3>
                <p className="text-xs text-[#5a4835] dark:text-slate-400 leading-relaxed">
                  Select your preferred background color from the three options below. Changes apply instantly across the whole application.
                </p>
              </div>

              {/* ─── EXACTLY 3 COLOR BOXES ─── */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1">
                {PRESET_COLOR_BOXES.map((box) => {
                  const isSelected = activeBgHex.toLowerCase() === box.hex.toLowerCase() || 
                    (!customBgColor && currentTheme === box.themeMatch);
                  return (
                    <button
                      key={box.name}
                      type="button"
                      onClick={() => handlePickPreset(box)}
                      className={`relative rounded-2xl p-4 cursor-pointer transition-all border-2 flex flex-col justify-between text-left group ${
                        isSelected 
                          ? 'border-amber-500 ring-2 ring-amber-500/30 shadow-md bg-amber-500/5 dark:bg-amber-500/10' 
                          : 'border-[#e4d8c1] dark:border-slate-800 hover:border-amber-400/70 hover:shadow-sm bg-[#faf6ec]/50 dark:bg-slate-800/40'
                      }`}
                    >
                      <div>
                        {/* Small Color Box Preview */}
                        <div className="flex items-center justify-between mb-3">
                          <div
                            className={`w-12 h-12 rounded-xl border shadow-inner flex items-center justify-center transition-transform group-hover:scale-105 ${
                              isSelected ? 'ring-2 ring-amber-500 ring-offset-2 ring-offset-white dark:ring-offset-slate-900' : ''
                            }`}
                            style={{
                              backgroundColor: box.hex,
                              borderColor: box.border || 'rgba(0,0,0,0.2)',
                            }}
                          >
                            {isSelected && (
                              <div className={`w-5 h-5 rounded-full flex items-center justify-center shadow-xs ${
                                box.isDark ? 'bg-white text-black' : 'bg-black text-white'
                              }`}>
                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                              </div>
                            )}
                          </div>

                          <span className="text-[10px] font-mono font-bold uppercase px-2 py-1 rounded-lg bg-white/70 dark:bg-slate-900/70 border border-[#e4d8c1] dark:border-slate-700 text-[#6b5843] dark:text-slate-300">
                            {box.hex}
                          </span>
                        </div>

                        {/* Title and description */}
                        <h4 className="text-xs font-bold text-[#1c1611] dark:text-white mb-1 flex items-center space-x-1.5">
                          {box.themeMatch === 'ivory' && <Sun className="w-3.5 h-3.5 text-amber-600" />}
                          {box.themeMatch === 'dark' && <Moon className="w-3.5 h-3.5 text-amber-400" />}
                          {box.themeMatch === 'navy' && <Sparkles className="w-3.5 h-3.5 text-cyan-400" />}
                          <span>{box.name}</span>
                        </h4>
                        <p className="text-[11px] text-[#6b5843] dark:text-slate-400 leading-snug">
                          {box.description}
                        </p>
                      </div>

                      {/* Footer: status badge */}
                      <div className="mt-4 pt-2.5 border-t border-[#ebdcc4] dark:border-slate-800 flex items-center justify-between">
                        <span className="text-[10px] font-semibold text-[#8a6b2f] dark:text-amber-400">
                          {box.themeMatch === 'ivory' ? 'Default Elegance' : box.themeMatch === 'dark' ? 'Sleek & Focused' : 'Modern Executive'}
                        </span>
                        {isSelected ? (
                          <div className="flex items-center space-x-1 text-[11px] font-bold text-amber-700 dark:text-amber-400">
                            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>Active</span>
                          </div>
                        ) : (
                          <span className="text-[11px] font-semibold text-[#726048] dark:text-slate-500 group-hover:text-amber-700 dark:group-hover:text-amber-400 transition-colors">
                            Click to Select
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Theme description card */}
              <div className="p-3 bg-[#faf6ec] dark:bg-slate-800/60 rounded-xl border border-[#ebdcc4] dark:border-slate-800 flex items-start space-x-2 text-xs text-[#5a4835] dark:text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-[#1c1611] dark:text-white">
                    Adaptive Contrast & Instant Application
                  </p>
                  <p className="text-[11px] text-[#6b5843] dark:text-slate-400 mt-0.5">
                    Clicking any of the three color boxes updates the chat, navigation bar, property listings, and admin views instantly with WCAG AA verified contrast.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════════
              TAB 2: ADMIN CONTROLS & MANAGEMENT
          ══════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'admin' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-violet-700 dark:text-violet-400 mb-1">
                  Administrative Access & Changes
                </h3>
                <p className="text-xs text-[#5a4835] dark:text-slate-400 leading-relaxed">
                  Manage the 3 specialized administrative portals, check real-time authentication status, and configure database credentials for Lyka Realty.
                </p>
              </div>

              {/* Portal Selector Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {/* 1. Super Admin */}
                <div
                  onClick={() => onSelectPortal('admin')}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                    adminTargetPortal === 'admin'
                      ? 'border-violet-500 bg-violet-500/10 dark:bg-violet-500/20 ring-1 ring-violet-500/30'
                      : 'border-[#ebdcc4] dark:border-slate-800 bg-[#faf6ec]/50 dark:bg-slate-800/40 hover:border-violet-400'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <ShieldCheck className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                    {adminAuthenticated ? (
                      <span className="text-[9px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 px-1.5 py-0.5 rounded">
                        Active
                      </span>
                    ) : (
                      <span className="text-[9px] text-slate-500">Locked</span>
                    )}
                  </div>
                  <h4 className="text-xs font-bold text-[#1c1611] dark:text-white">Super Admin</h4>
                  <p className="text-[10px] text-[#6b5843] dark:text-slate-400 mt-0.5">
                    Full CRM leads, analytics, and vector embeddings
                  </p>
                </div>

                {/* 2. Property Admin */}
                <div
                  onClick={() => onSelectPortal('property_manager')}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                    adminTargetPortal === 'property_manager'
                      ? 'border-amber-500 bg-amber-500/10 dark:bg-amber-500/20 ring-1 ring-amber-500/30'
                      : 'border-[#ebdcc4] dark:border-slate-800 bg-[#faf6ec]/50 dark:bg-slate-800/40 hover:border-amber-400'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <Building2 className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    {propertyManagerAuthenticated || adminAuthenticated ? (
                      <span className="text-[9px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 px-1.5 py-0.5 rounded">
                        Active
                      </span>
                    ) : (
                      <span className="text-[9px] text-slate-500">Locked</span>
                    )}
                  </div>
                  <h4 className="text-xs font-bold text-[#1c1611] dark:text-white">Property Admin</h4>
                  <p className="text-[10px] text-[#6b5843] dark:text-slate-400 mt-0.5">
                    Inventory, bookings, and viewing slots
                  </p>
                </div>

                {/* 3. Sales Manager */}
                <div
                  onClick={() => onSelectPortal('sales_manager')}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                    adminTargetPortal === 'sales_manager'
                      ? 'border-emerald-500 bg-emerald-500/10 dark:bg-emerald-500/20 ring-1 ring-emerald-500/30'
                      : 'border-[#ebdcc4] dark:border-slate-800 bg-[#faf6ec]/50 dark:bg-slate-800/40 hover:border-emerald-400'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <Copy className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    {salesManagerAuthenticated || adminAuthenticated ? (
                      <span className="text-[9px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 px-1.5 py-0.5 rounded">
                        Active
                      </span>
                    ) : (
                      <span className="text-[9px] text-slate-500">Locked</span>
                    )}
                  </div>
                  <h4 className="text-xs font-bold text-[#1c1611] dark:text-white">Sales Manager</h4>
                  <p className="text-[10px] text-[#6b5843] dark:text-slate-400 mt-0.5">
                    Duplicate auditing and requirements tracking
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenAdminPanel();
                  }}
                  className="w-full bg-violet-600 hover:bg-violet-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-colors flex items-center justify-center space-x-2 shadow-xs cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>
                    Open {adminTargetPortal === 'property_manager' ? 'Property Admin' : adminTargetPortal === 'sales_manager' ? 'Sales Manager' : 'Admin'} Portal
                  </span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                <div className={`grid gap-2 ${adminAuthenticated && isAnyAdminAuthed ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
                  {adminAuthenticated && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenCredentialsConfig();
                      }}
                      className="w-full bg-[#f4ede0] hover:bg-[#ebdcc4] dark:bg-slate-800 dark:hover:bg-slate-700 text-[#2d2216] dark:text-slate-200 font-semibold py-2 px-3 rounded-xl text-xs transition-colors border border-[#d6c7ab] dark:border-slate-700 flex items-center justify-center space-x-1.5 cursor-pointer"
                    >
                      <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                      <span>Change Database Credentials</span>
                    </button>
                  )}

                  {isAnyAdminAuthed ? (
                    <button
                      type="button"
                      onClick={onAdminLogout}
                      className="w-full bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 font-semibold py-2 px-3 rounded-xl text-xs transition-colors border border-rose-200 dark:border-rose-900 flex items-center justify-center space-x-1.5 cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Log Out of Admin Portal</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenAdminPanel();
                      }}
                      className="w-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold py-2 px-3 rounded-xl text-xs transition-colors border border-slate-300 dark:border-slate-700 flex items-center justify-center space-x-1.5 cursor-pointer"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Authenticate as Admin</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════════
              TAB 3: AI ENGINE & MODEL SETTINGS
          ══════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'engine' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-cyan-700 dark:text-cyan-400 mb-1">
                  AI Model & Intelligence Provider
                </h3>
                <p className="text-xs text-[#5a4835] dark:text-slate-400 leading-relaxed">
                  Choose between high-speed edge reasoning (Groq) or multimodal intelligence (Google Gemini 2.5 Flash).
                </p>
              </div>

              {/* Provider Selector */}
              <div>
                <label className="text-xs font-bold text-[#2d2216] dark:text-white block mb-1.5">
                  Select Engine Provider:
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => onSelectEngineProvider('groq')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      engineProvider === 'groq'
                        ? 'bg-amber-500/15 border-amber-500 text-amber-900 dark:text-amber-300 font-bold'
                        : 'bg-[#faf6ec]/50 dark:bg-slate-800 border-[#e4d8c1] dark:border-slate-700 text-[#6b5843] dark:text-slate-400'
                    }`}
                  >
                    <div className="flex items-center space-x-1.5">
                      <Zap className="w-4 h-4 text-amber-600" />
                      <span>Groq High-Speed</span>
                    </div>
                    <p className="text-[10px] text-[#6b5843] dark:text-slate-400 mt-1">
                      Ultra-low latency streaming with Llama 3.3 70B & Mixtral
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => onSelectEngineProvider('gemini')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      engineProvider === 'gemini'
                        ? 'bg-amber-500/15 border-amber-500 text-amber-900 dark:text-amber-300 font-bold'
                        : 'bg-[#faf6ec]/50 dark:bg-slate-800 border-[#e4d8c1] dark:border-slate-700 text-[#6b5843] dark:text-slate-400'
                    }`}
                  >
                    <div className="flex items-center space-x-1.5">
                      <Sparkles className="w-4 h-4 text-amber-600" />
                      <span>Gemini 2.5 Flash</span>
                    </div>
                    <p className="text-[10px] text-[#6b5843] dark:text-slate-400 mt-1">
                      Multimodal property vision & Google knowledge grounding
                    </p>
                  </button>
                </div>
              </div>

              {/* Model Dropdown for Groq */}
              {engineProvider === 'groq' && (
                <div>
                  <label className="text-xs font-bold text-[#2d2216] dark:text-white block mb-1">
                    Groq Model Architecture:
                  </label>
                  <select
                    value={activeModel}
                    onChange={(e) => onSelectModel(e.target.value)}
                    className="w-full bg-[#faf6ec] dark:bg-slate-800 border border-[#d6c7ab] dark:border-slate-700 rounded-xl p-2.5 text-xs text-[#2d2216] dark:text-slate-100 font-semibold outline-none focus:border-amber-500"
                  >
                    <option value="llama-3.3-70b-versatile">llama-3.3-70b-versatile (Recommended Dubai Real Estate)</option>
                    <option value="llama-3.1-8b-instant">llama-3.1-8b-instant (Fastest Response Speed)</option>
                    <option value="mixtral-8x7b-32768">mixtral-8x7b-32768 (Large Context Window)</option>
                    <option value="gemma2-9b-it">gemma2-9b-it (Google Compact Model)</option>
                  </select>
                </div>
              )}

              {/* Agent Greeting Information */}
              <div className="p-3 bg-[#faf6ec] dark:bg-slate-800/60 rounded-xl border border-[#ebdcc4] dark:border-slate-800 space-y-1 text-xs">
                <div className="flex items-center space-x-1.5 font-bold text-[#1c1611] dark:text-white">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Agentic Greeting & Knowledge Grounding:</span>
                </div>
                <p className="text-[11px] text-[#6b5843] dark:text-slate-400 leading-relaxed">
                  The AI concierge answers on behalf of Lyka Realty (Dubai), cross-referencing live Firebase Firestore property inventory and vector-embedded market guides.
                </p>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════════
              TAB 4: ACCOUNT & PROFILE
          ══════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'account' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-1">
                  User Account & Profile
                </h3>
                <p className="text-xs text-[#5a4835] dark:text-slate-400 leading-relaxed">
                  View your current session information, saved chat history status, and authentication credentials.
                </p>
              </div>

              {userLoggedIn ? (
                <div className="p-4 bg-[#faf6ec] dark:bg-slate-800/60 rounded-2xl border border-[#ebdcc4] dark:border-slate-800 space-y-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-300 flex items-center justify-center text-amber-950 font-bold text-base shadow-sm">
                      {userName?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-[#1c1611] dark:text-white truncate">
                        {userName || 'Lyka Client'}
                      </p>
                      <p className="text-xs text-[#6b5843] dark:text-slate-400 truncate">
                        {userEmail}
                      </p>
                    </div>
                    <span className="text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded-full">
                      Signed In
                    </span>
                  </div>

                  {userAge && (
                    <div className="pt-2 border-t border-[#ebdcc4] dark:border-slate-700 text-xs flex justify-between text-[#5a4835] dark:text-slate-400">
                      <span>Verified Age</span>
                      <span className="font-bold text-[#1c1611] dark:text-slate-200">{userAge} years</span>
                    </div>
                  )}

                  <div className="pt-2 flex justify-end space-x-2">
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenAuthModal();
                      }}
                      className="text-xs bg-white dark:bg-slate-700 hover:bg-slate-100 text-[#1c1611] dark:text-white font-semibold px-3 py-1.5 rounded-xl border border-[#d6c7ab] dark:border-slate-600 transition-colors"
                    >
                      Manage Profile
                    </button>
                    <button
                      type="button"
                      onClick={onUserLogout}
                      className="text-xs bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 font-semibold px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900 transition-colors flex items-center space-x-1"
                    >
                      <LogOut className="w-3 h-3" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-[#faf6ec] dark:bg-slate-800/60 rounded-2xl border border-[#ebdcc4] dark:border-slate-800 text-center space-y-3">
                  <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto text-amber-700 dark:text-amber-400">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#1c1611] dark:text-white">
                      Guest Session
                    </h4>
                    <p className="text-[11px] text-[#6b5843] dark:text-slate-400 mt-0.5">
                      You are currently using Lyka Realty as a guest. Sign in or create an account to save your chat sessions and property bookmarks permanently.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenAuthModal();
                    }}
                    className="bg-amber-500 hover:bg-amber-400 text-amber-950 font-bold px-4 py-2 rounded-xl text-xs transition-colors shadow-xs cursor-pointer"
                  >
                    Sign In or Create Account
                  </button>
                  <p className="text-[11px] text-[#6b5843] dark:text-slate-400 text-center mt-2">
                    Protected by Lyka Realty's{' '}
                    <button
                      type="button"
                      onClick={() => setShowTermsModal(true)}
                      className="font-bold text-amber-700 dark:text-amber-400 hover:underline cursor-pointer"
                    >
                      Terms of Service & Privacy Policy
                    </button>
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-[#faf6ec] dark:bg-slate-900/80 border-t border-[#f0e6d2] dark:border-slate-800 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-[#726048] dark:text-slate-500">
            Lyka Realty Agentic AI v2.4
          </span>
          <button
            onClick={onClose}
            className="bg-amber-500 hover:bg-amber-400 text-amber-950 font-bold px-5 py-1.5 rounded-xl text-xs transition-colors shadow-xs"
          >
            Done
          </button>
        </div>

      </div>

      {/* Legal & Privacy Center Modal */}
      <TermsAndPolicyModal
        isOpen={showTermsModal}
        onClose={() => setShowTermsModal(false)}
        initialTab="terms"
      />
    </div>
  );
};
