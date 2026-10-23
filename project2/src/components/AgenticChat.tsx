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
  Search,
  LogOut,
  Trash2,
  AlertTriangle,
  Pencil,
  Save,
  MapPin,
  Bed,
  Bath,
  Maximize2,
  ShieldCheck,
  KeyRound,
  Bell
} from 'lucide-react';
import { 
  auth, 
  saveUserLoginToFirestore, 
  getUserProfileFromFirestore,
  updateUserProfileInFirestore,
  deleteUserLoginFromFirestore,
  getUserLeadsFromFirestore,
  getMessagesForLead,
  deleteLeadFromFirestore,
  deleteMessagesForLead,
  getUserChatSessionsFromFirestore,
  syncSessionToUserProfile,
  saveUserChatToFirestore,
  deleteSessionFromUserProfile
} from '../lib/firebase';
import { 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  updateEmail,
  updateProfile
} from 'firebase/auth';

interface SavedSession {
  id: string;
  title: string;
  preview: string;
  timestamp: string;
  messageCount: number;
  leadProfile: LeadProfile;
  messages: ChatMessage[];
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
  onAuthChange?: (userId: string | null, email?: string) => void;
  onLoadChat?: (lead: LeadProfile, msgs: ChatMessage[]) => void;
  onDeleteChat?: (leadId: string) => void;
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
  onStartNewChat,
  onAuthChange,
  onLoadChat,
  onDeleteChat
}) => {
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [expandedThoughtId, setExpandedThoughtId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [likedMap, setLikedMap] = useState<Record<string, boolean>>({});

  // Property details square modal state (left-side view)
  const [selectedDetailProperty, setSelectedDetailProperty] = useState<PropertyListing | null>(null);

  // Model & AI Engine configuration state
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [activeModel, setActiveModel] = useState<string>('llama-3.3-70b-versatile');
  const [groqKeyInput, setGroqKeyInput] = useState<string>('');
  const [engineProvider, setEngineProvider] = useState<'groq' | 'gemini'>('groq');

  // Left sidebar: user login & chat history
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  // Mobile sidebar drawer: toggles left panel as an overlay on small screens
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showProfileTooltip, setShowProfileTooltip] = useState(false);
  const [userLoggedIn, setUserLoggedIn] = useState(false);
  const [authNotification, setAuthNotification] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');
  const [userFullName, setUserFullName] = useState('');
  const [userAge, setUserAge] = useState('');
  const [userId, setUserId] = useState('');
  const [authProviderName, setAuthProviderName] = useState<'Google' | 'Email' | ''>('');
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [showEmailUpdateModal, setShowEmailUpdateModal] = useState(false);
  const [newEmailInput, setNewEmailInput] = useState('');
  const [emailUpdateError, setEmailUpdateError] = useState('');
  const [emailUpdateLoading, setEmailUpdateLoading] = useState(false);
  
  // Sign up OTP verification states (Passwordless)
  const [signupOtpSent, setSignupOtpSent] = useState(false);
  const [signupOtpInput, setSignupOtpInput] = useState('');
  const [signupOtpLoading, setSignupOtpLoading] = useState(false);
  const [signupOtpTimeRemaining, setSignupOtpTimeRemaining] = useState(180);
  const [signupOtpSuccessMsg, setSignupOtpSuccessMsg] = useState('');

  // Update Email OTP verification states in Manage Profile
  const [emailUpdateOtpSent, setEmailUpdateOtpSent] = useState(false);
  const [emailUpdateOtpInput, setEmailUpdateOtpInput] = useState('');
  const [emailUpdateOtpLoading, setEmailUpdateOtpLoading] = useState(false);
  const [emailUpdateOtpTimeRemaining, setEmailUpdateOtpTimeRemaining] = useState(180);

  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'google_signup'>('login');
  const [pendingGoogleUser, setPendingGoogleUser] = useState<{
    uid: string;
    email: string;
    displayName: string;
  } | null>(null);
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [sessionSearch, setSessionSearch] = useState('');

  // Edit profile (Name & Age) state
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editNameInput, setEditNameInput] = useState('');
  const [editAgeInput, setEditAgeInput] = useState('');
  const [editProfileLoading, setEditProfileLoading] = useState(false);
  const [editProfileError, setEditProfileError] = useState('');
  const [editProfileSuccess, setEditProfileSuccess] = useState('');

  // ── OTP Countdown Timers ───────────────────────────────────────────────
  // Countdown timer for Sign Up OTP (3 minutes / 180 seconds)
  useEffect(() => {
    if (!signupOtpSent || signupOtpTimeRemaining <= 0) return;
    const timer = setInterval(() => {
      setSignupOtpTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [signupOtpSent, signupOtpTimeRemaining]);

  // Countdown timer for Manage Profile Update Email OTP (3 minutes / 180 seconds)
  useEffect(() => {
    if (!emailUpdateOtpSent || emailUpdateOtpTimeRemaining <= 0) return;
    const timer = setInterval(() => {
      setEmailUpdateOtpTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [emailUpdateOtpSent, emailUpdateOtpTimeRemaining]);

  // ── Local Storage Session Restoration on Mount ──────────────────────────
  useEffect(() => {
    try {
      const stored = localStorage.getItem('lyka_client_user');
      if (stored) {
        const u = JSON.parse(stored);
        if (u && u.email) {
          setUserLoggedIn(true);
          setUserEmail(u.email);
          const initialName = u.name || u.email.split('@')[0] || 'User';
          setUserName(initialName);
          setUserFullName(initialName);
          setUserAge(u.age ? String(u.age) : '');
          const uid = u.uid || `user_${u.email.replace(/[^a-zA-Z0-9]/g, '_')}`;
          setUserId(uid);
          setAuthProviderName(u.authProvider || 'Email');
          if (onAuthChange) onAuthChange(uid, u.email);
          if (onUpdateLead) onUpdateLead({ user_id: uid, full_name: initialName, email: u.email });

          // Background sync from Firestore User_login
          getUserProfileFromFirestore(u.email, uid).then((profile) => {
            if (profile) {
              if (profile.Name) {
                setUserName(profile.Name);
                setUserFullName(profile.Name);
              }
              if (profile.Age !== undefined && profile.Age !== null) {
                setUserAge(String(profile.Age));
              }
            }
          }).catch(() => {});
        }
      }
    } catch (_) {}
  }, []);

  // ── Auth state persistence ──────────────────────────────────────────────
  // onAuthStateChanged handles Google Sign In or Firebase Auth sessions
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserLoggedIn(true);
        setUserEmail(user.email || '');
        setUserId(user.uid);
        // Determine provider from the first available providerData entry
        const provider = user.providerData?.[0]?.providerId;
        const finalProvider = provider === 'google.com' ? 'Google' : 'Email';
        setAuthProviderName(finalProvider);
        let restoredName = '';
        // Restore user name and age from Firestore User_login
        try {
          const profile = await getUserProfileFromFirestore(user.email || '', user.uid);
          if (profile && profile.Name) {
            restoredName = profile.Name;
            setUserName(profile.Name);
            if (profile.Age !== undefined && profile.Age !== null) {
              setUserAge(String(profile.Age));
            }
          } else if (user.displayName && !/^\d+$/.test(user.displayName)) {
            restoredName = user.displayName;
            setUserName(user.displayName);
          } else {
            // Avoid using numeric student ID as name
            const prefix = user.email?.split('@')[0] || '';
            restoredName = !/^\d+$/.test(prefix) && prefix ? prefix : 'User';
            setUserName(restoredName);
          }
        } catch (e) {
          console.warn('Could not restore user profile info:', e);
          const prefix = user.email?.split('@')[0] || '';
          restoredName = user.displayName || (!/^\d+$/.test(prefix) && prefix ? prefix : 'User');
          setUserName(restoredName);
        }

        // Cache in localStorage
        try {
          localStorage.setItem('lyka_client_user', JSON.stringify({
            uid: user.uid,
            email: user.email,
            name: restoredName,
            age: userAge || '',
            authProvider: finalProvider
          }));
        } catch (_) {}

        // Notify parent App component of auth state so chat history syncs immediately
        if (onAuthChange) {
          onAuthChange(user.uid, user.email || '');
        }
        if (onUpdateLead) {
          onUpdateLead({
            user_id: user.uid,
            full_name: restoredName || undefined,
            email: user.email || undefined
          });
        }
      } else {
        // If not in Firebase Auth, check if passwordless Email session exists in localStorage
        const saved = localStorage.getItem('lyka_client_user');
        if (saved) {
          try {
            const u = JSON.parse(saved);
            if (u && u.email && u.authProvider === 'Email') {
              // Maintain active email session
              return;
            }
          } catch (_) {}
        }
        // No user — reset state (guest mode)
        setUserLoggedIn(false);
        setUserName('');
        setUserFullName('');
        setUserAge('');
        setUserEmail('');
        setUserId('');
        setAuthProviderName('Email');
        setPendingGoogleUser(null);
        if (onAuthChange) {
          onAuthChange(null, '');
        }
      }
    });
    return () => unsubscribe(); // unsubscribe on unmount
  }, []); // run once on mount
  // ─────────────────────────────────────────────────────────────────────────

  // Close profile tooltip on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showProfileTooltip) {
        setShowProfileTooltip(false);
        setIsEditingProfile(false);
        setDeleteConfirm(false);
        setShowEmailUpdateModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showProfileTooltip]);

  const [savedSessions, setSavedSessions] = useState<SavedSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>('current');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    scrollToBottom('smooth');
    const timer = setTimeout(() => {
      scrollToBottom('auto');
    }, 120);
    return () => clearTimeout(timer);
  }, [messages, isLoading]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
    }
  }, [inputText]);

  useEffect(() => {
    async function loadSessions() {
      let sessions: SavedSession[] = [];
      if (userLoggedIn && userId) {
        try {
          sessions = await getUserChatSessionsFromFirestore(userId, userEmail);
        } catch (error) {
          console.warn('Failed to load chat sessions from Firestore', error);
        }
      }

      // Check local storage and merge (gives offline resilience, guest chats, and most recent turns)
      try {
        const localLeadsStr = localStorage.getItem('localLeads');
        const localMsgsStr = localStorage.getItem('localInteractions');
        if (localLeadsStr && localMsgsStr) {
          const leads: LeadProfile[] = JSON.parse(localLeadsStr);
          const allMsgs: ChatMessage[] = JSON.parse(localMsgsStr);

          for (const lead of leads) {
            const msgs = allMsgs.filter(m => m.lead_id === lead.id).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
            // ONLY store and display if user has actually queried the chatbot
            if (msgs.length > 0 && msgs.some(m => m.role === 'user')) {
              const firstUserMsg = msgs.find(m => m.role === 'user');
              const sessionTitle = firstUserMsg
                ? (firstUserMsg.content.length > 42 ? firstUserMsg.content.slice(0, 42) + '...' : firstUserMsg.content)
                : (lead.summary || `${lead.intent || 'General'} Inquiry`);

              const existingIdx = sessions.findIndex(s => s.id === lead.id);
              if (existingIdx >= 0) {
                // If local interaction log has more or equal messages, prefer local msgs
                if (msgs.length >= sessions[existingIdx].messages.length) {
                  sessions[existingIdx].messages = msgs;
                  sessions[existingIdx].messageCount = msgs.length;
                  sessions[existingIdx].preview = msgs[msgs.length - 1].content.substring(0, 60) + '...';
                  sessions[existingIdx].title = sessionTitle;
                }
              } else {
                sessions.push({
                  id: lead.id,
                  title: sessionTitle,
                  preview: msgs[msgs.length - 1].content.substring(0, 60) + '...',
                  timestamp: lead.updatedAt || msgs[msgs.length - 1].timestamp,
                  messageCount: msgs.length,
                  leadProfile: lead,
                  messages: msgs
                });
              }
            }
          }
        }
      } catch (e) {
        console.warn('Failed to parse local sessions', e);
      }

      // Preserve stable list order: keep existing items in their established positions
      setSavedSessions(prev => {
        if (!prev || prev.length === 0) {
          return sessions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        }
        // Map new session details into existing list without changing positions
        const sessionMap = new Map(sessions.map(s => [s.id, s]));
        const updated = prev.map(old => sessionMap.get(old.id) || old);
        // Append any brand-new sessions at the top
        const existingIds = new Set(prev.map(p => p.id));
        const brandNew = sessions.filter(s => !existingIds.has(s.id));
        return [...brandNew, ...updated];
      });
    }
    loadSessions();
  }, [userLoggedIn, userId, userEmail, messages.length]);

  // Set active session id
  useEffect(() => {
    setActiveSessionId(currentLead.id);
  }, [currentLead.id]);

  const userMessageCount = messages.filter(m => m.role === 'user').length;
  const isGuestLimitReached = !userLoggedIn && userMessageCount >= 2;

  const handleTalkToAgentClick = () => {
    if (!userLoggedIn) {
      setAuthNotification('Please Sign In or Sign Up first to connect and talk directly with our senior property advisor.');
      setShowAuthModal(true);
      return;
    }
    onOpenAgentHandoff();
  };

  const handleOpenSettingsClick = () => {
    if (!userLoggedIn) {
      setAuthNotification('Please Sign In or Sign Up first to access AI engine and model settings.');
      setShowAuthModal(true);
      return;
    }
    setShowSettingsModal(true);
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isLoading) return;
    if (isGuestLimitReached) {
      setAuthNotification('Free preview limit reached (2 conversations). Please Sign In or Sign Up to continue chatting with Lyka Realty AI!');
      setShowAuthModal(true);
      return;
    }
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
    if (isGuestLimitReached) {
      setAuthNotification('Free preview limit reached (2 conversations). Please Sign In or Sign Up to continue chatting with Lyka Realty AI!');
      setShowAuthModal(true);
      return;
    }
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

    // If user is on the Sign Up tab (first-time user), they MUST write Name and Age first!
    if (authMode === 'signup') {
      if (!userFullName.trim() || userFullName.trim().length < 2) {
        setAuthError('Please write your Full Name first before continuing with Google.');
        setAuthLoading(false);
        return;
      }
      const ageNum = Number(userAge);
      if (!userAge.trim() || !Number.isInteger(ageNum) || ageNum < 18 || ageNum > 120) {
        setAuthError('Please write a valid Age (between 18 and 120) first before continuing with Google.');
        setAuthLoading(false);
        return;
      }
    }

    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const gEmail = result.user.email || '';
      const gUid = result.user.uid;
      const gName = userFullName.trim() || result.user.displayName || gEmail.split('@')[0] || 'Customer';

      // Check whether user profile already exists in Firestore User_login
      const existingProfile = await getUserProfileFromFirestore(gEmail, gUid);

      if (existingProfile && existingProfile.Age) {
        // User is already registered with Age -> Sign In immediately!
        const finalName = existingProfile.Name || gName;
        const finalAge = existingProfile.Age;

        setUserName(finalName);
        setUserEmail(gEmail);
        setUserAge(String(finalAge));
        setUserId(gUid);
        setAuthProviderName('Google');
        setUserLoggedIn(true);
        setShowAuthModal(false);
        setPendingGoogleUser(null);
        setAuthMode('login');

        // Update last_login in Firestore
        await saveUserLoginToFirestore(
          gUid,
          gEmail,
          finalName,
          'Google',
          finalAge
        );

        if (onUpdateLead) {
          onUpdateLead({
            user_id: gUid,
            full_name: finalName,
            email: gEmail
          });
        }
        if (onAuthChange) onAuthChange(gUid, gEmail);
        if (messages.length > 0) {
          syncSessionToUserProfile(gEmail, gUid, { ...currentLead, user_id: gUid, email: gEmail }, messages).catch(() => {});
        }
      } else {
        // User is NEW (first time in Firebase)!
        // Check if user already wrote Name and Age before clicking Continue with Google:
        const ageNum = Number(userAge);
        const hasValidName = userFullName.trim().length >= 2;
        const hasValidAge = userAge.trim() && Number.isInteger(ageNum) && ageNum >= 18 && ageNum <= 120;

        if (hasValidName && hasValidAge) {
          // Both Name and Age are provided -> complete sign up immediately!
          const finalName = userFullName.trim();
          try {
            if (auth.currentUser) {
              await updateProfile(auth.currentUser, { displayName: finalName });
            }
          } catch (_) {}

          await saveUserLoginToFirestore(
            gUid,
            gEmail,
            finalName,
            'Google',
            ageNum
          );

          setUserName(finalName);
          setUserEmail(gEmail);
          setUserAge(String(ageNum));
          setUserId(gUid);
          setAuthProviderName('Google');
          setUserLoggedIn(true);
          setShowAuthModal(false);
          setPendingGoogleUser(null);
          setAuthMode('login');

          if (onUpdateLead) {
            onUpdateLead({
              user_id: gUid,
              full_name: finalName,
              email: gEmail
            });
          }
          if (onAuthChange) onAuthChange(gUid, gEmail);
          if (messages.length > 0) {
            syncSessionToUserProfile(gEmail, gUid, { ...currentLead, user_id: gUid, email: gEmail }, messages).catch(() => {});
          }
        } else {
          // USER HAS NOT WRITTEN NAME AND AGE:
          // They CANNOT login with Continue with Google!
          await signOut(auth);
          setUserLoggedIn(false);
          setPendingGoogleUser(null);
          setAuthMode('signup');
          if (!userFullName.trim()) {
            setUserFullName(result.user.displayName || '');
          }
          setAuthError('You must write your Name and Age first before continuing with Google!');
        }
      }
    } catch (error: any) {
      if (error?.code === 'auth/unauthorized-domain') {
        const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'current domain';
        setAuthError(`Domain "${currentHost}" is not authorized in Firebase. Please add "${currentHost}" to Firebase Console -> Authentication -> Settings -> Authorized Domains.`);
      } else if (error?.code === 'auth/popup-closed-by-user') {
        // user closed popup window
      } else {
        setAuthError(error.message);
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleCompleteGoogleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingGoogleUser) return;
    setAuthLoading(true);
    setAuthError('');

    const finalName = userFullName.trim() || pendingGoogleUser.displayName || 'Customer';
    const ageNum = Number(userAge);
    if (!userAge.trim() || !Number.isInteger(ageNum) || ageNum < 18 || ageNum > 120) {
      setAuthError('Please enter a valid age between 18 and 120.');
      setAuthLoading(false);
      return;
    }

    try {
      if (auth.currentUser) {
        try {
          await updateProfile(auth.currentUser, { displayName: finalName });
        } catch (_) {}
      }
      // Store name, age, email in Firestore User_login
      await saveUserLoginToFirestore(
        pendingGoogleUser.uid,
        pendingGoogleUser.email,
        finalName,
        'Google',
        ageNum
      );

      setUserName(finalName);
      setUserEmail(pendingGoogleUser.email);
      setUserAge(String(ageNum));
      setUserId(pendingGoogleUser.uid);
      setAuthProviderName('Google');
      setUserLoggedIn(true);
      setShowAuthModal(false);
      setPendingGoogleUser(null);
      setAuthMode('login');

      if (onUpdateLead) {
        onUpdateLead({
          user_id: pendingGoogleUser.uid,
          full_name: finalName,
          email: pendingGoogleUser.email
        });
      }
      if (onAuthChange) onAuthChange(pendingGoogleUser.uid, pendingGoogleUser.email);
      if (messages.length > 0) {
        syncSessionToUserProfile(pendingGoogleUser.email, pendingGoogleUser.uid, { ...currentLead, user_id: pendingGoogleUser.uid, email: pendingGoogleUser.email }, messages).catch(() => {});
      }
    } catch (err: any) {
      setAuthError('Failed to save profile: ' + err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  // ── Passwordless Sign In (Email Only) ──────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');

    const cleanEmail = userEmail.trim().toLowerCase();
    if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setAuthError('Please enter a valid email address.');
      setAuthLoading(false);
      return;
    }

    try {
      // Check if user exists in Firestore User_login
      const profile = await getUserProfileFromFirestore(cleanEmail);
      const profileEmail = (profile?.Email_id || '').trim().toLowerCase();
      if (!profile || !profileEmail || profileEmail !== cleanEmail) {
        setAuthError('No account found for this email. Please switch to Sign Up to create your account.');
        setAuthLoading(false);
        return;
      }

      const finalName = profile.Name || cleanEmail.split('@')[0] || 'User';
      const finalAge = profile.Age !== undefined && profile.Age !== null ? String(profile.Age) : '';
      const finalUid = profile.uid || `user_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
      const provider = (profile.auth_provider as 'Google' | 'Email') || 'Email';

      // Record login and update last_login in Firestore
      await saveUserLoginToFirestore(
        finalUid,
        cleanEmail,
        finalName,
        provider,
        profile.Age
      );

      // Save persistent session in localStorage
      localStorage.setItem('lyka_client_user', JSON.stringify({
        uid: finalUid,
        email: cleanEmail,
        name: finalName,
        age: finalAge,
        authProvider: provider
      }));

      setUserLoggedIn(true);
      setUserEmail(cleanEmail);
      setUserName(finalName);
      setUserFullName(finalName);
      setUserAge(finalAge);
      setUserId(finalUid);
      setAuthProviderName(provider);
      setShowAuthModal(false);
      setAuthError('');

      if (onUpdateLead) {
        onUpdateLead({
          user_id: finalUid,
          full_name: finalName,
          email: cleanEmail
        });
      }
      if (onAuthChange) onAuthChange(finalUid, cleanEmail);
      if (messages.length > 0) {
        syncSessionToUserProfile(cleanEmail, finalUid, { ...currentLead, user_id: finalUid, email: cleanEmail }, messages).catch(() => {});
      }
    } catch (err: any) {
      setAuthError('Failed to sign in: ' + (err.message || 'Please check your internet connection.'));
    } finally {
      setAuthLoading(false);
    }
  };

  // ── Passwordless Sign Up: Step 1 (Send Email OTP) ──────────────────────
  const handleRequestSignupOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSignupOtpLoading(true);
    setAuthError('');
    setSignupOtpSuccessMsg('');

    const cleanName = userFullName.trim();
    if (cleanName.length < 2) {
      setAuthError('Please enter your full name (at least 2 characters).');
      setSignupOtpLoading(false);
      return;
    }

    const ageNum = Number(userAge);
    if (!userAge.trim() || !Number.isInteger(ageNum) || ageNum < 18 || ageNum > 120) {
      setAuthError('Please enter a valid age between 18 and 120.');
      setSignupOtpLoading(false);
      return;
    }

    const cleanEmail = userEmail.trim().toLowerCase();
    if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setAuthError('Please enter a valid email address.');
      setSignupOtpLoading(false);
      return;
    }

    try {
      // Enforce strictly one single account per email ID
      const existingProfile = await getUserProfileFromFirestore(cleanEmail);
      const existingEmail = (existingProfile?.Email_id || existingProfile?.email || '').trim().toLowerCase();
      if (existingProfile && (existingEmail === cleanEmail || existingProfile.Age)) {
        setAuthError('An account with this email address already exists. Only one account can be created per email. Please switch to Sign In.');
        setSignupOtpLoading(false);
        return;
      }

      // Request 6-digit OTP code via Brevo API
      const res = await fetch('/api/auth/send-email-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, portal: 'user' })
      });
      const data = await res.json();

      if (!res.ok) {
        setAuthError(data.error || data.message || 'Failed to send verification code.');
      } else {
        setSignupOtpSent(true);
        setSignupOtpTimeRemaining(180);
        setSignupOtpSuccessMsg(`Verification code sent to ${cleanEmail}. Please check your inbox or spam folder.`);
      }
    } catch (err: any) {
      setAuthError('Network error sending verification code: ' + (err.message || 'Server unreachable.'));
    } finally {
      setSignupOtpLoading(false);
    }
  };

  // ── Passwordless Sign Up: Step 2 (Verify OTP & Create Account) ─────────
  const handleVerifySignupOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');

    const cleanEmail = userEmail.trim().toLowerCase();
    const cleanOtp = signupOtpInput.trim();

    if (cleanOtp.length !== 6) {
      setAuthError('Please enter the 6-digit verification code sent to your email.');
      setAuthLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/verify-email-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, portal: 'user', otp: cleanOtp })
      });
      const data = await res.json();

      if (!res.ok || !data.valid) {
        setAuthError(data.message || 'Invalid or expired verification code. Please check your email or resend code.');
        setAuthLoading(false);
        return;
      }

      // Enforce strictly one single account per email ID
      const existingProfile = await getUserProfileFromFirestore(cleanEmail);
      if (existingProfile && ((existingProfile.Email_id || '').trim().toLowerCase() === cleanEmail || existingProfile.Age)) {
        setAuthError('An account with this email address already exists. Only one account can be created per email. Please switch to Sign In.');
        setAuthLoading(false);
        return;
      }

      // OTP Verified successfully! Create unique single user profile in Firestore
      const cleanName = userFullName.trim();
      const ageNum = Number(userAge);
      const newUid = `user_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;

      await saveUserLoginToFirestore(
        newUid,
        cleanEmail,
        cleanName,
        'Email',
        ageNum
      );

      // Save persistent session in localStorage
      localStorage.setItem('lyka_client_user', JSON.stringify({
        uid: newUid,
        email: cleanEmail,
        name: cleanName,
        age: String(ageNum),
        authProvider: 'Email'
      }));

      setUserLoggedIn(true);
      setUserEmail(cleanEmail);
      setUserName(cleanName);
      setUserFullName(cleanName);
      setUserAge(String(ageNum));
      setUserId(newUid);
      setAuthProviderName('Email');
      setShowAuthModal(false);
      setSignupOtpSent(false);
      setSignupOtpInput('');
      setSignupOtpSuccessMsg('');
      setAuthError('');

      if (onUpdateLead) {
        onUpdateLead({
          user_id: newUid,
          full_name: cleanName,
          email: cleanEmail
        });
      }
      if (onAuthChange) onAuthChange(newUid, cleanEmail);
      if (messages.length > 0) {
        syncSessionToUserProfile(cleanEmail, newUid, { ...currentLead, user_id: newUid, email: cleanEmail }, messages).catch(() => {});
      }
    } catch (err: any) {
      setAuthError('Failed to complete sign up: ' + (err.message || 'Please try again.'));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.warn('Sign out notice:', e);
    }
    // Clear localStorage session
    try {
      localStorage.removeItem('lyka_client_user');
      localStorage.removeItem('current_user_profile');
      if (userEmail) {
        localStorage.removeItem(`user_profile_${userEmail.trim().toLowerCase()}`);
      }
    } catch (_) {}

    setUserLoggedIn(false);
    setUserEmail('');
    setUserName('');
    setUserFullName('');
    setUserAge('');
    setUserId('');
    setAuthProviderName('');
    setDeleteConfirm(false);
    setShowAuthModal(false);
    setShowProfileTooltip(false);
    setShowEmailUpdateModal(false);
    setSignupOtpSent(false);
    setSignupOtpInput('');
    setSignupOtpSuccessMsg('');
    setEmailUpdateOtpSent(false);
    setEmailUpdateOtpInput('');

    if (onAuthChange) onAuthChange(null, '');
  };

  const handleDeleteAccount = async () => {
    setAuthLoading(true);
    setAuthError('');
    try {
      const targetId = userId || auth.currentUser?.uid;
      const targetEmail = userEmail || auth.currentUser?.email;
      // 1. Delete user record from Firestore User_login collection
      if (targetId || targetEmail) {
        try {
          await deleteUserLoginFromFirestore(targetId || '', targetEmail || '');
        } catch (dbErr: any) {
          console.warn('Firestore user delete warning:', dbErr);
        }
      }
      // 2. Delete user authentication from Firebase Auth if currently logged in
      const currentUser = auth.currentUser;
      if (currentUser) {
        try {
          await currentUser.delete();
        } catch (authErr: any) {
          if (authErr?.code === 'auth/requires-recent-login') {
            setAuthError('For security reasons, please log in again before deleting your account.');
            setAuthLoading(false);
            return;
          }
          console.warn('Firebase user delete note:', authErr);
        }
      }
      // 3. Clear local storage for this user
      try {
        localStorage.removeItem('localInteractions');
        localStorage.removeItem('localLeads');
        localStorage.removeItem('lyka_client_user');
      } catch (_) {}

      // 4. Clear all active session state
      setUserLoggedIn(false);
      setUserEmail('');
      setUserName('');
      setUserFullName('');
      setUserAge('');
      setUserId('');
      setAuthProviderName('');
      setDeleteConfirm(false);
      setShowAuthModal(false);
      setShowProfileTooltip(false);

      if (onAuthChange) onAuthChange(null, undefined);
      if (onStartNewChat) onStartNewChat();
    } catch (err: any) {
      setAuthError('Error deleting user: ' + err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  // ── Manage Profile: Update Email with Brevo OTP (Passwordless) ─────────
  const handleRequestEmailUpdateOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setEmailUpdateLoading(true);
    setEmailUpdateError('');

    const cleanNewEmail = newEmailInput.trim().toLowerCase();
    if (!cleanNewEmail.includes('@') || !cleanNewEmail.includes('.')) {
      setEmailUpdateError('Please enter a valid email address.');
      setEmailUpdateLoading(false);
      return;
    }

    if (cleanNewEmail === userEmail.trim().toLowerCase()) {
      setEmailUpdateError('New email must be different from your current email.');
      setEmailUpdateLoading(false);
      return;
    }

    try {
      // Check if new email is already in use by another user
      const existing = await getUserProfileFromFirestore(cleanNewEmail);
      const existingEmail = (existing?.Email_id || '').trim().toLowerCase();
      if (existing && existingEmail && existingEmail === cleanNewEmail) {
        setEmailUpdateError('This email is already in use by another account.');
        setEmailUpdateLoading(false);
        return;
      }

      // Send OTP to new email address via Brevo
      const res = await fetch('/api/auth/send-email-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanNewEmail, portal: 'user' })
      });
      const data = await res.json();

      if (!res.ok) {
        setEmailUpdateError(data.error || data.message || 'Failed to send OTP.');
      } else {
        setEmailUpdateOtpSent(true);
        setEmailUpdateOtpTimeRemaining(180);
      }
    } catch (err: any) {
      setEmailUpdateError('Network error: ' + (err.message || 'Server unreachable.'));
    } finally {
      setEmailUpdateLoading(false);
    }
  };

  const handleVerifyEmailUpdateOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailUpdateLoading(true);
    setEmailUpdateError('');

    const cleanNewEmail = newEmailInput.trim().toLowerCase();
    const cleanOtp = emailUpdateOtpInput.trim();

    if (cleanOtp.length !== 6) {
      setEmailUpdateError('Please enter the 6-digit verification code sent to your new email.');
      setEmailUpdateLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/verify-email-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanNewEmail, portal: 'user', otp: cleanOtp })
      });
      const data = await res.json();

      if (!res.ok || !data.valid) {
        setEmailUpdateError(data.message || 'Invalid or expired OTP. Please check your email or resend code.');
        setEmailUpdateLoading(false);
        return;
      }

      // Valid OTP! Update user_login document in Firestore
      const oldEmail = userEmail.trim().toLowerCase();
      const currentUid = userId || `user_${cleanNewEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;

      // Delete old document from User_login
      if (oldEmail) {
        await deleteUserLoginFromFirestore(currentUid, oldEmail);
      }
      // Save new document with new email
      await saveUserLoginToFirestore(
        currentUid,
        cleanNewEmail,
        userName || 'User',
        authProviderName || 'Email',
        userAge ? Number(userAge) : undefined
      );

      // Update localStorage session
      try {
        const stored = localStorage.getItem('lyka_client_user');
        if (stored) {
          const u = JSON.parse(stored);
          u.email = cleanNewEmail;
          localStorage.setItem('lyka_client_user', JSON.stringify(u));
        }
      } catch (_) {}

      // Update local state
      setUserEmail(cleanNewEmail);
      setEmailUpdateOtpSent(false);
      setEmailUpdateOtpInput('');
      setNewEmailInput('');
      setEmailUpdateError('');
      setShowEmailUpdateModal(false);

      if (onAuthChange) onAuthChange(currentUid, cleanNewEmail);
      if (onUpdateLead) onUpdateLead({ user_id: currentUid, email: cleanNewEmail });
    } catch (err: any) {
      setEmailUpdateError('Failed to update email: ' + (err.message || 'Please try again.'));
    } finally {
      setEmailUpdateLoading(false);
    }
  };

  const handleStartEditProfile = () => {
    setEditNameInput(userName || userFullName || '');
    setEditAgeInput(userAge ? String(userAge) : '');
    setEditProfileError('');
    setEditProfileSuccess('');
    setIsEditingProfile(true);
  };

  const handleSaveProfileChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = editNameInput.trim();
    if (!trimmedName) {
      setEditProfileError('Please enter your name.');
      return;
    }

    const ageStr = editAgeInput.trim();
    let ageNum: number | undefined = undefined;
    if (ageStr) {
      const parsedAge = parseInt(ageStr, 10);
      if (isNaN(parsedAge) || parsedAge < 18 || parsedAge > 120) {
        setEditProfileError('Please enter a valid age between 18 and 120.');
        return;
      }
      ageNum = parsedAge;
    }

    const targetUserId = userId || auth.currentUser?.uid || '';
    const targetEmail = userEmail || auth.currentUser?.email || '';

    if (!targetUserId && !targetEmail) {
      setEditProfileError('User session not found.');
      return;
    }

    setEditProfileLoading(true);
    setEditProfileError('');
    setEditProfileSuccess('');

    try {
      // 1. Update in Firestore User_login & local cache (replaces old Name and Age with new values)
      await updateUserProfileInFirestore(targetUserId, targetEmail, trimmedName, ageNum);

      // 2. Also update Firebase Auth profile displayName if current user is signed in
      if (auth.currentUser) {
        try {
          await updateProfile(auth.currentUser, { displayName: trimmedName });
        } catch (_) {}
      }

      // 3. Update React local states
      setUserName(trimmedName);
      setUserFullName(trimmedName);
      if (ageNum !== undefined) {
        setUserAge(String(ageNum));
      }

      // 4. Update parent CRM lead profile
      if (onUpdateLead) {
        onUpdateLead({
          full_name: trimmedName
        });
      }

      setEditProfileSuccess('Profile saved successfully!');
      setTimeout(() => {
        setIsEditingProfile(false);
        setEditProfileSuccess('');
      }, 1200);
    } catch (err: any) {
      setEditProfileError(err.message || 'Failed to update profile. Please try again.');
    } finally {
      setEditProfileLoading(false);
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
      icon: <Sparkles className="w-5 h-5 text-amber-600" />,
      prompt: 'Hi, I am looking for properties with Lyka Realty.'
    },
    {
      title: 'Buy Waterfront 2BR',
      desc: 'Dubai Marina ~AED 1.8M',
      icon: <Building2 className="w-5 h-5 text-emerald-600" />,
      prompt: 'I want to buy a 2-bedroom apartment in Dubai Marina around AED 1.8M ready to move in.'
    },
    {
      title: 'High ROI Off-Plan',
      desc: 'Business Bay, 80/20 plan',
      icon: <Coins className="w-5 h-5 text-amber-700" />,
      prompt: 'I am an investor looking for high rental yield off-plan properties in Business Bay.'
    },
    {
      title: 'NRI Investment',
      desc: 'Mumbai or Dubai comparison',
      icon: <Compass className="w-5 h-5 text-cyan-600" />,
      prompt: 'I am an NRI from Mumbai comparing luxury 3BHK in Worli vs Dubai tax-free yields.'
    }
  ];

  const filteredSessions = savedSessions.filter(s =>
    (s.title.toLowerCase().includes(sessionSearch.toLowerCase()) ||
    s.preview.toLowerCase().includes(sessionSearch.toLowerCase())) &&
    s.messages.some(m => m.role === 'user')
  );

  return (
    <div className="flex-1 flex h-full overflow-hidden bg-[#ffffff] font-sans relative">

      {/* ═══════════════════════════════════════════════════
          LEFT PANEL — User Auth + Chat History
      ═══════════════════════════════════════════════════ */}
      {/* ─── Mobile overlay backdrop (dismiss on tap outside) ─── */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}
      {/* Left Panel: hidden on mobile (shown as overlay drawer), visible on md+ */}
      <div className={`flex flex-col border-r border-[#f3ede0] bg-[#ffffff] transition-all duration-300 h-full overflow-hidden shrink-0
        ${mobileSidebarOpen ? 'fixed inset-y-0 left-0 z-50 w-72 shadow-2xl md:relative md:shadow-none' : 'hidden md:flex'}
        ${!mobileSidebarOpen && (leftPanelCollapsed ? 'md:w-14' : 'md:w-80')}
      `}>

        {/* Panel Header */}
        <div className="h-14 border-b border-[#f3ede0] flex items-center justify-between px-3 shrink-0">
          {!leftPanelCollapsed && (
            <div className="flex items-center">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Menu</span>
            </div>
          )}
          {/* Desktop collapse button */}
          <button
            onClick={() => setLeftPanelCollapsed(prev => !prev)}
            className="hidden md:flex p-1.5 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-[#f3ede0] transition-colors ml-auto"
            title={leftPanelCollapsed ? 'Expand panel' : 'Collapse panel'}
          >
            {leftPanelCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
          {/* Mobile close button */}
          <button
            onClick={() => setMobileSidebarOpen(false)}
            className="md:hidden p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-[#f3ede0] transition-colors ml-auto"
            title="Close menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {leftPanelCollapsed ? (
          /* Collapsed icon rail */
          <div className="flex flex-col items-center py-4 space-y-3">
            <button
              onClick={() => {
                setLeftPanelCollapsed(false);
                if (userLoggedIn) {
                  setShowProfileTooltip(true);
                } else {
                  setShowAuthModal(true);
                }
              }}
              className="p-2 rounded-lg text-amber-850 hover:text-amber-950 hover:bg-[#f3ede0] transition-colors"
              title="User Account"
            >
              <UserCircle className="w-5 h-5 text-amber-800" />
            </button>
            <button
              onClick={() => setLeftPanelCollapsed(false)}
              className="p-2 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-[#f3ede0] transition-colors"
              title="Chat History"
            >
              <Clock className="w-5 h-5" />
            </button>
            <button
              onClick={onStartNewChat}
              className="p-2 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-[#f3ede0] transition-colors"
              title="New Chat"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <div className="flex-1 flex flex-col relative">

            {/* ─── NEW CHAT BUTTON ─── */}
            <div className="p-3 shrink-0">
              <button
                onClick={() => { onStartNewChat(); setMobileSidebarOpen(false); }}
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
                {/* Current active chat if user has queried and not yet in saved sessions list */}
                {messages.some(m => m.role === 'user') && !savedSessions.some(s => s.id === currentLead.id) && (
                  <button
                    onClick={() => { setActiveSessionId(currentLead.id); setMobileSidebarOpen(false); }}
                    className={`w-full text-left p-2.5 rounded-xl border transition-all group ${
                      activeSessionId === currentLead.id || activeSessionId === 'current'
                        ? 'bg-amber-500/10 border-amber-500/40 text-slate-300'
                        : 'bg-transparent border-transparent hover:bg-[#f3ede0] hover:border-[#e2d9c6] text-slate-400'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${activeSessionId === currentLead.id ? 'text-amber-600' : 'text-slate-600'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-semibold truncate text-[#2d2216]">
                          {(() => {
                            const firstUserQuery = messages.find(m => m.role === 'user')?.content;
                            return firstUserQuery ? (firstUserQuery.length > 40 ? firstUserQuery.slice(0, 40) + '...' : firstUserQuery) : 'Active Conversation';
                          })()}
                        </p>
                        <p className="text-[9px] text-slate-500 truncate">{messages[messages.length - 1]?.content?.slice(0, 35)}...</p>
                      </div>
                      <span className="text-[9px] bg-amber-500/20 text-amber-950 px-1.5 py-0.5 rounded-full font-medium shrink-0">Active</span>
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
                {filteredSessions.map(session => {
                  const isActive = activeSessionId === session.id || currentLead.id === session.id;
                  return (
                    <div key={session.id} className="relative group">
                      <button
                        onClick={() => {
                          if (currentLead.id === session.id) {
                            setMobileSidebarOpen(false);
                            return;
                          }
                          setActiveSessionId(session.id);
                          if (onLoadChat) onLoadChat(session.leadProfile, session.messages);
                          setMobileSidebarOpen(false);
                        }}
                        className={`w-full text-left p-2.5 rounded-xl border transition-all ${
                          isActive
                            ? 'bg-amber-500/10 border-amber-500/40 text-slate-300 shadow-sm'
                            : 'bg-transparent border-transparent hover:bg-[#f3ede0] hover:border-[#e2d9c6] text-slate-400'
                        }`}
                      >
                        <div className="flex items-center space-x-2 pr-6">
                          <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-amber-500' : 'text-slate-600'}`} />
                          <p className={`text-[11px] font-semibold truncate flex-1 ${isActive ? 'text-amber-700' : 'text-slate-300'}`}>{session.title}</p>
                          {isActive && (
                            <span className="text-[9px] bg-amber-500/20 text-amber-950 px-1.5 py-0.5 rounded-full font-medium shrink-0">Open</span>
                          )}
                        </div>
                        <p className="text-[9px] text-slate-500 truncate mt-1 ml-5">{session.preview}</p>
                        <div className="flex items-center justify-between mt-1 ml-5">
                          <span className="text-[9px] text-slate-600">{session.messageCount} msgs</span>
                          <span className="text-[9px] text-slate-600">{formatTime(session.timestamp)}</span>
                        </div>
                      </button>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          const sessionToDelete = session.id;
                          setSavedSessions(prev => prev.filter(s => s.id !== sessionToDelete));
                          if (onDeleteChat) {
                            onDeleteChat(sessionToDelete);
                          } else {
                            try {
                              const effectiveUid = userId || auth.currentUser?.uid;
                              const effectiveEmail = userEmail || auth.currentUser?.email;
                              await deleteLeadFromFirestore(sessionToDelete);
                              await deleteMessagesForLead(sessionToDelete);
                              if (effectiveUid) {
                                await deleteSessionFromUserProfile(effectiveEmail || null, effectiveUid, sessionToDelete);
                              }
                            } catch (err) {
                              console.warn('Error deleting chat from Firestore in AgenticChat:', err);
                            }
                          }
                        }}
                        className="absolute right-2 top-2.5 p-1 text-slate-400 hover:text-red-500 hover:bg-red-50/50 rounded transition-colors opacity-0 group-hover:opacity-100"
                        title="Delete chat"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}

                {!userLoggedIn && savedSessions.length > 0 && (
                  <div className="mt-2 p-2.5 bg-[#f7f2e6] border border-dashed border-[#e2d9c6] rounded-xl text-center">
                    <p className="text-[9px] text-slate-500">Sign in to sync chat history across devices</p>
                  </div>
                )}
              </div>
            </div>

            {/* ─── BOTTOM MENU / PROFILE BUTTON WITH TOOLTIP DESIGN ─── */}
            <div className="p-3 border-t border-[#f3ede0] shrink-0 bg-[#f7f2e6] relative">
              {/* Profile Tooltip Popover for Logged-In User */}
              {showProfileTooltip && userLoggedIn && (
                <>
                  {/* Invisible backdrop to dismiss tooltip on outside click */}
                  <div
                    className="fixed inset-0 z-40 cursor-default"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowProfileTooltip(false);
                      setIsEditingProfile(false);
                      setDeleteConfirm(false);
                      setShowEmailUpdateModal(false);
                      setEmailUpdateOtpSent(false);
                      setEmailUpdateOtpInput('');
                    }}
                  />

                  {/* Floating Tooltip Card */}
                  <div
                    role="dialog"
                    aria-label="Profile Details"
                    onClick={(e) => e.stopPropagation()}
                    className="absolute bottom-full left-3 right-3 mb-2.5 z-50 bg-[#ffffff] border border-[#d6c7ab] rounded-2xl shadow-2xl shadow-stone-900/15 p-3.5 flex flex-col space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-150 max-h-[calc(100vh-160px)] overflow-y-auto"
                  >
                    {/* Downward pointing tooltip caret arrow */}
                    <div className="absolute -bottom-1.5 left-7 w-3 h-3 bg-[#ffffff] border-b border-r border-[#d6c7ab] rotate-45 z-10" />

                    {/* Tooltip Header */}
                    <div className="flex items-center justify-between pb-2.5 border-b border-[#f0e8d9] shrink-0">
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-300 flex items-center justify-center text-neutral-900 font-extrabold text-xs shrink-0 shadow-xs border border-amber-200">
                          {userName[0]?.toUpperCase() || 'U'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-neutral-900 truncate">
                            {userName || userFullName || 'Lyka Client'}
                          </p>
                          <p className="text-[10px] font-medium text-neutral-500 truncate">
                            {userEmail || auth.currentUser?.email || 'Signed In'}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setShowProfileTooltip(false);
                          setIsEditingProfile(false);
                          setDeleteConfirm(false);
                          setShowEmailUpdateModal(false);
                          setEmailUpdateOtpSent(false);
                          setEmailUpdateOtpInput('');
                        }}
                        className="p-1 rounded-md text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors shrink-0"
                        title="Close"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Tooltip Body: Profile details / Edit Profile / Update Email */}
                    {showEmailUpdateModal ? (
                      /* Sub-view: Update Email Form (Passwordless with OTP) */
                      !emailUpdateOtpSent ? (
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-neutral-800 flex items-center space-x-1.5">
                              <Mail className="w-3.5 h-3.5 text-neutral-600" />
                              <span>Update Email</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setShowEmailUpdateModal(false);
                                setEmailUpdateError('');
                                setEmailUpdateOtpSent(false);
                                setEmailUpdateOtpInput('');
                              }}
                              className="text-[10px] text-neutral-500 hover:text-neutral-800 font-medium"
                            >
                              Cancel
                            </button>
                          </div>

                          <p className="text-[10px] text-neutral-600">
                            Enter your new email address. A 6-digit verification code will be sent to verify it.
                          </p>

                          <div className="space-y-1">
                            <label className="text-[10px] font-medium text-neutral-600 block">New Email Address</label>
                            <input
                              type="email"
                              value={newEmailInput}
                              onChange={(e) => { setNewEmailInput(e.target.value); setEmailUpdateError(''); }}
                              placeholder="new.email@example.com"
                              className="w-full bg-white border border-[#d6c7ab] focus:border-amber-600 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-neutral-800 outline-none transition-colors"
                            />
                          </div>

                          {emailUpdateError && (
                            <p className="text-[11px] text-red-900 bg-red-50 border border-red-300 rounded-lg p-2 font-bold leading-tight">
                              {emailUpdateError}
                            </p>
                          )}

                          <div className="flex space-x-2 pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                setShowEmailUpdateModal(false);
                                setEmailUpdateError('');
                                setEmailUpdateOtpSent(false);
                                setEmailUpdateOtpInput('');
                              }}
                              className="flex-1 bg-white hover:bg-neutral-100 text-neutral-700 font-medium py-1.5 rounded-lg text-xs transition-colors border border-neutral-300"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={handleRequestEmailUpdateOtp}
                              disabled={emailUpdateLoading || !newEmailInput.trim()}
                              className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-neutral-900 font-bold py-1.5 rounded-lg text-xs transition-colors flex items-center justify-center space-x-1 shadow-xs"
                            >
                              {emailUpdateLoading ? 'Sending Code...' : 'Send Verification Code'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-neutral-800 flex items-center space-x-1.5">
                              <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                              <span>Verify New Email</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setEmailUpdateOtpSent(false);
                                setEmailUpdateOtpInput('');
                                setEmailUpdateError('');
                              }}
                              className="text-[10px] text-amber-700 hover:underline font-semibold"
                            >
                              Change Email
                            </button>
                          </div>

                          <div className="p-2 bg-amber-50 rounded-lg border border-amber-200 text-[10px] text-neutral-700">
                            Verification code sent to: <strong className="text-neutral-900">{newEmailInput}</strong>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-medium text-neutral-600 block">6-Digit Code</label>
                            <input
                              type="text"
                              maxLength={6}
                              value={emailUpdateOtpInput}
                              onChange={(e) => { setEmailUpdateOtpInput(e.target.value.replace(/\D/g, '')); setEmailUpdateError(''); }}
                              placeholder="123456"
                              className="w-full text-center tracking-widest font-mono text-base bg-white border border-[#d6c7ab] focus:border-amber-600 rounded-xl px-2.5 py-1.5 font-bold text-neutral-900 outline-none transition-colors"
                            />
                          </div>

                          <div className="flex justify-between items-center text-[10px]">
                            {emailUpdateOtpTimeRemaining > 0 ? (
                              <span className="text-neutral-500 font-medium">
                                Resend code in <strong className="text-amber-800">{emailUpdateOtpTimeRemaining}s</strong>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={handleRequestEmailUpdateOtp}
                                disabled={emailUpdateLoading}
                                className="text-amber-700 font-bold hover:underline"
                              >
                                Resend Code
                              </button>
                            )}
                          </div>

                          {emailUpdateError && (
                            <p className="text-[11px] text-red-900 bg-red-50 border border-red-300 rounded-lg p-2 font-bold leading-tight">
                              {emailUpdateError}
                            </p>
                          )}

                          <div className="flex space-x-2 pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                setShowEmailUpdateModal(false);
                                setEmailUpdateOtpSent(false);
                                setEmailUpdateOtpInput('');
                                setEmailUpdateError('');
                              }}
                              className="flex-1 bg-white hover:bg-neutral-100 text-neutral-700 font-medium py-1.5 rounded-lg text-xs transition-colors border border-neutral-300"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={handleVerifyEmailUpdateOtp}
                              disabled={emailUpdateLoading || emailUpdateOtpInput.length !== 6}
                              className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-neutral-900 font-bold py-1.5 rounded-lg text-xs transition-colors flex items-center justify-center space-x-1 shadow-xs"
                            >
                              {emailUpdateLoading ? 'Verifying...' : 'Verify & Save'}
                            </button>
                          </div>
                        </div>
                      )
                    ) : isEditingProfile ? (
                      /* Sub-view: Edit Profile (Name & Age) */
                      <form onSubmit={handleSaveProfileChanges} className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-neutral-800 flex items-center space-x-1.5">
                            <Pencil className="w-3.5 h-3.5 text-neutral-600" />
                            <span>Edit Name & Age</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => { setIsEditingProfile(false); setEditProfileError(''); setEditProfileSuccess(''); }}
                            className="text-[10px] text-neutral-500 hover:text-neutral-800 font-medium"
                          >
                            Cancel
                          </button>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-medium text-neutral-600 block">Full Name</label>
                          <div className="relative">
                            <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500" />
                            <input
                              type="text"
                              value={editNameInput}
                              onChange={(e) => { setEditNameInput(e.target.value); setEditProfileError(''); }}
                              placeholder="Your full name"
                              required
                              className="w-full bg-white border border-[#d6c7ab] focus:border-amber-600 rounded-xl pl-8 pr-2.5 py-1.5 text-xs font-semibold text-neutral-800 outline-none transition-colors"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-medium text-neutral-600 block">Age (Years)</label>
                          <div className="relative">
                            <UserCircle className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500" />
                            <input
                              type="number"
                              min={18}
                              max={120}
                              inputMode="numeric"
                              value={editAgeInput}
                              onChange={(e) => { setEditAgeInput(e.target.value); setEditProfileError(''); }}
                              placeholder="Age (18 - 120)"
                              className="w-full bg-white border border-[#d6c7ab] focus:border-amber-600 rounded-xl pl-8 pr-2.5 py-1.5 text-xs font-semibold text-neutral-800 outline-none transition-colors"
                            />
                          </div>
                        </div>

                        {editProfileError && (
                          <p className="text-[11px] text-red-900 bg-red-50 border border-red-300 rounded-lg p-2 font-bold leading-tight">
                            {editProfileError}
                          </p>
                        )}

                        {editProfileSuccess && (
                          <p className="text-[11px] text-emerald-900 bg-emerald-50 border border-emerald-300 rounded-lg p-2 font-bold flex items-center space-x-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                            <span>{editProfileSuccess}</span>
                          </p>
                        )}

                        <div className="flex space-x-2 pt-1">
                          <button
                            type="button"
                            onClick={() => { setIsEditingProfile(false); setEditProfileError(''); }}
                            className="flex-1 bg-white hover:bg-neutral-100 text-neutral-700 font-medium py-1.5 rounded-lg text-xs transition-colors border border-neutral-300"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={editProfileLoading}
                            className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-neutral-900 font-bold py-1.5 rounded-lg text-xs transition-colors flex items-center justify-center space-x-1 shadow-xs"
                          >
                            {editProfileLoading ? (
                              <span className="text-[11px]">Saving...</span>
                            ) : (
                              <>
                                <Save className="w-3 h-3 text-neutral-900" />
                                <span>Save</span>
                              </>
                            )}
                          </button>
                        </div>
                      </form>
                    ) : (
                      /* Main View: Profile Info & Quick Action Buttons */
                      <div className="space-y-2.5">
                        <div className="bg-[#faf7f0] p-2.5 rounded-xl border border-[#e2d9c6] text-[11px] space-y-1.5">
                          <div className="flex justify-between items-center">
                            <span className="font-medium text-neutral-500">Full Name</span>
                            <span className="font-semibold text-neutral-800">{userName || userFullName || 'Not set'}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="font-medium text-neutral-500">Age</span>
                            <span className="font-semibold text-neutral-800">{userAge ? `${userAge} yrs` : 'Not set'}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="font-medium text-neutral-500">Sign-in</span>
                            <span className="font-semibold text-neutral-800">
                              {authProviderName || (auth.currentUser?.providerData?.[0]?.providerId === 'google.com' ? 'Google' : 'Email')}
                            </span>
                          </div>
                        </div>

                        {authError && (
                          <div className="p-2 rounded-lg bg-red-50 border border-red-200 text-red-900 font-bold text-[11px] flex items-start space-x-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-red-600" />
                            <span>{authError}</span>
                          </div>
                        )}

                        {/* Action buttons inside Tooltip */}
                        <div className="space-y-1.5 pt-1">
                          <button
                            type="button"
                            onClick={handleStartEditProfile}
                            className="w-full bg-[#faf7f0] hover:bg-amber-50 text-neutral-700 hover:text-neutral-900 border border-[#d6c7ab] font-medium py-1.5 px-2.5 rounded-lg text-xs transition-all flex items-center justify-center space-x-1.5 shadow-xs"
                          >
                            <Pencil className="w-3 h-3 text-neutral-600" />
                            <span>Edit Name & Age</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setShowEmailUpdateModal(true);
                              setEmailUpdateError('');
                              setNewEmailInput('');
                              setEmailUpdateOtpSent(false);
                              setEmailUpdateOtpInput('');
                            }}
                            disabled={authLoading || authProviderName === 'Google'}
                            className={`w-full font-medium py-1.5 px-2.5 rounded-lg text-xs transition-colors flex items-center justify-center space-x-1.5 border shadow-xs ${
                              authProviderName === 'Google'
                                ? 'bg-[#f7f2e6] text-neutral-400 border-[#e2d9c6] cursor-not-allowed opacity-75'
                                : 'bg-white hover:bg-[#faf6ee] text-neutral-700 border-[#d6c7ab]'
                            }`}
                          >
                            <Mail className={`w-3 h-3 ${authProviderName === 'Google' ? 'text-neutral-400' : 'text-neutral-600'}`} />
                            <span>
                              {authProviderName === 'Google' ? 'Email Managed by Google' : 'Update Email'}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={handleSignOut}
                            disabled={authLoading}
                            className="w-full bg-white hover:bg-[#faf6ee] text-neutral-700 hover:text-neutral-900 font-medium py-1.5 px-2.5 rounded-lg text-xs transition-colors flex items-center justify-center space-x-1.5 border border-[#d6c7ab] shadow-xs"
                          >
                            <LogOut className="w-3 h-3 text-neutral-600" />
                            <span>Log Out</span>
                          </button>

                          {!deleteConfirm ? (
                            <button
                              type="button"
                              onClick={() => setDeleteConfirm(true)}
                              disabled={authLoading}
                              className="w-full text-red-700 hover:text-red-800 hover:bg-red-50/60 font-semibold py-1 px-2 rounded-lg text-[11px] transition-colors flex items-center justify-center space-x-1"
                            >
                              <Trash2 className="w-3 h-3 text-red-600" />
                              <span>Delete Account & Data</span>
                            </button>
                          ) : (
                            <div className="p-2 bg-red-50 rounded-lg border border-red-200 space-y-1.5">
                              <p className="text-[10px] text-red-900 font-semibold leading-tight">
                                Permanently delete profile and data?
                              </p>
                              <div className="flex space-x-1.5">
                                <button
                                  type="button"
                                  onClick={handleDeleteAccount}
                                  disabled={authLoading}
                                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-1 rounded text-[10px] transition-colors"
                                >
                                  {authLoading ? 'Deleting...' : 'Confirm'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeleteConfirm(false)}
                                  disabled={authLoading}
                                  className="flex-1 bg-white hover:bg-neutral-100 text-black font-semibold py-1 rounded text-[10px] border border-neutral-300"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Bottom Profile Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (userLoggedIn) {
                    setShowProfileTooltip(prev => !prev);
                  } else {
                    setShowAuthModal(true);
                  }
                }}
                className={`relative z-50 w-full flex items-center justify-between p-2.5 rounded-xl transition-all border shadow-xs ${
                  showProfileTooltip && userLoggedIn
                    ? 'bg-[#faf6ee] border-amber-400 ring-2 ring-amber-400/20'
                    : 'bg-white hover:bg-[#faf6ee] border-[#e2d9c6]'
                }`}
              >
                <div className="flex items-center space-x-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-900 shrink-0 font-bold text-xs border border-amber-200">
                    {userLoggedIn ? (userName[0]?.toUpperCase() || 'U') : <UserCircle className="w-5 h-5 text-amber-800" />}
                  </div>
                  <div className="text-left truncate">
                    <p className="text-xs font-black text-[#1e1610] truncate">{userLoggedIn ? userName : 'Account'}</p>
                    <p className="text-[11px] font-bold text-amber-700">{userLoggedIn ? 'Manage Profile' : 'Sign In / Sign Up'}</p>
                  </div>
                </div>
                <ChevronUp className={`w-4 h-4 text-slate-600 shrink-0 transition-transform duration-200 ${showProfileTooltip && userLoggedIn ? 'rotate-180 text-amber-700' : ''}`} />
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
        <div className="h-14 border-b border-[#f3ede0] px-3 sm:px-5 flex items-center justify-between bg-[#ffffff]/95 backdrop-blur-md shrink-0 gap-2">
          <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
            {/* Mobile Hamburger / Menu toggle to open left panel drawer */}
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="md:hidden p-1.5 rounded-xl bg-[#f7f2e6] hover:bg-[#eee6d3] text-[#6b5843] border border-[#d6cbb4] transition-colors shrink-0"
              title="Chat History & Menu"
            >
              <MessageSquare className="w-4 h-4 text-amber-700" />
            </button>

            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-400 via-amber-500 to-yellow-300 flex items-center justify-center text-amber-950 shadow-sm shadow-amber-500/20 shrink-0">
              <Sparkles className="w-4 h-4 fill-slate-950" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-1.5 sm:space-x-2">
                <span className="text-xs sm:text-sm font-bold text-[#2d2216] truncate">Lyka Realty AI</span>
                <button
                  onClick={handleOpenSettingsClick}
                  className="hidden xs:flex items-center space-x-1 text-[9px] sm:text-[10px] bg-[#f7f2e6] hover:bg-[#eee6d3] text-amber-700 border border-[#d6cbb4] px-1.5 sm:px-2 py-0.5 rounded-full font-mono transition-colors shrink-0"
                  title="Configure AI Engine"
                >
                  <Zap className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-600" />
                  <span>{engineProvider === 'groq' ? `Groq · ${activeModel.split('-').slice(0,2).join('-')}` : 'Gemini 2.5'}</span>
                </button>
              </div>
              <p className="text-[9px] sm:text-[10px] text-slate-500 truncate hidden xs:block">Dubai Property Intelligence Engine</p>
            </div>
          </div>

          <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
            <button
              onClick={handleOpenSettingsClick}
              className="p-1.5 rounded-full bg-[#f7f2e6] hover:bg-[#eee6d3] text-[#6b5843] hover:text-slate-800 border border-[#d6cbb4] transition-colors"
              title="AI Settings"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleTalkToAgentClick}
              className={`flex items-center space-x-1 sm:space-x-1.5 text-xs px-2.5 sm:px-3 py-1.5 rounded-full transition-all font-medium shadow-xs ${
                currentLead.human_handoff_required
                  ? 'bg-amber-500 text-amber-950 font-bold border border-amber-400 ring-2 ring-amber-400/50 animate-pulse'
                  : 'bg-[#f7f2e6] hover:bg-[#eee6d3] text-[#3a2e20] border border-[#d6cbb4]'
              }`}
              title="Talk to Human Agent"
            >
              <PhoneCall className="w-3.5 h-3.5 text-amber-700 shrink-0" />
              <span className="hidden sm:inline">Talk to Agent</span>
            </button>
            <button
              onClick={onToggleSidebar}
              className={`flex items-center space-x-1 sm:space-x-1.5 text-xs px-2.5 sm:px-3 py-1.5 rounded-full border transition-all ${
                sidebarOpen
                  ? 'bg-rose-500 hover:bg-rose-600 text-white border-rose-400 font-bold shadow-sm'
                  : 'bg-[#f7f2e6] hover:bg-[#eee6d3] text-[#3a2e20] border-[#d6cbb4] font-medium'
              }`}
              title={sidebarOpen ? "Close CRM Lead Profile" : "Open CRM Lead Profile"}
            >
              {sidebarOpen ? (
                <X className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
              )}
              <span className={sidebarOpen ? "inline text-xs font-bold" : "hidden sm:inline"}>
                {sidebarOpen ? 'Cut CRM ✕' : `CRM (${currentLead.requirement_completeness}%)`}
              </span>
            </button>
          </div>
        </div>

        {/* ─── Conversation Stream ─── */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-3 sm:py-4 space-y-4">
          <div className="w-full max-w-5xl 2xl:max-w-6xl mx-auto space-y-4">

            {/* Welcome Hero */}
            {messages.length <= 1 && (
              <div className="pt-1 pb-2 sm:pt-2 sm:pb-3 space-y-4 animate-fade-in">
                <div className="space-y-2">
                  <div className="flex items-center justify-center mb-0.5">
                    <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-tr from-amber-400 via-amber-500 to-yellow-300 flex items-center justify-center text-amber-950 shadow-md shadow-amber-500/20 border border-amber-300/60">
                      <Sparkles className="w-5 h-5 fill-amber-950 text-amber-950" />
                    </div>
                  </div>
                  <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-amber-800 via-amber-900 to-amber-950 bg-clip-text text-transparent text-center tracking-tight">
                    Hello{userLoggedIn ? `, ${userName}` : ''}! Welcome to Lyka Realty.
                  </h1>
                  <p className="text-sm sm:text-base text-[#6b5843] leading-relaxed text-center max-w-2xl mx-auto">
                    I'm your AI Property Advisor for Dubai & prime India corridors. Tell me what you're looking for — I'll qualify your requirements and find matching verified properties.
                  </p>
                </div>

                {/* Prompt Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                  {promptCards.map((card, i) => (
                    <div
                      key={i}
                      onClick={() => {
                        if (isGuestLimitReached) {
                          setAuthNotification('Free preview limit reached (2 conversations). Please Sign In or Sign Up to continue chatting with Lyka Realty AI!');
                          setShowAuthModal(true);
                          return;
                        }
                        onSendMessage(card.prompt, { groqApiKey: groqKeyInput.trim() || undefined, groqModel: activeModel });
                      }}
                      className="bg-[#f7f2e6] hover:bg-[#eee6d3] border border-[#d6cbb4] hover:border-amber-400/60 p-3.5 sm:p-4 rounded-xl cursor-pointer transition-all duration-200 flex flex-col justify-between space-y-2 group shadow-xs hover:shadow-md"
                    >
                      <div className="flex items-start justify-between">
                        <span className="font-bold text-slate-300 text-sm group-hover:text-amber-800 transition-colors">
                          {card.title}
                        </span>
                        <div className="p-1.5 sm:p-2 rounded-lg bg-[#ffffff] border border-[#d6cbb4] group-hover:border-amber-400/60 transition-colors">
                          {card.icon}
                        </div>
                      </div>
                      <p className="text-xs text-[#6b5843] leading-relaxed">{card.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Messages */}
            {messages.map((msg) => (
              <div key={msg.id} className="space-y-3">
                {msg.role === 'user' ? (
                  <div className="flex justify-end items-end space-x-2">
                    <div className="bg-[#eee6d3] text-slate-300 px-5 py-3.5 rounded-3xl rounded-tr-md max-w-xl sm:max-w-2xl text-base sm:text-lg leading-relaxed border border-[#d6cbb4]/60 shadow-sm">
                      {msg.content}
                    </div>

                  </div>
                ) : (
                  <div className="flex items-start space-x-3.5 sm:space-x-4">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-400 to-yellow-300 flex items-center justify-center text-amber-950 shrink-0 mt-0.5 shadow-md border border-amber-300/50">
                      <Sparkles className="w-5 h-5 fill-amber-950" />
                    </div>

                    <div className="flex-1 space-y-3 min-w-0">
                      <div className="flex items-center space-x-2.5">
                        <span className="text-sm sm:text-base font-bold text-slate-300">Lyka Realty AI</span>
                        {/* Internal technical provider badge hidden per user request */}
                        <span className="text-xs text-[#6b5843]">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      {/* Agentic Thinking Hidden per user request */}

                      {/* Message Body */}
                      <div className="text-base sm:text-lg text-[#3a2e20] leading-relaxed whitespace-pre-wrap">
                        {msg.content}
                      </div>

                      {/* Property Cards */}
                      {msg.recommended_properties && msg.recommended_properties.length > 0 && (
                        <div className="pt-3 space-y-3">
                          <div className="flex items-center space-x-2 text-xs sm:text-sm font-bold text-amber-600 uppercase tracking-wider">
                            <Building2 className="w-4 h-4 sm:w-5 sm:h-5" />
                            <span>Matching Properties ({msg.recommended_properties.length})</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {msg.recommended_properties.map((prop) => (
                              <div
                                key={prop.id}
                                className="bg-[#f7f2e6] border border-[#d6cbb4] hover:border-amber-400/60 rounded-2xl overflow-hidden transition-all duration-200 group flex flex-col shadow-xs hover:shadow-md"
                              >
                                <div className="relative h-40 sm:h-44 overflow-hidden">
                                  <img
                                    src={prop.image_url}
                                    alt={prop.title}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  />
                                  <div className="absolute top-2.5 left-2.5 flex items-center space-x-1.5">
                                    <span className="bg-amber-500/90 text-amber-950 px-2 py-0.5 rounded text-[10px] sm:text-xs font-black">
                                      {prop.city || 'Dubai'}
                                    </span>
                                    <span className="bg-[#ffffff]/90 backdrop-blur-md px-2.5 py-0.5 rounded text-xs font-bold text-amber-600 border border-[#d6cbb4]">
                                      {prop.community}
                                    </span>
                                  </div>
                                </div>
                                <div className="p-4 space-y-1.5 flex-1">
                                  <div className="flex items-baseline justify-between">
                                    <span className="text-base sm:text-lg font-extrabold text-amber-600">
                                      AED {prop.price_aed.toLocaleString()}
                                    </span>
                                    <span className="text-xs sm:text-sm text-slate-400">{prop.bedrooms} BR · {prop.size_sqft} sqft</span>
                                  </div>
                                  <h4 className="font-bold text-slate-300 text-sm sm:text-base line-clamp-1 group-hover:text-amber-700 transition-colors">{prop.title}</h4>
                                  <p className="text-xs sm:text-sm text-[#6b5843] line-clamp-2 leading-relaxed">{prop.description}</p>
                                  <div className="text-xs sm:text-sm text-emerald-400 font-semibold">{prop.expected_roi || 'High Capital Upside'}</div>
                                </div>
                                <div className="p-4 pt-0 border-t border-[#eee6d3] flex items-center justify-between gap-2 flex-wrap">
                                  <span className="text-xs sm:text-sm text-[#6b5843] truncate max-w-[110px]">{prop.developer}</span>
                                  <div className="flex items-center space-x-2">
                                    <button
                                      type="button"
                                      onClick={() => setSelectedDetailProperty(prop)}
                                      className="bg-[#ffffff] hover:bg-[#f3ede0] text-[#4a3b2c] border border-[#d6cbb4] hover:border-amber-500 font-bold px-3 py-1.5 rounded-xl text-xs sm:text-sm transition-colors flex items-center space-x-1.5 shadow-2xs"
                                      title="View full property specifications"
                                    >
                                      <Eye className="w-3.5 h-3.5 text-amber-700" />
                                      <span>View Details</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => onBookViewing(prop)}
                                      className="bg-amber-500 hover:bg-amber-400 text-amber-950 font-bold px-3.5 py-1.5 rounded-xl text-xs sm:text-sm transition-colors flex items-center space-x-1.5 shadow-2xs"
                                    >
                                      <Calendar className="w-3.5 h-3.5" />
                                      <span>Book Viewing</span>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Interactive Button to Open Talk to Agent Modal */}
                      {(msg.content.includes("Talk to Agent") || msg.agentic_decision?.handoff_suggested) && (
                        <div className="pt-2 pb-1">
                          <button
                            type="button"
                            onClick={handleTalkToAgentClick}
                            className="inline-flex items-center space-x-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-amber-950 font-bold px-4 py-2 rounded-xl text-xs sm:text-sm shadow-md transition-all transform hover:-translate-y-0.5 active:translate-y-0"
                          >
                            <PhoneCall className="w-4 h-4 text-amber-950 shrink-0" />
                            <span>Click here to Talk to Agent (Write Query & Send)</span>
                          </button>
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
                        <button onClick={handleTalkToAgentClick} className="p-1.5 hover:text-amber-600 rounded-lg hover:bg-[#f7f2e6] transition-colors" title="Escalate to Agent">
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
              <div className="flex items-start space-x-3.5">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-400 to-yellow-300 flex items-center justify-center text-amber-950 shrink-0 animate-pulse shadow-md border border-amber-300/50">
                  <Sparkles className="w-5 h-5 fill-amber-950" />
                </div>
                <div className="space-y-2 pt-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-bold text-slate-300">Lyka Realty AI</span>
                    <span className="text-xs text-amber-600 animate-pulse">Analyzing requirements...</span>
                  </div>
                  <div className="flex space-x-1.5 py-1">
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-bounce"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-bounce [animation-delay:0.2s]"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-bounce [animation-delay:0.4s]"></div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* ─── Input Bar ─── */}
        <div className="p-2 sm:p-4 lg:p-6 bg-gradient-to-t from-[#ffffff] via-[#ffffff]/95 to-transparent shrink-0">
          <div className="w-full max-w-5xl 2xl:max-w-6xl mx-auto">
            {/* Free Guest Preview Limit Notification Banner */}
            {isGuestLimitReached && (
              <div className="mb-3 p-3.5 sm:p-4 bg-gradient-to-r from-amber-500/15 via-amber-400/10 to-amber-600/15 border border-amber-500/40 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0 shadow-xs">
                    <Lock className="w-4 h-4 text-amber-800" />
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm font-bold text-[#1e1610]">Free Guest Preview Limit Reached (2/2 Conversations)</p>
                    <p className="text-[11px] text-[#6b5843] leading-snug">Please sign in or sign up to continue chatting with Lyka Realty AI, access settings, and talk with our advisors.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAuthNotification('Please Sign In or Sign Up to continue chatting with Lyka Realty AI!');
                    setShowAuthModal(true);
                  }}
                  className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-amber-950 font-bold rounded-xl text-xs shadow-md transition-all whitespace-nowrap shrink-0 flex items-center space-x-1.5 transform hover:-translate-y-0.5 active:translate-y-0"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Sign In / Sign Up</span>
                </button>
              </div>
            )}

            <form
              onSubmit={handleSubmit}
              className="bg-[#f7f2e6] border border-[#d6cbb4] focus-within:border-amber-400/70 rounded-2xl sm:rounded-3xl p-1.5 sm:p-2.5 flex items-end space-x-1.5 sm:space-x-2.5 shadow-xl sm:shadow-2xl transition-all duration-200"
            >
              <textarea
                ref={textareaRef}
                rows={1}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                onClick={() => {
                  if (isGuestLimitReached) {
                    setAuthNotification('You have completed your 2 free preview conversations. Please Sign In or Sign Up to continue chatting with Lyka Realty AI!');
                    setShowAuthModal(true);
                  }
                }}
                placeholder={isGuestLimitReached ? "🔒 Free guest limit reached (2/2). Click here to Sign In or Sign Up..." : "Ask about Dubai properties, investment yields, communities..."}
                disabled={isLoading || isGuestLimitReached}
                className={`flex-1 bg-transparent border-0 px-4 py-2 text-base sm:text-lg text-slate-300 placeholder-[#6b5843] outline-none resize-none leading-relaxed min-h-[44px] max-h-[160px] ${isGuestLimitReached ? 'cursor-pointer select-none' : ''}`}
              />
              <button
                type="button"
                onClick={toggleSpeechRecognition}
                className={`p-2.5 sm:p-3 rounded-full transition-all ${
                  isListening ? 'bg-rose-500 text-white animate-pulse' : 'text-[#6b5843] hover:text-slate-300 hover:bg-[#eee6d3]'
                }`}
                title={isListening ? 'Listening... stop' : 'Voice input'}
              >
                {isListening ? <MicOff className="w-5 h-5 sm:w-6 sm:h-6" /> : <Mic className="w-5 h-5 sm:w-6 sm:h-6" />}
              </button>
              <button
                type="submit"
                disabled={(!inputText.trim() && !isGuestLimitReached) || isLoading}
                onClick={(e) => {
                  if (isGuestLimitReached) {
                    e.preventDefault();
                    setAuthNotification('You have completed your 2 free preview conversations. Please Sign In or Sign Up to continue chatting with Lyka Realty AI!');
                    setShowAuthModal(true);
                  }
                }}
                className={`p-2.5 sm:p-3 rounded-full transition-all shrink-0 font-bold ${
                  isGuestLimitReached 
                    ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-md cursor-pointer' 
                    : 'bg-amber-500 hover:bg-amber-400 disabled:opacity-30 text-amber-950'
                }`}
                title={isGuestLimitReached ? "Sign In / Sign Up to continue" : "Send message"}
              >
                {isGuestLimitReached ? <Lock className="w-4 h-4 sm:w-5 sm:h-5" /> : <Send className="w-4 h-4 sm:w-5 sm:h-5" />}
              </button>
            </form>
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
                <h3 className="text-base font-bold text-[#2d2216]">System Settings & Engine</h3>
              </div>
              <button onClick={() => setShowSettingsModal(false)} className="p-1 rounded-full text-[#6b5843] hover:text-[#2d2216] hover:bg-[#eee6d3]">
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
                <div>
                  <label className="text-[#6b5843] block mb-1 font-semibold">Model:</label>
                  <select
                    value={activeModel}
                    onChange={(e) => setActiveModel(e.target.value)}
                    className="w-full bg-[#ffffff] border border-[#d6cbb4] rounded-xl p-2.5 text-[#2d2216] font-medium outline-none focus:border-amber-400"
                  >
                    <option value="llama-3.3-70b-versatile">llama-3.3-70b-versatile (Recommended)</option>
                    <option value="llama-3.1-8b-instant">llama-3.1-8b-instant (Fastest)</option>
                    <option value="mixtral-8x7b-32768">mixtral-8x7b-32768 (High context)</option>
                    <option value="gemma2-9b-it">gemma2-9b-it</option>
                  </select>
                </div>
              )}

              <div className="bg-[#ffffff] p-3 rounded-xl border border-[#d6cbb4] space-y-1 text-[11px] text-[#6b5843]">
                <div className="flex items-center space-x-1.5 text-[#2d2216] font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
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
              <h3 className="font-bold text-base text-neutral-800">Account</h3>
              <button 
                onClick={() => { setShowAuthModal(false); setAuthNotification(null); }} 
                className="text-slate-500 hover:text-slate-700 p-1 bg-white rounded-md border border-[#e2d9c6]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {/* ─── USER AUTH SECTION ─── */}
            <div className="p-4">
              {/* Contextual Auth Notification Banner */}
              {authNotification && (
                <div className="mb-3.5 p-3 bg-amber-500/15 border border-amber-500/40 rounded-xl flex items-start space-x-2.5 shadow-xs">
                  <Bell className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-950">
                    <p className="font-bold text-amber-950">Sign In or Sign Up Required</p>
                    <p className="text-[11px] text-amber-900 leading-snug mt-0.5">{authNotification}</p>
                  </div>
                </div>
              )}

              {!userLoggedIn ? (
                <div className="space-y-3">
                  <div className="flex items-center space-x-2.5 mb-2">
                    <div className="w-8 h-8 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center">
                      <User className="w-4 h-4 text-black" />
                    </div>
                    <div>
                      <p className="text-sm font-extrabold text-black">Welcome</p>
                      <p className="text-xs font-semibold text-neutral-700">Sign in to save and sync your chats</p>
                    </div>
                  </div>

                  {/* Auth Tabs */}
                  <div className="flex bg-[#f7f2e6] rounded-xl p-1 border border-[#e2d9c6]">
                    {(['login', 'signup'] as const).map(mode => (
                      <button
                        key={mode}
                        onClick={() => {
                          setAuthMode(mode);
                          setAuthError('');
                          setSignupOtpSent(false);
                          setSignupOtpInput('');
                          setSignupOtpSuccessMsg('');
                        }}
                        className={`flex-1 text-xs font-bold py-1.5 rounded-lg transition-all capitalize ${
                          authMode === mode
                            ? 'bg-amber-500 text-black font-extrabold shadow-xs'
                            : 'text-black hover:text-neutral-800 font-bold'
                        }`}
                      >
                        {mode === 'login' ? 'Sign In' : 'Sign Up'}
                      </button>
                    ))}
                  </div>

                  {/* Auth Form */}
                  {authMode === 'login' ? (
                    <form onSubmit={handleLogin} className="space-y-2.5">
                      <div className="relative">
                        <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-black" />
                        <input
                          type="email"
                          value={userEmail}
                          onChange={e => { setUserEmail(e.target.value); setAuthError(''); }}
                          placeholder="Enter your registered email address"
                          required
                          className="w-full bg-white border border-[#d6c7ab] focus:border-amber-600 rounded-xl pl-9 pr-3 py-2 text-xs font-bold text-black placeholder:text-neutral-400 outline-none transition-colors"
                        />
                      </div>

                      {authError && (
                        <p className="text-xs text-red-900 bg-red-50 border border-red-300 rounded-xl px-3 py-2 font-bold leading-relaxed">
                          {authError}
                        </p>
                      )}

                      <button
                        type="submit"
                        disabled={authLoading || !userEmail.trim()}
                        className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-black font-extrabold py-2.5 rounded-xl text-xs transition-colors flex items-center justify-center space-x-1.5 shadow-xs"
                      >
                        {authLoading ? (
                          <svg className="w-4 h-4 animate-spin text-black" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        ) : (
                          <LogIn className="w-4 h-4 text-black" />
                        )}
                        <span>{authLoading ? 'Signing in...' : 'Sign In'}</span>
                      </button>
                    </form>
                  ) : (
                    /* Sign Up Mode (OTP Based) */
                    !signupOtpSent ? (
                      <form onSubmit={handleRequestSignupOtp} className="space-y-2.5">
                        <div className="relative">
                          <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-black" />
                          <input
                            type="text"
                            value={userFullName}
                            onChange={e => { setUserFullName(e.target.value); setAuthError(''); }}
                            placeholder="Full name"
                            autoComplete="name"
                            required
                            className="w-full bg-white border border-[#d6c7ab] focus:border-amber-600 rounded-xl pl-9 pr-3 py-2 text-xs font-bold text-black placeholder:text-neutral-400 outline-none transition-colors"
                          />
                        </div>
                        <div className="relative">
                          <UserCircle className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-black" />
                          <input
                            type="number"
                            min={18}
                            max={120}
                            inputMode="numeric"
                            value={userAge}
                            onChange={e => { setUserAge(e.target.value); setAuthError(''); }}
                            placeholder="Age (18 - 120)"
                            required
                            className="w-full bg-white border border-[#d6c7ab] focus:border-amber-600 rounded-xl pl-9 pr-3 py-2 text-xs font-bold text-black placeholder:text-neutral-400 outline-none transition-colors"
                          />
                        </div>
                        <div className="relative">
                          <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-black" />
                          <input
                            type="email"
                            value={userEmail}
                            onChange={e => { setUserEmail(e.target.value); setAuthError(''); }}
                            placeholder="Email address"
                            required
                            className="w-full bg-white border border-[#d6c7ab] focus:border-amber-600 rounded-xl pl-9 pr-3 py-2 text-xs font-bold text-black placeholder:text-neutral-400 outline-none transition-colors"
                          />
                        </div>

                        {authError && (
                          <p className="text-xs text-red-900 bg-red-50 border border-red-300 rounded-xl px-3 py-2 font-bold leading-relaxed">
                            {authError}
                          </p>
                        )}

                        <button
                          type="submit"
                          disabled={signupOtpLoading}
                          className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-black font-extrabold py-2.5 rounded-xl text-xs transition-colors flex items-center justify-center space-x-1.5 shadow-xs"
                        >
                          {signupOtpLoading ? (
                            <svg className="w-4 h-4 animate-spin text-black" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                          ) : (
                            <Mail className="w-4 h-4 text-black" />
                          )}
                          <span>{signupOtpLoading ? 'Sending Verification Code...' : 'Send Verification Code'}</span>
                        </button>
                      </form>
                    ) : (
                      <form onSubmit={handleVerifySignupOtp} className="space-y-2.5">
                        <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-neutral-800 space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="font-semibold text-neutral-600">Name:</span>
                            <span className="font-bold text-neutral-900">{userFullName}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="font-semibold text-neutral-600">Age:</span>
                            <span className="font-bold text-neutral-900">{userAge} yrs</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="font-semibold text-neutral-600">Email:</span>
                            <span className="font-bold text-neutral-900 truncate max-w-[170px]">{userEmail}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => { setSignupOtpSent(false); setSignupOtpInput(''); setAuthError(''); }}
                            className="text-[11px] text-amber-700 hover:underline font-bold mt-1 block"
                          >
                            Edit Information
                          </button>
                        </div>

                        {signupOtpSuccessMsg && (
                          <div className="p-2 bg-emerald-50 border border-emerald-300 rounded-xl text-[11px] text-emerald-900 font-bold flex items-center space-x-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                            <span>{signupOtpSuccessMsg}</span>
                          </div>
                        )}

                        <div className="relative">
                          <ShieldCheck className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-black" />
                          <input
                            type="text"
                            maxLength={6}
                            value={signupOtpInput}
                            onChange={e => { setSignupOtpInput(e.target.value.replace(/\D/g, '')); setAuthError(''); }}
                            placeholder="Enter 6-digit OTP"
                            required
                            className="w-full text-center tracking-widest font-mono text-base bg-white border border-[#d6c7ab] focus:border-amber-600 rounded-xl pl-9 pr-3 py-2 font-bold text-black outline-none transition-colors"
                          />
                        </div>

                        <div className="flex justify-between items-center text-[11px] px-1">
                          {signupOtpTimeRemaining > 0 ? (
                            <span className="text-neutral-600 font-medium">
                              Resend code in <strong className="text-amber-800">{signupOtpTimeRemaining}s</strong>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={handleRequestSignupOtp}
                              disabled={signupOtpLoading}
                              className="text-amber-800 font-bold hover:underline"
                            >
                              Resend Code
                            </button>
                          )}
                        </div>

                        {authError && (
                          <p className="text-xs text-red-900 bg-red-50 border border-red-300 rounded-xl px-3 py-2 font-bold leading-relaxed">
                            {authError}
                          </p>
                        )}

                        <button
                          type="submit"
                          disabled={authLoading || signupOtpInput.length !== 6}
                          className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-black font-extrabold py-2.5 rounded-xl text-xs transition-colors flex items-center justify-center space-x-1.5 shadow-xs"
                        >
                          {authLoading ? (
                            <svg className="w-4 h-4 animate-spin text-black" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                          ) : (
                            <CheckCircle2 className="w-4 h-4 text-black" />
                          )}
                          <span>{authLoading ? 'Verifying & Creating...' : 'Verify & Create Account'}</span>
                        </button>
                      </form>
                    )
                  )}



                  <p className="text-xs font-semibold text-neutral-700 text-center mt-3">
                    Chat continues as guest without sign-in
                  </p>
                </div>
              ) : (
                /* Logged-in User Profile Card & Controls */
                <div className="space-y-4">
                  {/* Profile Header */}
                  <div className="flex items-center space-x-3 p-3 bg-[#f7f2e6] rounded-xl border border-[#e2d9c6]">
                    <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-300 flex items-center justify-center text-neutral-800 font-bold text-base shrink-0 shadow-sm">
                      {userName[0]?.toUpperCase() || 'U'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-neutral-800 truncate">{userName || userFullName || 'Lyka Client'}</p>
                      <p className="text-xs font-medium text-neutral-600 truncate">{userEmail || auth.currentUser?.email || 'Signed In'}</p>
                    </div>
                  </div>

                  {/* Account Details & Edit Profile Section */}
                  {isEditingProfile ? (
                    <form onSubmit={handleSaveProfileChanges} className="p-3.5 bg-[#fdfbf5] rounded-xl border border-[#d6c7ab] space-y-3 shadow-xs">
                      <div className="flex items-center justify-between border-b border-[#e2d9c6] pb-2">
                        <span className="text-xs font-bold text-neutral-800 flex items-center space-x-1.5">
                          <Pencil className="w-3.5 h-3.5 text-neutral-600" />
                          <span>Edit Name & Age</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => { setIsEditingProfile(false); setEditProfileError(''); setEditProfileSuccess(''); }}
                          className="text-[11px] text-neutral-600 hover:text-neutral-900 font-medium"
                        >
                          Cancel
                        </button>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-neutral-700 block">Full Name</label>
                        <div className="relative">
                          <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                          <input
                            type="text"
                            value={editNameInput}
                            onChange={(e) => { setEditNameInput(e.target.value); setEditProfileError(''); }}
                            placeholder="Your full name"
                            required
                            className="w-full bg-white border border-[#d6c7ab] focus:border-amber-600 rounded-xl pl-9 pr-3 py-2 text-xs font-semibold text-neutral-800 outline-none transition-colors placeholder:text-neutral-400"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-neutral-700 block">Age (Years)</label>
                        <div className="relative">
                          <UserCircle className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                          <input
                            type="number"
                            min={18}
                            max={120}
                            inputMode="numeric"
                            value={editAgeInput}
                            onChange={(e) => { setEditAgeInput(e.target.value); setEditProfileError(''); }}
                            placeholder="Enter age (18 - 120)"
                            className="w-full bg-white border border-[#d6c7ab] focus:border-amber-600 rounded-xl pl-9 pr-3 py-2 text-xs font-semibold text-neutral-800 outline-none transition-colors placeholder:text-neutral-400"
                          />
                        </div>
                      </div>

                      {editProfileError && (
                        <p className="text-xs text-red-900 bg-red-50 border border-red-300 rounded-xl px-2.5 py-1.5 font-bold">
                          {editProfileError}
                        </p>
                      )}

                      {editProfileSuccess && (
                        <p className="text-xs text-emerald-900 bg-emerald-50 border border-emerald-300 rounded-xl px-2.5 py-1.5 font-bold flex items-center space-x-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                          <span>{editProfileSuccess}</span>
                        </p>
                      )}

                      <div className="flex space-x-2 pt-1">
                        <button
                          type="button"
                          onClick={() => { setIsEditingProfile(false); setEditProfileError(''); }}
                          className="flex-1 bg-white hover:bg-neutral-100 text-neutral-700 font-medium py-2 rounded-xl text-xs transition-colors border border-neutral-300 shadow-xs"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={editProfileLoading}
                          className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-neutral-900 font-bold py-2 rounded-xl text-xs transition-colors flex items-center justify-center space-x-1.5 shadow-xs"
                        >
                          {editProfileLoading ? (
                            <span className="text-[11px] text-neutral-900 font-semibold">Saving...</span>
                          ) : (
                            <>
                              <Save className="w-3.5 h-3.5 text-neutral-900" />
                              <span className="text-neutral-900 font-bold">Save</span>
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="bg-[#faf7f0] p-3.5 rounded-xl border border-[#d6c7ab] text-xs space-y-2.5 shadow-xs">
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-neutral-600">Full Name:</span>
                        <span className="font-semibold text-neutral-800 text-xs">{userName || userFullName || 'Not set'}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-neutral-600">Age:</span>
                        <span className="font-semibold text-neutral-800 text-xs">{userAge ? `${userAge} years` : 'Not recorded'}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-neutral-600">Sign-in Method:</span>
                        <span className="font-semibold text-neutral-800 text-xs">{authProviderName || (auth.currentUser?.providerData?.[0]?.providerId === 'google.com' ? 'Google' : 'Email')}</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleStartEditProfile}
                        className="w-full mt-2 bg-white hover:bg-amber-50/70 text-neutral-700 hover:text-neutral-900 border border-[#c4a468]/60 hover:border-amber-600 font-semibold py-2 px-3 rounded-lg text-xs transition-all flex items-center justify-center space-x-1.5 shadow-xs"
                      >
                        <Pencil className="w-3.5 h-3.5 text-neutral-600" />
                        <span className="text-neutral-700 font-semibold">Edit Name & Age</span>
                      </button>
                    </div>
                  )}

                  {authError && (
                    <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-900 font-bold text-xs flex items-start space-x-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                      <span>{authError}</span>
                    </div>
                  )}

                  {/* Actions: Update Email, Logout & Delete */}
                  <div className="pt-2 border-t border-[#d6c7ab] space-y-2">
                    {/* Update Email Button */}
                    <button
                      type="button"
                      onClick={() => {
                        setShowAuthModal(false);
                        setShowProfileTooltip(true);
                        setShowEmailUpdateModal(true);
                        setEmailUpdateError('');
                        setNewEmailInput('');
                        setEmailUpdateOtpSent(false);
                        setEmailUpdateOtpInput('');
                      }}
                      disabled={authLoading || authProviderName === 'Google'}
                      className={`w-full font-semibold py-2.5 px-3 rounded-xl text-xs transition-colors flex items-center justify-center space-x-2 border shadow-xs ${
                        authProviderName === 'Google'
                          ? 'bg-[#f7f2e6] text-neutral-500 border-[#d6c7ab] cursor-not-allowed opacity-75'
                          : 'bg-amber-50 hover:bg-amber-100 text-neutral-700 border-[#c4a468]'
                      }`}
                    >
                      <Mail className={`w-4 h-4 ${authProviderName === 'Google' ? 'text-neutral-500' : 'text-neutral-700'}`} />
                      <span className={authProviderName === 'Google' ? 'text-neutral-600 font-medium' : 'text-neutral-700 font-semibold'}>
                        {authProviderName === 'Google' ? 'Email Managed by Google' : 'Update Email'}
                      </span>
                    </button>

                    {/* Log Out Button */}
                    <button
                      type="button"
                      onClick={handleSignOut}
                      disabled={authLoading}
                      className="w-full bg-[#f7f2e6] hover:bg-[#eee6d3] text-neutral-700 hover:text-neutral-900 font-semibold py-2.5 px-3 rounded-xl text-xs transition-colors flex items-center justify-center space-x-2 border border-[#d6c7ab] shadow-xs"
                    >
                      <LogOut className="w-4 h-4 text-neutral-600" />
                      <span className="text-neutral-700 font-semibold">Log Out</span>
                    </button>

                    {/* Delete Account */}
                    {!deleteConfirm ? (
                      <button
                        type="button"
                        onClick={() => setDeleteConfirm(true)}
                        disabled={authLoading}
                        className="w-full bg-transparent hover:bg-red-50 text-red-700 font-bold py-2 px-3 rounded-xl text-xs transition-colors flex items-center justify-center space-x-1.5 border border-transparent hover:border-red-200"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-700" />
                        <span className="text-red-700">Delete Account & Data</span>
                      </button>
                    ) : (
                      <div className="p-3 bg-red-50 rounded-xl border border-red-200 space-y-2.5">
                        <div className="flex items-start space-x-2">
                          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                          <p className="text-[11px] text-red-900 font-semibold leading-snug">
                            Permanently delete your profile and remove all associated account data?
                          </p>
                        </div>
                        <div className="flex space-x-2">
                          <button
                            type="button"
                            onClick={handleDeleteAccount}
                            disabled={authLoading}
                            className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-1.5 rounded-lg text-xs transition-colors flex items-center justify-center space-x-1 shadow-xs"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>{authLoading ? 'Deleting...' : 'Confirm Delete'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirm(false)}
                            disabled={authLoading}
                            className="flex-1 bg-white hover:bg-neutral-100 text-black font-bold py-1.5 rounded-lg text-xs transition-colors border border-neutral-300"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════
          LEFT-SIDE SQUARE PROPERTY DETAILS MODAL
      ═══════════════════════════════════════════════════ */}
      {selectedDetailProperty && (
        <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center md:justify-start p-3 sm:p-5 md:p-8">
          {/* Subtle click-away backdrop */}
          <div 
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-[2px] pointer-events-auto transition-opacity cursor-pointer"
            onClick={() => setSelectedDetailProperty(null)}
            title="Click outside to close"
          />

          {/* Square Container on the Left Side */}
          <div className="relative pointer-events-auto w-full max-w-[490px] h-full max-h-[calc(100vh-3rem)] sm:max-h-[520px] bg-[#ffffff] border-2 border-amber-500/60 rounded-3xl shadow-2xl overflow-hidden flex flex-col z-10 animate-in fade-in slide-in-from-bottom-4 md:slide-in-from-left-6 duration-200">
            {/* 1. Header */}
            <div className="px-4 py-3 border-b border-[#f3ede0] bg-[#faf7f0] flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0">
                  <Building2 className="w-4 h-4 text-amber-700" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs sm:text-sm font-bold text-[#2d2216] truncate">
                    {selectedDetailProperty.title}
                  </h3>
                  <div className="flex items-center space-x-1.5 text-[10px] text-[#6b5843]">
                    <span className="font-semibold text-amber-700">{selectedDetailProperty.city || 'Dubai'}</span>
                    <span>•</span>
                    <span className="truncate">{selectedDetailProperty.community}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedDetailProperty(null)}
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-[#eee6d3] flex items-center justify-center transition-colors shrink-0"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 2. Scrollable Body */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 text-xs text-[#4a3b2c]">
              {/* Image banner */}
              <div className="relative h-44 rounded-2xl overflow-hidden border border-[#e2d9c6] shrink-0">
                <img
                  src={selectedDetailProperty.image_url}
                  alt={selectedDetailProperty.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-2 left-2 flex items-center space-x-1.5">
                  <span className="bg-amber-500 text-amber-950 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider shadow-sm">
                    {selectedDetailProperty.status || 'Verified'}
                  </span>
                  <span className="bg-slate-900/80 backdrop-blur-sm text-white px-2 py-0.5 rounded-md text-[10px] font-semibold">
                    {selectedDetailProperty.property_type}
                  </span>
                </div>
                {selectedDetailProperty.expected_roi && (
                  <div className="absolute bottom-2 right-2 bg-emerald-600/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-md backdrop-blur-xs shadow-sm">
                    {selectedDetailProperty.expected_roi}
                  </div>
                )}
              </div>

              {/* Price & Currency */}
              <div className="bg-[#faf7f0] border border-[#e8dec8] rounded-xl p-2.5 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-[#7d6952] uppercase tracking-wider font-semibold block">Asking Price</span>
                  <div className="text-base sm:text-lg font-black text-amber-700">
                    AED {selectedDetailProperty.price_aed?.toLocaleString()}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-[#7d6952] uppercase tracking-wider font-semibold block">Approx INR</span>
                  <div className="text-xs sm:text-sm font-bold text-slate-700">
                    ₹ {(selectedDetailProperty.price_inr || Math.round(selectedDetailProperty.price_aed * 22.8)).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Specs Grid */}
              <div className="grid grid-cols-4 gap-1.5 text-center">
                <div className="bg-[#f7f3ea] border border-[#e8dec8] rounded-xl p-2">
                  <Bed className="w-3.5 h-3.5 text-amber-700 mx-auto mb-1" />
                  <span className="text-[10px] text-[#7d6952] block">Bedrooms</span>
                  <span className="font-bold text-[#2d2216] text-xs">{selectedDetailProperty.bedrooms} BR</span>
                </div>
                <div className="bg-[#f7f3ea] border border-[#e8dec8] rounded-xl p-2">
                  <Bath className="w-3.5 h-3.5 text-amber-700 mx-auto mb-1" />
                  <span className="text-[10px] text-[#7d6952] block">Bathrooms</span>
                  <span className="font-bold text-[#2d2216] text-xs">{selectedDetailProperty.bathrooms || '2'}</span>
                </div>
                <div className="bg-[#f7f3ea] border border-[#e8dec8] rounded-xl p-2">
                  <Maximize2 className="w-3.5 h-3.5 text-amber-700 mx-auto mb-1" />
                  <span className="text-[10px] text-[#7d6952] block">Built-up</span>
                  <span className="font-bold text-[#2d2216] text-xs">{selectedDetailProperty.size_sqft} sqft</span>
                </div>
                <div className="bg-[#f7f3ea] border border-[#e8dec8] rounded-xl p-2">
                  <Building2 className="w-3.5 h-3.5 text-amber-700 mx-auto mb-1" />
                  <span className="text-[10px] text-[#7d6952] block">Furnished</span>
                  <span className="font-bold text-[#2d2216] text-xs truncate block">{selectedDetailProperty.furnished || 'Ready'}</span>
                </div>
              </div>

              {/* Extra details (Developer, Payment plan, Handover) */}
              <div className="bg-[#ffffff] border border-[#e8dec8] rounded-xl p-2.5 space-y-1.5 text-[11px]">
                <div className="flex justify-between items-center">
                  <span className="text-[#7d6952]">Developer</span>
                  <span className="font-bold text-[#2d2216]">{selectedDetailProperty.developer}</span>
                </div>
                {selectedDetailProperty.handover_date && (
                  <div className="flex justify-between items-center">
                    <span className="text-[#7d6952]">Handover Date</span>
                    <span className="font-bold text-[#2d2216]">{selectedDetailProperty.handover_date}</span>
                  </div>
                )}
                {selectedDetailProperty.payment_plan && (
                  <div className="flex justify-between items-center">
                    <span className="text-[#7d6952]">Payment Plan</span>
                    <span className="font-bold text-amber-700">{selectedDetailProperty.payment_plan}</span>
                  </div>
                )}
                {selectedDetailProperty.rera_id && (
                  <div className="flex justify-between items-center">
                    <span className="text-[#7d6952]">RERA Permit ID</span>
                    <span className="font-mono text-[10px] text-slate-600">{selectedDetailProperty.rera_id}</span>
                  </div>
                )}
              </div>

              {/* Description */}
              <div>
                <h4 className="text-[11px] font-bold text-[#2d2216] uppercase tracking-wider mb-1">Description</h4>
                <p className="text-[11px] text-[#5c4936] leading-relaxed bg-[#faf7f0] p-2.5 rounded-xl border border-[#e8dec8]">
                  {selectedDetailProperty.description}
                </p>
              </div>

              {/* Amenities */}
              {selectedDetailProperty.amenities && selectedDetailProperty.amenities.length > 0 && (
                <div>
                  <h4 className="text-[11px] font-bold text-[#2d2216] uppercase tracking-wider mb-1">Amenities</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedDetailProperty.amenities.map((amenity, i) => (
                      <span key={i} className="text-[10px] bg-[#faf7f0] text-[#5c4936] border border-[#e8dec8] px-2 py-0.5 rounded-lg font-medium">
                        ✓ {amenity}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 3. Footer Actions */}
            <div className="px-4 py-2.5 border-t border-[#f3ede0] bg-[#faf7f0] flex items-center justify-between gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setInputText(`Tell me more about ${selectedDetailProperty.title} in ${selectedDetailProperty.community}`);
                  setSelectedDetailProperty(null);
                }}
                className="bg-[#ffffff] hover:bg-[#eee6d3] text-[#4a3b2c] border border-[#d6cbb4] text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors flex items-center space-x-1"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>Ask AI</span>
              </button>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setSelectedDetailProperty(null)}
                  className="text-xs text-[#6b5843] hover:text-[#2d2216] font-medium px-2 py-1.5 transition-colors"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const p = selectedDetailProperty;
                    setSelectedDetailProperty(null);
                    onBookViewing(p);
                  }}
                  className="bg-amber-500 hover:bg-amber-400 text-amber-950 font-bold px-3.5 py-1.5 rounded-xl text-xs transition-colors flex items-center space-x-1.5 shadow-sm"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Book Viewing</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
