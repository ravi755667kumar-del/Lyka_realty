import React, { useState } from 'react';
import { 
  Building2, 
  MessageSquare, 
  Kanban, 
  Database, 
  BookOpen, 
  Layers,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Users,
  TrendingUp,
  LogOut,
  BookmarkCheck,
  Info
} from 'lucide-react';

interface NavbarProps {
  activeTab: 'chat' | 'crm' | 'properties' | 'embeddings' | 'knowledge' | 'stats' | 'customers' | 'login_stats' | 'assigned_properties';
  setActiveTab: (tab: 'chat' | 'crm' | 'properties' | 'embeddings' | 'knowledge' | 'stats' | 'customers' | 'login_stats' | 'assigned_properties') => void;
  leadCount: number;
  customerCount?: number;
  propertyCount?: number;
  bookedPropertyCount?: number;
  firestoreActive: boolean;
  vectorStatus?: { connected: boolean; count: number };
  onStartNewChat?: () => void;
  adminPanelOpen: boolean;
  onToggleAdminPanel: () => void;
  onSelectPortal?: (portal: 'admin' | 'property_manager') => void;
  adminAuthenticated: boolean;
  propertyManagerAuthenticated: boolean;
  adminTargetPortal: 'admin' | 'property_manager';
  onAdminLogout: () => void;
  onOpenAbout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  leadCount,
  customerCount,
  propertyCount,
  bookedPropertyCount,
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
  onOpenAbout,
}) => {
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const isAdminTab = ['crm', 'properties', 'embeddings', 'knowledge', 'stats', 'customers', 'login_stats', 'assigned_properties'].includes(activeTab);

  // Determine which portal is currently authenticated (Super Admin has access to both)
  const currentPortal = adminTargetPortal;
  const isPortalAuthed = currentPortal === 'admin' 
    ? adminAuthenticated 
    : (propertyManagerAuthenticated || adminAuthenticated);
  const isAnyAuthed = adminAuthenticated || propertyManagerAuthenticated;

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

          {/* Center: AI Chat tab — ABSOLUTELY CENTERED */}
          <nav className="absolute left-1/2 -translate-x-1/2 flex items-center space-x-2 z-10">
            <button
              onClick={() => { setActiveTab('chat'); }}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all border ${
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

          {/* Right: About in right corner */}
          <div className="flex items-center space-x-2 ml-auto z-10">
            <button
              onClick={onOpenAbout}
              className="flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-espresso-300 hover:text-amber-400 hover:bg-espresso-800 border border-espresso-700/60 transition-all shadow-sm"
              title="Learn about Lyka Realty"
            >
              <Info className="w-4 h-4 text-amber-400" />
              <span>About</span>
            </button>
          </div>
        </div>
      </div>

      {/* Admin & Property Manager Sub-nav — visible when Admin Panel is open */}
      {(adminPanelOpen || isAdminTab) && isPortalAuthed && (
        <div className="border-t border-violet-500/30 bg-espresso-900/95 backdrop-blur-sm">
          <div className="px-4 sm:px-6 flex items-center space-x-3 overflow-x-auto py-2">
            {/* Downside Role Dropdown Selector — Kept inside admin */}
            <div className="relative flex-shrink-0 mr-1">
              <button
                onClick={() => setRoleDropdownOpen(prev => !prev)}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border shadow-sm ${
                  adminTargetPortal === 'admin'
                    ? 'bg-violet-600/30 border-violet-500/60 text-violet-200 hover:bg-violet-600/40 hover:border-violet-400'
                    : 'bg-amber-500/20 border-amber-500/50 text-amber-300 hover:bg-amber-500/30 hover:border-amber-400'
                }`}
                title="Choose Admin or Property Admin"
              >
                {adminTargetPortal === 'admin' ? (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5 text-violet-400" />
                    <span>Admin</span>
                    {leadCount > 0 && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-violet-950/60 text-violet-200">
                        {leadCount}
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <Building2 className="w-3.5 h-3.5 text-amber-400" />
                    <span>Property Admin</span>
                    {propertyCount !== undefined && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-amber-950/40 text-amber-950">
                        {propertyCount}
                      </span>
                    )}
                  </>
                )}
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${roleDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Downside Dropdown Menu */}
              {roleDropdownOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40 bg-transparent" 
                    onClick={() => setRoleDropdownOpen(false)} 
                  />
                  <div className="absolute left-0 top-full mt-2 w-64 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl z-50 p-2 space-y-1.5 text-slate-100 backdrop-blur-xl">
                    <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                      Choose Option
                    </div>

                    {/* Option 1: Admin */}
                    <button
                      onClick={() => {
                        setRoleDropdownOpen(false);
                        if (onSelectPortal) onSelectPortal('admin');
                        setActiveTab('crm');
                      }}
                      className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-start space-x-2.5 ${
                        adminTargetPortal === 'admin'
                          ? 'bg-violet-600/25 border-violet-500 text-white shadow-sm'
                          : 'bg-slate-800/40 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <ShieldCheck className="w-4 h-4 text-violet-400 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white">Admin</span>
                          {adminTargetPortal === 'admin' && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded-full font-bold bg-violet-500/30 text-violet-200">
                              Active
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 truncate mt-0.5">CRM, AI Embeddings & Knowledge</p>
                      </div>
                    </button>

                    {/* Option 2: Property Admin */}
                    <button
                      onClick={() => {
                        setRoleDropdownOpen(false);
                        if (onSelectPortal) onSelectPortal('property_manager');
                        setActiveTab('properties');
                      }}
                      className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-start space-x-2.5 ${
                        adminTargetPortal === 'property_manager'
                          ? 'bg-amber-500/25 border-amber-500 text-white shadow-sm'
                          : 'bg-slate-800/40 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <Building2 className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white">Property Admin</span>
                          {adminTargetPortal === 'property_manager' && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded-full font-bold bg-amber-500/30 text-amber-200">
                              Active
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 truncate mt-0.5">Dubai Properties & Inventory</p>
                      </div>
                    </button>
                  </div>
                </>
              )}
            </div>

            <div className="h-6 w-px bg-espresso-700/60 mx-1 flex-shrink-0" />

            {adminTargetPortal === 'admin' && (
              // Admin Portal Tabs
              <div className="flex items-center space-x-1 flex-shrink-0">
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

                <button
                  onClick={() => setActiveTab('assigned_properties')}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    activeTab === 'assigned_properties'
                      ? 'bg-amber-500 text-amber-950 font-bold shadow-md'
                      : 'text-espresso-400 hover:text-espresso-300 hover:bg-espresso-800'
                  }`}
                >
                  <BookmarkCheck className="w-3.5 h-3.5" />
                  <span>Assign / Bookings</span>
                  {bookedPropertyCount !== undefined && bookedPropertyCount > 0 && (
                    <span className={`text-[9px] px-1.5 rounded-full font-bold ${
                      activeTab === 'assigned_properties' ? 'bg-amber-900/30 text-amber-950' : 'bg-emerald-500/20 text-emerald-300'
                    }`}>
                      {bookedPropertyCount}
                    </span>
                  )}
                </button>
              </div>
            )}

            {adminTargetPortal === 'property_manager' && (
              // Property Admin Tabs
              <div className="flex items-center space-x-1 flex-shrink-0">
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

                <button
                  onClick={() => setActiveTab('assigned_properties')}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    activeTab === 'assigned_properties'
                      ? 'bg-amber-500 text-amber-950 font-bold shadow-md'
                      : 'text-espresso-400 hover:text-espresso-300 hover:bg-espresso-800'
                  }`}
                >
                  <BookmarkCheck className="w-3.5 h-3.5" />
                  <span>Assign / Bookings</span>
                  {bookedPropertyCount !== undefined && bookedPropertyCount > 0 && (
                    <span className={`text-[9px] px-1.5 rounded-full font-bold ${
                      activeTab === 'assigned_properties' ? 'bg-amber-900/30 text-amber-950' : 'bg-emerald-500/20 text-emerald-300'
                    }`}>
                      {bookedPropertyCount}
                    </span>
                  )}
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

            {/* Downside Right Actions: Logout and Back to Chat */}
            <div className="ml-auto flex items-center space-x-2 flex-shrink-0 pl-3">
              <button
                onClick={onAdminLogout}
                className="flex items-center space-x-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-red-500/40 bg-red-950/30 hover:bg-red-900/50 text-red-300 hover:border-red-400 transition-all"
                title="Logout from Admin"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Logout</span>
              </button>
              <button
                onClick={() => {
                  setActiveTab('chat');
                  onToggleAdminPanel();
                }}
                className="text-xs text-espresso-400 hover:text-espresso-200 px-2.5 py-1.5 rounded-lg hover:bg-espresso-800 border border-espresso-700/60 transition-colors"
                title="Back to AI Chat"
              >
                Back to Chat ✕
              </button>
            </div>
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
          onClick={onOpenAbout}
          className="flex items-center space-x-1 px-3 py-1.5 rounded-md whitespace-nowrap font-medium text-amber-400 border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20"
        >
          <Info className="w-3.5 h-3.5" />
          <span>About</span>
        </button>
        {isAnyAuthed ? (
          <>
            <button
              onClick={() => {
                if (onSelectPortal) onSelectPortal('admin');
                setActiveTab('crm');
              }}
              className={`px-3 py-1.5 rounded-md whitespace-nowrap font-medium border ${
                (adminPanelOpen || isAdminTab) && adminTargetPortal === 'admin'
                  ? 'bg-violet-600 text-white border-violet-500'
                  : 'text-espresso-400 border-espresso-700'
              }`}
            >
              Admin
            </button>
            <button
              onClick={() => {
                if (onSelectPortal) onSelectPortal('property_manager');
                setActiveTab('properties');
              }}
              className={`px-3 py-1.5 rounded-md whitespace-nowrap font-medium border ${
                (adminPanelOpen || isAdminTab) && activeTab === 'properties'
                  ? 'bg-amber-500 text-amber-950 border-amber-400'
                  : 'text-espresso-400 border-espresso-700'
              }`}
            >
              Property Admin
            </button>
            <button
              onClick={() => setActiveTab('assigned_properties')}
              className={`px-3 py-1.5 rounded-md whitespace-nowrap font-medium border ${
                activeTab === 'assigned_properties'
                  ? 'bg-amber-500 text-amber-950 border-amber-400'
                  : 'text-espresso-400 border-espresso-700'
              }`}
            >
              Assign
            </button>
            <button
              onClick={onAdminLogout}
              className="px-2.5 py-1.5 rounded-md whitespace-nowrap font-medium border border-red-500/40 text-red-300 ml-auto"
            >
              Logout
            </button>
          </>
        ) : null}
      </div>
    </header>
  );
};
