import React, { useState } from 'react';
import { 
  Building2, 
  MessageSquare, 
  Kanban, 
  Database, 
  BookOpen, 
  Sparkles,
  Layers,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Users,
  TrendingUp
} from 'lucide-react';

interface NavbarProps {
  activeTab: 'chat' | 'crm' | 'properties' | 'embeddings' | 'knowledge' | 'stats' | 'customers' | 'login_stats';
  setActiveTab: (tab: 'chat' | 'crm' | 'properties' | 'embeddings' | 'knowledge' | 'stats' | 'customers' | 'login_stats') => void;
  leadCount: number;
  customerCount?: number;
  propertyCount?: number;
  firestoreActive: boolean;
  vectorStatus?: { connected: boolean; count: number };
  onStartNewChat: () => void;
  adminPanelOpen: boolean;
  onToggleAdminPanel: () => void;
  onSelectPortal?: (portal: 'admin' | 'property_manager') => void;
  adminAuthenticated: boolean;
  propertyManagerAuthenticated: boolean;
  adminTargetPortal: 'admin' | 'property_manager';
  onAdminLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  leadCount,
  customerCount,
  propertyCount,
  firestoreActive,
  vectorStatus,
  onStartNewChat,
  adminPanelOpen,
  onToggleAdminPanel,
  onSelectPortal,
  adminAuthenticated,
  propertyManagerAuthenticated,
  adminTargetPortal,
  onAdminLogout,
}) => {
  const [adminDropdownOpen, setAdminDropdownOpen] = useState(false);
  const isAdminTab = ['crm', 'properties', 'embeddings', 'knowledge', 'stats', 'customers', 'login_stats'].includes(activeTab);

  // Determine which portal is currently authenticated
  const currentPortal = adminTargetPortal;
  const isPortalAuthed = currentPortal === 'admin' ? adminAuthenticated : propertyManagerAuthenticated;

  return (
    <header className="bg-espresso-900 border-b border-espresso-700 text-espresso-300 sticky top-0 z-50">
      <div className="px-4 sm:px-6">
        <div className="relative flex items-center h-16">
          {/* Logo & Brand — Left */}
          <div
            className="flex items-center cursor-pointer flex-shrink-0 absolute left-0"
            onClick={() => { setActiveTab('chat'); }}
          >
            <img src="/logo.png" alt="Lyka Realty" className="h-12 w-auto object-contain rounded-lg" />
          </div>

          {/* Center: AI Chat tab (frontend) — ABSOLUTELY CENTERED */}
          <nav className="absolute left-1/2 -translate-x-1/2 flex items-center space-x-2 z-10">
            <button
              onClick={() => { setActiveTab('chat'); }}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all border ${
                activeTab === 'chat'
                  ? 'bg-amber-500 text-amber-950 shadow-md font-bold border-amber-400'
                  : 'text-espresso-400 hover:text-espresso-300 hover:bg-espresso-800 border-espresso-700/60'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>Agentic AI Chat</span>
              {activeTab === 'chat' && (
                <span className="text-[9px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-espresso-800/70 text-amber-950">
                  LIVE
                </span>
              )}
            </button>
          </nav>

          {/* Right: Status badges + Admin & Property Manager Dropdown + New Customer */}
          <div className="flex items-center space-x-2 ml-auto">
            {/* Firebase badge */}
            <div
              className="hidden lg:flex items-center space-x-1.5 text-[11px] bg-espresso-800/80 px-2.5 py-1 rounded-md border border-espresso-700 text-espresso-300"
              title="Firebase Firestore Active"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="font-medium text-emerald-200">Firebase Live</span>
            </div>

            {/* Admin & Property Manager Portal Dropdown Trigger */}
            <div className="relative">
              <button
                onClick={() => setAdminDropdownOpen(prev => !prev)}
                className={`flex items-center space-x-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${
                  adminPanelOpen || isAdminTab
                    ? 'bg-violet-600 hover:bg-violet-500 text-white border-violet-500 shadow-md shadow-violet-500/20'
                    : adminAuthenticated
                    ? 'bg-espresso-800 hover:bg-espresso-700 text-violet-300 border-violet-500/50'
                    : 'bg-espresso-800 hover:bg-espresso-700 text-espresso-300 border-espresso-700 hover:border-amber-500/60'
                }`}
              >
                {adminAuthenticated ? (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                ) : (
                  <ShieldCheck className="w-3.5 h-3.5" />
                )}
                <span className="hidden sm:inline">Admin</span>
                {adminDropdownOpen || adminPanelOpen || isAdminTab
                  ? <ChevronUp className="w-3 h-3" />
                  : <ChevronDown className="w-3 h-3" />}
                {leadCount > 0 && adminAuthenticated && (
                  <span className="text-[10px] px-1.5 rounded-full font-bold bg-amber-500/25 text-amber-950">
                    {leadCount}
                  </span>
                )}
              </button>

              {/* Management Portals Dropdown */}
              {adminDropdownOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40 bg-transparent" 
                    onClick={() => setAdminDropdownOpen(false)} 
                  />
                  <div className="absolute right-0 top-full mt-2 w-72 sm:w-80 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl z-50 p-2.5 space-y-2 text-neutral-800 backdrop-blur-xl">
                    <div className="flex items-center justify-between px-2 pt-1 pb-1 border-b border-slate-800">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Management Portal
                      </span>
                      {isPortalAuthed && (
                        <span className="text-[10px] text-emerald-400 flex items-center space-x-1 font-medium bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                          <span>Signed In</span>
                        </span>
                      )}
                    </div>

                    {!isPortalAuthed ? (
                      // Not authenticated — show both portals as login options
                      <>
                        {/* Option 1: Admin */}
                        <button
                          onClick={() => {
                            setAdminDropdownOpen(false);
                            if (onSelectPortal) {
                              onSelectPortal('admin');
                            } else {
                              onToggleAdminPanel();
                            }
                          }}
                          className={`w-full text-left p-3 rounded-xl border transition-all flex items-start space-x-3 group ${
                            isAdminTab && ['crm', 'embeddings', 'knowledge'].includes(activeTab)
                              ? 'bg-violet-600/20 border-violet-500/60 shadow-sm'
                              : 'bg-slate-800/40 border-slate-800 hover:bg-slate-800 hover:border-violet-500/40'
                          }`}
                        >
                          <div className="w-9 h-9 rounded-xl bg-violet-600/20 border border-violet-500/40 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                            <ShieldCheck className="w-5 h-5 text-violet-700" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-neutral-800 group-hover:text-black transition-colors">
                                Admin
                              </span>
                              {leadCount > 0 && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-violet-500/20 text-neutral-800 border border-violet-500/40">
                                  {leadCount} leads
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 leading-tight mt-0.5">
                              CRM Pipeline, AI Embeddings & Knowledge Base
                            </p>
                          </div>
                        </button>

                        {/* Option 2: Property Manager */}
                        <button
                          onClick={() => {
                            setAdminDropdownOpen(false);
                            if (onSelectPortal) {
                              onSelectPortal('property_manager');
                            } else {
                              setActiveTab('properties');
                            }
                          }}
                          className={`w-full text-left p-3 rounded-xl border transition-all flex items-start space-x-3 group ${
                            isAdminTab && ['properties', 'stats'].includes(activeTab)
                              ? 'bg-slate-900/40 border-slate-700/60 shadow-sm'
                              : 'bg-slate-800/40 border-slate-800 hover:bg-slate-800 hover:border-slate-600/40'
                          }`}
                        >
                          <div className="w-9 h-9 rounded-xl bg-slate-900/40 border border-slate-700/40 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                            <Building2 className="w-5 h-5 text-neutral-700" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-neutral-800 group-hover:text-black transition-colors">
                                Property Manager
                              </span>
                              {propertyCount !== undefined && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-900/40 text-neutral-800 border border-slate-700/30">
                                  {propertyCount} units
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 leading-tight mt-0.5">
                              Manage inventory, add listings & pricing statistics
                            </p>
                          </div>
                        </button>
                      </>
                    ) : (
                      // Authenticated — show ONLY the current portal's info (no switching)
                      <>
                        {currentPortal === 'admin' && (
                          <div className="w-full text-left p-3 rounded-xl border bg-violet-600/20 border-violet-500/60 flex items-start space-x-3">
                            <div className="w-9 h-9 rounded-xl bg-violet-600/20 border border-violet-500/40 flex items-center justify-center flex-shrink-0">
                              <ShieldCheck className="w-5 h-5 text-violet-700" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-neutral-800">Admin Portal</span>
                                {leadCount > 0 && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-violet-500/20 text-neutral-800 border border-violet-500/40">
                                    {leadCount} leads
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-400 leading-tight mt-0.5">
                                CRM Pipeline, AI Embeddings & Knowledge Base
                              </p>
                            </div>
                          </div>
                        )}
                        {currentPortal === 'property_manager' && (
                          <div className="w-full text-left p-3 rounded-xl border bg-slate-900/40 border-slate-700/60 flex items-start space-x-3">
                            <div className="w-9 h-9 rounded-xl bg-slate-900/40 border border-slate-700/40 flex items-center justify-center flex-shrink-0">
                              <Building2 className="w-5 h-5 text-neutral-700" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-neutral-800">Property Manager Portal</span>
                                {propertyCount !== undefined && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-900/40 text-neutral-800 border border-slate-700/30">
                                    {propertyCount} units
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-400 leading-tight mt-0.5">
                                Manage inventory, add listings & pricing statistics
                              </p>
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {/* Quick Close option if panel is open */}
                    {(adminPanelOpen || isAdminTab) && (
                      <div className="pt-1 border-t border-slate-800/80 flex justify-end">
                        <button
                          onClick={() => {
                            setAdminDropdownOpen(false);
                            onToggleAdminPanel();
                          }}
                          className="text-[11px] text-slate-400 hover:text-rose-400 transition-colors px-2 py-1"
                        >
                          Close Management Panel
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Logout button — only when authenticated */}
            {isPortalAuthed && (
              <button
                onClick={onAdminLogout}
                title="Logout from Portal"
                className="flex items-center space-x-1 text-[11px] font-medium px-2.5 py-1.5 rounded-lg border border-espresso-700 bg-espresso-800/70 hover:bg-red-900/40 hover:border-red-500/60 hover:text-red-300 text-espresso-400 transition-all"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span className="hidden lg:inline">Logout</span>
              </button>
            )}

            <button
              onClick={onStartNewChat}
              className="flex items-center space-x-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-amber-950 px-3 py-1.5 rounded-lg transition-colors shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">New Customer</span>
            </button>
          </div>
        </div>
      </div>

      {/* Admin & Property Manager Sub-nav — visible when Admin Panel is open */}
      {(adminPanelOpen || isAdminTab) && isPortalAuthed && (
        <div className="border-t border-violet-500/30 bg-espresso-900/95 backdrop-blur-sm">
          <div className="px-4 sm:px-6 flex items-center space-x-3 overflow-x-auto py-2">
            {currentPortal === 'admin' && (
              // Admin Portal Tabs
              <div className="flex items-center space-x-1 flex-shrink-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-violet-300 px-2 py-1 rounded bg-violet-500/10 border border-violet-500/20 flex items-center space-x-1 mr-1">
                  <ShieldCheck className="w-3 h-3" />
                  <span>Admin</span>
                </span>
                <button
                  onClick={() => setActiveTab('crm')}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    activeTab === 'crm'
                      ? 'bg-violet-600 text-white shadow-md'
                      : 'text-espresso-400 hover:text-espresso-300 hover:bg-espresso-800'
                  }`}
                >
                  <Kanban className="w-3.5 h-3.5" />
                  <span>CRM Pipeline</span>
                  {leadCount > 0 && (
                    <span className={`text-[9px] px-1.5 rounded-full font-bold ${
                      activeTab === 'crm' ? 'bg-espresso-800/25 text-espresso-300' : 'bg-violet-500/30 text-violet-200'
                    }`}>
                      {leadCount}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setActiveTab('embeddings')}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    activeTab === 'embeddings'
                      ? 'bg-violet-600 text-white shadow-md'
                      : 'text-espresso-400 hover:text-espresso-300 hover:bg-espresso-800'
                  }`}
                >
                  <Database className="w-3.5 h-3.5" />
                  <span>Vector Embeddings</span>
                </button>

                <button
                  onClick={() => setActiveTab('knowledge')}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    activeTab === 'knowledge'
                      ? 'bg-violet-600 text-white shadow-md'
                      : 'text-espresso-400 hover:text-espresso-300 hover:bg-espresso-800'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Knowledge Base</span>
                </button>

                <button
                  onClick={() => setActiveTab('customers')}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    activeTab === 'customers'
                      ? 'bg-amber-500 text-amber-950 font-bold shadow-md'
                      : 'text-espresso-400 hover:text-espresso-300 hover:bg-espresso-800'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Customer Profiles</span>
                  {customerCount !== undefined && customerCount > 0 && (
                    <span className={`text-[9px] px-1.5 rounded-full font-bold ${
                      activeTab === 'customers' ? 'bg-amber-900/30 text-amber-950' : 'bg-amber-500/20 text-amber-700'
                    }`}>
                      {customerCount}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setActiveTab('login_stats')}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    activeTab === 'login_stats'
                      ? 'bg-amber-500 text-amber-950 font-bold shadow-md'
                      : 'text-espresso-400 hover:text-espresso-300 hover:bg-espresso-800'
                  }`}
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>Login Trends</span>
                </button>

                <button
                  onClick={() => setActiveTab('stats')}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    activeTab === 'stats'
                      ? 'bg-amber-500 text-amber-950 font-bold shadow-md'
                      : 'text-espresso-400 hover:text-espresso-300 hover:bg-espresso-800'
                  }`}
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>Property Stats</span>
                </button>
              </div>
            )}

            {currentPortal === 'property_manager' && (
              // Property Manager Portal Tabs
              <div className="flex items-center space-x-1 flex-shrink-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 px-2 py-1 rounded bg-amber-500/10 border border-amber-500/20 flex items-center space-x-1 mr-1">
                  <Building2 className="w-3 h-3" />
                  <span>Property Manager</span>
                </span>

                <button
                  onClick={() => setActiveTab('properties')}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    activeTab === 'properties'
                      ? 'bg-amber-500 text-amber-950 font-bold shadow-md'
                      : 'text-espresso-400 hover:text-espresso-300 hover:bg-espresso-800'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>Dubai Properties</span>
                  {propertyCount !== undefined && (
                    <span className={`text-[9px] px-1.5 rounded-full font-bold ${
                      activeTab === 'properties' ? 'bg-amber-900/30 text-amber-950' : 'bg-amber-500/20 text-amber-700'
                    }`}>
                      {propertyCount}
                    </span>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mobile nav */}
      <div className="md:hidden flex overflow-x-auto px-4 py-2 space-x-2 bg-espresso-900 border-t border-espresso-700 text-xs">
        <button
          onClick={() => setActiveTab('chat')}
          className={`px-3 py-1.5 rounded-md whitespace-nowrap font-medium ${
            activeTab === 'chat' ? 'bg-amber-500 text-amber-950' : 'text-espresso-400'
          }`}
        >
          AI Chat
        </button>
        {isPortalAuthed && (
          <button
            onClick={onToggleAdminPanel}
            className={`px-3 py-1.5 rounded-md whitespace-nowrap font-medium border ${
              adminPanelOpen || isAdminTab
                ? 'bg-violet-600 text-white border-violet-500'
                : 'text-espresso-400 border-espresso-700'
            }`}
          >
            {currentPortal === 'admin' ? 'Admin ▾' : 'Property Mgr ▾'}
          </button>
        )}
        {!isPortalAuthed && (
          <button
            onClick={() => setAdminDropdownOpen(prev => !prev)}
            className={`px-3 py-1.5 rounded-md whitespace-nowrap font-medium border ${
              adminPanelOpen || isAdminTab
                ? 'bg-violet-600 text-white border-violet-500'
                : 'text-espresso-400 border-espresso-700'
            }`}
          >
            Portals ▾
          </button>
        )}
      </div>
    </header>
  );
};
