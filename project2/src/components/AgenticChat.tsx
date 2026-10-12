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
  Save
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
  saveUserChatToFirestore
} from '../lib/firebase';
import { 
  GoogleAuthProvider, 
  signInWithPopup, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  updateEmail,
  updateProfile,
  reauthenticateWithCredential,
  EmailAuthProvider
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
  const [userId, setUserId] = useState('');
  const [authProviderName, setAuthProviderName] = useState<'Google' | 'Email' | ''>('');
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [showEmailUpdateModal, setShowEmailUpdateModal] = useState(false);
  const [newEmailInput, setNewEmailInput] = useState('');
  const [emailUpdatePassword, setEmailUpdatePassword] = useState('');
  const [emailUpdateError, setEmailUpdateError] = useState('');
  const [emailUpdateLoading, setEmailUpdateLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
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

  // ── Auth state persistence ──────────────────────────────────────────────
  // onAuthStateChanged restores user session from Firebase Auth on mount or page reload.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserLoggedIn(true);
        setUserEmail(user.email || '');
        setUserId(user.uid);
        // Determine provider from the first available providerData entry
        const provider = user.providerData?.[0]?.providerId;
        setAuthProviderName(
          provider === 'google.com' ? 'Google' : 'Email'
        );
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
        // No user — reset state (guest mode)
        setUserLoggedIn(false);
        setUserName('');
        setUserFullName('');
        setUserAge('');
        setUserEmail('');
        setUserPassword('');
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

  const [savedSessions, setSavedSessions] = useState<SavedSession[]>([]);
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

  useEffect(() => {
    async function loadSessions() {
      if (userLoggedIn && userId) {
        try {
          const sessions = await getUserChatSessionsFromFirestore(userId, userEmail);
          setSavedSessions(sessions);
        } catch (error) {
          console.warn('Failed to load chat sessions', error);
        }
      } else {
        try {
          const localLeadsStr = localStorage.getItem('localLeads');
          const localMsgsStr = localStorage.getItem('localInteractions');
          if (localLeadsStr && localMsgsStr) {
            const leads: LeadProfile[] = JSON.parse(localLeadsStr);
            const allMsgs: ChatMessage[] = JSON.parse(localMsgsStr);
            const sessions: SavedSession[] = [];
            
            for (const lead of leads) {
              const msgs = allMsgs.filter(m => m.lead_id === lead.id).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
              if (msgs.length > 0) {
                sessions.push({
                  id: lead.id,
                  title: lead.summary || `${lead.intent || 'General'} Inquiry`,
                  preview: msgs[msgs.length - 1].content.substring(0, 60) + '...',
                  timestamp: lead.updatedAt || msgs[msgs.length - 1].timestamp,
                  messageCount: msgs.length,
                  leadProfile: lead,
                  messages: msgs
                });
              }
            }
            // Sort sessions by timestamp descending
            sessions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            setSavedSessions(sessions);
          } else {
            setSavedSessions([]);
          }
        } catch (e) {
          console.warn('Failed to parse local sessions', e);
          setSavedSessions([]);
        }
      }
    }
    loadSessions();
  }, [userLoggedIn, userId, userEmail, messages.length]);

  // Set active session id
  useEffect(() => {
    setActiveSessionId(currentLead.id);
  }, [currentLead.id]);

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
        // Fetch profile to populate Age and Name
        const profile = await getUserProfileFromFirestore(userEmail, userId);
        if (profile) {
          finalUserName = profile.Name || userCredential.user.displayName || userEmail.split('@')[0];
          if (profile.Age) {
            finalAge = profile.Age;
            setUserAge(String(profile.Age));
          }
        } else {
          finalUserName = userCredential.user.displayName || userEmail.split('@')[0];
        }
      }
      
      setUserLoggedIn(true);
      setUserName(finalUserName);
      setUserId(userId);
      setAuthProviderName('Email');
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
          user_id: userId,
          full_name: finalUserName,
          email: userEmail
        });
      }
      if (onAuthChange) onAuthChange(userId, userEmail);
      if (messages.length > 0) {
        syncSessionToUserProfile(userEmail, userId, { ...currentLead, user_id: userId, email: userEmail }, messages).catch(() => {});
      }
    } catch (error: any) {
      // Handle standard Firebase errors gracefully
      if (error.code === 'auth/email-already-in-use') {
        setAuthMode('login');
        setAuthError('This email is already registered. We have switched to Sign In for you. Please enter your password.');
      } else if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
        // 'invalid-credential' is the modern Firebase error for both wrong password and missing user
        // We can check if they are in 'login' mode, maybe they don't have an account
        if (authMode === 'login') {
          setAuthMode('signup');
          setAuthError('User not found in Firebase. You cannot sign in — please sign up first!');
        } else {
          setAuthError('Invalid email or password.');
        }
      } else if (error.code === 'auth/wrong-password') {
        setAuthError('Invalid password. Please try again.');
      } else {
        setAuthError(error.message);
      }
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
    setUserLoggedIn(false);
    setUserEmail('');
    setUserPassword('');
    setUserName('');
    setUserFullName('');
    setUserAge('');
    setUserId('');
    setAuthProviderName('');
    setDeleteConfirm(false);
    setShowAuthModal(false);
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
      } catch (_) {}

      // 4. Clear all active session state
      setUserLoggedIn(false);
      setUserEmail('');
      setUserPassword('');
      setUserName('');
      setUserFullName('');
      setUserAge('');
      setUserId('');
      setAuthProviderName('');
      setDeleteConfirm(false);
      setShowAuthModal(false);

      if (onAuthChange) onAuthChange(null, undefined);
      if (onStartNewChat) onStartNewChat();
    } catch (err: any) {
      setAuthError('Error deleting user: ' + err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleUpdateEmail = async () => {
    if (!newEmailInput.trim() || !emailUpdatePassword.trim()) {
      setEmailUpdateError('Please enter both new email and current password.');
      return;
    }
    if (!newEmailInput.includes('@')) {
      setEmailUpdateError('Please enter a valid email address.');
      return;
    }
    const currentUser = auth.currentUser;
    if (!currentUser) {
      setEmailUpdateError('No user logged in.');
      return;
    }

    setEmailUpdateLoading(true);
    setEmailUpdateError('');

    try {
      // Re-authenticate user with current password
      const credential = EmailAuthProvider.credential(currentUser.email!, emailUpdatePassword);
      await reauthenticateWithCredential(currentUser, credential);

      // Update email in Firebase Auth
      await updateEmail(currentUser, newEmailInput.trim().toLowerCase());

      // Update display name if needed
      await updateProfile(currentUser, {
        displayName: userName || currentUser.displayName || undefined
      });

      // Update user_login document in Firestore with new email
      const oldEmail = currentUser.email;
      const userId = currentUser.uid;
      const newEmail = newEmailInput.trim().toLowerCase();

      // Update user_login document (delete old, create new with new email)
      if (oldEmail) {
        await deleteUserLoginFromFirestore(userId, oldEmail);
      }
      await saveUserLoginToFirestore(
        userId,
        newEmail,
        userName || currentUser.displayName || 'User',
        authProviderName || (currentUser.providerData?.[0]?.providerId === 'google.com' ? 'Google' : 'Email')
      );

      // Update local state
      setUserEmail(newEmail);
      setEmailUpdateError('');
      setShowEmailUpdateModal(false);
      setNewEmailInput('');
      setEmailUpdatePassword('');

      // Notify parent component of auth change
      if (onAuthChange) onAuthChange(userId, newEmail);

    } catch (err: any) {
      if (err.code === 'auth/requires-recent-login') {
        setEmailUpdateError('Please log in again to update your email.');
      } else if (err.code === 'auth/email-already-in-use') {
        setEmailUpdateError('This email is already in use by another account.');
      } else if (err.code === 'auth/invalid-email') {
        setEmailUpdateError('Invalid email format.');
      } else if (err.code === 'auth/wrong-password') {
        setEmailUpdateError('Incorrect password. Please try again.');
      } else {
        setEmailUpdateError(err.message || 'Failed to update email. Please try again.');
      }
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
              onClick={() => { setLeftPanelCollapsed(false); setShowAuthModal(true); }}
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
          <div className="flex-1 flex flex-col overflow-hidden">

            {/* ─── NEW CHAT BUTTON ─── */}
            <div className="p-3 shrink-0">
              <button
                onClick={onStartNewChat}
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
                {/* Current active chat if not yet in saved sessions list */}
                {messages.length > 1 && !savedSessions.some(s => s.id === currentLead.id) && (
                  <button
                    onClick={() => setActiveSessionId(currentLead.id)}
                    className={`w-full text-left p-2.5 rounded-xl border transition-all group ${
                      activeSessionId === currentLead.id || activeSessionId === 'current'
                        ? 'bg-amber-500/10 border-amber-500/40 text-slate-300'
                        : 'bg-transparent border-transparent hover:bg-[#f3ede0] hover:border-[#e2d9c6] text-slate-400'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${activeSessionId === currentLead.id ? 'text-amber-600' : 'text-slate-600'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-semibold truncate">Active Conversation</p>
                        <p className="text-[9px] text-slate-500 truncate">{messages[messages.length - 1]?.content?.slice(0, 35)}...</p>
                      </div>
                      <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded-full font-medium shrink-0">Open</span>
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
                          setActiveSessionId(session.id);
                          if (onLoadChat) onLoadChat(session.leadProfile, session.messages);
                        }}
                        className={`w-full text-left p-2.5 rounded-xl border transition-all ${
                          isActive
                            ? 'bg-amber-500/10 border-amber-500/40 text-slate-300 shadow-sm'
                            : 'bg-transparent border-transparent hover:bg-[#f3ede0] hover:border-[#e2d9c6] text-slate-400'
                        }`}
                      >
                        <div className="flex items-center space-x-2 pr-6">
                          <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-amber-500' : 'text-slate-600'}`} />
                          <p className={`text-[11px] font-semibold truncate flex-1 ${isActive ? 'text-amber-300' : 'text-slate-300'}`}>{session.title}</p>
                          {isActive && (
                            <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded-full font-medium shrink-0">Open</span>
                          )}
                        </div>
                        <p className="text-[9px] text-slate-500 truncate mt-1 ml-5">{session.preview}</p>
                        <div className="flex items-center justify-between mt-1 ml-5">
                          <span className="text-[9px] text-slate-600">{session.messageCount} msgs</span>
                          <span className="text-[9px] text-slate-600">{formatTime(session.timestamp)}</span>
                        </div>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onDeleteChat) onDeleteChat(session.id);
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

            {/* ─── BOTTOM MENU / PROFILE BUTTON ─── */}
            <div className="p-3 border-t border-[#f3ede0] shrink-0 bg-[#f7f2e6]">
              <button
                onClick={() => setShowAuthModal(true)}
                className="w-full flex items-center justify-between p-2.5 rounded-xl bg-white hover:bg-[#faf6ee] transition-all border border-[#e2d9c6] shadow-xs"
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
                <ChevronUp className="w-4 h-4 text-slate-600 shrink-0" />
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
              className="flex items-center space-x-1.5 text-xs bg-[#f7f2e6] hover:bg-[#eee6d3] text-[#3a2e20] border border-[#d6cbb4] px-2.5 sm:px-3 py-1.5 rounded-full transition-colors font-medium shadow-xs"
              title="Talk to Human Agent"
            >
              <PhoneCall className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span className="hidden xs:inline sm:inline">Talk to Agent</span>
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

                      {/* Agentic Thinking Hidden per user request */}

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
                  isListening ? 'bg-rose-500 text-white animate-pulse' : 'text-[#6b5843] hover:text-slate-300 hover:bg-[#eee6d3]'
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
              <h3 className="font-extrabold text-base text-[#1e1610]">Account</h3>
              <button onClick={() => setShowAuthModal(false)} className="text-slate-500 hover:text-slate-300 p-1 bg-white rounded-md border border-[#e2d9c6]">
                <X className="w-4 h-4" />
              </button>
            </div>
            {/* ─── USER AUTH SECTION ─── */}
            <div className="p-4">
              {!userLoggedIn ? (
                authMode === 'google_signup' && pendingGoogleUser ? (
                  /* ─── GOOGLE SIGN UP COMPLETION (NEW USER) ─── */
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2.5 p-2.5 bg-amber-50 rounded-xl border border-amber-200">
                      <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5 shrink-0" alt="Google" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-800">New User Registration</p>
                        <p className="text-[11px] text-slate-600 truncate">{pendingGoogleUser.email}</p>
                      </div>
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">Verified</span>
                    </div>

                    <div className="text-xs bg-amber-50/80 p-2.5 rounded-xl border border-amber-200 text-amber-900 space-y-0.5">
                      <p className="font-bold text-[12px]">First-time User: Sign Up Required</p>
                      <p className="text-[11px] text-amber-800">
                        You do not have an account in Firebase yet. Please provide your Name and Age first to complete registration before continuing with Google.
                      </p>
                    </div>

                    <form onSubmit={handleCompleteGoogleSignUp} className="space-y-2.5">
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">Full Name</label>
                        <div className="relative">
                          <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                          <input
                            type="text"
                            value={userFullName}
                            onChange={e => { setUserFullName(e.target.value); setAuthError(''); }}
                            placeholder="Your full name"
                            required
                            className="w-full bg-white border border-[#e2d9c6] focus:border-amber-500 rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-slate-800 placeholder-slate-400 outline-none transition-colors"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">Age (Required)</label>
                        <div className="relative">
                          <UserCircle className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                          <input
                            type="number"
                            min={18}
                            max={120}
                            inputMode="numeric"
                            value={userAge}
                            onChange={e => { setUserAge(e.target.value); setAuthError(''); }}
                            placeholder="Enter your age (e.g. 28)"
                            required
                            className="w-full bg-white border border-[#e2d9c6] focus:border-amber-500 rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-slate-800 placeholder-slate-400 outline-none transition-colors"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">Email ID</label>
                        <div className="relative">
                          <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                          <input
                            type="email"
                            value={pendingGoogleUser.email}
                            disabled
                            readOnly
                            className="w-full bg-slate-100 border border-[#e2d9c6] rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-slate-600 outline-none cursor-not-allowed"
                          />
                        </div>
                      </div>

                      {authError && (
                        <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2 font-medium">
                          {authError}
                        </p>
                      )}

                      <button
                        type="submit"
                        disabled={authLoading}
                        className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-amber-950 font-bold py-2.5 rounded-xl text-xs transition-colors flex items-center justify-center space-x-1.5 shadow-xs"
                      >
                        {authLoading ? (
                          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        ) : (
                          <CheckCircle2 className="w-4 h-4" />
                        )}
                        <span>{authLoading ? 'Completing Sign Up...' : 'Complete Sign Up'}</span>
                      </button>

                      <button
                        type="button"
                        disabled={authLoading}
                        onClick={async () => {
                          try {
                            await signOut(auth);
                          } catch (e) {
                            // ignore
                          }
                          setPendingGoogleUser(null);
                          setAuthMode('login');
                          setAuthError('');
                        }}
                        className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2 rounded-xl text-xs transition-colors"
                      >
                        Cancel / Switch Account
                      </button>
                    </form>
                  </div>
                ) : (
                <div className="space-y-3">
                  <div className="flex items-center space-x-2.5 mb-2">
                    <div className="w-8 h-8 rounded-full bg-amber-100 border border-amber-200 flex items-center justify-center">
                      <User className="w-4 h-4 text-amber-800" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-300">Welcome</p>
                      <p className="text-xs font-medium text-slate-600">Sign in to save and sync your chats</p>
                    </div>
                  </div>

                  {/* Auth Tabs */}
                  <div className="flex bg-[#f7f2e6] rounded-xl p-1 border border-[#e2d9c6]">
                    {(['login', 'signup'] as const).map(mode => (
                      <button
                        key={mode}
                        onClick={() => { setAuthMode(mode); setAuthError(''); }}
                        className={`flex-1 text-xs font-bold py-1.5 rounded-lg transition-all capitalize ${
                          authMode === mode
                            ? 'bg-amber-500 text-amber-950 shadow-xs'
                            : 'text-slate-700 hover:text-slate-900'
                        }`}
                      >
                        {mode === 'login' ? 'Sign In' : 'Sign Up'}
                      </button>
                    ))}
                  </div>

                  {/* Auth Form */}
                  <form onSubmit={handleAuth} className="space-y-2.5">
                    {authMode === 'signup' && (
                      <>
                        <div className="relative">
                          <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                          <input
                            type="text"
                            value={userFullName}
                            onChange={e => { setUserFullName(e.target.value); setAuthError(''); }}
                            placeholder="Full name"
                            autoComplete="name"
                            required
                            className="w-full bg-white border border-[#e2d9c6] focus:border-amber-500 rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-slate-300 placeholder-slate-400 outline-none transition-colors"
                          />
                        </div>
                        <div className="relative">
                          <UserCircle className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                          <input
                            type="number"
                            min={18}
                            max={120}
                            inputMode="numeric"
                            value={userAge}
                            onChange={e => { setUserAge(e.target.value); setAuthError(''); }}
                            placeholder="Age"
                            required
                            className="w-full bg-white border border-[#e2d9c6] focus:border-amber-500 rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-slate-300 placeholder-slate-400 outline-none transition-colors"
                          />
                        </div>
                      </>
                    )}
                    <div className="relative">
                      <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type="email"
                        value={userEmail}
                        onChange={e => { setUserEmail(e.target.value); setAuthError(''); }}
                        placeholder="Email address"
                        required
                        className="w-full bg-white border border-[#e2d9c6] focus:border-amber-500 rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-slate-300 placeholder-slate-400 outline-none transition-colors"
                      />
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={userPassword}
                        onChange={e => { setUserPassword(e.target.value); setAuthError(''); }}
                        placeholder="Password"
                        required
                        className="w-full bg-white border border-[#e2d9c6] focus:border-amber-500 rounded-xl pl-9 pr-9 py-2 text-xs font-medium text-slate-300 placeholder-slate-400 outline-none transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(p => !p)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    {authError && (
                      <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2 font-medium">
                        {authError}
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={authLoading}
                      className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-amber-950 font-bold py-2.5 rounded-xl text-xs transition-colors flex items-center justify-center space-x-1.5 shadow-xs"
                    >
                      {authLoading ? (
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      ) : (
                        <LogIn className="w-4 h-4" />
                      )}
                      <span>{authLoading ? 'Signing in...' : authMode === 'login' ? 'Sign In' : 'Create Account'}</span>
                    </button>
                  </form>

                  <div className="flex items-center my-3">
                    <div className="flex-grow border-t border-slate-200"></div>
                    <span className="mx-2 text-xs font-bold text-slate-500">OR</span>
                    <div className="flex-grow border-t border-slate-200"></div>
                  </div>

                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={authLoading}
                    className="w-full bg-espresso-900 hover:bg-espresso-800 text-espresso-300 font-bold py-2.5 rounded-xl text-xs transition-colors flex items-center justify-center space-x-2 border border-espresso-700"
                  >
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-4 h-4" alt="Google" />
                    <span>{authMode === 'signup' ? 'Sign Up with Google' : 'Continue with Google'}</span>
                  </button>

                  {authMode === 'signup' && (
                    <p className="text-[11px] text-amber-850 bg-amber-50/90 border border-amber-200/80 rounded-lg p-2 text-center font-medium leading-tight text-amber-900">
                      * You must write your <strong>Name</strong> and <strong>Age</strong> above first before using Google Sign Up.
                    </p>
                  )}

                  <p className="text-xs font-medium text-slate-600 text-center mt-3">
                    Chat continues as guest without sign-in
                  </p>
                </div>
                )
              ) : (
                /* Logged-in User Profile Card & Controls */
                <div className="space-y-4">
                  {/* Profile Header */}
                  <div className="flex items-center space-x-3 p-3 bg-[#f7f2e6] rounded-xl border border-[#e2d9c6]">
                    <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-300 flex items-center justify-center text-amber-950 font-black text-base shrink-0 shadow-sm">
                      {userName[0]?.toUpperCase() || 'U'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-300 truncate">{userName || userFullName || 'Lyka Client'}</p>
                      <p className="text-xs text-slate-500 truncate">{userEmail || auth.currentUser?.email || 'Signed In'}</p>
                      <div className="flex items-center space-x-1.5 mt-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                        <span className="text-[10px] font-medium text-emerald-700">Database Synced (User_login)</span>
                      </div>
                    </div>
                  </div>

                  {/* Account Details & Edit Profile Section */}
                  {isEditingProfile ? (
                    <form onSubmit={handleSaveProfileChanges} className="p-3.5 bg-amber-50/80 rounded-xl border border-amber-200/90 space-y-3">
                      <div className="flex items-center justify-between border-b border-amber-200/80 pb-2">
                        <span className="text-xs font-bold text-amber-950 flex items-center space-x-1.5">
                          <Pencil className="w-3.5 h-3.5 text-amber-700" />
                          <span>Edit Name & Age</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => { setIsEditingProfile(false); setEditProfileError(''); setEditProfileSuccess(''); }}
                          className="text-[11px] text-slate-500 hover:text-slate-800 font-medium"
                        >
                          Cancel
                        </button>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700 block">Full Name</label>
                        <div className="relative">
                          <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input
                            type="text"
                            value={editNameInput}
                            onChange={(e) => { setEditNameInput(e.target.value); setEditProfileError(''); }}
                            placeholder="Your full name"
                            required
                            className="w-full bg-white border border-[#e2d9c6] focus:border-amber-500 rounded-xl pl-9 pr-3 py-2 text-xs font-semibold text-slate-800 outline-none transition-colors"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700 block">Age (Years)</label>
                        <div className="relative">
                          <UserCircle className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input
                            type="number"
                            min={18}
                            max={120}
                            inputMode="numeric"
                            value={editAgeInput}
                            onChange={(e) => { setEditAgeInput(e.target.value); setEditProfileError(''); }}
                            placeholder="Enter age (18 - 120)"
                            className="w-full bg-white border border-[#e2d9c6] focus:border-amber-500 rounded-xl pl-9 pr-3 py-2 text-xs font-semibold text-slate-800 outline-none transition-colors"
                          />
                        </div>
                      </div>

                      {editProfileError && (
                        <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-2.5 py-1.5 font-medium">
                          {editProfileError}
                        </p>
                      )}

                      {editProfileSuccess && (
                        <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-2.5 py-1.5 font-bold flex items-center space-x-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>{editProfileSuccess}</span>
                        </p>
                      )}

                      <div className="flex space-x-2 pt-1">
                        <button
                          type="button"
                          onClick={() => { setIsEditingProfile(false); setEditProfileError(''); }}
                          className="flex-1 bg-white hover:bg-slate-100 text-slate-700 font-semibold py-2 rounded-xl text-xs transition-colors border border-slate-200"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={editProfileLoading}
                          className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-amber-950 font-bold py-2 rounded-xl text-xs transition-colors flex items-center justify-center space-x-1.5 shadow-xs"
                        >
                          {editProfileLoading ? (
                            <span className="text-[11px]">Saving...</span>
                          ) : (
                            <>
                              <Save className="w-3.5 h-3.5" />
                              <span>Save</span>
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-2">
                      <div className="flex justify-between items-center text-slate-600">
                        <span className="font-medium">Full Name:</span>
                        <span className="font-bold text-slate-800">{userName || userFullName || 'Not set'}</span>
                      </div>
                      <div className="flex justify-between items-center text-slate-600">
                        <span className="font-medium">Age:</span>
                        <span className="font-semibold text-slate-800">{userAge ? `${userAge} years` : 'Not recorded'}</span>
                      </div>
                      <div className="flex justify-between items-center text-slate-600">
                        <span className="font-medium">Sign-in Method:</span>
                        <span className="font-semibold text-slate-800">{authProviderName || (auth.currentUser?.providerData?.[0]?.providerId === 'google.com' ? 'Google' : 'Email/Password')}</span>
                      </div>
                      <div className="flex justify-between items-center text-slate-600">
                        <span className="font-medium">User ID:</span>
                        <span className="font-mono text-[10px] text-slate-500 truncate max-w-[150px]">{userId || auth.currentUser?.uid || 'USR-LOCAL'}</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleStartEditProfile}
                        className="w-full mt-2 bg-white hover:bg-amber-50 text-amber-800 border border-[#e2d9c6] hover:border-amber-300 font-bold py-2 px-3 rounded-lg text-xs transition-all flex items-center justify-center space-x-1.5 shadow-2xs"
                      >
                        <Pencil className="w-3 h-3 text-amber-700" />
                        <span>Edit Name & Age</span>
                      </button>
                    </div>
                  )}

                  {authError && (
                    <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-start space-x-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{authError}</span>
                    </div>
                  )}

                  {/* Actions: Update Email, Logout & Delete */}
                  <div className="pt-2 border-t border-[#f3ede0] space-y-2">
                    {/* Update Email Button */}
                    <button
                      type="button"
                      onClick={() => { setShowEmailUpdateModal(true); setEmailUpdateError(''); setNewEmailInput(''); setEmailUpdatePassword(''); }}
                      disabled={authLoading || authProviderName === 'Google'}
                      className="w-full bg-amber-50 hover:bg-amber-100 text-amber-700 font-medium py-2.5 px-3 rounded-xl text-xs transition-colors flex items-center justify-center space-x-2 border border-amber-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Mail className="w-4 h-4" />
                      <span>Update Email</span>
                    </button>

                    {/* Log Out Button */}
                    <button
                      type="button"
                      onClick={handleSignOut}
                      disabled={authLoading}
                      className="w-full bg-[#f3ede0] hover:bg-[#eee6d3] text-slate-300 font-semibold py-2.5 px-3 rounded-xl text-xs transition-colors flex items-center justify-center space-x-2 border border-[#e2d9c6]"
                    >
                      <LogOut className="w-4 h-4 text-slate-600" />
                      <span>Log Out</span>
                    </button>

                    {/* Delete Account */}
                    {!deleteConfirm ? (
                      <button
                        type="button"
                        onClick={() => setDeleteConfirm(true)}
                        disabled={authLoading}
                        className="w-full bg-transparent hover:bg-red-50 text-red-600 font-medium py-2 px-3 rounded-xl text-xs transition-colors flex items-center justify-center space-x-1.5 border border-transparent hover:border-red-200"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete Account & Data</span>
                      </button>
                    ) : (
                      <div className="p-3 bg-red-50 rounded-xl border border-red-200 space-y-2.5">
                        <div className="flex items-start space-x-2">
                          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                          <p className="text-[11px] text-red-800 leading-snug">
                            Permanently delete your profile and remove your data from the <strong>user-login</strong> database?
                          </p>
                        </div>
                        <div className="flex space-x-2">
                          <button
                            type="button"
                            onClick={handleDeleteAccount}
                            disabled={authLoading}
                            className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-1.5 rounded-lg text-xs transition-colors flex items-center justify-center space-x-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>{authLoading ? 'Deleting...' : 'Confirm Delete'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirm(false)}
                            disabled={authLoading}
                            className="flex-1 bg-white hover:bg-slate-100 text-slate-700 font-medium py-1.5 rounded-lg text-xs transition-colors border border-slate-300"
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
</div>
  );
};
