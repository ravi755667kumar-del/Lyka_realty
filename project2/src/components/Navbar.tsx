import React from 'react';
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
  ChevronUp
} from 'lucide-react';

interface NavbarProps {
  activeTab: 'chat' | 'crm' | 'properties' | 'embeddings' | 'knowledge';
  setActiveTab: (tab: 'chat' | 'crm' | 'properties' | 'embeddings' | 'knowledge') => void;
  leadCount: number;
  firestoreActive: boolean;
  mongoStatus: { connected: boolean; uriConfigured: boolean; count: number };
  onStartNewChat: () => void;
  adminPanelOpen: boolean;
  onToggleAdminPanel: () => void;
  adminAuthenticated: boolean;
  onAdminLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  leadCount,
  firestoreActive,
  mongoStatus,
  onStartNewChat,
  adminPanelOpen,
  onToggleAdminPanel,
  adminAuthenticated,
  onAdminLogout,
}) => {
  const isAdminTab = ['crm', 'properties', 'embeddings', 'knowledge'].includes(activeTab);

  return (
    <header className="bg-espresso-900 border-b border-espresso-700 text-espresso-300 sticky top-0 z-50">
      <div className="px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div
            className="flex items-center cursor-pointer flex-shrink-0"
            onClick={() => { setActiveTab('chat'); }}
          >
            <img src="/logo.png" alt="Lyka Realty" className="h-12 w-auto object-contain rounded-lg mix-blend-screen" />
          </div>

          {/* Center: AI Chat tab (frontend) */}
          <nav className="hidden md:flex items-center space-x-2">
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
                <span className="text-[9px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-espresso-800/70 text-amber-300">
                  LIVE
                </span>
              )}
            </button>
          </nav>

          {/* Right: Status badges + Admin toggle + New Customer */}
          <div className="flex items-center space-x-2">
            {/* Firebase badge */}
            <div
              className="hidden lg:flex items-center space-x-1.5 text-[11px] bg-espresso-800/80 px-2.5 py-1 rounded-md border border-espresso-700 text-espresso-300"
              title="Firebase Firestore Active"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="font-medium text-emerald-200">Firebase Live</span>
            </div>

            {/* Mongo badge */}
            <div
              onClick={() => { onToggleAdminPanel(); if (!adminPanelOpen) setActiveTab('embeddings'); }}
              className="hidden lg:flex items-center space-x-1.5 text-[11px] bg-espresso-800/80 px-2.5 py-1 rounded-md border border-espresso-700 cursor-pointer hover:border-amber-500/50 transition-colors"
              title="MongoDB Numerical Vector Storage"
            >
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-espresso-300">
                {mongoStatus.connected ? 'MongoDB' : 'Vectors'}
              </span>
            </div>

            {/* Admin Panel toggle */}
            <button
              onClick={onToggleAdminPanel}
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
              {adminPanelOpen || isAdminTab
                ? <ChevronUp className="w-3 h-3" />
                : <ChevronDown className="w-3 h-3" />}
              {leadCount > 0 && adminAuthenticated && (
                <span className="text-[10px] px-1.5 rounded-full font-bold bg-amber-500/25 text-amber-300">
                  {leadCount}
                </span>
              )}
            </button>

            {/* Logout button — only when authenticated */}
            {adminAuthenticated && (
              <button
                onClick={onAdminLogout}
                title="Logout from Admin"
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

      {/* Admin Sub-nav — only visible when Admin Panel is open */}
      {(adminPanelOpen || isAdminTab) && (
        <div className="border-t border-violet-500/30 bg-espresso-900/95 backdrop-blur-sm">
          <div className="px-4 sm:px-6 flex items-center space-x-1 overflow-x-auto py-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-violet-300 mr-2 flex-shrink-0 flex items-center space-x-1">
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
              onClick={() => setActiveTab('properties')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === 'properties'
                  ? 'bg-violet-600 text-white shadow-md'
                  : 'text-espresso-400 hover:text-espresso-300 hover:bg-espresso-800'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Dubai Properties</span>
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
              <span>MongoDB Embeddings</span>
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
        <button
          onClick={onToggleAdminPanel}
          className={`px-3 py-1.5 rounded-md whitespace-nowrap font-medium border ${
            adminPanelOpen || isAdminTab
              ? 'bg-violet-600 text-white border-violet-500'
              : 'text-espresso-400 border-espresso-700'
          }`}
        >
          Admin ▾
        </button>
      </div>
    </header>
  );
};
