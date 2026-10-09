import React, { useState, useRef, useEffect } from 'react';
import { 
  ChatMessage, 
  LeadProfile, 
  PropertyListing, 
} from '../types/crm';
import { 
  Send, 
  Mic, 
  MicOff, 
  Sparkles, 
  Building2, 
  Calendar, 
  PhoneCall, 
  CheckCircle2, 
  Copy, 
  Check, 
  Volume2, 
  VolumeX, 
  ThumbsUp, 
  ChevronDown, 
  ChevronUp, 
  SlidersHorizontal,
  Coins,
  Compass,
  Brain,
  Cpu,
  Settings,
  X,
  Zap,
  User,
  LogIn,
  MessageSquare,
  Clock,
  Plus,
  Mail,
  Lock,
  Eye,
  EyeOff,
  UserCircle,
  ChevronLeft,
  ChevronRight,
  Search
} from 'lucide-react';
import { auth, saveUserLoginToFirestore } from '../lib/firebase';
import { GoogleAuthProvider, signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';

interface SavedSession {
  id: string;
  title: string;
  preview: string;
  timestamp: string;
  messageCount: number;
}

interface AgenticChatProps {
  messages: ChatMessage[];
  currentLead: LeadProfile;
  onSendMessage: (text: string, options?: { groqApiKey?: string; groqModel?: string }) => void;
  isLoading: boolean;
  onBookViewing: (property: PropertyListing) => void;
  onOpenAgentHandoff: () => void;
  onToggleSidebar: () => void;
  sidebarOpen: boolean;
  onUpdateLead?: (updates: Partial<LeadProfile>) => void;
  onStartNewChat: () => void;
}

export const AgenticChat: React.FC<AgenticChatProps> = ({
  messages,
  currentLead,
  onSendMessage,
  isLoading,
  onBookViewing,
  onOpenAgentHandoff,
  onToggleSidebar,
  sidebarOpen,
  onUpdateLead,
  onStartNewChat
}) => {
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [expandedThoughtId, setExpandedThoughtId] = useState<string | null>(null);
  
  // ... other code ...
  
  const handleAuth = async (e: React.FormEvent) => {
    // This part is modified elsewhere in the file. Wait, I should not replace 350 lines just for this.
    // I need to split this into two separate edits to avoid breaking the file!
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [likedMap, setLikedMap] = useState<Record<string, boolean>>({});

  // Model & AI Engine configuration state
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [activeModel, setActiveModel] = useState<string>('llama-3.3-70b-versatile');
  const [groqKeyInput, setGroqKeyInput] = useState<string>('');
  const [engineProvider, setEngineProvider] = useState<'groq' | 'gemini'>('groq');

  // Left sidebar: user login & chat history
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [userLoggedIn, setUserLoggedIn] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [userName, setUserName] = useState('');
  const [userFullName, setUserFullName] = useState('');
  const [userAge, setUserAge] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [sessionSearch, setSessionSearch] = useState('');

  // Saved sessions (mock data + real sessions derived from messages)
  const [savedSessions, setSavedSessions] = useState<SavedSession[]>([
    {
      id: 'SES-001',
      title: 'Dubai Marina Inquiry',
      preview: 'Looking for 2BR apartment near waterfront...',
      timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
      messageCount: 8
    },
    {
      id: 'SES-002',
      title: 'Business Bay Investment',
      preview: 'High ROI off-plan with flexible payment plan...',
      timestamp: new Date(Date.now() - 3600000 * 24).toISOString(),
      messageCount: 12
    },
    {
      id: 'SES-003',
      title: 'Downtown Dubai Villa',
      preview: 'Family relocation, 4BR villa with pool...',
      timestamp: new Date(Date.now() - 3600000 * 48).toISOString(),
      messageCount: 6
    }
  ]);
  const [activeSessionId, setActiveSessionId] = useState<string>('current');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
    }
  }, [inputText]);

  // Save current session when messages grow
  useEffect(() => {
    if (messages.length >= 3) {
      const firstUserMsg = messages.find(m => m.role === 'user');
      if (firstUserMsg) {
        const sessionTitle = firstUserMsg.content.slice(0, 40) + (firstUserMsg.content.length > 40 ? '...' : '');
        setSavedSessions(prev => {
          const exists = prev.find(s => s.id === 'current');
          const session: SavedSession = {
            id: 'current',
            title: sessionTitle,
            preview: messages[messages.length - 1]?.content?.slice(0, 60) + '...',
            timestamp: new Date().toISOString(),
            messageCount: messages.length
          };
          if (exists) return prev.map(s => s.id === 'current' ? session : s);
          return [session, ...prev];
        });
      }
    }
  }, [messages]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isLoading) return;
    onSendMessage(inputText.trim(), {
      groqApiKey: groqKeyInput.trim() || undefined,
      groqModel: activeModel
    });
    setInputText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSpeak = (id: string, text: string) => {
    if (!('speechSynthesis' in window)) return;
    if (speakingId === id) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      return;
    }
    window.speechSynthesis.cancel();
    const cleanText = text.replace(/[*#_`]/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);
    setSpeakingId(id);
    window.speechSynthesis.speak(utterance);
  };

  const toggleSpeechRecognition = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      alert('Speech recognition is not supported in this browser.');
      return;
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    if (isListening) {
      recognition.stop();
      setIsListening(false);
      return;
    }
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInputText(prev => prev ? `${prev} ${transcript}` : transcript);
      setIsListening(false);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognition.start();
  };

    const handleGoogleSignIn = async () => {
    setAuthLoading(true);
    setAuthError('');
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      setUserName(result.user.displayName || 'Customer');
      setUserEmail(result.user.email || '');
      setUserLoggedIn(true);
      setShowAuthModal(false);
      
      // Save specifically to the user-login collection
      await saveUserLoginToFirestore(
        result.user.uid,
        result.user.email || '',
        result.user.displayName || 'Customer',
        'Google'
      );
      
      if (onUpdateLead) {
        onUpdateLead({
          id: result.user.uid,
          full_name: result.user.displayName || undefined,
          email: result.user.email || undefined
        });
      }
    } catch (error: any) {
      setAuthError(error.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    
    if (!userEmail.includes('@')) {
      setAuthError('Please enter a valid email address.');
      setAuthLoading(false);
      return;
    }
    if (userPassword.length < 6) {
      setAuthError('Password must be at least 6 characters.');
      setAuthLoading(false);
      return;
    }

    try {
      let finalUserName = '';
      let userId = '';
      let finalAge: number | undefined = undefined;

      if (authMode === 'signup') {
        if (userFullName.trim().length < 2) {
          setAuthError('Please enter your full name.');
          setAuthLoading(false);
          return;
        }
        const age = Number(userAge);
        if (!userAge.trim() || !Number.isInteger(age) || age < 18 || age > 120) {
          setAuthError('Please enter a valid age between 18 and 120.');
          setAuthLoading(false);
          return;
        }
        finalAge = age;

        // Real Firebase Sign Up (Encrypted Password)
        const userCredential = await createUserWithEmailAndPassword(auth, userEmail, userPassword);
        userId = userCredential.user.uid;
        finalUserName = userFullName.trim();
        
      } else {
        // Real Firebase Sign In
        const userCredential = await signInWithEmailAndPassword(auth, userEmail, userPassword);
        userId = userCredential.user.uid;
        finalUserName = userCredential.user.displayName || userEmail.split('@')[0];
      }
      
      setUserLoggedIn(true);
      setUserName(finalUserName);
      setShowAuthModal(false);
      
      // Save to user-login collection (Password is NEVER stored here!)
      await saveUserLoginToFirestore(
        userId,
        userEmail,
        finalUserName,
        'Email/Password',
        finalAge
      );
      
      if (onUpdateLead) {
        onUpdateLead({
          id: userId,
          full_name: finalUserName,
          email: userEmail
        });
      }
    } catch (error: any) {
      // Handle standard Firebase errors gracefully
      if (error.code === 'auth/email-already-in-use') {
        setAuthError('This email is already registered. Please sign in instead.');
      } else if (error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
        setAuthError('Invalid email or password.');
      } else {
        setAuthError(error.message);
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    const now = new Date();
    const diffH = Math.floor((now.getTime() - d.getTime()) / 3600000);
    if (diffH < 1) return 'Just now';
    if (diffH < 24) return `${diffH}h ago`;
    return `${Math.floor(diffH / 24)}d ago`;
  };

  const promptCards = [
    {
      title: 'Say "Hi" to Concierge',
      desc: 'Warm welcome from Lyka Realty',
      icon: <Sparkles className="w-4 h-4 text-amber-600" />,
      prompt: 'Hi, I am looking for properties with Lyka Realty.'
    },
    {
      title: 'Buy Waterfront 2BR',
      desc: 'Dubai Marina ~AED 1.8M',
      icon: <Building2 className="w-4 h-4 text-emerald-400" />,
      prompt: 'I want to buy a 2-bedroom apartment in Dubai Marina around AED 1.8M ready to move in.'
    },
    {
      title: 'High ROI Off-Plan',
      desc: 'Business Bay, 80/20 plan',
      icon: <Coins className="w-4 h-4 text-amber-700" />,
      prompt: 'I am an investor looking for high rental yield off-plan properties in Business Bay.'
    },
    {
      title: 'NRI Investment',
      desc: 'Mumbai or Dubai comparison',
      icon: <Compass className="w-4 h-4 text-cyan-400" />,
      prompt: 'I am an NRI from Mumbai comparing luxury 3BHK in Worli vs Dubai tax-free yields.'
    }
  ];

  const filteredSessions = savedSessions.filter(s =>
    s.title.toLowerCase().includes(sessionSearch.toLowerCase()) ||
    s.preview.toLowerCase().includes(sessionSearch.toLowerCase())
  );

  return (
    <div className="flex-1 flex h-full overflow-hidden bg-[#ffffff] font-sans">

      {/* ═══════════════════════════════════════════════════
          LEFT PANEL — User Auth + Chat History
      ═══════════════════════════════════════════════════ */}
      <div className={`flex flex-col border-r border-[#f3ede0] bg-[#ffffff] transition-all duration-300 ${
        leftPanelCollapsed ? 'w-14' : 'w-72'
      } shrink-0 h-full overflow-hidden`}>

        {/* Panel Header */}
        <div className="h-14 border-b border-[#f3ede0] flex items-center justify-between px-3 shrink-0">
          {!leftPanelCollapsed && (
            <div className="flex items-center">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Menu</span>
            </div>
          )}
          <button
            onClick={() => setLeftPanelCollapsed(prev => !prev)}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-[#f3ede0] transition-colors ml-auto"
            title={leftPanelCollapsed ? 'Expand panel' : 'Collapse panel'}
          >
            {leftPanelCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {leftPanelCollapsed ? (
          /* Collapsed icon rail */
          <div className="flex flex-col items-center py-4 space-y-3">
            <button
              onClick={() => setLeftPanelCollapsed(false)}
              className="p-2 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-[#f3ede0] transition-colors"
              title="User Account"
            >
              <UserCircle className="w-5 h-5" />
            </button>
            <button
              onClick={() => setLeftPanelCollapsed(false)}
              className="p-2 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-[#f3ede0] transition-colors"
              title="Chat History"
            >
              <Clock className="w-5 h-5" />
            </button>
            <button
              onClick={() => onSendMessage('Hi, I am looking for properties with Lyka Realty.', {})}
              className="p-2 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-[#f3ede0] transition-colors"
              title="New Chat"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">

            {/* ─── NEW CHAT BUTTON ─── */}
            <div className="p-3 shrink-0">
              <button
                onClick={() => onSendMessage('Hi, I am looking for properties with Lyka Realty.', {})}
                className="w-full flex items-center justify-center space-x-2 bg-[#f3ede0] hover:bg-[#eee6d3] border border-[#e2d9c6] hover:border-amber-500/40 text-slate-300 hover:text-slate-300 py-2 rounded-xl text-xs font-semibold transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Conversation</span>
              </button>
            </div>

            {/* ─── CHAT HISTORY ─── */}
            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="px-3 pb-2 shrink-0">
                <div className="flex items-center space-x-1.5 mb-2">
                  <Clock className="w-3 h-3 text-slate-500" />
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Saved Chats</span>
                </div>
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-600" />
                  <input
                    type="text"
                    value={sessionSearch}
                    onChange={e => setSessionSearch(e.target.value)}
                    placeholder="Search chats..."
                    className="w-full bg-[#ffffff] border border-[#f3ede0] rounded-lg pl-6 pr-2 py-1.5 text-[10px] text-slate-300 placeholder-slate-600 outline-none"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1">
                {/* Current active chat */}
                {messages.length > 1 && (
                  <button
                    onClick={() => setActiveSessionId('current')}
                    className={`w-full text-left p-2.5 rounded-xl border transition-all group ${
                      activeSessionId === 'current'
                        ? 'bg-amber-500/10 border-amber-500/40 text-slate-300'
                        : 'bg-transparent border-transparent hover:bg-[#f3ede0] hover:border-[#e2d9c6] text-slate-400'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${activeSessionId === 'current' ? 'text-amber-600' : 'text-slate-600'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-semibold truncate">Current Chat</p>
                        <p className="text-[9px] text-slate-500 truncate">{messages[messages.length - 1]?.content?.slice(0, 35)}...</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-[9px] text-slate-600">{messages.length} msgs</span>
                      <span className="text-[9px] text-slate-600">Now</span>
                    </div>
                  </button>
                )}

                {/* Saved sessions */}
                {filteredSessions.length === 0 && sessionSearch && (
                  <p className="text-[10px] text-slate-600 text-center py-4">No chats found</p>
                )}
                {filteredSessions.map(session => (
                  <button
                    key={session.id}
                    onClick={() => setActiveSessionId(session.id)}
                    className={`w-full text-left p-2.5 rounded-xl border transition-all group ${
                      activeSessionId === session.id
                        ? 'bg-amber-500/10 border-amber-500/40 text-slate-300'
                        : 'bg-transparent border-transparent hover:bg-[#f3ede0] hover:border-[#e2d9c6] text-slate-400'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${activeSessionId === session.id ? 'text-amber-600' : 'text-slate-600'}`} />
                      <p className="text-[11px] font-semibold truncate flex-1">{session.title}</p>
                    </div>
                    <p className="text-[9px] text-slate-500 truncate mt-1 ml-5">{session.preview}</p>
                    <div className="flex items-center justify-between mt-1 ml-5">
                      <span className="text-[9px] text-slate-600">{session.messageCount} msgs</span>
                      <span className="text-[9px] text-slate-600">{formatTime(session.timestamp)}</span>
                    </div>
                  </button>
                ))}

                {!userLoggedIn && savedSessions.length > 0 && (
                  <div className="mt-2 p-2.5 bg-[#f7f2e6] border border-dashed border-[#e2d9c6] rounded-xl text-center">
                    <p className="text-[9px] text-slate-500">Sign in to sync chat history across devices</p>
                  </div>
                )}
              </div>
            </div>

            {/* ─── BOTTOM MENU / PROFILE BUTTON ─── */}
            <div className="p-3 border-t border-[#f3ede0] shrink-0 bg-[#f7f2e6]">
              <button
                onClick={() => setShowAuthModal(true)}
                className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-white transition-colors border border-transparent hover:border-[#e2d9c6]"
              >
                <div className="flex items-center space-x-2">
                  <UserCircle className="w-5 h-5 text-slate-500" />
                  <div className="text-left">
                    <p className="text-[11px] font-bold text-slate-700">{userLoggedIn ? userName : 'Account'}</p>
                    <p className="text-[9px] text-slate-500">{userLoggedIn ? 'Manage Profile' : 'Sign In / Sign Up'}</p>
                  </div>
                </div>
                <ChevronUp className="w-4 h-4 text-slate-400" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════
          RIGHT PANEL — Main Chat Area
      ═══════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#ffffff] text-[#3a2e20]">

        {/* Chat Header */}
        <div className="h-14 border-b border-[#f3ede0] px-4 sm:px-5 flex items-center justify-between bg-[#ffffff]/95 backdrop-blur-md shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-400 via-amber-500 to-yellow-300 flex items-center justify-center text-amber-950 shadow-sm shadow-amber-500/20">
              <Sparkles className="w-4 h-4 fill-slate-950" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-semibold text-slate-300">Lyka Realty AI</span>
                <button
                  onClick={() => setShowSettingsModal(true)}
                  className="flex items-center space-x-1 text-[10px] bg-[#f7f2e6] hover:bg-[#eee6d3] text-amber-700 border border-[#d6cbb4] px-2 py-0.5 rounded-full font-mono transition-colors"
                  title="Configure AI Engine"
                >
                  <Zap className="w-3 h-3 text-amber-600" />
                  <span>{engineProvider === 'groq' ? `Groq · ${activeModel.split('-').slice(0,2).join('-')}` : 'Gemini 2.5'}</span>
                </button>
              </div>
              <p className="text-[10px] text-slate-500">Dubai Property Intelligence Engine</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowSettingsModal(true)}
              className="p-1.5 rounded-full bg-[#f7f2e6] hover:bg-[#eee6d3] text-[#6b5843] hover:text-slate-300 border border-[#d6cbb4] transition-colors"
              title="AI Settings"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onOpenAgentHandoff}
              className="hidden sm:flex items-center space-x-1.5 text-xs bg-[#f7f2e6] hover:bg-[#eee6d3] text-[#3a2e20] border border-[#d6cbb4] px-3 py-1.5 rounded-full transition-colors font-medium"
            >
              <PhoneCall className="w-3.5 h-3.5 text-amber-600" />
              <span>Talk to Agent</span>
            </button>
            <button
              onClick={onToggleSidebar}
              className={`flex items-center space-x-1.5 text-xs px-3 py-1.5 rounded-full border transition-all ${
                sidebarOpen
                  ? 'bg-amber-500 text-amber-950 border-amber-400 font-bold'
                  : 'bg-[#f7f2e6] hover:bg-[#eee6d3] text-[#3a2e20] border-[#d6cbb4] font-medium'
              }`}
              title="CRM Lead Profile"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">CRM ({currentLead.requirement_completeness}%)</span>
            </button>
          </div>
        </div>

        {/* ─── Conversation Stream ─── */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-6">
          <div className="max-w-2xl mx-auto w-full space-y-6">

            {/* Welcome Hero */}
            {messages.length <= 1 && (
              <div className="py-6 sm:py-10 space-y-6 animate-fade-in">
                <div className="space-y-3">
                  <div className="flex items-center justify-center mb-4">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-400 via-amber-500 to-yellow-300 flex items-center justify-center text-amber-950 shadow-xl shadow-amber-500/20">
                      <Sparkles className="w-8 h-8 fill-slate-950" />
                    </div>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-semibold bg-gradient-to-r from-amber-300 via-amber-400 to-yellow-200 bg-clip-text text-transparent text-center">
                    Hello{userLoggedIn ? `, ${userName}` : ''}! Welcome to Lyka Realty.
                  </h1>
                  <p className="text-sm text-[#6b5843] leading-relaxed text-center max-w-lg mx-auto">
                    I'm your AI Property Advisor for Dubai & prime India corridors. Tell me what you're looking for — I'll qualify your requirements and find matching verified properties.
                  </p>
                </div>

                {/* Prompt Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  {promptCards.map((card, i) => (
                    <div
                      key={i}
                      onClick={() => onSendMessage(card.prompt, { groqApiKey: groqKeyInput.trim() || undefined, groqModel: activeModel })}
                      className="bg-[#f7f2e6] hover:bg-[#eee6d3] border border-[#d6cbb4] hover:border-amber-400/50 p-4 rounded-2xl cursor-pointer transition-all duration-200 flex flex-col justify-between space-y-2 group"
                    >
                      <div className="flex items-start justify-between">
                        <span className="font-semibold text-slate-300 text-xs group-hover:text-amber-700 transition-colors">
                          {card.title}
                        </span>
                        <div className="p-1.5 rounded-lg bg-[#ffffff] border border-[#d6cbb4] group-hover:border-amber-400/40 transition-colors">
                          {card.icon}
                        </div>
                      </div>
                      <p className="text-[11px] text-[#6b5843] leading-relaxed">{card.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Messages */}
            {messages.map((msg) => (
              <div key={msg.id} className="space-y-2">
                {msg.role === 'user' ? (
                  <div className="flex justify-end items-end space-x-2">
                    <div className="bg-[#eee6d3] text-slate-300 px-4 py-3 rounded-3xl rounded-tr-md max-w-md text-sm leading-relaxed border border-[#d6cbb4]/50 shadow-sm">
                      {msg.content}
                    </div>
                    {/* User avatar */}
                    <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-violet-500 to-purple-400 flex items-center justify-center text-white font-bold text-xs shrink-0">
                      {userLoggedIn ? userName[0]?.toUpperCase() : 'U'}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-400 to-yellow-300 flex items-center justify-center text-amber-950 shrink-0 mt-0.5 shadow-md">
                      <Sparkles className="w-4 h-4 fill-slate-950" />
                    </div>

                    <div className="flex-1 space-y-3 min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-semibold text-slate-300">Lyka Realty AI</span>
                        {msg.provider && (
                          <span className="text-[10px] bg-[#f7f2e6] text-amber-700/90 border border-[#d6cbb4] px-2 py-0.5 rounded-full font-mono">
                            {msg.provider}
                          </span>
                        )}
                        <span className="text-[10px] text-[#6b5843]">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      {/* Agentic Thinking */}
                      {msg.agentic_decision && (
                        <div>
                          <button
                            onClick={() => setExpandedThoughtId(expandedThoughtId === msg.id ? null : msg.id)}
                            className="flex items-center space-x-1.5 text-xs text-[#6b5843] hover:text-amber-600 transition-colors py-1 px-2.5 rounded-lg bg-[#f7f2e6] border border-[#d6cbb4]"
                          >
                            <Brain className="w-3.5 h-3.5 text-amber-600" />
                            <span className="font-medium">
                              Reasoning • Intent: <strong className="text-slate-300">{msg.agentic_decision.intent_detected}</strong>
                            </span>
                            {expandedThoughtId === msg.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>

                          {expandedThoughtId === msg.id && (
                            <div className="mt-2 bg-[#f7f2e6] border border-[#d6cbb4] rounded-2xl p-4 text-xs space-y-2.5 text-[#5a4835]">
                              <div className="flex items-center justify-between pb-2 border-b border-[#d6cbb4]">
                                <span className="text-[#6b5843]">Intent:</span>
                                <span className="font-bold text-amber-700">
                                  {msg.agentic_decision.intent_detected} ({msg.agentic_decision.confidence}%)
                                </span>
                              </div>
                              <div>
                                <span className="text-[#6b5843] block mb-1">Reasoning:</span>
                                <p className="bg-[#ffffff] p-2.5 rounded-xl border border-[#eee6d3] leading-relaxed">
                                  {msg.agentic_decision.rationale}
                                </p>
                              </div>
                              <div className="flex items-center justify-between pt-1">
                                <span className="text-[#6b5843]">Next Step:</span>
                                <span className="text-emerald-400 font-semibold">{msg.agentic_decision.next_question_intent}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Message Body */}
                      <div className="text-sm text-[#3a2e20] leading-relaxed whitespace-pre-wrap">
                        {msg.content}
                      </div>

                      {/* Property Cards */}
                      {msg.recommended_properties && msg.recommended_properties.length > 0 && (
                        <div className="pt-3 space-y-3">
                          <div className="flex items-center space-x-1.5 text-xs font-bold text-amber-600 uppercase tracking-wider">
                            <Building2 className="w-4 h-4" />
                            <span>Matching Properties ({msg.recommended_properties.length})</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {msg.recommended_properties.map((prop) => (
                              <div
                                key={prop.id}
                                className="bg-[#f7f2e6] border border-[#d6cbb4] hover:border-amber-400/60 rounded-2xl overflow-hidden transition-all duration-200 group flex flex-col"
                              >
                                <div className="relative h-32 overflow-hidden">
                                  <img
                                    src={prop.image_url}
                                    alt={prop.title}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  />
                                  <div className="absolute top-2 left-2 flex items-center space-x-1">
                                    <span className="bg-amber-500/90 text-amber-950 px-1.5 py-0.5 rounded text-[9px] font-black">
                                      {prop.city || 'Dubai'}
                                    </span>
                                    <span className="bg-[#ffffff]/90 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-bold text-amber-600 border border-[#d6cbb4]">
                                      {prop.community}
                                    </span>
                                  </div>
                                </div>
                                <div className="p-3 space-y-1 flex-1">
                                  <div className="flex items-baseline justify-between">
                                    <span className="text-sm font-extrabold text-amber-600">
                                      AED {prop.price_aed.toLocaleString()}
                                    </span>
                                    <span className="text-[10px] text-slate-400">{prop.bedrooms} BR · {prop.size_sqft} sqft</span>
                                  </div>
                                  <h4 className="font-bold text-slate-300 text-xs line-clamp-1 group-hover:text-amber-700 transition-colors">{prop.title}</h4>
                                  <p className="text-[11px] text-[#6b5843] line-clamp-2">{prop.description}</p>
                                  <div className="text-[10px] text-emerald-400 font-semibold">{prop.expected_roi || 'High Capital Upside'}</div>
                                </div>
                                <div className="p-3 pt-0 border-t border-[#eee6d3] flex items-center justify-between">
                                  <span className="text-[10px] text-[#6b5843]">{prop.developer}</span>
                                  <button
                                    onClick={() => onBookViewing(prop)}
                                    className="bg-amber-500 hover:bg-amber-400 text-amber-950 font-bold px-3 py-1 rounded-xl text-xs transition-colors flex items-center space-x-1"
                                  >
                                    <Calendar className="w-3 h-3" />
                                    <span>Book</span>
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Action Bar */}
                      <div className="flex items-center space-x-1 pt-1 text-[#6b5843]">
                        <button onClick={() => handleCopy(msg.id, msg.content)} className="p-1.5 hover:text-slate-300 rounded-lg hover:bg-[#f7f2e6] transition-colors" title="Copy">
                          {copiedId === msg.id ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                        </button>
                        <button onClick={() => handleSpeak(msg.id, msg.content)} className={`p-1.5 rounded-lg hover:bg-[#f7f2e6] transition-colors ${speakingId === msg.id ? 'text-amber-600' : 'hover:text-slate-300'}`} title="Listen">
                          {speakingId === msg.id ? <VolumeX className="w-4 h-4 animate-pulse" /> : <Volume2 className="w-4 h-4" />}
                        </button>
                        <button onClick={() => setLikedMap(prev => ({ ...prev, [msg.id]: !prev[msg.id] }))} className={`p-1.5 rounded-lg hover:bg-[#f7f2e6] transition-colors ${likedMap[msg.id] ? 'text-amber-600' : 'hover:text-slate-300'}`} title="Good response">
                          <ThumbsUp className="w-4 h-4" />
                        </button>
                        <button onClick={onOpenAgentHandoff} className="p-1.5 hover:text-amber-600 rounded-lg hover:bg-[#f7f2e6] transition-colors" title="Escalate to Agent">
                          <PhoneCall className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Loading */}
            {isLoading && (
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-400 to-yellow-300 flex items-center justify-center text-amber-950 shrink-0 animate-pulse">
                  <Sparkles className="w-4 h-4 fill-slate-950" />
                </div>
                <div className="space-y-2 pt-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-semibold text-slate-300">Lyka Realty AI</span>
                    <span className="text-[10px] text-amber-600 animate-pulse">Analyzing requirements...</span>
                  </div>
                  <div className="flex space-x-1.5 py-1">
                    <div className="w-2 h-2 rounded-full bg-amber-400 animate-bounce"></div>
                    <div className="w-2 h-2 rounded-full bg-amber-400 animate-bounce [animation-delay:0.2s]"></div>
                    <div className="w-2 h-2 rounded-full bg-amber-400 animate-bounce [animation-delay:0.4s]"></div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* ─── Input Bar ─── */}
        <div className="p-4 sm:p-5 bg-gradient-to-t from-[#ffffff] via-[#ffffff]/95 to-transparent shrink-0">
          <div className="max-w-2xl mx-auto w-full">
            <form
              onSubmit={handleSubmit}
              className="bg-[#f7f2e6] border border-[#d6cbb4] focus-within:border-amber-400/70 rounded-3xl p-2 sm:p-2.5 flex items-end space-x-2 shadow-2xl transition-all duration-200"
            >
              <textarea
                ref={textareaRef}
                rows={1}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about Dubai properties, investment yields, communities..."
                disabled={isLoading}
                className="flex-1 bg-transparent border-0 px-3 py-1.5 text-sm text-slate-300 placeholder-[#6b5843] outline-none resize-none leading-relaxed min-h-[36px] max-h-[140px]"
              />
              <button
                type="button"
                onClick={toggleSpeechRecognition}
                className={`p-2 rounded-full transition-all ${
                  isListening ? 'bg-rose-500 text-white animate-pulse' : 'text-[#6b5843] hover:text-white hover:bg-[#eee6d3]'
                }`}
                title={isListening ? 'Listening... stop' : 'Voice input'}
              >
                {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>
              <button
                type="submit"
                disabled={!inputText.trim() || isLoading}
                className="p-2 rounded-full bg-amber-500 hover:bg-amber-400 disabled:opacity-30 text-amber-950 transition-all shrink-0 font-bold"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
            <p className="text-[10px] text-[#6b5843] text-center mt-2">
              Lyka Realty AI · <span className="text-amber-600/80 font-mono">{engineProvider === 'groq' ? `Groq (${activeModel})` : 'Gemini 2.5 Flash'}</span> · Verified Dubai & Mumbai Inventory
            </p>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════
          Settings Modal
      ═══════════════════════════════════════════════════ */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#f7f2e6] border border-[#d6cbb4] rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#d6cbb4]">
              <div className="flex items-center space-x-2">
                <Cpu className="w-5 h-5 text-amber-600" />
                <h3 className="text-base font-bold text-slate-300">AI Engine Configuration</h3>
              </div>
              <button onClick={() => setShowSettingsModal(false)} className="p-1 rounded-full text-[#6b5843] hover:text-slate-300 hover:bg-[#eee6d3]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="text-[#6b5843] block mb-1.5 font-semibold">Engine Provider:</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['groq', 'gemini'] as const).map(provider => (
                    <button
                      key={provider}
                      type="button"
                      onClick={() => setEngineProvider(provider)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        engineProvider === provider
                          ? 'bg-amber-500/20 border-amber-500 text-amber-700 font-bold'
                          : 'bg-[#ffffff] border-[#d6cbb4] text-[#6b5843]'
                      }`}
                    >
                      <div className="flex items-center space-x-1.5">
                        {provider === 'groq' ? <Zap className="w-4 h-4 text-amber-600" /> : <Sparkles className="w-4 h-4 text-amber-600" />}
                        <span>{provider === 'groq' ? 'Groq High-Speed' : 'Gemini 2.5 Flash'}</span>
                      </div>
                      <p className="text-[10px] text-[#6b5843] mt-1">{provider === 'groq' ? 'Llama 3.3 70B, Mixtral' : 'Multimodal Reasoning'}</p>
                    </button>
                  ))}
                </div>
              </div>

              {engineProvider === 'groq' && (
                <>
                  <div>
                    <label className="text-[#6b5843] block mb-1 font-semibold">Model:</label>
                    <select
                      value={activeModel}
                      onChange={(e) => setActiveModel(e.target.value)}
                      className="w-full bg-[#ffffff] border border-[#d6cbb4] rounded-xl p-2.5 text-slate-300 outline-none focus:border-amber-400"
                    >
                      <option value="llama-3.3-70b-versatile">llama-3.3-70b-versatile (Recommended)</option>
                      <option value="llama-3.1-8b-instant">llama-3.1-8b-instant (Fastest)</option>
                      <option value="mixtral-8x7b-32768">mixtral-8x7b-32768 (High context)</option>
                      <option value="gemma2-9b-it">gemma2-9b-it</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[#6b5843] block mb-1 font-semibold">Custom Groq API Key (Optional):</label>
                    <input
                      type="password"
                      value={groqKeyInput}
                      onChange={(e) => setGroqKeyInput(e.target.value)}
                      placeholder="gsk_..."
                      className="w-full bg-[#ffffff] border border-[#d6cbb4] rounded-xl p-2.5 text-slate-300 font-mono placeholder-[#7a6650] outline-none focus:border-amber-400"
                    />
                    <p className="text-[10px] text-[#6b5843] mt-1">Leave blank to use server <code className="text-amber-600">GROQ_API_KEY</code>.</p>
                  </div>
                </>
              )}

              <div className="bg-[#ffffff] p-3 rounded-xl border border-[#d6cbb4] space-y-1 text-[11px] text-[#6b5843]">
                <div className="flex items-center space-x-1.5 text-slate-300 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Agentic Greeting Behavior:</span>
                </div>
                <p>When a customer says "hi", the assistant greets warmly on behalf of Lyka Realty and asks about buy/rent/invest intent.</p>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowSettingsModal(false)}
                className="bg-amber-500 hover:bg-amber-400 text-amber-950 font-bold px-5 py-2 rounded-xl text-xs transition-colors"
              >
                Save & Close
              </button>
            </div>
          </div>
        </div>
      )}
    
      {/* ─── AUTH MODAL ─── */}
      {showAuthModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-[#ffffff] rounded-2xl w-full max-w-sm shadow-2xl border border-[#e2d9c6] overflow-hidden flex flex-col relative">
            <div className="flex justify-between items-center p-4 border-b border-[#f3ede0] bg-[#f7f2e6]">
              <h3 className="font-bold text-slate-700">Account</h3>
              <button onClick={() => setShowAuthModal(false)} className="text-slate-400 hover:text-slate-700 p-1 bg-white rounded-md border border-[#e2d9c6]">
                <X className="w-4 h-4" />
              </button>
            </div>
            {/* ─── USER AUTH SECTION ─── */}
            <div className="p-4">
              {!userLoggedIn ? (
                <div className="space-y-3">
                  <div className="flex items-center space-x-2 mb-2">
                    <div className="w-8 h-8 rounded-full bg-[#f3ede0] border border-[#e2d9c6] flex items-center justify-center">
                      <User className="w-4 h-4 text-slate-400" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-300">Welcome</p>
                      <p className="text-[10px] text-slate-500">Sign in to save chats</p>
                    </div>
                  </div>

                  {/* Auth Tabs */}
                  <div className="flex bg-[#ffffff] rounded-lg p-0.5 border border-[#f3ede0]">
                    {(['login', 'signup'] as const).map(mode => (
                      <button
                        key={mode}
                        onClick={() => { setAuthMode(mode); setAuthError(''); }}
                        className={`flex-1 text-[10px] font-semibold py-1.5 rounded-md transition-all capitalize ${
                          authMode === mode
                            ? 'bg-amber-500 text-amber-950'
                            : 'text-slate-400 hover:text-slate-300'
                        }`}
                      >
                        {mode === 'login' ? 'Sign In' : 'Sign Up'}
                      </button>
                    ))}
                  </div>

                  {/* Auth Form */}
                  <form onSubmit={handleAuth} className="space-y-2">
                    {authMode === 'signup' && (
                      <>
                        <div className="relative">
                          <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                          <input
                            type="text"
                            value={userFullName}
                            onChange={e => { setUserFullName(e.target.value); setAuthError(''); }}
                            placeholder="Full name"
                            autoComplete="name"
                            required
                            className="w-full bg-[#ffffff] border border-[#e2d9c6] focus:border-amber-500/60 rounded-lg pl-8 pr-3 py-2 text-[11px] text-slate-300 placeholder-slate-600 outline-none transition-colors"
                          />
                        </div>
                        <div className="relative">
                          <UserCircle className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                          <input
                            type="number"
                            min={18}
                            max={120}
                            inputMode="numeric"
                            value={userAge}
                            onChange={e => { setUserAge(e.target.value); setAuthError(''); }}
                            placeholder="Age"
                            required
                            className="w-full bg-[#ffffff] border border-[#e2d9c6] focus:border-amber-500/60 rounded-lg pl-8 pr-3 py-2 text-[11px] text-slate-300 placeholder-slate-600 outline-none transition-colors"
                          />
                        </div>
                      </>
                    )}
                    <div className="relative">
                      <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                      <input
                        type="email"
                        value={userEmail}
                        onChange={e => { setUserEmail(e.target.value); setAuthError(''); }}
                        placeholder="Email address"
                        required
                        className="w-full bg-[#ffffff] border border-[#e2d9c6] focus:border-amber-500/60 rounded-lg pl-8 pr-3 py-2 text-[11px] text-slate-300 placeholder-slate-600 outline-none transition-colors"
                      />
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={userPassword}
                        onChange={e => { setUserPassword(e.target.value); setAuthError(''); }}
                        placeholder="Password"
                        required
                        className="w-full bg-[#ffffff] border border-[#e2d9c6] focus:border-amber-500/60 rounded-lg pl-8 pr-8 py-2 text-[11px] text-slate-300 placeholder-slate-600 outline-none transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(p => !p)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>

                    {authError && (
                      <p className="text-[10px] text-red-400 bg-red-100/70 border border-red-300 rounded-lg px-2 py-1.5">
                        {authError}
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={authLoading}
                      className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-amber-950 font-bold py-2 rounded-lg text-[11px] transition-colors flex items-center justify-center space-x-1.5"
                    >
                      {authLoading ? (
                        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      ) : (
                        <LogIn className="w-3.5 h-3.5" />
                      )}
                      <span>{authLoading ? 'Signing in...' : authMode === 'login' ? 'Sign In' : 'Create Account'}</span>
                    </button>
                  </form>

                  <div className="flex items-center my-3">
                    <div className="flex-grow border-t border-slate-700"></div>
                    <span className="mx-2 text-[10px] font-bold text-slate-300">OR</span>
                    <div className="flex-grow border-t border-slate-700"></div>
                  </div>

                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={authLoading}
                    className="w-full bg-white hover:bg-slate-200 text-black font-bold py-2 rounded-lg text-[12px] transition-colors flex items-center justify-center space-x-2 shadow-sm"
                  >
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-4 h-4" alt="Google" />
                    <span>Continue with Google</span>
                  </button>

                  <p className="text-[9px] text-slate-600 text-center mt-3">
                    Chat continues as guest without sign-in
                  </p>
                </div>
              ) : (
                /* Logged-in User Card */
                <div className="flex items-center space-x-2.5 p-2 bg-[#f7f2e6] rounded-xl border border-[#e2d9c6]">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-300 flex items-center justify-center text-amber-950 font-black text-sm shrink-0">
                    {userName[0]?.toUpperCase() || 'U'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-300 truncate">{userName}</p>
                    <p className="text-[10px] text-emerald-400 flex items-center space-x-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"></span>
                      <span>Active session</span>
                    </p>
                  </div>
                  <button
                    onClick={() => { setUserLoggedIn(false); setUserEmail(''); setUserPassword(''); setUserName(''); setUserFullName(''); setUserAge(''); }}
                    className="p-1 rounded-md text-slate-500 hover:text-red-400 hover:bg-red-100/70 transition-colors"
                    title="Sign out"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            
          </div>
        </div>
      )}
</div>
  );
};
