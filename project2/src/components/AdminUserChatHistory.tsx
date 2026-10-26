import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  MessageSquare,
  Search,
  RefreshCw,
  Clock,
  Calendar,
  Sparkles,
  ChevronRight,
  UserCheck,
  ShieldCheck,
  ArrowLeft,
  Filter,
  Layers,
  Copy,
  Check,
  MessageCircle,
  FileText,
  AlertCircle,
  Palette
} from 'lucide-react';
import { UserProfileData, SequentialConversation, QaChatItem } from '../types/crm';
import { getAllUsersFromFirestore, getUserConversationsFromFirestore } from '../lib/firebase';

interface AdminUserChatHistoryProps {
  initialSelectedUser?: UserProfileData | null;
  onNavigateToProfiles?: () => void;
  customBgColor?: string;
  onSelectCustomBg?: (color: string) => void;
  onResetCustomBg?: () => void;
  currentTheme?: 'ivory' | 'dark' | 'navy';
  onSelectTheme?: (theme: 'ivory' | 'dark' | 'navy') => void;
  onOpenSettings?: () => void;
}

export const AdminUserChatHistory: React.FC<AdminUserChatHistoryProps> = ({
  initialSelectedUser = null,
  onNavigateToProfiles,
  customBgColor,
  onSelectCustomBg,
  onResetCustomBg,
  currentTheme = 'ivory',
  onSelectTheme,
  onOpenSettings
}) => {
  const [appearanceOpen, setAppearanceOpen] = useState<boolean>(false);
  const [users, setUsers] = useState<UserProfileData[]>([]);
  const [selectedUserKey, setSelectedUserKey] = useState<string>('');
  const [selectedUser, setSelectedUser] = useState<UserProfileData | null>(initialSelectedUser);
  const [conversations, setConversations] = useState<SequentialConversation[]>([]);
  const [loadingUsers, setLoadingUsers] = useState<boolean>(true);
  const [loadingChats, setLoadingChats] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedConvKey, setSelectedConvKey] = useState<string>('all');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Fetch all registered users from User_login
  const fetchUsers = async () => {
    try {
      setLoadingUsers(true);
      const allUsers = await getAllUsersFromFirestore();
      setUsers(allUsers);

      // If initial user provided, select them
      if (initialSelectedUser) {
        const key = initialSelectedUser.Email_id || initialSelectedUser.uid;
        setSelectedUserKey(key);
        setSelectedUser(initialSelectedUser);
      }
    } catch (err) {
      console.warn('Failed to fetch users in AdminUserChatHistory:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // When initialSelectedUser changes from props
  useEffect(() => {
    if (initialSelectedUser) {
      const key = initialSelectedUser.Email_id || initialSelectedUser.uid;
      setSelectedUserKey(key);
      setSelectedUser(initialSelectedUser);
    }
  }, [initialSelectedUser]);

  // Load chat conversations whenever selectedUser changes
  const loadUserConversations = async (user: UserProfileData) => {
    try {
      setLoadingChats(true);
      const convs = await getUserConversationsFromFirestore(user.Email_id, user.uid);
      setConversations(convs);
      setSelectedConvKey('all');
    } catch (err) {
      console.warn('Failed to load user conversations:', err);
      setConversations([]);
    } finally {
      setLoadingChats(false);
    }
  };

  // Handle user selection change from dropdown or card
  const handleSelectUser = (user: UserProfileData | null) => {
    if (!user) {
      setSelectedUser(null);
      setSelectedUserKey('');
      setConversations([]);
      return;
    }
    const key = user.Email_id || user.uid;
    setSelectedUserKey(key);
    setSelectedUser(user);
    loadUserConversations(user);
  };

  // Filtered users for search
  const filteredUsers = useMemo(() => {
    if (!searchTerm.trim()) return users;
    const term = searchTerm.toLowerCase().trim();
    return users.filter(u => 
      (u.Name && u.Name.toLowerCase().includes(term)) ||
      (u.Email_id && u.Email_id.toLowerCase().includes(term)) ||
      (u.phone && u.phone.includes(term)) ||
      (u.uid && u.uid.toLowerCase().includes(term))
    );
  }, [users, searchTerm]);

  // Total Q&A count across all conversations
  const totalQaCount = useMemo(() => {
    return conversations.reduce((acc, conv) => acc + (conv.chats?.length || 0), 0);
  }, [conversations]);

  // Visible conversations based on tab filter
  const displayedConversations = useMemo(() => {
    if (selectedConvKey === 'all') return conversations;
    return conversations.filter(c => c.conversation_key === selectedConvKey || c.lead_id === selectedConvKey);
  }, [conversations, selectedConvKey]);

  const copyTranscript = (conv: SequentialConversation) => {
    const text = conv.chats.map(c => 
      `[Sequence #${c.sequence}] ${c.date} ${c.time}\nUser Question: ${c.user_question}\nLyka AI Answer: ${c.ai_answer}\n`
    ).join('\n---\n\n');

    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(conv.conversation_key);
      setTimeout(() => setCopiedKey(null), 2000);
    }).catch(() => {});
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden font-sans transition-colors duration-200" style={{ backgroundColor: customBgColor || undefined }}>
      {/* Top Header */}
      <div className="shrink-0 bg-white dark:bg-slate-900 border-b border-espresso-100 dark:border-slate-800 px-4 sm:px-6 py-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 flex items-center justify-center font-bold">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                  User Chat History
                </h1>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 border border-amber-500/30">
                  Admin Inspection
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                First select a user name from login, then inspect their sequential Q&A chat history.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {onNavigateToProfiles && (
              <button
                onClick={onNavigateToProfiles}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors"
              >
                <Users className="w-3.5 h-3.5 text-amber-600" />
                <span>Customer Profiles</span>
              </button>
            )}

            {/* Background Color & Appearance Changer */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setAppearanceOpen(prev => !prev)}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold shadow-xs transition-all ${
                  appearanceOpen
                    ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
                }`}
                title="Change background color"
              >
                <Palette className="w-3.5 h-3.5 text-amber-500" />
                <span className="hidden sm:inline">Background</span>
                <div 
                  className="w-2.5 h-2.5 rounded-full border border-slate-300 dark:border-slate-600 shadow-xs shrink-0"
                  style={{ backgroundColor: customBgColor || (currentTheme === 'dark' ? '#0b0f17' : currentTheme === 'navy' ? '#070d1e' : '#fdfbf5') }}
                />
              </button>

              {appearanceOpen && (
                <>
                  <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setAppearanceOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl z-50 p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                      <div className="flex items-center space-x-1.5">
                        <Palette className="w-4 h-4 text-amber-500" />
                        <span className="text-xs font-bold text-slate-900 dark:text-white">Admin Background Color</span>
                      </div>
                      {onResetCustomBg && (
                        <button
                          type="button"
                          onClick={() => {
                            onResetCustomBg();
                            if (onSelectTheme) onSelectTheme('ivory');
                          }}
                          className="text-[10px] text-amber-600 dark:text-amber-400 hover:underline font-semibold"
                        >
                          Reset
                        </button>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Luxury Presets</span>
                      <div className="grid grid-cols-3 gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            if (onSelectTheme) onSelectTheme('ivory');
                            if (onSelectCustomBg) onSelectCustomBg('#fdfbf5');
                          }}
                          className="p-2 rounded-xl border border-slate-200 hover:border-amber-500 bg-[#fdfbf5] text-slate-900 text-center transition-all shadow-xs cursor-pointer"
                        >
                          <div className="w-4 h-4 rounded-full bg-[#fdfbf5] border border-slate-300 mx-auto mb-1" />
                          <span className="text-[10px] font-bold block">Ivory</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (onSelectTheme) onSelectTheme('dark');
                            if (onSelectCustomBg) onSelectCustomBg('#0b0f17');
                          }}
                          className="p-2 rounded-xl border border-slate-700 hover:border-amber-500 bg-[#0b0f17] text-white text-center transition-all shadow-xs cursor-pointer"
                        >
                          <div className="w-4 h-4 rounded-full bg-[#0b0f17] border border-slate-600 mx-auto mb-1" />
                          <span className="text-[10px] font-bold block">Obsidian</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (onSelectTheme) onSelectTheme('navy');
                            if (onSelectCustomBg) onSelectCustomBg('#070d1e');
                          }}
                          className="p-2 rounded-xl border border-blue-900 hover:border-amber-500 bg-[#070d1e] text-white text-center transition-all shadow-xs cursor-pointer"
                        >
                          <div className="w-4 h-4 rounded-full bg-[#070d1e] border border-blue-800 mx-auto mb-1" />
                          <span className="text-[10px] font-bold block">Navy</span>
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-1 border-t border-slate-100 dark:border-slate-800">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Custom Color Picker</span>
                      <div className="flex items-center space-x-2">
                        <input
                          type="color"
                          value={customBgColor || '#fdfbf5'}
                          onChange={(e) => {
                            if (onSelectCustomBg) onSelectCustomBg(e.target.value);
                          }}
                          className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0 p-0 shrink-0"
                        />
                        <input
                          type="text"
                          value={customBgColor || ''}
                          placeholder="#0b0f17 or #fdfbf5"
                          onChange={(e) => {
                            if (onSelectCustomBg) onSelectCustomBg(e.target.value);
                          }}
                          className="flex-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-900 dark:text-white font-mono placeholder-slate-400 focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>

                    {onOpenSettings && (
                      <button
                        type="button"
                        onClick={() => {
                          setAppearanceOpen(false);
                          onOpenSettings();
                        }}
                        className="w-full text-center py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-semibold transition-colors border border-slate-200 dark:border-slate-700 cursor-pointer"
                      >
                        All Theme & Appearance Settings →
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>

            <button
              onClick={() => {
                fetchUsers();
                if (selectedUser) loadUserConversations(selectedUser);
              }}
              disabled={loadingUsers || loadingChats}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-espresso-900 dark:bg-slate-800 hover:bg-espresso-800 dark:hover:bg-slate-700 text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
              title="Refresh users and chat history"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingUsers || loadingChats ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* STEP 1: Select User Name from Login Dropdown / Selector Bar */}
        <div className="mt-4 pt-3 border-t border-espresso-100/80 dark:border-slate-800/80 flex flex-col md:flex-row items-stretch md:items-center gap-3">
          <div className="flex items-center space-x-2 shrink-0">
            <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 font-black text-[11px] flex items-center justify-center shadow-xs">
              1
            </span>
            <label htmlFor="user-select-dropdown" className="text-xs font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
              Select User Name from Login:
            </label>
          </div>

          <div className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {/* Primary Select Dropdown */}
            <div className="relative flex-1">
              <select
                id="user-select-dropdown"
                value={selectedUserKey}
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val) {
                    handleSelectUser(null);
                  } else {
                    const found = users.find(u => (u.Email_id || u.uid) === val);
                    if (found) handleSelectUser(found);
                  }
                }}
                className="w-full pl-3 pr-8 py-2 rounded-xl text-xs font-medium border border-espresso-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 shadow-xs appearance-none cursor-pointer"
              >
                <option value="">
                  {loadingUsers ? 'Loading registered users...' : `-- Choose a User Name to View Chats (${users.length} Registered) --`}
                </option>
                {users.map((u) => {
                  const key = u.Email_id || u.uid;
                  const displayName = u.Name ? u.Name.trim() : 'Anonymous User';
                  const emailOrUid = u.Email_id || u.uid;
                  const provider = u.auth_provider || 'Email';
                  return (
                    <option key={key} value={key}>
                      {displayName} — {emailOrUid} ({provider})
                    </option>
                  );
                })}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-400">
                <ChevronRight className="w-4 h-4 rotate-90" />
              </div>
            </div>

            {/* Quick Search Box */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search user name/email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-2 rounded-xl text-xs border border-espresso-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              />
            </div>
          </div>

          {selectedUser && (
            <button
              onClick={() => handleSelectUser(null)}
              className="text-xs text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 font-semibold px-2 py-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors shrink-0"
            >
              Clear Selection
            </button>
          )}
        </div>
      </div>

      {/* Main Body */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        {/* CASE 1: NO USER SELECTED YET -> Prompt with User List Cards */}
        {!selectedUser ? (
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Guide Card */}
            <div className="bg-gradient-to-br from-amber-500/10 via-amber-600/5 to-slate-900/5 border border-amber-500/30 rounded-2xl p-6 sm:p-8 text-center space-y-3 shadow-sm">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-700 dark:text-amber-400 flex items-center justify-center mx-auto shadow-xs">
                <Users className="w-7 h-7" />
              </div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                Select a User to View Chat History
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-lg mx-auto">
                First of all, select a user name from the dropdown above, or click any user card below. All sequential conversations (<code className="font-mono text-amber-700 dark:text-amber-400">conversation_1</code>, <code className="font-mono text-amber-700 dark:text-amber-400">conversation_2</code>...) and Agentic AI Q&A transcripts will load automatically.
              </p>
            </div>

            {/* List of Registered Users */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <UserCheck className="w-4 h-4 text-amber-600" />
                  <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Registered Login Accounts ({filteredUsers.length})
                  </h3>
                </div>
                {searchTerm && (
                  <span className="text-[11px] text-slate-400">
                    Filtered by: "{searchTerm}"
                  </span>
                )}
              </div>

              {filteredUsers.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center text-slate-400 text-xs">
                  No registered users match your search.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredUsers.map((u) => {
                    const isGoogle = (u.auth_provider || '').toLowerCase().includes('google');
                    const initials = u.Name ? u.Name.substring(0, 2).toUpperCase() : 'CU';
                    return (
                      <div
                        key={u.Email_id || u.uid}
                        onClick={() => handleSelectUser(u)}
                        className="bg-white dark:bg-slate-900 hover:bg-amber-50/50 dark:hover:bg-slate-800/80 border border-espresso-100 dark:border-slate-800 hover:border-amber-500/50 rounded-2xl p-4 cursor-pointer transition-all shadow-xs group flex items-center justify-between"
                      >
                        <div className="flex items-center space-x-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 font-bold text-xs flex items-center justify-center shrink-0 border border-amber-500/30 group-hover:scale-105 transition-transform">
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate group-hover:text-amber-700 dark:group-hover:text-amber-400 transition-colors">
                              {u.Name || 'Anonymous Customer'}
                            </h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate">
                              {u.Email_id || u.uid}
                            </p>
                            <div className="flex items-center space-x-2 mt-1">
                              <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-semibold ${
                                isGoogle 
                                  ? 'bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400' 
                                  : 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400'
                              }`}>
                                {u.auth_provider || 'Email'}
                              </span>
                              {u.Age && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                                  {u.Age} yrs
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-1 text-xs font-semibold text-amber-700 dark:text-amber-400 group-hover:translate-x-1 transition-transform shrink-0">
                          <span>View Chats</span>
                          <ChevronRight className="w-4 h-4" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* CASE 2: USER IS SELECTED -> SHOW CHAT HISTORY */
          <div className="max-w-5xl mx-auto space-y-6">
            {/* Selected User Overview Card */}
            <div className="bg-white dark:bg-slate-900 border border-espresso-100 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center space-x-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-600 to-amber-400 text-white font-black text-sm flex items-center justify-center shadow-md shrink-0">
                    {selectedUser.Name ? selectedUser.Name.substring(0, 2).toUpperCase() : 'CU'}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2 flex-wrap">
                      <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                        {selectedUser.Name || 'Anonymous Customer'}
                      </h2>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-800 dark:text-amber-300 font-bold border border-amber-500/30">
                        {conversations.length} {conversations.length === 1 ? 'Conversation' : 'Conversations'}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-800 dark:text-violet-300 font-bold border border-violet-500/30">
                        {totalQaCount} Q&A Pairs
                      </span>
                    </div>

                    <div className="flex items-center space-x-3 text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono flex-wrap">
                      <span>{selectedUser.Email_id}</span>
                      {(selectedUser.phone || selectedUser.Phone_number) && (
                        <span>• Tel: {selectedUser.phone || selectedUser.Phone_number}</span>
                      )}
                      <span>• Auth: {selectedUser.auth_provider || 'Email'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  <button
                    onClick={() => handleSelectUser(null)}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Change User</span>
                  </button>
                  <button
                    onClick={() => loadUserConversations(selectedUser)}
                    disabled={loadingChats}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold shadow-xs transition-all"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingChats ? 'animate-spin' : ''}`} />
                    <span>Reload Chats</span>
                  </button>
                </div>
              </div>

              {/* Conversation Selector Tabs */}
              {conversations.length > 0 && (
                <div className="mt-4 pt-3 border-t border-espresso-100 dark:border-slate-800 flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-thin">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1">
                    Conversations:
                  </span>
                  <button
                    onClick={() => setSelectedConvKey('all')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                      selectedConvKey === 'all'
                        ? 'bg-amber-500 text-slate-950 shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    All Conversations ({conversations.length})
                  </button>

                  {conversations.map((c) => {
                    const isSelected = selectedConvKey === c.conversation_key || selectedConvKey === c.lead_id;
                    const qCount = c.chats?.length || 0;
                    return (
                      <button
                        key={c.conversation_key || c.lead_id}
                        onClick={() => setSelectedConvKey(c.conversation_key)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 flex items-center space-x-1.5 ${
                          isSelected
                            ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        <span>Conv #{c.conversation_number}</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                          isSelected ? 'bg-slate-950/20 text-slate-950' : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-300'
                        }`}>
                          {qCount} Q&A
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Loading Indicator */}
            {loadingChats && (
              <div className="bg-white dark:bg-slate-900 border border-espresso-100 dark:border-slate-800 rounded-2xl p-12 text-center space-y-3">
                <RefreshCw className="w-8 h-8 text-amber-500 animate-spin mx-auto" />
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  Loading sequential conversations and Q&A pairs for {selectedUser.Name || 'User'}...
                </p>
              </div>
            )}

            {/* Empty State if no conversations found */}
            {!loadingChats && conversations.length === 0 && (
              <div className="bg-white dark:bg-slate-900 border border-espresso-100 dark:border-slate-800 rounded-2xl p-12 text-center space-y-3 shadow-xs">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                  <MessageCircle className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                  No Chat History Found for {selectedUser.Name || 'User'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                  This user has logged in successfully, but has not initiated any Agentic AI chat inquiries yet.
                </p>
              </div>
            )}

            {/* Sequential Conversations List */}
            {!loadingChats && displayedConversations.map((conv) => (
              <div
                key={conv.conversation_key || conv.lead_id}
                className="bg-white dark:bg-slate-900 border border-espresso-100 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs space-y-0"
              >
                {/* Conversation Header Bar */}
                <div className="bg-espresso-900 text-white px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-espresso-800">
                  <div className="flex items-center space-x-3">
                    <span className="w-7 h-7 rounded-lg bg-amber-500 text-slate-950 font-black text-xs flex items-center justify-center shadow-xs">
                      #{conv.conversation_number}
                    </span>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="text-sm font-bold text-white tracking-wide">
                          {conv.title || `Conversation ${conv.conversation_number}`}
                        </h3>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-espresso-800 text-amber-300">
                          {conv.conversation_key}
                        </span>
                      </div>
                      <div className="flex items-center space-x-3 text-[11px] text-espresso-300 font-mono mt-0.5">
                        <span className="flex items-center space-x-1">
                          <Calendar className="w-3 h-3 text-amber-400" />
                          <span>{conv.date}</span>
                        </span>
                        {conv.started_at && (
                          <span className="flex items-center space-x-1">
                            <Clock className="w-3 h-3 text-amber-400" />
                            <span>Started: {conv.started_at}</span>
                          </span>
                        )}
                        <span>• {conv.chats.length} Q&A {conv.chats.length === 1 ? 'Interaction' : 'Interactions'}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => copyTranscript(conv)}
                    className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-espresso-800 hover:bg-espresso-700 text-espresso-200 text-xs font-medium transition-colors shrink-0 self-start sm:self-auto"
                    title="Copy full conversation transcript"
                  >
                    {copiedKey === conv.conversation_key ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400 font-semibold">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Transcript</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Sequential Q&A Chats inside Conversation */}
                <div className="p-4 sm:p-6 space-y-6 bg-slate-50/50 dark:bg-slate-950/40">
                  {conv.chats.map((qaItem: QaChatItem) => (
                    <div
                      key={qaItem.sequence}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4 hover:border-amber-500/30 transition-colors"
                    >
                      {/* Step Indicator Header */}
                      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                        <div className="flex items-center space-x-2">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                            Sequence #{qaItem.sequence}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2 text-[11px] text-slate-400 font-mono">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>{qaItem.date} • {qaItem.time}</span>
                        </div>
                      </div>

                      {/* 1. User Question Card */}
                      <div className="bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 rounded-xl p-3.5 space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-bold text-amber-900 dark:text-amber-300">
                          <div className="flex items-center space-x-2">
                            <span className="w-5 h-5 rounded-md bg-amber-500/20 text-amber-800 dark:text-amber-300 flex items-center justify-center text-[10px] font-black">
                              U
                            </span>
                            <span>User Question ({selectedUser.Name || 'Customer'})</span>
                          </div>
                          <span className="text-[10px] text-amber-800/70 dark:text-amber-400 font-mono">
                            {qaItem.time}
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm font-medium text-slate-900 dark:text-slate-100 pl-7 leading-relaxed whitespace-pre-wrap">
                          {qaItem.user_question || '<Empty prompt>'}
                        </p>
                      </div>

                      {/* 2. Lyka AI Answer Card */}
                      <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 rounded-xl p-3.5 space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-bold text-violet-900 dark:text-violet-300">
                          <div className="flex items-center space-x-2">
                            <span className="w-5 h-5 rounded-md bg-violet-500/20 text-violet-700 dark:text-violet-300 flex items-center justify-center text-[10px]">
                              <Sparkles className="w-3 h-3 text-amber-500" />
                            </span>
                            <span>Lyka Agentic AI Answer</span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {qaItem.time}
                          </span>
                        </div>
                        <div className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 pl-7 leading-relaxed whitespace-pre-wrap">
                          {qaItem.ai_answer || '<No response recorded>'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
