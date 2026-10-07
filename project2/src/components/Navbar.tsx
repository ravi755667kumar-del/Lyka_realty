import React from 'react';
import { 
  Building2, 
  MessageSquare, 
  Kanban, 
  Database, 
  BookOpen, 
  CheckCircle2, 
  Sparkles,
  Layers,
  PhoneCall
} from 'lucide-react';

interface NavbarProps {
  activeTab: 'chat' | 'crm' | 'properties' | 'embeddings' | 'knowledge';
  setActiveTab: (tab: 'chat' | 'crm' | 'properties' | 'embeddings' | 'knowledge') => void;
  leadCount: number;
  firestoreActive: boolean;
  mongoStatus: { connected: boolean; uriConfigured: boolean; count: number };
  onStartNewChat: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  leadCount,
  firestoreActive,
  mongoStatus,
  onStartNewChat,
}) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('chat')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-amber-400 to-yellow-300 flex items-center justify-center text-slate-950 shadow-lg shadow-amber-500/20 font-black text-xl">
              LR
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold tracking-tight text-lg text-white">LYKA REALTY</span>
                <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  DUBAI
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">Agentic AI & CRM Engine</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden md:flex items-center space-x-1 bg-slate-800/80 p-1.5 rounded-xl border border-slate-700/50">
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'chat'
                  ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>Agentic AI Chat</span>
            </button>

            <button
              onClick={() => setActiveTab('crm')}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all relative ${
                activeTab === 'crm'
                  ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
              }`}
            >
              <Kanban className="w-4 h-4" />
              <span>CRM Pipeline</span>
              {leadCount > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  activeTab === 'crm' ? 'bg-slate-950 text-amber-400' : 'bg-amber-500/30 text-amber-300'
                }`}>
                  {leadCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('properties')}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'properties'
                  ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>Dubai Properties</span>
            </button>

            <button
              onClick={() => setActiveTab('embeddings')}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'embeddings'
                  ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
              }`}
            >
              <Database className="w-4 h-4" />
              <span>MongoDB Embeddings</span>
            </button>

            <button
              onClick={() => setActiveTab('knowledge')}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'knowledge'
                  ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>Knowledge Base</span>
            </button>
          </nav>

          {/* Quick Stats & Action */}
          <div className="flex items-center space-x-3">
            {/* Firebase badge */}
            <div className="hidden lg:flex items-center space-x-1.5 text-[11px] bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-700 text-slate-300" title="Firebase Firestore Active">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="font-medium text-emerald-300">Firebase Live</span>
            </div>

            {/* Mongo badge */}
            <div 
              onClick={() => setActiveTab('embeddings')}
              className="hidden lg:flex items-center space-x-1.5 text-[11px] bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-700 cursor-pointer hover:border-amber-500/50 transition-colors" 
              title="MongoDB Numerical Vector Storage"
            >
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-slate-300">
                {mongoStatus.connected ? 'MongoDB Connected' : 'Vector Store Active'}
              </span>
            </div>

            <button
              onClick={onStartNewChat}
              className="flex items-center space-x-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 px-3 py-1.5 rounded-lg transition-colors shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>New Customer</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile nav */}
      <div className="md:hidden flex overflow-x-auto px-4 py-2 space-x-2 bg-slate-950 border-t border-slate-800 text-xs">
        <button
          onClick={() => setActiveTab('chat')}
          className={`px-3 py-1.5 rounded-md whitespace-nowrap font-medium ${activeTab === 'chat' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'}`}
        >
          AI Chat
        </button>
        <button
          onClick={() => setActiveTab('crm')}
          className={`px-3 py-1.5 rounded-md whitespace-nowrap font-medium ${activeTab === 'crm' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'}`}
        >
          CRM ({leadCount})
        </button>
        <button
          onClick={() => setActiveTab('properties')}
          className={`px-3 py-1.5 rounded-md whitespace-nowrap font-medium ${activeTab === 'properties' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'}`}
        >
          Properties
        </button>
        <button
          onClick={() => setActiveTab('embeddings')}
          className={`px-3 py-1.5 rounded-md whitespace-nowrap font-medium ${activeTab === 'embeddings' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'}`}
        >
          MongoDB Vectors
        </button>
        <button
          onClick={() => setActiveTab('knowledge')}
          className={`px-3 py-1.5 rounded-md whitespace-nowrap font-medium ${activeTab === 'knowledge' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'}`}
        >
          Knowledge Base
        </button>
      </div>
    </header>
  );
};
