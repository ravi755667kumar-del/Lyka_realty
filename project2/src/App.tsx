import React, { useState, useEffect, useMemo } from 'react';
import { signOut } from 'firebase/auth';
import { 
  LeadProfile, 
  ChatMessage, 
  PropertyListing, 
  FollowUpTask, 
  LeadStatus,
  AgenticDecision,
  PortalCredential,
  BookedPropertyRecord,
  FavoritePropertyRecord,
  UserProfileData,
  PortalStaffMember
} from './types/crm';
import { 
  createInitialLeadProfile, 
  extractEntitiesFromText, 
  computeCompletenessAndMissing, 
  evaluateLeadStatusAndPriority, 
  findMatchingProperties, 
  generateNextAdaptiveQuestion,
  isPropertyQuery 
} from './lib/agentic_engine';
import { ALL_VERIFIED_PROPERTIES } from './data/all_properties';
import { LYKA_AGENTS } from './data/dubai_knowledge';
import { 
  testConnection, 
  saveLeadToFirestore, 
  getLeadsFromFirestore, 
  getUserLeadsFromFirestore,
  saveInteractionToFirestore, 
  saveUserChatToFirestore,
  deleteUserChatFromFirestore,
  getMessagesForLead,
  saveFollowUpToFirestore, 
  getFollowUpsFromFirestore,
  deleteLeadFromFirestore,
  deleteMessagesForLead,
  syncSessionToUserProfile,
  deleteSessionFromUserProfile,
  getAllUsersFromFirestore,
  saveTalkToAgentRequest,
  ensurePortalCredentialsInFirestore,
  verifyPortalLoginFromFirestore,
  savePortalCredentialToFirestore,
  recordSalesManagerLoginInFirestore,
  deletePortalOtpFromFirestore,
  savePropertyToFirestore,
  getPropertiesFromFirestore,
  deletePropertyFromFirestore,
  saveBookedPropertyToFirestore,
  cancelBookedPropertyInFirestore,
  saveFavoritePropertyToFirestore,
  removeFavoritePropertyFromFirestore,
  getFavoritePropertiesFromFirestore,
  fetchPortalStaff,
  auth
} from './lib/firebase';
import { Navbar } from './components/Navbar';
import { AboutProjectModal } from './components/AboutProjectModal';
import { AgenticChat } from './components/AgenticChat';
import { HomeLanding } from './components/HomeLanding';
import { LeadProfileSidebar } from './components/LeadProfileSidebar';
import { CrmPipeline } from './components/CrmPipeline';
import { PropertyInventory } from './components/PropertyInventory';
import { SalesManagerDashboard } from './components/SalesManagerDashboard';
import { AdminFavoritesView } from './components/AdminFavoritesView';
import { AssignedPropertiesView } from './components/AssignedPropertiesView';
import { KnowledgeBaseView } from './components/KnowledgeBaseView';
import { AdminStats } from './components/AdminStats';
import { CustomerAnalytics } from './components/CustomerAnalytics';
import { CustomerProfiles } from './components/CustomerProfiles';
import { AdminUserChatHistory } from './components/AdminUserChatHistory';
import { AdminCopilotChat } from './components/AdminCopilotChat';
import { AdminStaffManagement } from './components/AdminStaffManagement';
import { SettingsModal, AppTheme } from './components/SettingsModal';
import { talkToAgentSchema, mobilePhoneSchema, otpSchema } from './schemas/validation';
import { 
  Calendar, 
  CheckCircle2, 
  PhoneCall, 
  Phone,
  UserCheck, 
  X, 
  AlertCircle, 
  Building2, 
  Send,
  ShieldCheck,
  Lock,
  Database,
  Settings,
  Save,
  KeyRound,
  Copy,
  Check,
  Mail,
  Clock,
  AlertTriangle,
  Eye,
  EyeOff,
  Heart,
  Sparkles,
  RefreshCw,
  ExternalLink,
  ArrowLeft,
  ArrowRight
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'home' | 'chat' | 'crm' | 'properties' | 'knowledge' | 'stats' | 'customers' | 'user_chats' | 'login_stats' | 'assigned_properties' | 'sales_duplicates' | 'sales_missing_requirements' | 'favorites' | 'staff_access'>('home');
  const [chatHistoryTargetUser, setChatHistoryTargetUser] = useState<UserProfileData | null>(null);
  const [dbFavoritesList, setDbFavoritesList] = useState<FavoritePropertyRecord[]>([]);

  function getGuestSessionId(): string {
    try {
      let id = localStorage.getItem('lyka_guest_session_id');
      if (!id) {
        id = 'guest_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36).slice(-4);
        localStorage.setItem('lyka_guest_session_id', id);
      }
      return id;
    } catch {
      return 'guest_device';
    }
  }

  const fetchDbFavorites = async () => {
    try {
      const firestoreFavs = await getFavoritePropertiesFromFirestore();
      if (firestoreFavs && firestoreFavs.length > 0) {
        setDbFavoritesList(firestoreFavs);
        return;
      }
    } catch (_) {}

    try {
      const res = await fetch('/api/favorites');
      const data = await res.json();
      if (data && data.success && Array.isArray(data.favorites)) {
        setDbFavoritesList(data.favorites);
      }
    } catch (_) {}
  };

  const handleAdminDeleteFavorite = async (favoriteId: string) => {
    await removeFavoritePropertyFromFirestore(favoriteId);
    fetch('/api/favorites/remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: favoriteId })
    }).catch(() => {});
    setDbFavoritesList(curr => curr.filter(f => f.id !== favoriteId));
  };

  const [customerCount, setCustomerCount] = useState<number>(0);
  const [currentLead, setCurrentLead] = useState<LeadProfile>(createInitialLeadProfile());
  const [leadsList, setLeadsList] = useState<LeadProfile[]>([]);
  const [followUpsList, setFollowUpsList] = useState<FollowUpTask[]>([]);
  const [propertiesList, setPropertiesList] = useState<PropertyListing[]>(() => {
    try {
      const savedDeleted = localStorage.getItem('deletedPropertyIds');
      const deletedSet = new Set<string>(savedDeleted ? JSON.parse(savedDeleted) : []);
      const saved = localStorage.getItem('localProperties');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.filter((p: any) => p && p.id && !deletedSet.has(p.id));
        }
      }
      return ALL_VERIFIED_PROPERTIES.filter(p => !deletedSet.has(p.id));
    } catch (e) {
      console.warn('Error reading localProperties from localStorage:', e);
    }
    return ALL_VERIFIED_PROPERTIES;
  });
  const [firestoreActive, setFirestoreActive] = useState(false);
  const [mongoStatus, setMongoStatus] = useState({ connected: false, uriConfigured: false, count: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [adminPanelOpen, setAdminPanelOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [theme, setTheme] = useState<AppTheme>(() => {
    try {
      const saved = localStorage.getItem('lyka_realty_theme') as AppTheme;
      if (saved && ['ivory', 'dark', 'navy'].includes(saved)) {
        return saved;
      }
    } catch (_) {}
    return 'ivory';
  });
  const [customBgColor, setCustomBgColor] = useState<string>(() => {
    try {
      return localStorage.getItem('lyka_realty_custom_bg') || '';
    } catch (_) {
      return '';
    }
  });
  const [engineProvider, setEngineProvider] = useState<'groq' | 'gemini'>('groq');
  const [activeModel, setActiveModel] = useState<string>('llama-3.3-70b-versatile');

  useEffect(() => {
    if (typeof document !== 'undefined') {
      const activeBg = customBgColor || (theme === 'dark' ? '#0b0f17' : theme === 'navy' ? '#070d1e' : '#fdfbf5');
      
      // Determine if dark contrast is needed
      let isDark = theme === 'dark' || theme === 'navy';
      if (customBgColor) {
        const clean = customBgColor.replace('#', '').trim();
        if (clean.length === 6) {
          const r = parseInt(clean.substring(0, 2), 16);
          const g = parseInt(clean.substring(2, 4), 16);
          const b = parseInt(clean.substring(4, 6), 16);
          isDark = (0.299 * r + 0.587 * g + 0.114 * b) < 145;
        }
      }
      const effectiveTheme = theme === 'navy' ? 'navy' : (theme === 'dark' ? 'dark' : 'ivory');

      document.documentElement.setAttribute('data-theme', effectiveTheme);
      document.documentElement.className = 'theme-' + effectiveTheme;
      document.body.setAttribute('data-theme', effectiveTheme);
      document.body.className = 'theme-' + effectiveTheme;
      if (effectiveTheme === 'dark' || effectiveTheme === 'navy') {
        document.documentElement.classList.add('dark');
        document.body.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
        document.body.classList.remove('dark');
      }

      // Apply CSS variable and inline style across whole window
      document.documentElement.style.setProperty('--lyka-bg', activeBg);
      document.documentElement.style.setProperty('--color-slate-950', activeBg);
      document.documentElement.style.backgroundColor = activeBg;
      document.body.style.backgroundColor = activeBg;

      try {
        localStorage.setItem('lyka_realty_theme', theme);
        if (customBgColor) {
          localStorage.setItem('lyka_realty_custom_bg', customBgColor);
        } else {
          localStorage.removeItem('lyka_realty_custom_bg');
        }
      } catch (_) {}
    }
  }, [theme, customBgColor]);
  const [adminTargetPortal, setAdminTargetPortal] = useState<'admin' | 'property_manager' | 'sales_manager'>(() => {
    try {
      const saved = localStorage.getItem('lyka_admin_target_portal');
      if (saved === 'property_manager' || saved === 'admin' || saved === 'sales_manager') return saved;
    } catch (e) {}
    return 'admin';
  });
  // Admin authentication gate — PERSISTED in localStorage until explicit logout
  const [adminAuthenticated, setAdminAuthenticated] = useState<boolean>(() => {
    try {
      return localStorage.getItem('lyka_admin_authenticated') === 'true';
    } catch (e) {
      return false;
    }
  });
  const [propertyManagerAuthenticated, setPropertyManagerAuthenticated] = useState<boolean>(() => {
    try {
      return localStorage.getItem('lyka_pm_authenticated') === 'true';
    } catch (e) {
      return false;
    }
  });
  const [salesManagerAuthenticated, setSalesManagerAuthenticated] = useState<boolean>(() => {
    try {
      return localStorage.getItem('lyka_sm_authenticated') === 'true';
    } catch (e) {
      return false;
    }
  });
  const isPortalAuthed = adminTargetPortal === 'admin' 
    ? adminAuthenticated 
    : adminTargetPortal === 'property_manager'
    ? (propertyManagerAuthenticated || adminAuthenticated)
    : (salesManagerAuthenticated || adminAuthenticated);
  const [showAdminLoginModal, setShowAdminLoginModal] = useState(false);
  const [adminEmailInput, setAdminEmailInput] = useState('');
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [showConfigSalesPassword, setShowConfigSalesPassword] = useState(false);
  const [showConfigPmPassword, setShowConfigPmPassword] = useState(false);
  const [showConfigAdminPassword, setShowConfigAdminPassword] = useState(false);
  const [adminLoginError, setAdminLoginError] = useState('');
  const [adminLoginLoading, setAdminLoginLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);

  // Database-backed Admin, Property Manager, & Sales Manager profile metadata (Passwords are never loaded client-side)
  
  // Authorized Staff Access State (Property Admins and Sales Managers added by Super Admin)
  const [staffList, setStaffList] = useState<PortalStaffMember[]>([]);

  const loadStaffList = async () => {
    try {
      const staff = await fetchPortalStaff();
      setStaffList(staff);
    } catch (err) {
      console.warn('Could not load staff list:', err);
    }
  };

  useEffect(() => {
    loadStaffList();
  }, []);

  const [adminDbCredentials, setAdminDbCredentials] = useState<PortalCredential[]>([
    { id: 'admin', email: 'admin@lykarealty.ae', role: 'admin', name: 'Lyka Super Admin' }
  ]);
  const [pmDbCredentials, setPmDbCredentials] = useState<PortalCredential[]>([
    { id: 'property_manager', email: 'manager@lykarealty.ae', role: 'property_manager', name: 'Lyka Property Manager' }
  ]);
  const [salesDbCredentials, setSalesDbCredentials] = useState<PortalCredential[]>([
    { id: 'sales_manager', email: 'sales@lykarealty.ae', role: 'sales_manager', name: 'Lyka Sales Manager' }
  ]);
  const [showCredentialConfig, setShowCredentialConfig] = useState(false);
  const [configAdminEmail, setConfigAdminEmail] = useState('');
  const [configAdminPassword, setConfigAdminPassword] = useState('');
  const [configPmEmail, setConfigPmEmail] = useState('');
  const [configPmPassword, setConfigPmPassword] = useState('');
  const [configSalesEmail, setConfigSalesEmail] = useState('');
  const [configSalesPassword, setConfigSalesPassword] = useState('');
  const [configSaving, setConfigSaving] = useState(false);
  const [configSuccessMsg, setConfigSuccessMsg] = useState('');
  const [configErrorMsg, setConfigErrorMsg] = useState('');
  const [configPortalTab, setConfigPortalTab] = useState<'admin' | 'property_manager' | 'sales_manager'>('sales_manager');

  // Forgot Password & Reset Password states for all Admin sections
  const [adminAuthMode, setAdminAuthMode] = useState<'login' | 'forgot_password' | 'link_sent' | 'reset_password'>('login');
  const [forgotEmailInput, setForgotEmailInput] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');
  const [sentResetUrl, setSentResetUrl] = useState('');
  const [activeResetToken, setActiveResetToken] = useState('');
  const [resetTargetPortal, setResetTargetPortal] = useState<'admin' | 'property_manager' | 'sales_manager'>('admin');
  const [resetTargetEmail, setResetTargetEmail] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resetPasswordLoading, setResetPasswordLoading] = useState(false);
  const [resetPasswordError, setResetPasswordError] = useState('');
  const [resetPasswordSuccess, setResetPasswordSuccess] = useState('');
  const [generatedPasswordNotice, setGeneratedPasswordNotice] = useState(false);
  const [passwordFailedAttempt, setPasswordFailedAttempt] = useState(false);

  const ADMIN_EMAIL = adminDbCredentials[0]?.email || 'raviku6678@gmail.com';
  const PM_EMAIL = pmDbCredentials[0]?.email || 'ravikumar755667@gmail.com';
  const SALES_EMAIL = salesDbCredentials[0]?.email || 'raviku6678@gmail.com';

  const adminEmails = useMemo(() => {
    const list = [
      (adminDbCredentials[0]?.email || 'raviku6678@gmail.com').toLowerCase(),
      (pmDbCredentials[0]?.email || 'ravikumar755667@gmail.com').toLowerCase(),
      (salesDbCredentials[0]?.email || 'sales@lykarealty.ae').toLowerCase(),
      'raviku6678@gmail.com',
      'ravikumar755667@gmail.com'
    ];
    staffList.forEach(s => {
      if (s.email) list.push(s.email.toLowerCase().trim());
    });
    return Array.from(new Set(list));
  }, [adminDbCredentials, pmDbCredentials, salesDbCredentials, staffList]);

  // When a regular customer user logs in on Home or Chat, they must NOT see the admin header or panel
  const isCustomerLoggedIn = useMemo(() => {
    if (!currentUserEmail) return false;
    const clean = currentUserEmail.trim().toLowerCase();
    return !adminEmails.includes(clean);
  }, [currentUserEmail, adminEmails]);

  const effectiveAdminAuthed = isCustomerLoggedIn ? false : adminAuthenticated;
  const effectivePmAuthed = isCustomerLoggedIn ? false : propertyManagerAuthenticated;
  const effectiveSmAuthed = isCustomerLoggedIn ? false : salesManagerAuthenticated;

  // Email 6-Digit OTP states for Admin / Property Manager Login (Valid for 3 Minutes)
  const [adminOtpInput, setAdminOtpInput] = useState('');
  const [adminOtpSent, setAdminOtpSent] = useState(false);
  const [adminOtpLoading, setAdminOtpLoading] = useState(false);
  const [adminOtpSuccessMsg, setAdminOtpSuccessMsg] = useState('');
  const [adminOtpExpiresAt, setAdminOtpExpiresAt] = useState<number | null>(null);
  const [otpTimeRemaining, setOtpTimeRemaining] = useState<number>(180); // 3 minutes = 180s

  // OTP Rate Limiter (Max 5 attempts, 1-hour cooldown lockout)
  const [adminOtpAttemptsUsed, setAdminOtpAttemptsUsed] = useState<number>(0);
  const [adminOtpLockedUntil, setAdminOtpLockedUntil] = useState<number | null>(null);
  const [adminOtpLockoutRemaining, setAdminOtpLockoutRemaining] = useState<number>(0);

  // 3-Minute countdown timer for OTP
  useEffect(() => {
    let timer: any = null;
    if (adminOtpSent && adminOtpExpiresAt) {
      timer = setInterval(() => {
        const remaining = Math.max(0, Math.floor((adminOtpExpiresAt - Date.now()) / 1000));
        setOtpTimeRemaining(remaining);
        if (remaining <= 0) {
          if (timer) clearInterval(timer);
        }
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [adminOtpSent, adminOtpExpiresAt]);

  // 1-Hour Lockout Countdown Timer
  useEffect(() => {
    let timer: any = null;
    if (adminOtpLockedUntil) {
      const updateLockout = () => {
        const diff = Math.max(0, Math.floor((adminOtpLockedUntil - Date.now()) / 1000));
        setAdminOtpLockoutRemaining(diff);
        if (diff <= 0) {
          setAdminOtpLockedUntil(null);
          setAdminOtpAttemptsUsed(0);
          if (adminEmailInput) {
            try {
              localStorage.removeItem(`lyka_admin_otp_limit_${adminEmailInput.trim().toLowerCase()}`);
            } catch (e) {}
          }
          if (timer) clearInterval(timer);
        }
      };
      updateLockout();
      timer = setInterval(updateLockout, 1000);
    } else {
      setAdminOtpLockoutRemaining(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [adminOtpLockedUntil, adminEmailInput]);

  // Synchronize rate limit status when email or portal modal changes
  useEffect(() => {
    const email = adminEmailInput.trim().toLowerCase();
    if (!email) {
      setAdminOtpAttemptsUsed(0);
      setAdminOtpLockedUntil(null);
      setAdminOtpLockoutRemaining(0);
      return;
    }

    try {
      const cached = localStorage.getItem(`lyka_admin_otp_limit_${email}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.lockedUntil && parsed.lockedUntil > Date.now()) {
          setAdminOtpLockedUntil(parsed.lockedUntil);
          setAdminOtpAttemptsUsed(5);
        } else if (typeof parsed.attemptsUsed === 'number') {
          setAdminOtpAttemptsUsed(parsed.attemptsUsed);
        }
      }
    } catch (e) {}

    fetch(`/api/auth/otp-status?email=${encodeURIComponent(email)}`)
      .then(res => res.json())
      .then(data => {
        if (data.locked && data.lockedUntil && data.lockedUntil > Date.now()) {
          setAdminOtpLockedUntil(data.lockedUntil);
          setAdminOtpAttemptsUsed(5);
          try {
            localStorage.setItem(`lyka_admin_otp_limit_${email}`, JSON.stringify({
              lockedUntil: data.lockedUntil,
              attemptsUsed: 5
            }));
          } catch (e) {}
        } else if (typeof data.attemptsUsed === 'number') {
          setAdminOtpAttemptsUsed(data.attemptsUsed);
          if (!data.locked) {
            setAdminOtpLockedUntil(null);
          }
        }
      })
      .catch(() => {});
  }, [adminEmailInput, showAdminLoginModal]);

  // Explicitly revoke all admin sessions and storage tokens
  const revokeAdminAuthSessions = () => {
    setAdminAuthenticated(false);
    setPropertyManagerAuthenticated(false);
    setSalesManagerAuthenticated(false);
    setAdminPanelOpen(false);
    try {
      localStorage.removeItem('lyka_admin_authenticated');
      localStorage.removeItem('lyka_pm_authenticated');
      localStorage.removeItem('lyka_sm_authenticated');
    } catch (_) {}
  };

  const resetAdminModalState = () => {
    setAdminLoginError('');
    setAdminOtpInput('');
    setAdminOtpSent(false);
    setAdminOtpLoading(false);
    setAdminOtpSuccessMsg('');
    setAdminOtpExpiresAt(null);
    setOtpTimeRemaining(180);
    setConfigSuccessMsg('');
    setConfigErrorMsg('');
    setShowAdminPassword(false);
    setShowConfigSalesPassword(false);
    setShowConfigPmPassword(false);
    setShowConfigAdminPassword(false);
    setPasswordFailedAttempt(false);
  };

  const handleSelectPortalTab = (portal: 'admin' | 'property_manager' | 'sales_manager') => {
    setAdminTargetPortal(portal);
    setConfigPortalTab(portal);
    resetAdminModalState();
    if (portal === 'admin') {
      setAdminEmailInput(adminDbCredentials[0]?.email || ADMIN_EMAIL);
    } else if (portal === 'property_manager') {
      setAdminEmailInput(pmDbCredentials[0]?.email || PM_EMAIL);
    } else {
      setAdminEmailInput(salesDbCredentials[0]?.email || SALES_EMAIL);
    }
    setAdminPasswordInput('');
  };

  const handleSaveIndividualPortalCredential = async (portal: 'admin' | 'property_manager' | 'sales_manager') => {
    setConfigSaving(true);
    setConfigErrorMsg('');
    setConfigSuccessMsg('');

    try {
      if (portal === 'sales_manager') {
        const permanentEmail = salesDbCredentials[0]?.email || SALES_EMAIL;
        const passToSave = configSalesPassword.trim();
        if (!passToSave) {
          setConfigErrorMsg('Please provide a new password for Sales Manager.');
          setConfigSaving(false);
          return;
        }
        if (passToSave.length < 6) {
          setConfigErrorMsg('Password must be at least 6 characters long.');
          setConfigSaving(false);
          return;
        }
        const saved = await savePortalCredentialToFirestore('sales_manager', permanentEmail, passToSave, 'Lyka Sales Manager', 'sales_manager');
        setSalesDbCredentials([saved]);
        setAdminEmailInput(saved.email);
        setAdminTargetPortal('sales_manager');
        setConfigSuccessMsg(`Sales Admin password updated in Sales_login! (Email permanently locked to ${saved.email})`);
      } else if (portal === 'property_manager') {
        const permanentEmail = pmDbCredentials[0]?.email || PM_EMAIL;
        const passToSave = configPmPassword.trim();
        if (!passToSave) {
          setConfigErrorMsg('Please provide a new password for Property Manager.');
          setConfigSaving(false);
          return;
        }
        if (passToSave.length < 6) {
          setConfigErrorMsg('Password must be at least 6 characters long.');
          setConfigSaving(false);
          return;
        }
        const saved = await savePortalCredentialToFirestore('property_manager', permanentEmail, passToSave, 'Lyka Property Manager', 'property_manager');
        setPmDbCredentials([saved]);
        setAdminEmailInput(saved.email);
        setAdminTargetPortal('property_manager');
        setConfigSuccessMsg(`Property Admin password updated in Property_login! (Email permanently locked to ${saved.email})`);
      } else {
        const permanentEmail = adminDbCredentials[0]?.email || ADMIN_EMAIL;
        const passToSave = configAdminPassword.trim();
        if (!passToSave) {
          setConfigErrorMsg('Please provide a new password for Super Admin.');
          setConfigSaving(false);
          return;
        }
        if (passToSave.length < 6) {
          setConfigErrorMsg('Password must be at least 6 characters long.');
          setConfigSaving(false);
          return;
        }
        const saved = await savePortalCredentialToFirestore('admin', permanentEmail, passToSave, 'Lyka Super Admin', 'admin');
        setAdminDbCredentials([saved]);
        setAdminEmailInput(saved.email);
        setAdminTargetPortal('admin');
        setConfigSuccessMsg(`Super Admin password updated in Admin_login! (Email permanently locked to ${saved.email})`);
      }

      setAdminPasswordInput('');
      setTimeout(() => {
        setShowCredentialConfig(false);
        setConfigSuccessMsg('');
      }, 1600);
    } catch (err: any) {
      setConfigErrorMsg(err.message || 'Failed to save credentials to database.');
    } finally {
      setConfigSaving(false);
    }
  };

  // Auto-generate strong 12-char password and populate both New Password and Re-enter Password fields
  const handleGenerateStrongPassword = () => {
    const charsUpper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const charsLower = 'abcdefghjkmnpqrstuvwxyz';
    const charsNum = '23456789';
    const charsSym = '!@#$%&*';

    let partUpper = '';
    for (let i = 0; i < 2; i++) partUpper += charsUpper[Math.floor(Math.random() * charsUpper.length)];
    let partLower = '';
    for (let i = 0; i < 4; i++) partLower += charsLower[Math.floor(Math.random() * charsLower.length)];
    let partNum = '';
    for (let i = 0; i < 2; i++) partNum += charsNum[Math.floor(Math.random() * charsNum.length)];
    let partSym = '';
    for (let i = 0; i < 2; i++) partSym += charsSym[Math.floor(Math.random() * charsSym.length)];

    const all = (partUpper + partLower + partNum + partSym).split('');
    for (let i = all.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [all[i], all[j]] = [all[j], all[i]];
    }

    const generated = 'Lyka#' + all.join('');
    setNewPasswordInput(generated);
    setConfirmPasswordInput(generated);
    setShowNewPassword(true);
    setShowConfirmPassword(true);
    setGeneratedPasswordNotice(true);
    setResetPasswordError('');
    setTimeout(() => {
      setGeneratedPasswordNotice(false);
    }, 4500);
  };

  // Send password reset link to user's email via Brevo API
  const handleSendResetLink = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setForgotError('');
    setForgotSuccess('');

    const targetEmail = forgotEmailInput.trim().toLowerCase();
    if (!targetEmail || !targetEmail.includes('@')) {
      setForgotError('Please enter a valid email address.');
      return;
    }

    setForgotLoading(true);

    try {
      const res = await fetch('/api/auth/send-password-reset-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: targetEmail,
          portal: adminTargetPortal
        })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setSentResetUrl(data.resetUrl || '');
        setActiveResetToken(data.token || '');
        setResetTargetPortal(adminTargetPortal);
        setResetTargetEmail(targetEmail);
        setAdminAuthMode('link_sent');
        setForgotSuccess(data.message || 'Password reset link sent successfully!');
      } else {
        setForgotError(data.error || 'Failed to send password reset link. Please check the email and try again.');
      }
    } catch (err: any) {
      setForgotError(err.message || 'Network error sending reset link. Please try again.');
    } finally {
      setForgotLoading(false);
    }
  };

  // Submit new password to be updated in database (disk + Firestore)
  const handleResetPasswordSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setResetPasswordError('');
    setResetPasswordSuccess('');

    if (!newPasswordInput || !confirmPasswordInput) {
      setResetPasswordError('Please enter and confirm your new password.');
      return;
    }

    if (newPasswordInput !== confirmPasswordInput) {
      setResetPasswordError('New Password and Re-entered Password do not match.');
      return;
    }

    if (newPasswordInput.length < 6) {
      setResetPasswordError('Password must be at least 6 characters long.');
      return;
    }

    if (!activeResetToken) {
      setResetPasswordError('Reset token missing. Please request a new password reset link.');
      return;
    }

    setResetPasswordLoading(true);

    try {
      const targetPortal = resetTargetPortal || adminTargetPortal;
      const targetEmail = resetTargetEmail || forgotEmailInput || (targetPortal === 'property_manager' ? PM_EMAIL : targetPortal === 'sales_manager' ? SALES_EMAIL : ADMIN_EMAIL);

      const res = await fetch('/api/auth/reset-portal-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: activeResetToken,
          portal: targetPortal,
          email: targetEmail,
          newPassword: newPasswordInput.trim()
        })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setResetPasswordSuccess(data.message || 'Password successfully updated in database! Redirecting to login...');
        
        // 1. Revoke any existing active admin session so resetting password NEVER auto-logs the user in
        revokeAdminAuthSessions();

        // 2. Prepare the login modal in place with target email & portal, but leave password completely BLANK
        setAdminPasswordInput('');
        setAdminEmailInput(targetEmail);
        setAdminTargetPortal(targetPortal);
        resetAdminModalState();

        // 3. Update local credential display state
        if (targetPortal === 'admin') {
          setAdminDbCredentials([{ id: 'admin', email: targetEmail, role: 'admin', name: 'Lyka Super Admin' }]);
        } else if (targetPortal === 'property_manager') {
          setPmDbCredentials([{ id: 'property_manager', email: targetEmail, role: 'property_manager', name: 'Lyka Property Manager' }]);
        } else if (targetPortal === 'sales_manager') {
          setSalesDbCredentials([{ id: 'sales_manager', email: targetEmail, role: 'sales_manager', name: 'Lyka Sales Manager' }]);
        }

        // 4. Clean up URL parameters without refreshing page
        try {
          const currentUrl = new URL(window.location.href);
          currentUrl.searchParams.delete('reset_token');
          currentUrl.searchParams.delete('portal');
          currentUrl.searchParams.delete('email');
          window.history.replaceState({}, document.title, currentUrl.pathname);
        } catch (_) {}

        // 5. Clear sensitive reset form fields
        setNewPasswordInput('');
        setConfirmPasswordInput('');
        setActiveResetToken('');

        // 6. Provide 4-second fallback timer to transition to the login form in place if user doesn't click "Resume"
        setTimeout(() => {
          setAdminAuthMode(mode => {
            if (mode === 'reset_password') {
              setAdminOtpSuccessMsg('Password updated in database! Please enter your new password to verify and receive OTP.');
              return 'login';
            }
            return mode;
          });
        }, 4000);
      } else {
        setResetPasswordError(data.error || data.message || 'Failed to update password. Please try again.');
      }
    } catch (err: any) {
      setResetPasswordError(err.message || 'Network error updating password. Please try again.');
    } finally {
      setResetPasswordLoading(false);
    }
  };

  // Detect password reset token from URL query string (e.g., from email link: /?reset_token=...&portal=...&email=...)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('reset_token');
      const portalParam = params.get('portal');
      const emailParam = params.get('email');

      if (token) {
        // Revoke any previous admin session so password reset operates in a clean, logged-out state
        revokeAdminAuthSessions();
        setShowAdminLoginModal(true);
        setActiveResetToken(token);
        if (portalParam === 'sales_manager' || portalParam === 'property_manager' || portalParam === 'admin') {
          setAdminTargetPortal(portalParam);
          setResetTargetPortal(portalParam);
        }
        if (emailParam) {
          setResetTargetEmail(emailParam);
          setForgotEmailInput(emailParam);
        }

        // Verify token with backend
        fetch('/api/auth/verify-reset-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        })
          .then(res => res.json())
          .then(data => {
            if (data && data.valid) {
              if (data.portal) {
                setAdminTargetPortal(data.portal);
                setResetTargetPortal(data.portal);
              }
              if (data.email) {
                setResetTargetEmail(data.email);
              }
              setAdminAuthMode('reset_password');
              setResetPasswordError('');
            } else {
              setAdminAuthMode('forgot_password');
              setForgotError(data.message || 'This password reset link is invalid or has expired. Please request a new link.');
            }
          })
          .catch(() => {
            setAdminAuthMode('reset_password');
          });
      }
    } catch (e) {
      console.warn('Failed to parse reset URL params', e);
    }
  }, []);

  const handleGetAdminOtp = async () => {
    setAdminLoginError('');
    setAdminOtpSuccessMsg('');
    setPasswordFailedAttempt(false);

    const targetEmail = adminEmailInput.trim().toLowerCase();
    if (!targetEmail || !targetEmail.includes('@')) {
      setAdminLoginError('Please enter your valid Admin/Manager email address to receive your 6-digit OTP.');
      return;
    }

    if (!adminPasswordInput) {
      setAdminLoginError('Please enter your password first. OTP will only be sent after password verification.');
      return;
    }

    // Check if account is in 1-hour lockout
    if (adminOtpLockedUntil && adminOtpLockedUntil > Date.now()) {
      const mins = Math.max(1, Math.ceil((adminOtpLockedUntil - Date.now()) / 60000));
      setAdminLoginError(`OTP generation limit reached (5 attempts). For security, please wait ${mins} minute(s) before requesting a new OTP.`);
      return;
    }

    setAdminOtpLoading(true);

    try {
      // Call server endpoint with email AND password to verify credentials first
      const res = await fetch('/api/auth/send-email-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: targetEmail,
          password: adminPasswordInput,
          portal: adminTargetPortal
        })
      });

      let data: any = {};
      const responseText = await res.text();
      try {
        data = JSON.parse(responseText);
      } catch {
        data = {};
      }

      // Handle 429 Too Many Requests (Rate limit reached)
      if (res.status === 429 || data.locked) {
        const lockoutTime = data.lockedUntil || (Date.now() + 60 * 60 * 1000);
        setAdminOtpLockedUntil(lockoutTime);
        setAdminOtpAttemptsUsed(5);
        try {
          localStorage.setItem(`lyka_admin_otp_limit_${targetEmail}`, JSON.stringify({
            lockedUntil: lockoutTime,
            attemptsUsed: 5
          }));
        } catch (e) {}
        const mins = data.retryAfterMinutes || Math.max(1, Math.ceil((lockoutTime - Date.now()) / 60000));
        setAdminLoginError(data.error || `OTP generation limit reached (5 attempts). Please wait ${mins} minute(s) before requesting again.`);
        return;
      }

      // Handle password error or 401 Unauthorized
      if (res.status === 401 || data.passwordError) {
        setPasswordFailedAttempt(true);
        setAdminLoginError(data.error || data.message || `Incorrect password for ${adminTargetPortal === 'property_manager' ? 'Property Manager' : adminTargetPortal === 'sales_manager' ? 'Sales Manager' : 'Admin'} portal.`);
        return;
      }

      if (!res.ok) {
        throw new Error(data.error || data.message || `Server returned ${res.status} (${res.statusText || 'Error'}). Please try again.`);
      }

      // Successful verification and OTP dispatch
      setPasswordFailedAttempt(false);
      const attemptsCount = typeof data.attemptsUsed === 'number' ? data.attemptsUsed : (adminOtpAttemptsUsed + 1);
      setAdminOtpAttemptsUsed(attemptsCount);

      if (data.lockedUntil || attemptsCount >= 5) {
        const lockoutTime = data.lockedUntil || (Date.now() + 60 * 60 * 1000);
        setAdminOtpLockedUntil(lockoutTime);
        try {
          localStorage.setItem(`lyka_admin_otp_limit_${targetEmail}`, JSON.stringify({
            lockedUntil: lockoutTime,
            attemptsUsed: 5
          }));
        } catch (e) {}
      } else {
        try {
          localStorage.setItem(`lyka_admin_otp_limit_${targetEmail}`, JSON.stringify({
            attemptsUsed: attemptsCount
          }));
        } catch (e) {}
      }

      const now = Date.now();
      const expiresAt = now + 3 * 60 * 1000; // strictly 3 minutes
      setAdminOtpExpiresAt(expiresAt);
      setOtpTimeRemaining(180);
      setAdminOtpSent(true);
      setAdminOtpSuccessMsg(`Password verified! 6-Digit OTP sent directly to ${targetEmail}! Valid for 3 minutes.`);

    } catch (err: any) {
      console.warn('Brevo Email send notice:', err.message);
      setAdminLoginError(`Error: ${err.message || 'Please check email address and try again.'}`);
    } finally {
      setAdminOtpLoading(false);
    }
  };

  // Initial welcome message
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'MSG-INIT',
      lead_id: 'INITIAL',
      role: 'assistant',
      content: `Hello, and welcome! Thanks for reaching out to Lyka Realty. What brings you to us today? Are you looking to invest, buy, sell, or something else?`,
      timestamp: new Date().toISOString(),
      agentic_decision: {
        intent_detected: 'Inquiry Initiation',
        confidence: 100,
        extracted_fields: {},
        still_missing_fields: ['Intent (Buy/Rent/Invest)', 'Budget range', 'Preferred community'],
        next_question_intent: 'Identify Role First',
        rationale: 'Initial greeting per PDF: ask what brings them today before criteria.',
        qualify_score: 0,
        handoff_suggested: false,
        suggested_action: 'Greet customer and identify role first'
      }
    }
  ]);

  // Modals
  const [viewingModalProperty, setViewingModalProperty] = useState<PropertyListing | null>(null);
  // Header property selector — which property the user has chosen from the inventory
  const [selectedProperty, setSelectedProperty] = useState<PropertyListing | null>(null);
  // Header property and city selector state
  const [selectedCityFilter, setSelectedCityFilter] = useState<'all' | 'Dubai' | 'Mumbai'>('all');
  // Header favorites — property IDs the user has favorited (persisted to localStorage)
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('lyka_favorite_properties') || localStorage.getItem('lyka_saved_properties');
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  });

  const [favoriteToast, setFavoriteToast] = useState<string | null>(null);

  // Visitor is signed in if they have a customer account session or an authenticated staff/admin session
  const isUserSignedIn = useMemo(() => {
    if (Boolean(currentUserId || currentUserEmail || auth?.currentUser || adminAuthenticated || propertyManagerAuthenticated || salesManagerAuthenticated)) {
      return true;
    }
    try {
      const stored = localStorage.getItem('lyka_client_user');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.id || parsed?.uid || parsed?.email) return true;
      }
    } catch (_) {}
    return false;
  }, [currentUserId, currentUserEmail, adminAuthenticated, propertyManagerAuthenticated, salesManagerAuthenticated]);

  const handleToggleFavoritesFilter = () => {
    if (!isUserSignedIn) {
      setFavoriteToast('🔒 Please Sign In or Sign Up to view your saved favorites!');
      setTimeout(() => setFavoriteToast(null), 4500);
      return;
    }
    setActiveTab('home');
    setAdminPanelOpen(false);
    setShowFavoritesOnly(prev => {
      const next = !prev;
      if (next && typeof document !== 'undefined') {
        setTimeout(() => {
          const el = document.getElementById('portfolio-section');
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 100);
      }
      return next;
    });
  };

  const toggleFavorite = (propertyId: string) => {
    if (!isUserSignedIn) {
      setFavoriteToast('🔒 Please Sign In or Sign Up to save properties to your favorites!');
      setTimeout(() => setFavoriteToast(null), 4500);
      return;
    }

    setFavorites(prev => {
      const isRemoving = prev.includes(propertyId);
      const updated = isRemoving
        ? prev.filter(id => id !== propertyId)
        : [...prev, propertyId];
      try {
        localStorage.setItem('lyka_favorite_properties', JSON.stringify(updated));
        localStorage.setItem('lyka_saved_properties', JSON.stringify(updated));
      } catch (e) {}

      const foundProp = (propertiesList.length > 0 ? propertiesList : ALL_VERIFIED_PROPERTIES).find(p => p.id === propertyId);
      const propTitle = foundProp?.title || 'Residence';
      if (!isRemoving) {
        setFavoriteToast(`Saved "${propTitle}" to your favorites!`);
      } else {
        setFavoriteToast(`Removed "${propTitle}" from favorites.`);
      }
      setTimeout(() => setFavoriteToast(null), 3200);

      return updated;
    });
  };
  const [viewingDate, setViewingDate] = useState(new Date().toISOString().split('T')[0]);
  const [viewingTime, setViewingTime] = useState('11:00 AM');
  const [viewingMode, setViewingMode] = useState<'In-person at property' | 'Virtual 3D walkthrough'>('In-person at property');

  const [showHandoffModal, setShowHandoffModal] = useState(false);
  const [handoffNotes, setHandoffNotes] = useState('');
  const [handoffPhone, setHandoffPhone] = useState('');
  const [handoffError, setHandoffError] = useState('');

  // Initial data loading & connection testing
  useEffect(() => {
    async function init() {
      const fsOk = await testConnection();
      setFirestoreActive(fsOk);
      fetchDbFavorites();

      // Load existing Firestore leads or seed with sample leads
      const existingLeads = await getLeadsFromFirestore();
      if (existingLeads.length > 0) {
        setLeadsList(existingLeads);
      } else {
        // Seed initial representative leads for CRM pipeline
        const seedLeads: LeadProfile[] = [
          {
            ...createInitialLeadProfile(),
            id: 'LEAD-DXB102',
            full_name: 'Mohammed Al-Hashimi',
            phone: '+971 50 234 5678',
            email: 'm.hashimi@investments.ae',
            customer_type: 'Investor',
            intent: 'Invest',
            budget_max: 3500000,
            budget_min: 2500000,
            preferred_communities: ['Downtown Dubai', 'Dubai Creek Harbour'],
            property_type: 'Apartment',
            bedrooms: '2',
            ready_or_offplan: 'Off-plan',
            purpose: 'High ROI & Capital Growth',
            lead_status: 'Qualified',
            lead_priority: 'Urgent',
            requirement_completeness: 85,
            assigned_agent: LYKA_AGENTS[1].name,
            summary: 'Overseas investor seeking off-plan 2BR with post-handover payment plan.'
          },
          {
            ...createInitialLeadProfile(),
            id: 'LEAD-DXB103',
            full_name: 'David & Claire Wilson',
            phone: '+44 7911 123456',
            email: 'david.wilson@ukemail.co.uk',
            customer_type: 'End-user / Family',
            intent: 'Buy',
            budget_max: 4800000,
            budget_min: 4000000,
            preferred_communities: ['Dubai Hills Estate'],
            property_type: 'Villa',
            bedrooms: '4',
            ready_or_offplan: 'Ready',
            purpose: 'Family Relocation',
            financing: 'Mortgage',
            lead_status: 'Viewing',
            lead_priority: 'High',
            requirement_completeness: 90,
            assigned_agent: LYKA_AGENTS[2].name,
            summary: 'UK family relocating to Dubai Hills Estate, looking for 4BR villa with private garden.'
          }
        ];
        setLeadsList(seedLeads);
        // Persist seed leads to firestore or local
        seedLeads.forEach(l => saveLeadData(l));
      }

      // Load follow-ups
      const existingFollowups = await getFollowUpsFromFirestore();
      if (existingFollowups.length > 0) {
        setFollowUpsList(existingFollowups);
      }

      // Load custom properties from backend & Firestore
      try {
        // 1. Try backend server API first
        try {
          const apiRes = await fetch('/api/properties');
          if (apiRes.ok) {
            const apiData = await apiRes.json();
            if (apiData.properties && Array.isArray(apiData.properties) && apiData.properties.length > 0) {
              setPropertiesList(prev => {
                const savedDeleted = localStorage.getItem('deletedPropertyIds');
                const deletedSet = new Set<string>(savedDeleted ? JSON.parse(savedDeleted) : []);
                const apiMap = new Map(apiData.properties.map((p: any) => [p.id, p]));
                const merged = prev.filter(p => !deletedSet.has(p.id)).map(p => apiMap.has(p.id) ? { ...p, ...(apiMap.get(p.id) || {}) } : p);
                const existingIds = new Set(merged.map(p => p.id));
                const newFromApi = apiData.properties.filter((p: any) => !existingIds.has(p.id) && !deletedSet.has(p.id));
                const combined = [...newFromApi, ...merged];
                try { localStorage.setItem('localProperties', JSON.stringify(combined)); } catch (_) {}
                return combined;
              });
            }
          }
        } catch (apiErr) {
          console.warn('Backend /api/properties fetch notice:', apiErr);
        }

        // 2. Also check Firestore properties
        const firestoreProps = await getPropertiesFromFirestore();
        if (firestoreProps.length > 0) {
          setPropertiesList(prev => {
            const savedDeleted = localStorage.getItem('deletedPropertyIds');
            const deletedSet = new Set<string>(savedDeleted ? JSON.parse(savedDeleted) : []);
            const fsMap = new Map(firestoreProps.map(p => [p.id, p]));
            const merged = prev.filter(p => !deletedSet.has(p.id)).map(p => fsMap.has(p.id) ? { ...p, ...fsMap.get(p.id) } : p);
            const existingIds = new Set(merged.map(p => p.id));
            const newFromFirestore = firestoreProps.filter(p => !existingIds.has(p.id) && !deletedSet.has(p.id));
            const combined = [...newFromFirestore, ...merged];
            try {
              localStorage.setItem('localProperties', JSON.stringify(combined));
            } catch (_) {}
            return combined;
          });
        }
      } catch (err) {
        console.warn('Could not fetch custom properties from Firestore:', err);
      }

      // Check Vector Embedding status
      try {
        const res = await fetch('/api/embeddings/status');
        const data = await res.json();
        setMongoStatus({
          connected: data.connected,
          uriConfigured: data.connected,
          count: data.embeddingsCount || 0
        });
      } catch (err) {
        console.warn('Vector status check:', err);
      }

      // Load user count for customer analytics
      try {
        const users = await getAllUsersFromFirestore();
        setCustomerCount(users.length);
      } catch (err) {
        console.warn('Customer count fetch notice:', err);
      }

      // Ensure Admin, Property Manager & Sales Manager credentials exist in Firestore
      try {
        const { adminCredentials, pmCredentials, smCredentials } = await ensurePortalCredentialsInFirestore();
        if (adminCredentials.length > 0) setAdminDbCredentials(adminCredentials);
        if (pmCredentials.length > 0) setPmDbCredentials(pmCredentials);
        if (smCredentials && smCredentials.length > 0) setSalesDbCredentials(smCredentials);
      } catch (err) {
        console.warn('Portal credentials init notice:', err);
      }
    }

    init();
  }, []);

  useEffect(() => {
    if (currentUserId && currentLead.id) {
      // Sync the full JSON of this chat into the user's profile
      syncSessionToUserProfile(currentUserEmail || currentLead.email || null, currentUserId, currentLead, messages).catch(() => {});
    }
  }, [currentUserId, currentUserEmail, currentLead, messages]);

  const handleAuthChange = async (uid: string | null, email?: string) => {
    setCurrentUserId(uid);
    if (email) setCurrentUserEmail(email);

    if (email) {
      const cleanEmail = email.trim().toLowerCase();
      // If customer logs in, clear any admin portal session so they can't see the admin
      if (!adminEmails.includes(cleanEmail)) {
        setAdminAuthenticated(false);
        setPropertyManagerAuthenticated(false);
        setSalesManagerAuthenticated(false);
        setAdminPanelOpen(false);
        try {
          localStorage.removeItem('lyka_admin_authenticated');
          localStorage.removeItem('lyka_pm_authenticated');
          localStorage.removeItem('lyka_sm_authenticated');
          localStorage.removeItem('lyka_admin_target_portal');
        } catch (_) {}
      }
    }

    if (uid) {
      // 1. Migrate local guest data to Firestore
      try {
        const localLeadsStr = localStorage.getItem('localLeads');
        const localMsgsStr = localStorage.getItem('localInteractions');
        let localMsgs: ChatMessage[] = [];
        if (localMsgsStr) {
          try { localMsgs = JSON.parse(localMsgsStr); } catch (_) {}
        }
        
        if (localLeadsStr) {
          try {
            const leads: LeadProfile[] = JSON.parse(localLeadsStr);
            for (const lead of leads) {
              lead.user_id = uid;
              if (email && !lead.email) lead.email = email;
              await saveLeadToFirestore(lead);
              const msgsForThisLead = localMsgs.filter(m => m.lead_id === lead.id);
              if (msgsForThisLead.length > 0) {
                await saveUserChatToFirestore(uid, lead.id, msgsForThisLead);
                await syncSessionToUserProfile(email || null, uid, lead, msgsForThisLead);
              }
            }
          } catch (e) {
            console.warn('Error migrating localLeads:', e);
          }
        }
        
        if (localMsgs.length > 0) {
          for (const msg of localMsgs) {
            await saveInteractionToFirestore(msg);
          }
        }
        
        // Clear local storage after successful migration
        localStorage.removeItem('localLeads');
        localStorage.removeItem('localInteractions');
      } catch (e) {
        console.warn('Failed to migrate local data', e);
      }

      // 2. Migrate and persist current active conversation in state to Firestore
      setCurrentLead(prev => {
        const updated = { ...prev, user_id: uid, email: prev.email || email || '' };
        saveLeadToFirestore(updated).catch(() => {});
        if (messages.length > 0) {
          saveUserChatToFirestore(uid, updated.id, messages).catch(() => {});
          syncSessionToUserProfile(email || updated.email || null, uid, updated, messages).catch(() => {});
          for (const msg of messages) {
            saveInteractionToFirestore(msg).catch(() => {});
          }
        }
        return updated;
      });

      // 3. Load user's leads from Firestore to keep CRM pipeline updated
      try {
        const userLeads = await getUserLeadsFromFirestore(uid);
        if (userLeads.length > 0) {
          setLeadsList(prev => {
            const existingIds = new Set(userLeads.map(l => l.id));
            const otherLeads = prev.filter(l => !existingIds.has(l.id));
            return [...userLeads, ...otherLeads];
          });
        }
      } catch (e) {
        console.warn('Could not fetch user leads on auth change:', e);
      }
    }
  };

  const saveLeadData = (lead: LeadProfile) => {
    // Always mirror to localStorage for instantaneous offline resilience and fast loads
    try {
      const localLeads = JSON.parse(localStorage.getItem('localLeads') || '[]');
      const existingIndex = localLeads.findIndex((l: LeadProfile) => l.id === lead.id);
      if (existingIndex >= 0) {
        localLeads[existingIndex] = lead;
      } else {
        localLeads.push(lead);
      }
      localStorage.setItem('localLeads', JSON.stringify(localLeads));
    } catch (e) { console.warn(e); }

    // ONLY persist to Firestore database collection 'leads' if user is authenticated (logged in)
    if (currentUserId) {
      saveLeadToFirestore(lead).catch(err => {
        console.warn('saveLeadToFirestore notice:', err);
      });
    }
  };

  // Update current lead state in leads list and Firestore
  const updateActiveLead = (updatedFields: Partial<LeadProfile>) => {
    setCurrentLead(prev => {
      const merged = { ...prev, ...updatedFields, updatedAt: new Date().toISOString() };
      setLeadsList(list => {
        const index = list.findIndex(l => l.id === merged.id);
        if (index >= 0) {
          const updatedList = [...list];
          updatedList[index] = merged;
          return updatedList;
        }
        return [merged, ...list];
      });
      // Sync to firestore (if logged in) or local
      saveLeadData(merged);
      // Sync to backend store ONLY if user is authenticated (logged in)
      if (currentUserId) {
        fetch('/api/leads/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(merged)
        }).catch(() => {});
      }
      return merged;
    });
  };

  // Start new customer chat
  const handleStartNewChat = (options?: { skipSaveCurrent?: boolean }) => {
    // Save active chat before switching to a new one ONLY if user actually queried and not skipping save
    const hasUserMsg = messages.some(m => m.role === 'user');
    if (!options?.skipSaveCurrent && currentLead.id && hasUserMsg) {
      // Unconditionally save to localStorage
      try {
        const localMsgs = JSON.parse(localStorage.getItem('localInteractions') || '[]');
        const filtered = localMsgs.filter((m: ChatMessage) => m.lead_id !== currentLead.id);
        localStorage.setItem('localInteractions', JSON.stringify([...filtered, ...messages]));
      } catch (_) {}

      if (currentUserId) {
        saveLeadToFirestore(currentLead).catch(() => {});
        saveUserChatToFirestore(currentUserId, currentLead.id, messages).catch(() => {});
        syncSessionToUserProfile(currentUserEmail || currentLead.email || null, currentUserId, currentLead, messages).catch(() => {});
      } else {
        saveLeadData(currentLead);
      }
    }

    const newLead = { ...createInitialLeadProfile(), user_id: currentUserId || undefined, email: currentUserEmail || '' };
    setCurrentLead(newLead);

    const initMsg: ChatMessage = {
      id: 'MSG-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
      lead_id: newLead.id,
      role: 'assistant',
      content: `Hello, and welcome! Thanks for reaching out to Lyka Realty.\n\nWhat brings you to us today? Are you looking to invest, buy, sell, or something else?`,
      timestamp: new Date().toISOString(),
    };

    setMessages([initMsg]);

    setActiveTab('chat');
    setAdminPanelOpen(false);
  };

  const handleLoadChat = async (lead: LeadProfile, msgs: ChatMessage[]) => {
    // If clicking the current open conversation, no reload needed
    if (currentLead.id === lead.id && messages.length > 1) return;

    // 1. Save currently active chat before switching so nothing is ever lost
    if (currentLead.id && messages.length > 1 && currentLead.id !== lead.id) {
      // Unconditionally persist active chat to localStorage
      try {
        const localMsgs = JSON.parse(localStorage.getItem('localInteractions') || '[]');
        const filtered = localMsgs.filter((m: ChatMessage) => m.lead_id !== currentLead.id);
        localStorage.setItem('localInteractions', JSON.stringify([...filtered, ...messages]));
      } catch (_) {}

      if (currentUserId) {
        saveLeadToFirestore(currentLead).catch(() => {});
        saveUserChatToFirestore(currentUserId, currentLead.id, messages).catch(() => {});
        syncSessionToUserProfile(currentUserEmail || currentLead.email || null, currentUserId, currentLead, messages).catch(() => {});
      } else {
        saveLeadData(currentLead);
      }
    }

    // 2. Fetch the most complete message history for this lead
    let resolvedMsgs = msgs && msgs.length > 0 ? [...msgs] : [];
    if (lead.id) {
      if (currentUserId) {
        try {
          const firestoreMsgs = await getMessagesForLead(lead.id);
          if (firestoreMsgs && firestoreMsgs.length >= resolvedMsgs.length) {
            resolvedMsgs = firestoreMsgs;
          }
        } catch (_) {}
      }
      try {
        const localMsgs = JSON.parse(localStorage.getItem('localInteractions') || '[]');
        const forThisLead = localMsgs.filter((m: ChatMessage) => m.lead_id === lead.id);
        if (forThisLead.length > resolvedMsgs.length) {
          resolvedMsgs = forThisLead;
        }
      } catch (_) {}
    }

    // 3. Reconstruct full lead profile with safe defaults
    const fullLead: LeadProfile = {
      ...createInitialLeadProfile(),
      ...(lead || {}),
      user_id: currentUserId || (lead && lead.user_id) || undefined
    };

    setCurrentLead(fullLead);
    setMessages(resolvedMsgs.length > 0 ? resolvedMsgs : [
      {
        id: 'MSG-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
        lead_id: fullLead.id,
        role: 'assistant',
        content: `Continuing conversation for ${fullLead.summary || 'your property search'}. How can I assist you further?`,
        timestamp: new Date().toISOString()
      }
    ]);
    setActiveTab('chat');
    setAdminPanelOpen(false);
  };

  const handleDeleteChat = async (leadId: string) => {
    // 1. Immediately clean local storage synchronously so background sync never re-uploads it
    try {
      let localLeads = JSON.parse(localStorage.getItem('localLeads') || '[]');
      localLeads = localLeads.filter((l: LeadProfile) => l.id !== leadId);
      localStorage.setItem('localLeads', JSON.stringify(localLeads));

      let localMsgs = JSON.parse(localStorage.getItem('localInteractions') || '[]');
      localMsgs = localMsgs.filter((m: ChatMessage) => m.lead_id !== leadId);
      localStorage.setItem('localInteractions', JSON.stringify(localMsgs));
    } catch (e) { console.warn(e); }

    // 2. Remove from active state
    setLeadsList(prev => prev.filter(l => l.id !== leadId));
    if (currentLead.id === leadId) {
      handleStartNewChat({ skipSaveCurrent: true });
    }
    
    // 3. Resolve effective user ID & email
    const effectiveUid = currentUserId || auth.currentUser?.uid;
    const effectiveEmail = currentUserEmail || auth.currentUser?.email;

    // 4. Delete from Firebase Firestore across all collections (leads, interactions, user_chat, User_login)
    try {
      await Promise.allSettled([
        deleteUserChatFromFirestore(leadId, effectiveUid),
        deleteLeadFromFirestore(leadId),
        deleteMessagesForLead(leadId),
        deleteSessionFromUserProfile(effectiveEmail || null, effectiveUid || '', leadId),
      ]);
    } catch (err) {
      console.warn('Error deleting chat from Firestore:', err);
    }
  };

  const saveInteractionData = (msg: ChatMessage) => {
    // Always mirror to localStorage for instantaneous offline resilience and fast loads
    try {
      const localMsgs = JSON.parse(localStorage.getItem('localInteractions') || '[]');
      const existingIndex = localMsgs.findIndex((m: ChatMessage) => m.id === msg.id);
      if (existingIndex >= 0) {
        localMsgs[existingIndex] = msg;
      } else {
        localMsgs.push(msg);
      }
      localStorage.setItem('localInteractions', JSON.stringify(localMsgs));
    } catch (e) { console.warn(e); }

    if (currentUserId) {
      saveInteractionToFirestore(msg);
      getMessagesForLead(msg.lead_id).then(messages => {
        saveUserChatToFirestore(currentUserId, msg.lead_id, messages);
      }).catch(() => {});
    }
  };

  // Maps current lead state to the correct LangGraph conversation stage
  const mapLeadToStage = (lead: typeof currentLead, lastAssistantText?: string, userText?: string): string => {
    const isAffirmative = /^(yes|yeah|yep|sure|ok|okay|yup|definitely|absolutely|please)\b/i.test((userText || '').trim());
    const askedAboutAdvisor = lastAssistantText && /\b(speak with them directly|speak with a Lyka Realty advisor|connect you with|arrange viewings|advisor will reach out)\b/i.test(lastAssistantText);
    if ((isAffirmative && askedAboutAdvisor) || lead.human_handoff_required) {
      return 'agent_handoff';
    }
    if (lead.next_action === 'present_results' || (lastAssistantText && lastAssistantText.includes('matches for you'))) {
      if (isAffirmative) return 'agent_handoff';
      return 'present_results';
    }
    if (!lead.intent) return 'classify_intent';
    const i = lead.intent.toLowerCase();
    if (i === 'buy') return 'qualify_buy';
    if (i === 'rent') return 'qualify_rent';
    if (i === 'invest') return 'qualify_invest';
    if (i === 'sell') return 'qualify_sell';
    return 'classify_intent';
  };

  // User sends message
  const handleSendMessage = async (userText: string, options?: { groqApiKey?: string; groqModel?: string }) => {
    // Check guest 2-conversation limit
    const previousUserMsgCount = messages.filter(m => m.role === 'user').length;
    const isGuest = !currentUserId && !auth.currentUser;

    if (isGuest && previousUserMsgCount >= 2) {
      const limitNoticeMsg: ChatMessage = {
        id: 'MSG-A-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
        lead_id: currentLead.id,
        role: 'assistant',
        content: `🔒 **Sign In / Sign Up Required**\n\nYou have completed your **2 free preview conversations** with Lyka Realty AI.\n\nPlease **Sign In** or **Sign Up** using the account button at the top to continue chatting, booking viewings, and connecting directly with our property advisors!`,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, limitNoticeMsg]);
      setIsLoading(false);
      return;
    }

    const userMsg: ChatMessage = {
      id: 'MSG-U-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
      lead_id: currentLead.id,
      role: 'user',
      content: userText,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      // When the user sends their first query in this chat, register and persist the session
      const isFirstUserQuery = !messages.some(m => m.role === 'user');
      if (isFirstUserQuery) {
        const initGreeting = messages.find(m => m.role === 'assistant');
        if (initGreeting) {
          saveInteractionData(initGreeting);
        }
      }

      // 1. Agentic Extraction
      const extracted = extractEntitiesFromText(userText, currentLead);
      const mergedLead: LeadProfile = {
        ...currentLead,
        ...extracted,
        summary: currentLead.summary && !currentLead.summary.includes('Customer LEAD-') 
          ? currentLead.summary 
          : (userText.length > 40 ? userText.slice(0, 40) + '...' : userText),
        updatedAt: new Date().toISOString(),
      };

      if (isFirstUserQuery) {
        setLeadsList(prev => [mergedLead, ...prev.filter(l => l.id !== mergedLead.id)]);
        saveLeadData(mergedLead);
      }

      // 2. Compute Completeness & Missing Fields
      const { completeness, missing } = computeCompletenessAndMissing(mergedLead);
      mergedLead.requirement_completeness = completeness;
      mergedLead.missing_fields = missing;

      // 3. Evaluate Status & Priority
      const { status, priority } = evaluateLeadStatusAndPriority(mergedLead, completeness);
      mergedLead.lead_status = status;
      mergedLead.lead_priority = priority;

      // 4. Assign best matching agent based on community or customer type
      if (mergedLead.preferred_communities && mergedLead.preferred_communities.length > 0) {
        const firstComm = mergedLead.preferred_communities[0];
        const matchedAgent = LYKA_AGENTS.find(a => a.communities.includes(firstComm));
        if (matchedAgent) {
          mergedLead.assigned_agent = matchedAgent.name;
        }
      }

      // 5. Match properties whenever user asks about properties or expresses real estate interest
      let matchingProps: PropertyListing[] = [];
      const pool = (propertiesList.length > 0 ? propertiesList : ALL_VERIFIED_PROPERTIES).filter(
        p => !p.is_booked && (p.status || '').toLowerCase() !== 'booked'
      );
      const lowerText = userText.toLowerCase();

      const mentionsProperty = 
        isPropertyQuery(userText) ||
        /\b(propert|flat|apartment|villa|penthouse|studio|townhouse|home|house|listing|unit|bhk|bedroom|bed|buy|rent|invest|purchase|budget|price|option|available|recommend|suggest|show|give|find|look|downtown|marina|palm|jvc|jlt|business bay|creek|hills|ranches|worli|bandra|juhu|bkc|powai|mumbai|dubai)\b/i.test(lowerText) ||
        Boolean(mergedLead.intent) ||
        Boolean(mergedLead.preferred_communities && mergedLead.preferred_communities.length > 0) ||
        Boolean(mergedLead.budget_max) ||
        Boolean(mergedLead.bedrooms);

      if (mentionsProperty) {
        let candidates = [...pool];

        // A. City Filter (Dubai vs Mumbai)
        const asksMumbai = /\b(mumbai|worli|bandra|juhu|bkc|powai|andheri|mahalaxmi|lower parel|malabar hill)\b/i.test(lowerText) || mergedLead.target_city === 'Mumbai';
        const asksDubai = /\b(dubai|marina|downtown|palm|jvc|jlt|business bay|hills|ranches|creek|islands)\b/i.test(lowerText) || mergedLead.target_city === 'Dubai';
        if (asksMumbai && !asksDubai) {
          candidates = candidates.filter(p => (p.city || '').toLowerCase() === 'mumbai');
        } else if (asksDubai && !asksMumbai) {
          candidates = candidates.filter(p => (p.city || 'dubai').toLowerCase() === 'dubai');
        }

        // B. Community Filter
        const communityMatches = candidates.filter(p => 
          lowerText.includes(p.community.toLowerCase()) || 
          p.community.toLowerCase().includes(lowerText) ||
          (mergedLead.preferred_communities && mergedLead.preferred_communities.some(c => p.community.toLowerCase().includes(c.toLowerCase()) || c.toLowerCase().includes(p.community.toLowerCase())))
        );
        if (communityMatches.length > 0) {
          candidates = communityMatches;
        }

        // C. Property Type Filter
        if (/\b(villa|villas)\b/i.test(lowerText) || (mergedLead.property_type && /villa/i.test(mergedLead.property_type))) {
          const matchedTypes = candidates.filter(p => /villa/i.test(p.property_type));
          if (matchedTypes.length > 0) candidates = matchedTypes;
        } else if (/\b(apartment|apartments|flat|flats)\b/i.test(lowerText) || (mergedLead.property_type && /apartment/i.test(mergedLead.property_type))) {
          const matchedTypes = candidates.filter(p => /apartment/i.test(p.property_type));
          if (matchedTypes.length > 0) candidates = matchedTypes;
        } else if (/\b(penthouse|penthouses)\b/i.test(lowerText) || (mergedLead.property_type && /penthouse/i.test(mergedLead.property_type))) {
          const matchedTypes = candidates.filter(p => /penthouse/i.test(p.property_type));
          if (matchedTypes.length > 0) candidates = matchedTypes;
        }

        // D. Bedroom Count Filter
        const bedMatch = lowerText.match(/\b([1-5])\s*(?:br|bhk|bedroom|bed)\b/i) || (mergedLead.bedrooms ? [null, String(mergedLead.bedrooms)] : null);
        if (bedMatch && bedMatch[1]) {
          const targetBed = String(parseInt(bedMatch[1], 10));
          const matchedBeds = candidates.filter(p => p.bedrooms === targetBed || Math.abs(parseInt(p.bedrooms, 10) - parseInt(targetBed, 10)) <= 1);
          if (matchedBeds.length > 0) candidates = matchedBeds;
        }

        // E. Price & Sorting Filter
        const isLowest = /\b(lowest|cheapest|min|minimum|least|affordable|budget|cheap)\b/i.test(lowerText);
        const isHighest = /\b(highest|most expensive|maximum|max price|luxury|costliest)\b/i.test(lowerText);
        if (isLowest) {
          candidates.sort((a, b) => a.price_aed - b.price_aed);
        } else if (isHighest) {
          candidates.sort((a, b) => b.price_aed - a.price_aed);
        } else if (mergedLead.budget_max) {
          candidates.sort((a, b) => Math.abs(a.price_aed - mergedLead.budget_max!) - Math.abs(b.price_aed - mergedLead.budget_max!));
        }

        matchingProps = candidates.slice(0, 3);
        if (matchingProps.length === 0) {
          matchingProps = pool.slice(0, 3);
        }
      }

      // 6. Next Question logic
      const lastAssistantMsg = messages.slice().reverse().find(m => m.role === 'assistant');
      const isAffirmative = /^(yes|yeah|yep|sure|ok|okay|yup|definitely|absolutely|please)\b/i.test(userText.trim());
      const askedAboutAdvisor = lastAssistantMsg && /\b(speak with them directly|speak with a Lyka Realty advisor|connect you with|arrange viewings|advisor will reach out)\b/i.test(lastAssistantMsg.content);

      if ((isAffirmative && askedAboutAdvisor) || /\b(talk to agent|speak with agent|speak to advisor|call me|connect with advisor)\b/i.test(userText)) {
        mergedLead.human_handoff_required = true;
        mergedLead.handoff_reason = 'Customer confirmed to speak directly with Lyka Realty advisor';
        const initialDigits = (mergedLead.phone || '').replace(/\D/g, '').slice(0, 10);
        setHandoffPhone(initialDigits);
        setHandoffNotes(prev => prev || 'Customer requested direct advisor consultation & viewing setup.');
        setHandoffError('');
        setShowHandoffModal(true);
      }

      const { nextQuestion, rationale, intentCategory } = generateNextAdaptiveQuestion(mergedLead, missing, userText);
      mergedLead.next_action = intentCategory;
      mergedLead.summary = `Customer ${mergedLead.full_name || mergedLead.id} seeking ${mergedLead.property_type || 'property'} (${mergedLead.bedrooms || ''}BR) in ${(mergedLead.preferred_communities || []).join(', ') || 'Dubai'}. Budget: AED ${mergedLead.budget_max || 'TBD'}. Intent: ${mergedLead.intent}.`;

      // 7. Update Lead in State and Firestore
      updateActiveLead(mergedLead);

      // 8. Try Server AI endpoint or fallback to deterministic Agentic Question
      let assistantReply = nextQuestion;
      let assistantProvider = 'Lyka Realty Polite Concierge';
      let serverMatchedProperties: any[] = [];
      try {
        const chatRes = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: userText,
            history: [...messages, userMsg].slice(-10).map(m => ({ role: m.role, content: m.content })),
            currentLead: mergedLead,
            conversationStage: mapLeadToStage(mergedLead, lastAssistantMsg?.content, userText),
            groqApiKey: options?.groqApiKey,
            groqModel: options?.groqModel
          })
        });
        const chatData = await chatRes.json();
        if (chatData && chatData.reply) {
          if (!chatData.fallback) {
            assistantReply = chatData.reply;
          }
          if (chatData.provider) {
            assistantProvider = chatData.provider;
          }
          if (chatData.nextStage === 'agent_handoff' || (chatData.reply && chatData.reply.includes('Talk to Agent'))) {
            mergedLead.human_handoff_required = true;
            setShowHandoffModal(true);
          }
          if (chatData.matchedProperties && chatData.matchedProperties.length > 0) {
            serverMatchedProperties = chatData.matchedProperties;
          }
          // Merge any profile updates from LangGraph back into lead
          if (chatData.updatedProfile) {
            const serverUpdates = chatData.updatedProfile;
            if (serverUpdates.intent && !mergedLead.intent) mergedLead.intent = serverUpdates.intent;
            if (serverUpdates.budget_max) mergedLead.budget_max = serverUpdates.budget_max;
            if (serverUpdates.rental_budget) mergedLead.rental_budget = serverUpdates.rental_budget;
            if (serverUpdates.property_type && !mergedLead.property_type) mergedLead.property_type = serverUpdates.property_type;
            // Slots filled by the agent's regex/LLM extraction fallback — only
            // fill empties so the browser extractor keeps priority.
            for (const k of ['bedrooms', 'ready_or_offplan', 'financing', 'timeline',
                             'furnishing', 'move_in_date', 'investment_goal', 'budget_max', 'rental_budget'] as const) {
              const v = (serverUpdates as any)[k];
              if (v !== undefined && v !== null && v !== '' && !(mergedLead as any)[k]) {
                (mergedLead as any)[k] = v;
              }
            }
            if (serverUpdates.preferred_communities?.length && !mergedLead.preferred_communities?.length) {
              mergedLead.preferred_communities = serverUpdates.preferred_communities;
            }
            // Contact details collected by the agent (PDF Section 8 Step 6)
            if (serverUpdates.full_name) mergedLead.full_name = serverUpdates.full_name;
            if (serverUpdates.mobile) mergedLead.phone = serverUpdates.mobile;
            if (serverUpdates.email) mergedLead.email = serverUpdates.email;
            if (serverUpdates.contact_declined !== undefined) mergedLead.contact_declined = serverUpdates.contact_declined;
            // Carry the re-ask state so "ask at most once" survives the next turn
            if (serverUpdates.contact_pending) mergedLead.contact_pending = serverUpdates.contact_pending;
            if (serverUpdates.contact_recheck_asked) mergedLead.contact_recheck_asked = serverUpdates.contact_recheck_asked;
            // Slots the agent marked unsure — persist so they are never re-asked
            if (serverUpdates.unsure_slots) mergedLead.unsure_slots = serverUpdates.unsure_slots;
          }
        }
      } catch (err) {
        console.warn('Using client agentic response generator:', err);
      }

      const agenticDecision: AgenticDecision = {
        intent_detected: mergedLead.intent,
        confidence: Math.round(completeness),
        extracted_fields: extracted,
        still_missing_fields: missing,
        next_question_intent: intentCategory,
        rationale: rationale,
        qualify_score: completeness,
        handoff_suggested: mergedLead.human_handoff_required,
        suggested_action: intentCategory
      };

      const unbookedServerProps = (serverMatchedProperties || []).filter(
        p => !p.is_booked && (p.status || '').toLowerCase() !== 'booked'
      );
      const unbookedMatchingProps = (matchingProps || []).filter(
        p => !p.is_booked && (p.status || '').toLowerCase() !== 'booked'
      );
      const finalProperties = unbookedServerProps.length > 0
        ? unbookedServerProps.slice(0, 3)
        : unbookedMatchingProps.length > 0 ? unbookedMatchingProps.slice(0, 3) : undefined;

      let finalContent = assistantReply;
      if (isGuest && previousUserMsgCount === 1) {
        finalContent += "\n\n---\n🔔 **Guest Limit Notice:** *You have completed your 2 free preview conversations. To continue chatting, booking viewings, or talking to our team, please **Sign In** or **Sign Up** using the Account button!*";
      }

      const assistantMsg: ChatMessage = {
        id: 'MSG-A-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
        lead_id: mergedLead.id,
        role: 'assistant',
        content: finalContent,
        timestamp: new Date().toISOString(),
        provider: assistantProvider,
        agentic_decision: agenticDecision,
        recommended_properties: finalProperties,
      };

      const updatedMessages = [...messages, userMsg, assistantMsg];
      setMessages(updatedMessages);

      // Save interactions to Firestore or local
      saveInteractionData(userMsg);
      saveInteractionData(assistantMsg);

      // Update lead state with any server-side extracted parameters
      updateActiveLead(mergedLead);

      // Explicitly persist full updated chat history to user_chat and User_login
      if (currentUserId) {
        saveUserChatToFirestore(currentUserId, mergedLead.id, updatedMessages).catch(() => {});
        syncSessionToUserProfile(currentUserEmail || mergedLead.email || null, currentUserId, mergedLead, updatedMessages).catch(() => {});
      }

      // Asynchronously generate numerical vector embedding and store into Firebase Firestore ONLY if logged in
      if (currentUserId) {
        fetch('/api/embeddings/store', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lead_id: mergedLead.id,
            user_id: currentUserId,
            text_content: `${mergedLead.full_name || 'Customer'} inquiry: ${userText}. Extracted: ${mergedLead.intent} ${mergedLead.property_type || ''} in ${(mergedLead.preferred_communities || []).join(', ')} budget AED ${mergedLead.budget_max || ''}`,
            metadata: {
              user_id: currentUserId,
              customer_name: mergedLead.full_name || 'Prospect',
              intent: mergedLead.intent,
              budget_max: mergedLead.budget_max,
              communities: mergedLead.preferred_communities
            }
          })
        }).catch(e => console.warn('Vector store background sync:', e));
      }

    } catch (err) {
      console.error('Agentic execution error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Ask a question from the landing page — opens the existing chatbot with the question sent.
  // The chatbot itself (flow, engine, history) stays completely unchanged.
  const handleAskFromLanding = (question: string) => {
    setActiveTab('chat');
    setAdminPanelOpen(false);
    const q = question.trim();
    if (q) {
      handleSendMessage(q);
    }
  };

  // Schedule viewing submission
  const handleConfirmViewing = (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewingModalProperty) return;

    const newTask: FollowUpTask = {
      id: 'TASK-VIEW-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
      lead_id: currentLead.id,
      customer_name: currentLead.full_name || 'Client ' + currentLead.id,
      reason: `Viewing for ${viewingModalProperty.title} (${viewingModalProperty.community})`,
      date: `${viewingDate} at ${viewingTime}`,
      assigned_agent: currentLead.assigned_agent,
      action: `${viewingMode} with ${currentLead.assigned_agent}`,
      status: 'Pending',
      priority: 'High',
      createdAt: new Date().toISOString()
    };

    setFollowUpsList(prev => [newTask, ...prev]);
    saveFollowUpToFirestore(newTask);
    fetch('/api/followups/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTask)
    }).catch(() => {});

    // Save full booking record in booked_properties collection in Firestore
    const viewBookingId = 'BK-VIEW-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    const bookedAt = new Date().toISOString();
    const customerPhone = (currentLead.phone || '').trim();
    const customerName = (currentLead.full_name || (customerPhone ? `Client (${customerPhone.slice(-4)})` : 'Valued Client')).trim();
    const cleanDigits = customerPhone.replace(/[^0-9]/g, '');
    const customerEmail = (currentLead.email || (cleanDigits ? `client_${cleanDigits}@customer.lykarealty.ae` : 'client@lykarealty.ae')).trim();
    const tokenAmount = viewingModalProperty.price_aed ? Math.round(viewingModalProperty.price_aed * 0.10) : 50000;
    const viewNotes = `Viewing scheduled for ${viewingDate} at ${viewingTime} (${viewingMode}). Client answers: Country/City=${currentLead.target_city || 'Dubai'}, Intent=${currentLead.intent || 'Buy'}, Preferred Location=${currentLead.preferred_community || viewingModalProperty.community}, Budget=AED ${currentLead.budget_max_aed ? Number(currentLead.budget_max_aed).toLocaleString() : viewingModalProperty.price_aed.toLocaleString()}, Move-in=${currentLead.move_in_timeline || 'Immediate'}. Assigned Agent: ${currentLead.assigned_agent}.`;

    const viewBookingRecord: BookedPropertyRecord = {
      id: viewBookingId,
      property_id: viewingModalProperty.id,
      property_title: viewingModalProperty.title,
      community: viewingModalProperty.community,
      city: viewingModalProperty.city || currentLead.target_city || 'Dubai',
      bedrooms: String(viewingModalProperty.bedrooms),
      price_aed: viewingModalProperty.price_aed,
      property_type: viewingModalProperty.property_type,
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_email: customerEmail,
      booking_amount_aed: tokenAmount,
      notes: viewNotes,
      booked_at: bookedAt,
      status: 'Booked',
      lead_id: currentLead.id,
      intent: currentLead.intent || 'Buy',
      target_city: currentLead.target_city || 'Dubai',
      budget_max_aed: currentLead.budget_max_aed || viewingModalProperty.price_aed,
      move_in_timeline: currentLead.move_in_timeline || 'Immediate',
      assigned_agent: currentLead.assigned_agent,
      booking_type: 'Viewing Booked'
    };

    saveBookedPropertyToFirestore(viewBookingRecord).catch(err => {
      console.warn('saveBookedPropertyToFirestore viewing error:', err);
    });

    // Update property listing state so Property Admin immediately tracks the booker
    setPropertiesList(prev => {
      const updated = prev.map(p => {
        if (p.id === viewingModalProperty.id) {
          const item: PropertyListing = {
            ...p,
            is_booked: true,
            status: 'Booked' as const,
            booking_id: viewBookingId,
            booked_by_name: customerName,
            booked_by_phone: customerPhone,
            assigned_to: customerName,
            assigned_phone: customerPhone,
            booked_at: bookedAt,
            booking_notes: viewNotes,
            booking_amount_aed: tokenAmount
          };
          savePropertyToFirestore(item).catch(() => {});
          return item;
        }
        return p;
      });
      try { localStorage.setItem('localProperties', JSON.stringify(updated)); } catch (_) {}
      return updated;
    });

    fetch('/api/properties/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...viewBookingRecord,
        propertyId: viewingModalProperty.id,
        customerName,
        customerPhone,
        customerEmail,
        bookingAmount: tokenAmount,
        notes: viewNotes
      })
    }).catch(() => {});

    // Update lead status to Viewing
    updateActiveLead({
      lead_status: 'Viewing',
      lead_priority: 'Urgent',
      viewing_preference: `${viewingMode} on ${viewingDate} at ${viewingTime}`,
      human_handoff_required: true,
      handoff_reason: `Confirmed viewing for ${viewingModalProperty.title}`
    });

    // Add confirmation message to chat
    const confirmMsg: ChatMessage = {
      id: 'MSG-VIEW-CONFIRM-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
      lead_id: currentLead.id,
      role: 'assistant',
      content: `I have scheduled your ${viewingMode.toLowerCase()} for **${viewingModalProperty.title}** on **${viewingDate} at ${viewingTime}**.\n\nYour assigned Lyka Realty senior property advisor, **${currentLead.assigned_agent}**, has received the confirmation and will contact you via WhatsApp / phone with the location pin and access details.`,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, confirmMsg]);
    saveInteractionData(confirmMsg);
    setViewingModalProperty(null);
  };

  // Human handoff confirmation (Strict Zod validation)
  const handleConfirmHandoff = () => {
    const rawPhone = handoffPhone.trim() || currentLead.phone || '';
    
    // Validate payload strictly using Zod
    const validationResult = talkToAgentSchema.safeParse({
      phone: rawPhone,
      notes: handoffNotes.trim()
    });

    if (!validationResult.success) {
      const firstIssue = validationResult.error.issues[0]?.message || 'Please enter a valid mobile number.';
      setHandoffError(firstIssue);
      return;
    }

    const { phone: finalPhone, notes } = validationResult.data;
    const finalNotes = notes || 'Client requested direct coordination with Lyka agent';

    const updatedLead: LeadProfile = {
      ...currentLead,
      phone: finalPhone,
      human_handoff_required: true,
      lead_status: 'Viewing',
      lead_priority: 'Urgent',
      handoff_reason: finalNotes
    };

    updateActiveLead({
      phone: finalPhone,
      human_handoff_required: true,
      lead_status: 'Viewing',
      lead_priority: 'Urgent',
      handoff_reason: finalNotes
    });

    // Store in Firestore User_login & leads
    saveTalkToAgentRequest(
      currentUserId,
      currentUserEmail || currentLead.email || null,
      finalPhone,
      finalNotes,
      updatedLead
    ).catch(err => console.warn('saveTalkToAgentRequest notice:', err));

    const handoffMsg: ChatMessage = {
      id: 'MSG-HANDOFF-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
      lead_id: currentLead.id,
      role: 'assistant',
      content: `### ✅ Submitted\n\nYour request has been submitted successfully. Our property advisor has been notified and will contact you shortly.`,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, handoffMsg]);
    saveInteractionData(handoffMsg);
    setShowHandoffModal(false);
    setHandoffError('');
  };

  // Assign / Book a property
  const handleBookProperty = async (
    propertyId: string,
    bookingDetails: {
      customerName?: string;
      customerPhone?: string;
      customerEmail?: string;
      bookingAmount?: number;
      notes?: string;
      assigned_to?: string;
      assigned_phone?: string;
      assigned_email?: string;
      assigned_id_card?: string;
      assigned_id_type?: string;
      customer_id_card?: string;
      customer_id_type?: string;
      booking_amount_aed?: number;
      booking_notes?: string;
    }
  ) => {
    // Guard: Super Admin is view-only for assignments/bookings
    if (adminTargetPortal === 'admin') {
      alert('Action not permitted: Super Admin is View-Only for bookings and assignments. Only Property Admin can book or assign properties.');
      return;
    }

    const targetProp = propertiesList.find(p => p.id === propertyId);
    const finalCustomerPhone = (bookingDetails.customerPhone || bookingDetails.assigned_phone || currentLead.phone || '').trim();
    let finalCustomerName = (bookingDetails.customerName || bookingDetails.assigned_to || currentLead.full_name || '').trim();
    if (!finalCustomerName) {
      finalCustomerName = finalCustomerPhone ? `Client (${finalCustomerPhone.slice(-4)})` : 'Valued Client';
    }

    const finalIdCard = (bookingDetails.assigned_id_card || bookingDetails.customer_id_card || '').trim();
    const finalIdType = (bookingDetails.assigned_id_type || bookingDetails.customer_id_type || 'Emirates ID').trim();

    // Strict identification verification check:
    // If the unit was already booked by someone, only the matching person can be assigned.
    if (targetProp && (targetProp.is_booked || (targetProp.status || '').toLowerCase() === 'booked')) {
      const regPhoneDigits = (targetProp.booked_by_phone || targetProp.assigned_phone || '').replace(/[^0-9]/g, '');
      const newPhoneDigits = finalCustomerPhone.replace(/[^0-9]/g, '');
      const regIdCard = (targetProp.booked_by_id_card || targetProp.assigned_id_card || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      const newIdCard = finalIdCard.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      const regName = (targetProp.booked_by_name || targetProp.assigned_to || '').trim().toLowerCase();
      const newName = finalCustomerName.trim().toLowerCase();

      const hasPriorBooker = Boolean(regPhoneDigits || regIdCard || regName);
      if (hasPriorBooker) {
        const phoneMatch = Boolean(
          regPhoneDigits.length >= 7 &&
          newPhoneDigits.length >= 7 &&
          (regPhoneDigits === newPhoneDigits ||
           regPhoneDigits.endsWith(newPhoneDigits.slice(-7)) ||
           newPhoneDigits.endsWith(regPhoneDigits.slice(-7)))
        );
        const idMatch = Boolean(regIdCard && newIdCard && regIdCard === newIdCard);
        const nameMatch = Boolean(
          regName && newName &&
          (regName === newName || regName.includes(newName) || newName.includes(regName))
        );

        if (!phoneMatch && !idMatch && !(nameMatch && newPhoneDigits.length >= 4)) {
          const bookerDesc = targetProp.booked_by_name || targetProp.assigned_to || 'another customer';
          const bookerPhone = targetProp.booked_by_phone || targetProp.assigned_phone || 'Phone on file';
          alert(
            `❌ Identification Mismatch Error: Property "${targetProp.title}" was booked by ${bookerDesc} (${bookerPhone}). Only the person who booked this property can be assigned.`
          );
          throw new Error(`Identification Mismatch: Cannot assign to a different client than the registered booker.`);
        }
      }
    }

    const propPrice = Number(targetProp?.price_aed) || 0;
    const rawAmount = Number(bookingDetails.bookingAmount ?? bookingDetails.booking_amount_aed);
    const finalBookingAmount = (rawAmount > 0) ? rawAmount : (propPrice > 0 ? Math.round(propPrice * 0.10) : 50000);

    let finalCustomerEmail = (bookingDetails.customerEmail || bookingDetails.assigned_email || currentLead.email || '').trim();
    if (!finalCustomerEmail) {
      const cleanDigits = finalCustomerPhone.replace(/[^0-9]/g, '');
      finalCustomerEmail = cleanDigits ? `client_${cleanDigits}@customer.lykarealty.ae` : 'client@lykarealty.ae';
    }

    let finalNotes = (bookingDetails.notes || bookingDetails.booking_notes || '').trim();
    if (!finalNotes) {
      const intentStr = currentLead.intent ? `Intent: ${currentLead.intent}. ` : '';
      const budgetStr = currentLead.budget_max_aed ? `Budget: AED ${Number(currentLead.budget_max_aed).toLocaleString()}. ` : '';
      const timelineStr = currentLead.move_in_timeline ? `Timeline: ${currentLead.move_in_timeline}. ` : '';
      finalNotes = `Booking confirmed & verified for ${targetProp?.title || propertyId} in ${targetProp?.community || 'Dubai'} (${targetProp?.bedrooms || 2} BR, AED ${propPrice.toLocaleString()}). ${intentStr}${budgetStr}${timelineStr}Assigned to ${finalCustomerName} (${finalCustomerPhone}), ID: [${finalIdType}: ${finalIdCard}].`;
    }

    const booked_at = new Date().toISOString();
    const booking_id = targetProp?.booking_id || ('BK-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase());

    // 1. Update local properties state & localStorage
    let updatedPropertyObj: PropertyListing | null = null;
    setPropertiesList(prev => {
      const updated = prev.map(p => {
        if (p.id === propertyId) {
          const item: PropertyListing = {
            ...p,
            is_booked: true,
            status: 'Booked' as const,
            booking_id,
            assigned_to: finalCustomerName,
            assigned_phone: finalCustomerPhone,
            assigned_email: finalCustomerEmail,
            assigned_id_card: finalIdCard || p.assigned_id_card || p.booked_by_id_card,
            assigned_id_type: finalIdType || p.assigned_id_type || 'Emirates ID',
            assignment_verified: true,
            assigned_at: booked_at,
            booked_by_name: p.booked_by_name || finalCustomerName,
            booked_by_phone: p.booked_by_phone || finalCustomerPhone,
            booked_by_id_card: p.booked_by_id_card || finalIdCard,
            booking_amount_aed: finalBookingAmount,
            booking_notes: finalNotes,
            booked_at: p.booked_at || booked_at
          };
          updatedPropertyObj = item;
          return item;
        }
        return p;
      });
      try {
        localStorage.setItem('localProperties', JSON.stringify(updated));
      } catch (e) {
        console.warn('Could not save localProperties to localStorage:', e);
      }
      return updated;
    });

    // 2. Persist to Firestore properties collection
    if (updatedPropertyObj) {
      savePropertyToFirestore(updatedPropertyObj).catch(err => {
        console.warn('savePropertyToFirestore booking error:', err);
      });
    }

    // 3. Persist to Firestore booked_properties collection
    const bookedRecord: BookedPropertyRecord = {
      id: booking_id,
      property_id: propertyId,
      property_title: targetProp?.title || propertyId,
      community: targetProp?.community || 'Dubai',
      city: targetProp?.city || currentLead.target_city || 'Dubai',
      bedrooms: String(targetProp?.bedrooms || '2'),
      price_aed: propPrice,
      property_type: targetProp?.property_type || 'Apartment',
      customer_name: finalCustomerName,
      customer_phone: finalCustomerPhone,
      customer_email: finalCustomerEmail,
      customer_id_card: finalIdCard,
      customer_id_type: finalIdType,
      assigned_to: finalCustomerName,
      assigned_phone: finalCustomerPhone,
      assigned_id_card: finalIdCard,
      assignment_verified: true,
      booking_amount_aed: finalBookingAmount,
      notes: finalNotes,
      booked_at,
      status: 'Booked',
      lead_id: currentLead.id,
      intent: currentLead.intent || 'Buy',
      target_city: currentLead.target_city || 'Dubai',
      budget_max_aed: Number(currentLead.budget_max_aed) || propPrice,
      move_in_timeline: currentLead.move_in_timeline || 'Immediate',
      assigned_agent: currentLead.assigned_agent || targetProp?.agent_name || 'Senior Property Advisor',
      booking_type: 'Verified Assignment'
    };
    saveBookedPropertyToFirestore(bookedRecord).catch(err => {
      console.warn('saveBookedPropertyToFirestore error:', err);
    });

    // 4. Sync to backend server endpoint /api/properties/book
    try {
      await fetch('/api/properties/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...bookedRecord,
          propertyId,
          customerName: finalCustomerName,
          customerPhone: finalCustomerPhone,
          customerEmail: finalCustomerEmail,
          bookingAmount: finalBookingAmount,
          notes: finalNotes,
          assigned_to: finalCustomerName,
          assigned_phone: finalCustomerPhone,
          assigned_email: finalCustomerEmail,
          assigned_id_card: finalIdCard,
          assigned_id_type: finalIdType,
          assignment_verified: true,
          booking_amount_aed: finalBookingAmount,
          booking_notes: finalNotes
        })
      });
    } catch (err) {
      console.warn('Backend /api/properties/book notice:', err);
    }
  };

  // Unbook / Reopen an assigned property
  const handleUnbookProperty = async (propertyId: string) => {
    // Guard: Super Admin is view-only for assignments/bookings
    if (adminTargetPortal === 'admin') {
      alert('Action not permitted: Super Admin is View-Only for bookings and assignments. Only Property Admin can release bookings.');
      return;
    }

    let updatedPropertyObj: PropertyListing | null = null;
    setPropertiesList(prev => {
      const updated = prev.map(p => {
        if (p.id === propertyId) {
          const item: PropertyListing = {
            ...p,
            is_booked: false,
            status: 'Available' as const,
            assigned_to: undefined,
            assigned_phone: undefined,
            assigned_email: undefined,
            assigned_id_card: undefined,
            assigned_id_type: undefined,
            assignment_verified: false,
            assigned_at: undefined,
            booking_amount_aed: undefined,
            booking_notes: undefined,
            booked_at: undefined,
            booking_id: undefined
          };
          updatedPropertyObj = item;
          return item;
        }
        return p;
      });
      try {
        localStorage.setItem('localProperties', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });

    if (updatedPropertyObj) {
      savePropertyToFirestore(updatedPropertyObj).catch(err => {
        console.warn('savePropertyToFirestore unbook error:', err);
      });
    }

    cancelBookedPropertyInFirestore(propertyId).catch(err => {
      console.warn('cancelBookedPropertyInFirestore error:', err);
    });

    try {
      await fetch('/api/properties/unbook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId })
      });
    } catch (err) {
      console.warn('Backend /api/properties/unbook notice:', err);
    }
  };

  const handleAddProperty = async (newProp: PropertyListing) => {
    // 1. Immediately reflect in local state and localStorage
    setPropertiesList(prev => {
      const updated = [newProp, ...prev];
      try {
        localStorage.setItem('localProperties', JSON.stringify(updated));
      } catch (e) {
        console.warn('Could not save localProperties to localStorage:', e);
      }
      return updated;
    });

    // 2. Persist directly to Firestore collection 'properties'
    try {
      await savePropertyToFirestore(newProp);
      console.log(`[Property Admin] Property ${newProp.id} saved to Firestore successfully.`);
    } catch (err) {
      console.warn('Could not save property to Firestore:', err);
    }

    // 3. Persist to backend server API (which updates Firestore and builds vector embeddings)
    try {
      await fetch('/api/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProp)
      });
    } catch (err) {
      console.warn('Could not save property to backend server:', err);
    }
  };

  const handleUpdateProperty = async (updatedProp: PropertyListing) => {
    setPropertiesList(prev => {
      const updated = prev.map(p => p.id === updatedProp.id ? updatedProp : p);
      try {
        localStorage.setItem('localProperties', JSON.stringify(updated));
      } catch (e) {
        console.warn('Could not save localProperties to localStorage:', e);
      }
      return updated;
    });
    try {
      await savePropertyToFirestore(updatedProp);
    } catch (err) {
      console.warn('Could not save updated property to Firestore:', err);
    }
    try {
      await fetch('/api/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedProp)
      });
    } catch (err) {
      console.warn('Could not save updated property to backend server:', err);
    }
  };

  const handleDeleteProperty = async (propertyId: string) => {
    try {
      const savedDeleted = localStorage.getItem('deletedPropertyIds');
      const arr = savedDeleted ? JSON.parse(savedDeleted) : [];
      if (!arr.includes(propertyId)) {
        arr.push(propertyId);
        localStorage.setItem('deletedPropertyIds', JSON.stringify(arr));
      }
    } catch (_) {}

    setPropertiesList(prev => {
      const updated = prev.filter(p => p.id !== propertyId);
      try {
        localStorage.setItem('localProperties', JSON.stringify(updated));
      } catch (e) {
        console.warn('Could not save localProperties to localStorage:', e);
      }
      return updated;
    });
    try {
      await deletePropertyFromFirestore(propertyId);
    } catch (err) {
      console.warn('Could not delete property from Firestore:', err);
    }
    try {
      await fetch(`/api/properties/${encodeURIComponent(propertyId)}`, {
        method: 'DELETE'
      });
    } catch (err) {
      console.warn('Could not delete property from backend server:', err);
    }
  };

  // Fast duplicate & missing requirements count for Navbar badges
  const { duplicateCount, missingRequirementsCount } = useMemo(() => {
    const list = propertiesList;
    let dupCount = 0;
    const paired = new Set<string>();
    for (let i = 0; i < list.length; i++) {
      if (paired.has(list[i].id)) continue;
      const t1 = (list[i].title || '').toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
      for (let j = i + 1; j < list.length; j++) {
        if (paired.has(list[j].id)) continue;
        const t2 = (list[j].title || '').toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
        const r1 = (list[i].rera_id || '').trim().toLowerCase();
        const r2 = (list[j].rera_id || '').trim().toLowerCase();
        if ((r1 && r2 && r1 === r2) || (t1 && t2 && (t1 === t2 || t1.includes(t2) || t2.includes(t1)))) {
          dupCount += 1;
          paired.add(list[j].id);
          break;
        }
      }
    }

    let missingCount = 0;
    list.forEach(p => {
      if (!p.rera_id || !p.price_aed || !p.size_sqft || !p.image_url || !p.developer || !p.handover_date || !p.payment_plan) {
        missingCount += 1;
      }
    });

    return { duplicateCount: dupCount, missingRequirementsCount: missingCount };
  }, [propertiesList]);

  const bookedPropertyCount = propertiesList.filter(p => p.is_booked || (p.status || '').toLowerCase() === 'booked').length;

  const isOtpLocked = Boolean(adminOtpLockedUntil && adminOtpLockedUntil > Date.now());
  const lockoutMinutesRemaining = Math.max(1, Math.ceil(adminOtpLockoutRemaining / 60));

  return (
    <div 
      data-theme={theme}
      style={{ backgroundColor: customBgColor || undefined }}
      className={`flex flex-col h-screen h-[100dvh] w-screen max-w-full font-sans overflow-hidden transition-colors duration-300 ${
        theme === 'dark' 
          ? 'bg-[#0b0f17] text-slate-100 theme-dark dark' 
          : theme === 'navy' 
          ? 'bg-[#070d1e] text-blue-50 theme-navy dark' 
          : 'bg-slate-950 text-slate-300 theme-ivory'
      }`}
    >


      {/* Navigation Header */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          if (tab === 'chat') setAdminPanelOpen(false);
        }}
        leadCount={leadsList.filter(l => l.lead_status !== 'New').length}
        propertyCount={propertiesList.length}
        bookedPropertyCount={bookedPropertyCount}
        duplicateCount={duplicateCount}
        missingRequirementsCount={missingRequirementsCount}
        customerCount={customerCount}
        firestoreActive={firestoreActive}
        vectorStatus={mongoStatus}
        onStartNewChat={handleStartNewChat}
        isCustomerLoggedIn={isCustomerLoggedIn}
        adminPanelOpen={adminPanelOpen}
        adminAuthenticated={effectiveAdminAuthed}
        propertyManagerAuthenticated={effectivePmAuthed}
        salesManagerAuthenticated={effectiveSmAuthed}
        adminTargetPortal={adminTargetPortal}
        onSelectPortal={(portal) => {
          setAdminTargetPortal(portal);
          try {
            localStorage.setItem('lyka_admin_target_portal', portal);
          } catch (e) {}
          const isAuthed = portal === 'admin' 
            ? effectiveAdminAuthed 
            : portal === 'property_manager'
            ? (effectivePmAuthed || effectiveAdminAuthed)
            : (effectiveSmAuthed || effectiveAdminAuthed);
          if (!isAuthed) {
            handleSelectPortalTab(portal);
            setShowAdminLoginModal(true);
          } else {
            setAdminPanelOpen(true);
            if (portal === 'property_manager') {
              setActiveTab('properties');
            } else if (portal === 'sales_manager') {
              setActiveTab('sales_duplicates');
            } else {
              setActiveTab('crm');
            }
          }
        }}
        onToggleAdminPanel={() => {
          const isAdminTab = ['crm', 'properties', 'knowledge', 'stats', 'customers', 'user_chats', 'login_stats', 'assigned_properties', 'sales_duplicates', 'sales_missing_requirements', 'favorites', 'staff_access'].includes(activeTab);
          if (adminPanelOpen || isAdminTab) {
            // Close admin → go back to home
            setAdminPanelOpen(false);
            setActiveTab('home');
          } else {
            const isAuthed = adminTargetPortal === 'admin' 
              ? effectiveAdminAuthed 
              : adminTargetPortal === 'property_manager'
              ? (effectivePmAuthed || effectiveAdminAuthed)
              : (effectiveSmAuthed || effectiveAdminAuthed);
            if (!isAuthed) {
              // Not logged in → show login gate
              handleSelectPortalTab(adminTargetPortal);
              setShowAdminLoginModal(true);
            } else {
              // Already authed → open portal
              setAdminPanelOpen(true);
              if (adminTargetPortal === 'property_manager') {
                setActiveTab('properties');
              } else if (adminTargetPortal === 'sales_manager') {
                setActiveTab('sales_duplicates');
              } else {
                setActiveTab('crm');
              }
            }
          }
        }}
        onAdminLogout={async () => {
          setAdminAuthenticated(false);
          setPropertyManagerAuthenticated(false);
          setSalesManagerAuthenticated(false);
          try {
            localStorage.removeItem('lyka_admin_authenticated');
            localStorage.removeItem('lyka_pm_authenticated');
            localStorage.removeItem('lyka_sm_authenticated');
            localStorage.removeItem('lyka_admin_target_portal');
          } catch (e) {}
          setAdminPanelOpen(false);
          setActiveTab('chat');
          // Delete any OTP from database upon logout
          try {
            await deletePortalOtpFromFirestore();
            fetch('/api/auth/clear-email-otp', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: adminEmailInput || '' })
            }).catch(() => {});
          } catch (cleanErr) {
            console.warn('Notice cleaning OTP on logout:', cleanErr);
          }
        }}
        onOpenAbout={() => setAboutOpen(true)}
        onOpenSettings={() => setShowSettingsModal(true)}
        customBgColor={customBgColor}
        onSelectCustomBg={(c) => {
          setCustomBgColor(c);
          try { localStorage.setItem('lyka_realty_custom_bg', c); } catch (_) {}
        }}
        onResetCustomBg={() => {
          setCustomBgColor('');
          try { localStorage.removeItem('lyka_realty_custom_bg'); } catch (_) {}
        }}
        currentTheme={theme}
        onSelectTheme={setTheme}
        properties={propertiesList}
        selectedProperty={selectedProperty}
        onSelectProperty={(prop) => {
          setSelectedProperty(prop);
          setViewingModalProperty(prop);
        }}
        favorites={favorites}
        onToggleFavorite={toggleFavorite}
        showFavoritesOnly={showFavoritesOnly}
        onToggleFavoritesFilter={handleToggleFavoritesFilter}
        selectedCity={selectedCityFilter}
        onSelectCity={(city) => {
          setSelectedCityFilter(city);
          if (activeTab === 'home') {
            setTimeout(() => {
              const el = document.getElementById('portfolio-section');
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
          }
        }}
      />

      {/* Main Body */}
      {/* Main Body: Landing page and AI Chat are the customer-facing base. Admin pages shown when admin tab is active */}
      <main className="flex-1 flex overflow-hidden relative">
        {/* Home Landing — professional property showcase; asking AI hands over to the unchanged chatbot */}
        {activeTab === 'home' && (
          <div className="absolute inset-0 z-10 flex w-full h-full overflow-hidden">
            <HomeLanding
              customBgColor={customBgColor}
              properties={propertiesList.length > 0 ? propertiesList : ALL_VERIFIED_PROPERTIES}
              onAskAI={handleAskFromLanding}
              onBookViewing={(prop) => setViewingModalProperty(prop)}
              onOpenChat={() => {
                setActiveTab('chat');
                setAdminPanelOpen(false);
              }}
              favorites={favorites}
              onToggleFavorite={toggleFavorite}
              showFavoritesOnly={showFavoritesOnly}
              onClearFavoritesFilter={() => setShowFavoritesOnly(false)}
              cityFilter={selectedCityFilter}
              onSelectCity={setSelectedCityFilter}
            />
          </div>
        )}

        {/* AI Chat — always rendered, hidden behind admin pages when admin active */}
        <div className={`absolute inset-0 flex w-full h-full overflow-hidden transition-opacity duration-200 ${
          activeTab === 'chat' ? 'opacity-100 z-10 pointer-events-auto' : 'opacity-0 z-0 pointer-events-none'
        }`}>
          <AgenticChat
            customBgColor={customBgColor}
            messages={messages}
            currentLead={currentLead}
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
            onBookViewing={(prop) => setViewingModalProperty(prop)}
            onOpenAgentHandoff={() => {
              if (!currentUserId && !auth.currentUser) {
                alert('Sign In / Sign Up Required: Please Sign In or Sign Up first to connect and talk directly with our senior property advisor.');
                return;
              }
              const initialDigits = (currentLead.phone || '').replace(/\D/g, '').slice(0, 10);
              setHandoffPhone(initialDigits);
              setHandoffError('');
              setShowHandoffModal(true);
            }}
            onToggleSidebar={() => setSidebarOpen(prev => !prev)}
            sidebarOpen={sidebarOpen}
            onUpdateLead={updateActiveLead}
            onStartNewChat={handleStartNewChat}
            onAuthChange={handleAuthChange}
            onLoadChat={handleLoadChat}
            onDeleteChat={handleDeleteChat}
            onOpenSettings={() => setShowSettingsModal(true)}
            favorites={favorites}
            onToggleFavorite={toggleFavorite}
          />
          {sidebarOpen && (
            <LeadProfileSidebar
              lead={currentLead}
              onUpdateLead={updateActiveLead}
              onTriggerHandoff={() => {
                if (!currentUserId && !auth.currentUser) {
                  alert('Sign In / Sign Up Required: Please Sign In or Sign Up first to connect and talk directly with our senior property advisor.');
                  return;
                }
                const initialDigits = (currentLead.phone || '').replace(/\D/g, '').slice(0, 10);
                setHandoffPhone(initialDigits);
                setHandoffError('');
                setShowHandoffModal(true);
              }}
              onScheduleViewing={() => {
                const sampleProp = propertiesList[0];
                setViewingModalProperty(sampleProp);
              }}
              onClose={() => setSidebarOpen(false)}
            />
          )}
        </div>

        {/* Admin Pages — shown when an admin tab is active (not on home or chat) */}
        {activeTab !== 'chat' && activeTab !== 'home' && (
          <div className="flex-1 flex w-full h-full overflow-hidden relative">
            <div className="flex-1 flex h-full overflow-hidden">
              {/* Admin Portal Pages — require adminAuthenticated */}
            {effectiveAdminAuthed && activeTab === 'crm' && (
              <CrmPipeline
                leads={leadsList}
                followUps={followUpsList}
                onSelectLead={(lead) => {
                  setCurrentLead(lead);
                  setActiveTab('chat');
                  setAdminPanelOpen(false);
                }}
                onUpdateLeadStatus={(id, st) => {
                  const target = leadsList.find(l => l.id === id);
                  if (target) {
                    const updated = { ...target, lead_status: st };
                    updateActiveLead(updated);
                  }
                }}
                onAddFollowUp={(task) => {
                  setFollowUpsList(prev => [task, ...prev]);
                  saveFollowUpToFirestore(task);
                  fetch('/api/followups/sync', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(task)
                  }).catch(() => {});
                }}
              />
            )}

            {effectiveAdminAuthed && activeTab === 'knowledge' && (
              <KnowledgeBaseView />
            )}

            {/* Stats — accessible to both Admin and Property Manager */}
            {(effectiveAdminAuthed || effectivePmAuthed) && activeTab === 'stats' && (
              <AdminStats properties={propertiesList.length > 0 ? propertiesList : ALL_VERIFIED_PROPERTIES} />
            )}

            {/* Assign / Bookings Section — accessible to both Property Manager and Admin */}
            {(effectiveAdminAuthed || effectivePmAuthed) && activeTab === 'assigned_properties' && (
              <AssignedPropertiesView
                properties={propertiesList.length > 0 ? propertiesList : ALL_VERIFIED_PROPERTIES}
                leads={leadsList}
                onBookProperty={handleBookProperty}
                onUnbookProperty={handleUnbookProperty}
                canManageBookings={adminTargetPortal === 'property_manager'}
              />
            )}

            {/* Customer Profiles & Activity (Which Customer Logged In) — Admin only */}
            {effectiveAdminAuthed && activeTab === 'customers' && (
              <CustomerProfiles 
                onNavigateToTrends={() => setActiveTab('login_stats')} 
                onSelectUserChat={(user) => {
                  setChatHistoryTargetUser(user);
                  setActiveTab('user_chats');
                }}
              />
            )}

            {/* User Chat History (Select User Name from Login, then view Sequential Q&A Chats) — Admin only */}
            {effectiveAdminAuthed && activeTab === 'user_chats' && (
              <AdminUserChatHistory
                initialSelectedUser={chatHistoryTargetUser}
                onNavigateToProfiles={() => setActiveTab('customers')}
                customBgColor={customBgColor}
                onSelectCustomBg={(c) => {
                  setCustomBgColor(c);
                  try { localStorage.setItem('lyka_realty_custom_bg', c); } catch (_) {}
                }}
                onResetCustomBg={() => {
                  setCustomBgColor('');
                  try { localStorage.removeItem('lyka_realty_custom_bg'); } catch (_) {}
                }}
                currentTheme={theme}
                onSelectTheme={setTheme}
                onOpenSettings={() => setShowSettingsModal(true)}
              />
            )}

            {/* Login Trends & Aggregates (Date/Day/Month/Year) — Admin only */}
            {effectiveAdminAuthed && activeTab === 'login_stats' && (
              <CustomerAnalytics onNavigateToProfiles={() => setActiveTab('customers')} />
            )}

            {/* Property Manager, Admin, & Sales Manager Portal Properties Page */}
            {(effectivePmAuthed || effectiveAdminAuthed || salesManagerAuthenticated) && activeTab === 'properties' && (
              <PropertyInventory
                properties={propertiesList}
                currentLead={currentLead}
                canAddProperty={adminTargetPortal === 'property_manager' || adminAuthenticated}
                onBookViewing={(prop) => setViewingModalProperty(prop)}
                onAddProperty={handleAddProperty}
                onUpdateProperty={handleUpdateProperty}
              />
            )}

            {/* Sales Manager Portal Pages — Duplicate Detection & Missing Requirements Quality Audit */}
            {(effectiveSmAuthed || effectiveAdminAuthed) && (activeTab === 'sales_duplicates' || activeTab === 'sales_missing_requirements') && (
              <SalesManagerDashboard
                properties={propertiesList}
                activeSubTab={activeTab === 'sales_missing_requirements' ? 'missing_requirements' : 'duplicates'}
                onChangeSubTab={(sub) => setActiveTab(sub === 'missing_requirements' ? 'sales_missing_requirements' : 'sales_duplicates')}
                onUpdateProperty={handleUpdateProperty}
                onDeleteProperty={handleDeleteProperty}
                onAddProperty={handleAddProperty}
              />
            )}


            {/* Customer Favorites & Saved Residences View — visible in Admin Option */}
            {(adminAuthenticated || propertyManagerAuthenticated || salesManagerAuthenticated) && activeTab === 'favorites' && (
              <AdminFavoritesView
                favorites={dbFavoritesList}
                properties={propertiesList.length > 0 ? propertiesList : ALL_VERIFIED_PROPERTIES}
                onRefresh={fetchDbFavorites}
                onSelectProperty={(prop) => setViewingModalProperty(prop)}
                onRemoveFavorite={handleAdminDeleteFavorite}
              />
            )}

            
            {/* Staff & Portal Access Management (Super Admin adds Property Admins & Sales Managers with ID Card & Mobile) */}
            {effectiveAdminAuthed && activeTab === 'staff_access' && (
              <AdminStaffManagement
                staffList={staffList}
                onRefreshStaff={loadStaffList}
                onNavigateToPortals={(portal) => {
                  handleSelectPortalTab(portal);
                  if (portal === 'property_manager') {
                    setActiveTab('properties');
                  } else {
                    setActiveTab('sales_duplicates');
                  }
                }}
              />
            )}

            {/* Unauthorized access fallback */}
            {adminPanelOpen && !isPortalAuthed && String(activeTab) !== 'chat' && (
              <div className="flex-1 flex items-center justify-center bg-slate-950">
                <div className="text-center p-8">
                  <Lock className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                  <h3 className="text-lg font-bold text-slate-300 mb-2">Access Denied</h3>
                  <p className="text-slate-500 mb-6">Please sign in to access this portal.</p>
                  <button
                    onClick={() => {
                      handleSelectPortalTab(adminTargetPortal);
                      setShowAdminLoginModal(true);
                    }}
                    className="px-6 py-2 bg-amber-500 hover:bg-amber-400 text-amber-950 font-bold rounded-xl text-sm transition-colors"
                  >
                    Sign In
                  </button>
                </div>
              </div>
            )}
            </div>

            {/* Admin Copilot Chatbot — ONLY rendered for Super Admin on Admin pages (REMOVED from Home) */}
            {effectiveAdminAuthed && adminTargetPortal === 'admin' && (
              <AdminCopilotChat
                properties={propertiesList.length > 0 ? propertiesList : ALL_VERIFIED_PROPERTIES}
                leads={leadsList}
                customerCount={customerCount}
                followUps={followUpsList}
                activeTab={activeTab}
                onNavigateTab={(tab) => {
                  if (tab === 'appearance' || tab === 'settings') {
                    setShowSettingsModal(true);
                  } else {
                    setActiveTab(tab as any);
                  }
                }}
              />
            )}

          </div>
        )}
      </main>

      {/* Viewing Scheduler Modal */}
      {viewingModalProperty && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-4 sm:p-6 shadow-2xl space-y-3 sm:space-y-4 max-h-[92dvh] overflow-y-auto my-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Calendar className="w-5 h-5 text-amber-600" />
                <h3 className="text-sm font-bold text-slate-300">Schedule Property Viewing</h3>
              </div>
              <button 
                onClick={() => setViewingModalProperty(null)}
                className="text-slate-400 hover:text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center space-x-3">
              <img 
                src={viewingModalProperty.image_url} 
                alt={viewingModalProperty.title}
                className="w-16 h-14 rounded-lg object-cover" 
              />
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-bold text-slate-300 truncate">{viewingModalProperty.title}</h4>
                <p className="text-[11px] text-amber-600 font-semibold mt-0.5">
                  {(viewingModalProperty.city || '').toLowerCase() === 'mumbai' && viewingModalProperty.price_inr
                    ? `₹ ${(viewingModalProperty.price_inr / 10000000).toFixed(1)} Cr (AED ${viewingModalProperty.price_aed.toLocaleString()})`
                    : `AED ${viewingModalProperty.price_aed.toLocaleString()}`}
                </p>
                <p className="text-[10px] text-slate-400">{viewingModalProperty.community} • {viewingModalProperty.bedrooms} BR</p>
              </div>
              <button
                type="button"
                onClick={() => toggleFavorite(viewingModalProperty.id)}
                aria-label={favorites.includes(viewingModalProperty.id) ? 'Remove from favorites' : 'Save property (no login required)'}
                title={favorites.includes(viewingModalProperty.id) ? 'Remove from favorites' : 'Save property (no login required)'}
                className={`p-2 rounded-xl border transition-all active:scale-95 cursor-pointer shrink-0 ${
                  favorites.includes(viewingModalProperty.id)
                    ? 'bg-red-500/20 border-red-500/50 text-red-400'
                    : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-red-400 hover:border-red-500/50'
                }`}
              >
                <Heart className={`w-4 h-4 ${favorites.includes(viewingModalProperty.id) ? 'fill-current text-red-400' : ''}`} />
              </button>
            </div>

            <form onSubmit={handleConfirmViewing} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Preferred Viewing Mode</label>
                <select
                  value={viewingMode}
                  onChange={(e) => setViewingMode(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 outline-none focus:border-amber-500"
                >
                  <option value="In-person at property">In-person at property</option>
                  <option value="Virtual 3D walkthrough">Virtual 3D walkthrough / Video call</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Date</label>
                  <input
                    type="date"
                    value={viewingDate}
                    onChange={(e) => setViewingDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 outline-none focus:border-amber-500"
                    required
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Time Slot</label>
                  <select
                    value={viewingTime}
                    onChange={(e) => setViewingTime(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 outline-none focus:border-amber-500"
                  >
                    <option value="10:00 AM">10:00 AM</option>
                    <option value="11:30 AM">11:30 AM</option>
                    <option value="02:00 PM">02:00 PM</option>
                    <option value="04:30 PM">04:30 PM</option>
                    <option value="06:00 PM">06:00 PM</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex space-x-2">
                <button
                  type="button"
                  onClick={() => setViewingModalProperty(null)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2.5 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-amber-500 hover:bg-amber-400 text-amber-950 py-2.5 rounded-xl font-bold shadow-md"
                >
                  Confirm Viewing
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Human Agent Handoff Modal */}
      {showHandoffModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-4 sm:p-6 shadow-2xl space-y-3 sm:space-y-4 max-h-[92dvh] overflow-y-auto my-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <UserCheck className="w-5 h-5 text-amber-600" />
                <h3 className="text-sm font-bold text-slate-300">Escalate to Lyka Senior Agent</h3>
              </div>
              <button 
                onClick={() => setShowHandoffModal(false)}
                className="text-slate-400 hover:text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Assigned Lyka Specialist:</span>
                <span className="font-bold text-slate-300">{currentLead.assigned_agent}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Customer Intent:</span>
                <span className="text-amber-600 font-semibold">{currentLead.intent} ({currentLead.customer_type})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Target Budget:</span>
                <span className="text-slate-300 font-mono">AED {currentLead.budget_max ? currentLead.budget_max.toLocaleString() : 'In discussion'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Communities:</span>
                <span className="text-slate-300">{(currentLead.preferred_communities || []).join(', ') || 'Any prime community'}</span>
              </div>
            </div>

            {/* Mobile Number Input */}
            <div className="space-y-1.5 text-xs">
              <label className="text-slate-300 font-semibold flex items-center justify-between">
                <span className="flex items-center space-x-1.5">
                  <Phone className="w-3.5 h-3.5 text-amber-500" />
                  <span>Mobile Number (10 digits): <span className="text-amber-600">*</span></span>
                </span>
                {handoffPhone.length === 10 ? (
                  <span className="text-[10px] text-emerald-400 font-bold flex items-center space-x-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Valid 10 Digits</span>
                  </span>
                ) : (
                  <span className="text-[10px] text-amber-600 font-medium">10 digits required</span>
                )}
              </label>
              <div className="relative">
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  value={handoffPhone}
                  onChange={(e) => {
                    // Strictly numbers only: accept only 0-9, maximum 10 digits
                    const onlyDigits = e.target.value.replace(/\D/g, '').slice(0, 10);
                    setHandoffPhone(onlyDigits);
                    setHandoffError('');
                  }}
                  placeholder="e.g. 9876543210 (10 digits)"
                  className={`w-full bg-slate-950 border rounded-xl px-3.5 py-2.5 text-slate-300 placeholder-slate-500 text-xs outline-none transition-colors font-mono tracking-wider ${
                    handoffError ? 'border-rose-500/80 focus:border-rose-500' : 'border-slate-800 focus:border-amber-500'
                  }`}
                  required
                />
              </div>
              {handoffError && (
                <p className="text-[11px] text-rose-400 flex items-center space-x-1">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  <span>{handoffError}</span>
                </p>
              )}
              <div className="text-[10px] text-slate-500 flex items-center justify-between">
                <span>Must be exactly 10 digits (Numbers only). Verified by Zod.</span>
                <span className={`font-mono font-bold ${handoffPhone.length === 10 ? 'text-emerald-400' : 'text-amber-600'}`}>
                  {handoffPhone.length}/10 digits
                </span>
              </div>
            </div>

            <div className="space-y-1.5 text-xs">
              <label className="text-slate-400 block">Handoff Reason & Notes for Agent:</label>
              <textarea
                rows={3}
                value={handoffNotes}
                onChange={(e) => setHandoffNotes(e.target.value)}
                placeholder="E.g., Client requested in-person meeting or price negotiation guidance on Marina 2BR..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-300 placeholder-slate-500 outline-none focus:border-amber-500 resize-none"
              />
            </div>

            <div className="pt-2 flex space-x-2">
              <button
                type="button"
                onClick={() => setShowHandoffModal(false)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2.5 rounded-xl font-semibold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmHandoff}
                className="flex-1 bg-amber-500 hover:bg-amber-400 text-amber-950 py-2.5 rounded-xl font-bold shadow-md text-xs flex items-center justify-center space-x-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Submit</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ─────────────────────────────────────────
           Admin Email-Gate Login Modal
      ───────────────────────────────────────── */}
      {showAdminLoginModal && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className={`bg-slate-900 border border-slate-700 rounded-2xl w-full ${showCredentialConfig ? 'max-w-xl' : 'max-w-md'} shadow-2xl overflow-hidden max-h-[92vh] flex flex-col transition-all duration-200`}>
            {/* Header */}
            <div className={`px-6 py-5 shrink-0 transition-colors ${
              adminTargetPortal === 'property_manager'
                ? 'bg-gradient-to-r from-amber-700 via-amber-600 to-yellow-600'
                : adminTargetPortal === 'sales_manager'
                ? 'bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-700'
                : 'bg-gradient-to-r from-violet-700 via-violet-600 to-purple-700'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center">
                    {adminTargetPortal === 'property_manager' ? (
                      <Building2 className="w-5 h-5 text-amber-100" />
                    ) : adminTargetPortal === 'sales_manager' ? (
                      <Copy className="w-5 h-5 text-emerald-100" />
                    ) : (
                      <ShieldCheck className="w-5 h-5 text-violet-100" />
                    )}
                  </div>
                  <div>
                    <h2 className="text-white font-bold text-base">
                      {adminTargetPortal === 'property_manager' 
                        ? 'Property Admin Portal' 
                        : adminTargetPortal === 'sales_manager'
                        ? 'Sales Manager Portal'
                        : 'Admin Portal Access'}
                    </h2>
                    <p className="text-white/80 text-xs mt-0.5">
                      {adminTargetPortal === 'property_manager'
                        ? 'Lyka Realty Property Inventory & Statistics'
                        : adminTargetPortal === 'sales_manager'
                        ? 'Duplicate Control & Property Requirements Quality Audit'
                        : 'Lyka Realty CRM & System Management'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowAdminLoginModal(false);
                    setAdminAuthMode('login');
                    resetAdminModalState();
                  }}
                  className="w-8 h-8 rounded-lg bg-black/20 hover:bg-black/40 text-white/80 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0 ml-2"
                  title="Close and resume on site"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Portal Switcher Tabs */}
            <div className="px-6 pt-4 pb-0 space-y-2.5 shrink-0">
              <div className="flex bg-slate-800/80 p-1 rounded-xl border border-slate-700/60">
                <button
                  type="button"
                  onClick={() => handleSelectPortalTab('admin')}
                  className={`flex-1 flex items-center justify-center space-x-1.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    adminTargetPortal === 'admin'
                      ? 'bg-violet-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Admin</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectPortalTab('property_manager')}
                  className={`flex-1 flex items-center justify-center space-x-1.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    adminTargetPortal === 'property_manager'
                      ? 'bg-amber-500 text-amber-950 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>Property</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectPortalTab('sales_manager')}
                  className={`flex-1 flex items-center justify-center space-x-1.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    adminTargetPortal === 'sales_manager'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Sales</span>
                </button>
              </div>

              {/* Firestore DB Collection Indicator & Toggle to Configure Credentials */}
              <div className="flex items-center justify-between text-[11px] bg-slate-800/50 border border-slate-700/50 rounded-xl px-3 py-1.5">
                <div className="flex items-center space-x-1.5 text-emerald-400 font-medium">
                  <Database className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    DB Collection: <code className="font-mono text-[10px] text-amber-300 font-bold">
                      {adminTargetPortal === 'property_manager' ? 'Property_login' : adminTargetPortal === 'sales_manager' ? 'Sales_login' : 'Admin_login'}
                    </code>
                  </span>
                </div>
                {adminAuthenticated && (
                  <button
                    type="button"
                    onClick={() => {
                      const nextShow = !showCredentialConfig;
                      setShowCredentialConfig(nextShow);
                      setConfigErrorMsg('');
                      setConfigSuccessMsg('');
                      if (nextShow) {
                        setConfigPortalTab(adminTargetPortal);
                        setConfigAdminEmail(adminDbCredentials[0]?.email || 'admin@lykarealty.ae');
                        setConfigAdminPassword('');
                        setConfigPmEmail(pmDbCredentials[0]?.email || 'manager@lykarealty.ae');
                        setConfigPmPassword('');
                        setConfigSalesEmail(salesDbCredentials[0]?.email || 'sales@lykarealty.ae');
                        setConfigSalesPassword('');
                      }
                    }}
                    className="text-[11px] font-semibold text-amber-500 hover:text-amber-400 flex items-center space-x-1 underline"
                  >
                    <Settings className="w-3 h-3" />
                    <span>{showCredentialConfig ? 'Back to Login' : 'Set in DB'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Scrollable Form Body */}
            <div className="overflow-y-auto px-6 py-4 flex-1">
              {showCredentialConfig ? (
                /* ── Distinct Per-Admin Set in DB View: Each admin has its own dedicated collection and option ── */
                <div className="space-y-4">
                  {/* Sub-selector for which Admin to configure in DB */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Select Admin to Update in DB:
                    </label>
                    <div className="grid grid-cols-3 gap-1.5 bg-slate-800/80 p-1 rounded-xl border border-slate-700/60">
                      <button
                        type="button"
                        onClick={() => {
                          setConfigPortalTab('admin');
                          setConfigErrorMsg('');
                          setConfigSuccessMsg('');
                        }}
                        className={`flex items-center justify-center space-x-1 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                          configPortalTab === 'admin'
                            ? 'bg-violet-600 text-white shadow-sm'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <ShieldCheck className="w-3 h-3" />
                        <span>Super Admin</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setConfigPortalTab('property_manager');
                          setConfigErrorMsg('');
                          setConfigSuccessMsg('');
                        }}
                        className={`flex items-center justify-center space-x-1 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                          configPortalTab === 'property_manager'
                            ? 'bg-amber-500 text-amber-950 shadow-sm'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Building2 className="w-3 h-3" />
                        <span>Property</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setConfigPortalTab('sales_manager');
                          setConfigErrorMsg('');
                          setConfigSuccessMsg('');
                        }}
                        className={`flex items-center justify-center space-x-1 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                          configPortalTab === 'sales_manager'
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Copy className="w-3 h-3" />
                        <span>Sales Admin</span>
                      </button>
                    </div>
                  </div>

                  {/* ── Option 1: Sales Admin Option (Saves into Sales_login collection) ── */}
                  {configPortalTab === 'sales_manager' && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleSaveIndividualPortalCredential('sales_manager');
                      }}
                      className="bg-slate-800/50 border border-emerald-500/40 rounded-xl p-4 space-y-3 shadow-md"
                    >
                      <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2">
                        <div className="flex items-center space-x-2">
                          <Copy className="w-4 h-4 text-emerald-400" />
                          <span className="text-xs font-bold text-emerald-300">Sales Admin Database Configuration</span>
                        </div>
                        <code className="text-[10px] font-mono text-emerald-300 bg-emerald-950/80 border border-emerald-700/50 px-2 py-0.5 rounded">
                          Sales_login/sales_manager
                        </code>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Updates password in <code className="text-emerald-400">Sales_login</code> collection. <strong className="text-amber-300">Notice:</strong> Registered email address is permanently locked and cannot be changed by any admin.
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[10px] font-semibold text-slate-300 uppercase tracking-wider block">
                              Sales Admin Email ID
                            </label>
                            <span className="text-[9px] font-bold text-amber-400 bg-amber-950/80 border border-amber-500/40 px-1.5 py-0.5 rounded flex items-center space-x-1">
                              <Lock className="w-2.5 h-2.5" />
                              <span>Permanently Locked</span>
                            </span>
                          </div>
                          <div className="relative">
                            <input
                              type="email"
                              value={salesDbCredentials[0]?.email || SALES_EMAIL}
                              readOnly
                              disabled
                              className="w-full bg-slate-950/80 border border-slate-800 text-slate-300 font-mono rounded-lg pl-3 pr-8 py-2 text-xs cursor-not-allowed select-all"
                            />
                            <Lock className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2" />
                          </div>
                          <p className="text-[10px] text-slate-400 mt-1">
                            Email cannot be changed by any admin. All OTP & recovery emails are routed here.
                          </p>
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold text-slate-300 uppercase tracking-wider block mb-1">
                            Update Sales Password
                          </label>
                          <div className="relative">
                            <input
                              type={showConfigSalesPassword ? "text" : "password"}
                              value={configSalesPassword}
                              onChange={(e) => { setConfigSalesPassword(e.target.value); setConfigErrorMsg(''); }}
                              placeholder="Enter new sales password"
                              required
                              className="w-full bg-slate-900 border border-slate-700 focus:border-emerald-500 rounded-lg pl-3 pr-9 py-2 text-xs text-slate-100 font-semibold placeholder-slate-500 outline-none font-mono"
                            />
                            <button
                              type="button"
                              onClick={() => setShowConfigSalesPassword(!showConfigSalesPassword)}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors p-0.5"
                              title={showConfigSalesPassword ? "Hide password" : "Show password"}
                              aria-label={showConfigSalesPassword ? "Hide password" : "Show password"}
                            >
                              {showConfigSalesPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 flex space-x-2">
                        <button
                          type="button"
                          onClick={() => setShowCredentialConfig(false)}
                          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={configSaving}
                          className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 shadow-md active:scale-95 cursor-pointer"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>{configSaving ? 'Saving to Sales_login...' : 'Update Sales Password in DB'}</span>
                        </button>
                      </div>
                    </form>
                  )}

                  {/* ── Option 2: Property Manager Option (Saves into Property_login collection) ── */}
                  {configPortalTab === 'property_manager' && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleSaveIndividualPortalCredential('property_manager');
                      }}
                      className="bg-slate-800/50 border border-amber-500/40 rounded-xl p-4 space-y-3 shadow-md"
                    >
                      <div className="flex items-center justify-between border-b border-amber-500/20 pb-2">
                        <div className="flex items-center space-x-2">
                          <Building2 className="w-4 h-4 text-amber-400" />
                          <span className="text-xs font-bold text-amber-300">Property Admin Database Configuration</span>
                        </div>
                        <code className="text-[10px] font-mono text-amber-300 bg-amber-950/80 border border-amber-700/50 px-2 py-0.5 rounded">
                          Property_login/property_manager
                        </code>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Updates password in <code className="text-amber-400">Property_login</code> collection. <strong className="text-amber-300">Notice:</strong> Registered email address is permanently locked and cannot be changed by any admin.
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[10px] font-semibold text-slate-300 uppercase tracking-wider block">
                              Property Admin Email ID
                            </label>
                            <span className="text-[9px] font-bold text-amber-400 bg-amber-950/80 border border-amber-500/40 px-1.5 py-0.5 rounded flex items-center space-x-1">
                              <Lock className="w-2.5 h-2.5" />
                              <span>Permanently Locked</span>
                            </span>
                          </div>
                          <div className="relative">
                            <input
                              type="email"
                              value={pmDbCredentials[0]?.email || PM_EMAIL}
                              readOnly
                              disabled
                              className="w-full bg-slate-950/80 border border-slate-800 text-slate-300 font-mono rounded-lg pl-3 pr-8 py-2 text-xs cursor-not-allowed select-all"
                            />
                            <Lock className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2" />
                          </div>
                          <p className="text-[10px] text-slate-400 mt-1">
                            Email cannot be changed by any admin. All OTP & recovery emails are routed here.
                          </p>
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold text-slate-300 uppercase tracking-wider block mb-1">
                            Update Property Password
                          </label>
                          <div className="relative">
                            <input
                              type={showConfigPmPassword ? "text" : "password"}
                              value={configPmPassword}
                              onChange={(e) => { setConfigPmPassword(e.target.value); setConfigErrorMsg(''); }}
                              placeholder="Enter new property password"
                              required
                              className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 rounded-lg pl-3 pr-9 py-2 text-xs text-slate-100 font-semibold placeholder-slate-500 outline-none font-mono"
                            />
                            <button
                              type="button"
                              onClick={() => setShowConfigPmPassword(!showConfigPmPassword)}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors p-0.5"
                              title={showConfigPmPassword ? "Hide password" : "Show password"}
                              aria-label={showConfigPmPassword ? "Hide password" : "Show password"}
                            >
                              {showConfigPmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 flex space-x-2">
                        <button
                          type="button"
                          onClick={() => setShowCredentialConfig(false)}
                          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={configSaving}
                          className="flex-1 bg-amber-500 hover:bg-amber-400 text-amber-950 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 shadow-md active:scale-95 cursor-pointer"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>{configSaving ? 'Saving to Property_login...' : 'Update Property Password in DB'}</span>
                        </button>
                      </div>
                    </form>
                  )}

                  {/* ── Option 3: Super Admin Option (Saves into Admin_login collection) ── */}
                  {configPortalTab === 'admin' && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleSaveIndividualPortalCredential('admin');
                      }}
                      className="bg-slate-800/50 border border-violet-500/40 rounded-xl p-4 space-y-3 shadow-md"
                    >
                      <div className="flex items-center justify-between border-b border-violet-500/20 pb-2">
                        <div className="flex items-center space-x-2">
                          <ShieldCheck className="w-4 h-4 text-violet-400" />
                          <span className="text-xs font-bold text-violet-300">Super Admin Database Configuration</span>
                        </div>
                        <code className="text-[10px] font-mono text-violet-300 bg-violet-950/80 border border-violet-700/50 px-2 py-0.5 rounded">
                          Admin_login/admin
                        </code>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Updates password in <code className="text-violet-400">Admin_login</code> collection. <strong className="text-amber-300">Notice:</strong> Registered email address is permanently locked and cannot be changed by any admin.
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[10px] font-semibold text-slate-300 uppercase tracking-wider block">
                              Super Admin Email ID
                            </label>
                            <span className="text-[9px] font-bold text-amber-400 bg-amber-950/80 border border-amber-500/40 px-1.5 py-0.5 rounded flex items-center space-x-1">
                              <Lock className="w-2.5 h-2.5" />
                              <span>Permanently Locked</span>
                            </span>
                          </div>
                          <div className="relative">
                            <input
                              type="email"
                              value={adminDbCredentials[0]?.email || ADMIN_EMAIL}
                              readOnly
                              disabled
                              className="w-full bg-slate-950/80 border border-slate-800 text-slate-300 font-mono rounded-lg pl-3 pr-8 py-2 text-xs cursor-not-allowed select-all"
                            />
                            <Lock className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2" />
                          </div>
                          <p className="text-[10px] text-slate-400 mt-1">
                            Email cannot be changed by any admin. All OTP & recovery emails are routed here.
                          </p>
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold text-slate-300 uppercase tracking-wider block mb-1">
                            Update Super Admin Password
                          </label>
                          <div className="relative">
                            <input
                              type={showConfigAdminPassword ? "text" : "password"}
                              value={configAdminPassword}
                              onChange={(e) => { setConfigAdminPassword(e.target.value); setConfigErrorMsg(''); }}
                              placeholder="Enter new admin password"
                              required
                              className="w-full bg-slate-900 border border-slate-700 focus:border-violet-500 rounded-lg pl-3 pr-9 py-2 text-xs text-slate-100 font-semibold placeholder-slate-500 outline-none font-mono"
                            />
                            <button
                              type="button"
                              onClick={() => setShowConfigAdminPassword(!showConfigAdminPassword)}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors p-0.5"
                              title={showConfigAdminPassword ? "Hide password" : "Show password"}
                              aria-label={showConfigAdminPassword ? "Hide password" : "Show password"}
                            >
                              {showConfigAdminPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 flex space-x-2">
                        <button
                          type="button"
                          onClick={() => setShowCredentialConfig(false)}
                          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={configSaving}
                          className="flex-1 bg-violet-600 hover:bg-violet-500 text-white py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 shadow-md active:scale-95 cursor-pointer"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>{configSaving ? 'Saving to Admin_login...' : 'Update Super Admin Password in DB'}</span>
                        </button>
                      </div>
                    </form>
                  )}

                  {configErrorMsg && (
                    <div className="text-xs text-red-400 bg-red-950/50 border border-red-500/40 rounded-xl px-3 py-2">
                      {configErrorMsg}
                    </div>
                  )}

                  {configSuccessMsg && (
                    <div className="text-xs text-emerald-300 bg-emerald-950/50 border border-emerald-500/40 rounded-xl px-3 py-2 flex items-center space-x-1.5 font-semibold">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>{configSuccessMsg}</span>
                    </div>
                  )}
                </div>
              ) : adminAuthMode === 'forgot_password' ? (
                /* Forgot Password Form */
                <form onSubmit={handleSendResetLink} className="space-y-4">
                  <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3.5 space-y-1.5 text-xs text-slate-300">
                    <p className="font-semibold text-slate-200 flex items-center space-x-1.5">
                      <Mail className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>Reset Password for {adminTargetPortal === 'property_manager' ? 'Property Manager' : adminTargetPortal === 'sales_manager' ? 'Sales Manager' : 'Super Admin'}</span>
                    </p>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Enter your registered portal email address below. We will send a secure 30-minute password reset link via Brevo transactional email.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                      <span>Registered Portal Email</span>
                      <span className="text-[10px] text-amber-400 font-medium flex items-center space-x-1">
                        <Lock className="w-2.5 h-2.5" />
                        <span>Locked</span>
                      </span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2">
                        <Mail className="w-4 h-4 text-slate-500" />
                      </span>
                      <input
                        type="email"
                        value={forgotEmailInput || (adminTargetPortal === 'property_manager' ? PM_EMAIL : adminTargetPortal === 'sales_manager' ? SALES_EMAIL : ADMIN_EMAIL)}
                        readOnly
                        required
                        className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl pl-9 pr-9 py-2.5 text-sm text-slate-300 font-mono select-all cursor-default"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" title="Registered email address is permanently locked">
                        <Lock className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>

                  {forgotError && (
                    <div className="flex items-center space-x-2 bg-red-950/60 border border-red-500/50 rounded-xl px-3 py-2.5 text-xs text-rose-300">
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>{forgotError}</span>
                    </div>
                  )}

                  <div className="flex space-x-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setAdminAuthMode('login');
                        setForgotError('');
                      }}
                      className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2.5 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center space-x-1 cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Back to Login</span>
                    </button>
                    <button
                      type="submit"
                      disabled={forgotLoading || !forgotEmailInput.trim()}
                      className="flex-1 bg-amber-500 hover:bg-amber-400 text-amber-950 disabled:opacity-50 disabled:cursor-not-allowed py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 shadow-md active:scale-95 cursor-pointer"
                    >
                      {forgotLoading ? (
                        <>
                          <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          <span>Sending Link...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          <span>Send Reset Link</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              ) : adminAuthMode === 'link_sent' ? (
                /* Link Sent Confirmation View with Open in Gmail */
                <div className="space-y-4 text-center py-2">
                  <div className="w-14 h-14 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-center mx-auto text-emerald-400">
                    <CheckCircle2 className="w-7 h-7 text-emerald-400" />
                  </div>

                  <div className="space-y-1.5">
                    <h3 className="text-base font-bold text-slate-100">Reset Link Dispatched!</h3>
                    <p className="text-xs text-slate-300 leading-relaxed px-2">
                      A password reset link with a secure 30-minute token has been sent to:
                    </p>
                    <div className="bg-slate-800 border border-slate-700/80 rounded-xl py-2 px-3 inline-block">
                      <span className="text-amber-400 font-mono font-bold text-xs">{forgotEmailInput}</span>
                    </div>
                  </div>

                  {/* Primary Action: Open in Gmail */}
                  <div className="pt-2 space-y-2">
                    <a
                      href="https://mail.google.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full bg-gradient-to-r from-red-600 via-rose-600 to-red-600 hover:from-red-500 hover:to-rose-500 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center space-x-2 shadow-lg shadow-red-900/30 transition-all text-xs active:scale-95 cursor-pointer"
                    >
                      <Mail className="w-4 h-4 text-white" />
                      <span>Open in Gmail (mail.google.com)</span>
                      <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                    </a>

                    {/* Direct Shortcut to Reset Form */}
                    <button
                      type="button"
                      onClick={() => {
                        setAdminAuthMode('reset_password');
                        setResetPasswordError('');
                      }}
                      className="w-full bg-slate-800/90 hover:bg-slate-800 text-amber-300 border border-amber-500/30 hover:border-amber-500/50 font-semibold py-2.5 px-4 rounded-xl flex items-center justify-center space-x-2 text-xs transition-colors cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>Proceed to Reset & Generate Password Screen</span>
                    </button>
                  </div>

                  <div className="pt-2 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        setAdminAuthMode('login');
                      }}
                      className="text-xs text-slate-400 hover:text-slate-200 transition-colors flex items-center justify-center space-x-1 mx-auto cursor-pointer"
                    >
                      <ArrowLeft className="w-3 h-3" />
                      <span>Return to Admin Login</span>
                    </button>
                  </div>
                </div>
              ) : adminAuthMode === 'reset_password' ? (
                /* Reset Password View */
                resetPasswordSuccess ? (
                  <div className="space-y-4 py-2">
                    <div className="bg-emerald-950/70 border border-emerald-500/50 rounded-2xl p-4 text-center space-y-2.5">
                      <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-emerald-300">Password Updated in Database!</h4>
                        <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                          Your new password has been saved. For security, you are <strong className="text-white">not automatically logged in</strong>.
                        </p>
                        <p className="text-[11px] text-slate-400 mt-1">
                          To access the {adminTargetPortal === 'admin' ? 'Super Admin' : adminTargetPortal === 'property_manager' ? 'Property Manager' : 'Sales Manager'} portal, enter your new password and verify the 6-digit OTP.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setAdminAuthMode('login');
                          setAdminPasswordInput('');
                          setResetPasswordSuccess('');
                          setAdminOtpSuccessMsg('Password updated in database! Enter your new password to verify and receive OTP.');
                        }}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2 shadow-md cursor-pointer active:scale-95"
                      >
                        <span>Resume to Sign In on Place</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setShowAdminLoginModal(false);
                          setAdminAuthMode('login');
                          setAdminPasswordInput('');
                          setResetPasswordSuccess('');
                          resetAdminModalState();
                        }}
                        className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 py-2.5 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center space-x-2 cursor-pointer"
                      >
                        <span>Close & Resume on Site</span>
                      </button>
                    </div>
                  </div>
                ) : (
                <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
                  {/* Account Summary Banner */}
                  <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Resetting Account</span>
                      <span className="text-amber-400 font-mono font-bold">
                        {resetTargetEmail || forgotEmailInput || adminEmailInput}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Database Collection</span>
                      <span className="text-emerald-400 font-mono font-bold text-[11px]">
                        {adminTargetPortal === 'property_manager' ? 'Property_login' : adminTargetPortal === 'sales_manager' ? 'Sales_login' : 'Admin_login'}
                      </span>
                    </div>
                  </div>

                  {/* Generate Strong Password Card */}
                  <div className="bg-gradient-to-r from-amber-950/40 via-slate-800 to-amber-950/30 border border-amber-500/30 rounded-xl p-3 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-amber-300 flex items-center space-x-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        <span>Auto-Generate Password</span>
                      </span>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Generates secure 12-char password and fills both fields.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleGenerateStrongPassword}
                      className="bg-amber-500 hover:bg-amber-400 text-amber-950 font-bold px-3 py-2 rounded-lg text-xs shadow-md transition-all flex items-center space-x-1 shrink-0 active:scale-95 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Generate</span>
                    </button>
                  </div>

                  {generatedPasswordNotice && (
                    <div className="bg-emerald-950/60 border border-emerald-500/50 rounded-xl p-2.5 text-xs text-emerald-300 flex items-center space-x-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Strong password generated & auto-filled in both fields!</span>
                    </div>
                  )}

                  {/* New Password Field */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      New Password (Min 6 Characters)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                        <Lock className="w-4 h-4 text-slate-500" />
                      </span>
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPasswordInput}
                        onChange={(e) => {
                          setNewPasswordInput(e.target.value);
                          setResetPasswordError('');
                        }}
                        placeholder="Enter new password"
                        required
                        className="w-full bg-slate-800 border border-slate-700 focus:border-amber-500 rounded-xl pl-9 pr-10 py-2.5 text-sm text-slate-100 font-mono placeholder-slate-500 outline-none transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors p-1"
                      >
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Re-enter Password Field */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Re-Enter Password (Confirm)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                        <Lock className="w-4 h-4 text-slate-500" />
                      </span>
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPasswordInput}
                        onChange={(e) => {
                          setConfirmPasswordInput(e.target.value);
                          setResetPasswordError('');
                        }}
                        placeholder="Re-type password to confirm"
                        required
                        className="w-full bg-slate-800 border border-slate-700 focus:border-amber-500 rounded-xl pl-9 pr-10 py-2.5 text-sm text-slate-100 font-mono placeholder-slate-500 outline-none transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors p-1"
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    {/* Match Indicator */}
                    {newPasswordInput && confirmPasswordInput && (
                      <div className="pt-1">
                        {newPasswordInput === confirmPasswordInput && newPasswordInput.length >= 6 ? (
                          <span className="text-[11px] text-emerald-400 font-semibold flex items-center space-x-1">
                            <Check className="w-3.5 h-3.5" />
                            <span>Passwords match! Ready to update in database.</span>
                          </span>
                        ) : newPasswordInput !== confirmPasswordInput ? (
                          <span className="text-[11px] text-rose-400 font-semibold flex items-center space-x-1">
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span>Passwords do not match yet.</span>
                          </span>
                        ) : (
                          <span className="text-[11px] text-amber-400 font-semibold flex items-center space-x-1">
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span>Password must be at least 6 characters.</span>
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {resetPasswordError && (
                    <div className="flex items-center space-x-2 bg-red-950/60 border border-red-500/50 rounded-xl px-3 py-2.5 text-xs text-rose-300">
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>{resetPasswordError}</span>
                    </div>
                  )}

                  {resetPasswordSuccess && (
                    <div className="flex items-center space-x-2 bg-emerald-950/60 border border-emerald-500/50 rounded-xl px-3 py-2.5 text-xs text-emerald-300">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>{resetPasswordSuccess}</span>
                    </div>
                  )}

                  <div className="flex space-x-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setAdminAuthMode('login');
                        setResetPasswordError('');
                      }}
                      className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2.5 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center space-x-1 cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Cancel</span>
                    </button>
                    <button
                      type="submit"
                      disabled={
                        resetPasswordLoading ||
                        !newPasswordInput ||
                        !confirmPasswordInput ||
                        newPasswordInput !== confirmPasswordInput ||
                        newPasswordInput.length < 6
                      }
                      className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 disabled:cursor-not-allowed py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 shadow-md active:scale-95 cursor-pointer"
                    >
                      {resetPasswordLoading ? (
                        <>
                          <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          <span>Saving to Database...</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-3.5 h-3.5" />
                          <span>Update Password in Database</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )
            ) : (
                /* ── Standard Portal Login Form (Verifies Password first, then sends 6-Digit OTP) ── */
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setAdminLoginLoading(true);
                    setAdminLoginError('');

                    // 1. Validate Email & Password inputs
                    if (!adminEmailInput.trim()) {
                      setAdminLoginError('Please enter your email or username.');
                      setAdminLoginLoading(false);
                      return;
                    }
                    if (!adminPasswordInput) {
                      setAdminLoginError('Please enter your password.');
                      setAdminLoginLoading(false);
                      return;
                    }

                    // 2. Ensure OTP was requested
                    if (!adminOtpSent) {
                      setAdminLoginError('Please verify your password and click "Verify Password & Send 6-Digit OTP" first.');
                      setAdminLoginLoading(false);
                      return;
                    }

                    // 3. Validate OTP format with Zod
                    const otpValidation = otpSchema.safeParse(adminOtpInput);
                    if (!otpValidation.success) {
                      setAdminLoginError(otpValidation.error.issues[0]?.message || 'OTP must be exactly 6 digits.');
                      setAdminLoginLoading(false);
                      return;
                    }

                    // 4. Check 3-minute expiration
                    if (adminOtpExpiresAt && Date.now() > adminOtpExpiresAt) {
                      setAdminLoginError('This OTP has expired (valid for 3 minutes only). Please click "Resend OTP" for a new code.');
                      setAdminLoginLoading(false);
                      return;
                    }

                    // 5. Verify OTP via server endpoint
                    let otpVerified = false;
                    try {
                      const verRes = await fetch('/api/auth/verify-email-otp', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          email: adminEmailInput.trim(),
                          portal: adminTargetPortal,
                          otp: adminOtpInput.trim()
                        })
                      });
                      let verData: any = {};
                      const verText = await verRes.text();
                      try {
                        verData = JSON.parse(verText);
                      } catch {
                        verData = {};
                      }
                      if (verRes.ok && verData.valid) {
                        otpVerified = true;
                      } else {
                        setAdminLoginError(verData.message || 'Invalid or expired OTP code. Please check your email.');
                        setAdminLoginLoading(false);
                        return;
                      }
                    } catch (netErr: any) {
                      setAdminLoginError(netErr?.message || 'Error communicating with verification server. Please try again.');
                      setAdminLoginLoading(false);
                      return;
                    }

                    if (!otpVerified) {
                      setAdminLoginError('Invalid OTP code. Please enter the 6-digit code sent to your email.');
                      setAdminLoginLoading(false);
                      return;
                    }

                    // 6. Verify credentials securely via server endpoint
                    const { valid, error: loginErr } = await verifyPortalLoginFromFirestore(
                      adminTargetPortal,
                      adminEmailInput,
                      adminPasswordInput
                    );

                    // Refresh state from Firestore so hint stays current
                    const { adminCredentials, pmCredentials, smCredentials } = await ensurePortalCredentialsInFirestore();
                    if (adminCredentials.length > 0) setAdminDbCredentials(adminCredentials);
                    if (pmCredentials.length > 0) setPmDbCredentials(pmCredentials);
                    if (smCredentials && smCredentials.length > 0) setSalesDbCredentials(smCredentials);

                    if (valid) {
                      if (adminTargetPortal === 'admin') {
                        setAdminAuthenticated(true);
                        setPropertyManagerAuthenticated(true);
                        setSalesManagerAuthenticated(true);
                        try {
                          localStorage.setItem('lyka_admin_authenticated', 'true');
                          localStorage.setItem('lyka_pm_authenticated', 'true');
                          localStorage.setItem('lyka_sm_authenticated', 'true');
                          localStorage.setItem('lyka_admin_target_portal', 'admin');
                        } catch (e) {}

                        // Record super admin access
                        recordSalesManagerLoginInFirestore(adminEmailInput.trim(), 'Lyka Super Admin', 'Master_Admin_Login').catch(() => {});

                        resetAdminModalState();
                        setShowAdminLoginModal(false);
                        setAdminPanelOpen(true);
                        setActiveTab('crm');
                      } else if (adminTargetPortal === 'property_manager') {
                        setPropertyManagerAuthenticated(true);
                        try {
                          localStorage.setItem('lyka_pm_authenticated', 'true');
                          localStorage.setItem('lyka_admin_target_portal', 'property_manager');
                        } catch (e) {}
                        resetAdminModalState();
                        setShowAdminLoginModal(false);
                        setAdminPanelOpen(true);
                        setActiveTab('properties');
                      } else {
                        setSalesManagerAuthenticated(true);
                        try {
                          localStorage.setItem('lyka_sm_authenticated', 'true');
                          localStorage.setItem('lyka_admin_target_portal', 'sales_manager');
                        } catch (e) {}

                        // Store successful Sales Manager login in Firestore DB (Sales_login and login_events)
                        await recordSalesManagerLoginInFirestore(
                          adminEmailInput.trim() || 'sales@lykarealty.ae',
                          'Lyka Sales Manager',
                          'Sales_Portal_Login'
                        );

                        resetAdminModalState();
                        setShowAdminLoginModal(false);
                        setAdminPanelOpen(true);
                        setActiveTab('sales_duplicates');
                      }
                    } else {
                      setPasswordFailedAttempt(true);
                      setAdminLoginError(
                        loginErr || `Invalid login or password for ${adminTargetPortal === 'property_manager' ? 'Property Manager' : adminTargetPortal === 'sales_manager' ? 'Sales Manager' : 'Admin'} portal.`
                      );
                    }
                    setAdminLoginLoading(false);
                  }}
                  className="space-y-4"
                >
                  {/* Notification Banner when resuming after reset or info */}
                  {adminOtpSuccessMsg && (
                    <div className="bg-emerald-950/70 border border-emerald-500/50 rounded-xl p-3 text-xs text-emerald-200 flex items-start space-x-2.5 animate-in fade-in">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span className="leading-relaxed">{adminOtpSuccessMsg}</span>
                    </div>
                  )}

                  {/* Email / Login Field */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                      <span>{adminTargetPortal === 'property_manager' ? 'Property Manager Portal Email' : adminTargetPortal === 'sales_manager' ? 'Sales Manager Portal Email' : 'Super Admin Portal Email'}</span>
                      <span className="text-[10px] text-emerald-400 font-medium flex items-center space-x-1">
                        <Lock className="w-2.5 h-2.5" />
                        <span>Fixed Portal Email</span>
                      </span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2">
                        <Mail className="w-4 h-4 text-slate-500" />
                      </span>
                      <input
                        id="admin-email-input"
                        type="email"
                        value={adminEmailInput}
                        readOnly
                        required
                        className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl pl-9 pr-9 py-2.5 text-sm text-slate-300 font-mono select-all cursor-default"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" title="Admin email address is permanent and cannot be changed">
                        <Lock className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>

                  {/* Password Field */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Password</label>
                      <button
                        type="button"
                        onClick={() => {
                          revokeAdminAuthSessions();
                          setForgotEmailInput(
                            adminEmailInput.trim() ||
                            (adminTargetPortal === 'property_manager' ? PM_EMAIL : adminTargetPortal === 'sales_manager' ? SALES_EMAIL : ADMIN_EMAIL)
                          );
                          setAdminAuthMode('forgot_password');
                          setForgotError('');
                          setForgotSuccess('');
                        }}
                        className="text-[11px] font-semibold text-amber-400 hover:text-amber-300 transition-colors underline cursor-pointer"
                      >
                        Forgot Password?
                      </button>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                        <Lock className="w-4 h-4 text-slate-500" />
                      </span>
                      <input
                        id="admin-password-input"
                        type={showAdminPassword ? "text" : "password"}
                        value={adminPasswordInput}
                        onChange={(e) => {
                          setAdminPasswordInput(e.target.value);
                          setAdminLoginError('');
                          setPasswordFailedAttempt(false);
                        }}
                        placeholder="Enter password"
                        required
                        className="w-full bg-slate-800 border border-slate-700 focus:border-violet-500 rounded-xl pl-9 pr-10 py-2.5 text-sm text-slate-100 font-semibold placeholder-slate-500 outline-none transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setShowAdminPassword(!showAdminPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors p-1 focus:outline-none cursor-pointer"
                        title={showAdminPassword ? "Hide password" : "Show password"}
                        aria-label={showAdminPassword ? "Hide password" : "Show password"}
                      >
                        {showAdminPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* 1-Hour Lockout Warning Card (When 5 attempts used) */}
                  {isOtpLocked && (
                    <div className="bg-rose-950/60 border border-rose-500/50 rounded-xl p-3.5 space-y-2 text-xs text-rose-300">
                      <div className="flex items-center justify-between font-bold text-rose-200">
                        <span className="flex items-center space-x-1.5">
                          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                          <span>OTP Limit Reached (5/5 Attempts)</span>
                        </span>
                        <span className="font-mono text-xs bg-rose-900/80 border border-rose-700/60 px-2 py-0.5 rounded text-rose-200">
                          {Math.floor(adminOtpLockoutRemaining / 60)}:{(adminOtpLockoutRemaining % 60).toString().padStart(2, '0')}
                        </span>
                      </div>
                      <p className="text-[11px] text-rose-300/90 leading-relaxed">
                        For security reasons, you can generate only 5 OTPs within 1 hour. It will automatically regenerate and unlock once the 1-hour cooldown completes.
                      </p>
                    </div>
                  )}

                  {/* Dedicated "Incorrect Password -> Forgot Password?" Card when password fails */}
                  {passwordFailedAttempt && (
                    <div className="bg-gradient-to-r from-rose-950/80 via-slate-900 to-rose-950/60 border border-rose-500/50 rounded-xl p-3.5 space-y-2.5 text-xs text-rose-200 animate-in fade-in">
                      <div className="flex items-center space-x-2 font-bold text-rose-100">
                        <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                        <span>Incorrect Password Entered</span>
                      </div>
                      <p className="text-[11px] text-rose-300/90 leading-relaxed">
                        The password entered for <strong className="text-amber-300 font-mono">{adminEmailInput}</strong> is incorrect. OTP cannot be dispatched until password is valid.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          revokeAdminAuthSessions();
                          setForgotEmailInput(
                            adminEmailInput.trim() ||
                            (adminTargetPortal === 'property_manager' ? PM_EMAIL : adminTargetPortal === 'sales_manager' ? SALES_EMAIL : ADMIN_EMAIL)
                          );
                          setAdminAuthMode('forgot_password');
                          setForgotError('');
                          setForgotSuccess('');
                        }}
                        className="w-full bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-white font-bold py-2.5 px-3 rounded-xl flex items-center justify-center space-x-2 transition-all text-xs shadow-md active:scale-95 cursor-pointer"
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                        <span>Forgot Password? Click Here to Reset</span>
                      </button>
                    </div>
                  )}

                  {/* Step 1 Button: "Verify Password & Send 6-Digit OTP" (Visible when OTP not sent yet) */}
                  {!adminOtpSent && (
                    <button
                      id="admin-get-otp-btn"
                      type="button"
                      onClick={handleGetAdminOtp}
                      disabled={!adminEmailInput.trim() || !adminPasswordInput || adminOtpLoading || isOtpLocked}
                      className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2 shadow-md ${
                        isOtpLocked
                          ? 'bg-rose-950/60 text-rose-400 border border-rose-800/60 cursor-not-allowed opacity-80'
                          : adminEmailInput.trim() && adminPasswordInput && !adminOtpLoading
                          ? adminTargetPortal === 'property_manager'
                            ? 'bg-amber-500 hover:bg-amber-400 text-amber-950 cursor-pointer active:scale-95'
                            : adminTargetPortal === 'sales_manager'
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer active:scale-95'
                            : 'bg-violet-600 hover:bg-violet-500 text-white cursor-pointer active:scale-95'
                          : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-60'
                      }`}
                    >
                      {adminOtpLoading ? (
                        <>
                          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          <span>Verifying Password & Generating OTP...</span>
                        </>
                      ) : isOtpLocked ? (
                        <>
                          <Lock className="w-4 h-4 text-rose-400" />
                          <span>Locked (5/5 Attempts) - Wait {lockoutMinutesRemaining}m</span>
                        </>
                      ) : (
                        <>
                          <KeyRound className="w-4 h-4" />
                          <span>Verify Password & Send 6-Digit OTP</span>
                        </>
                      )}
                    </button>
                  )}

                  {/* Step 2: Email OTP Sent Notice Card with 3-Minute Live Timer & Resend Option */}
                  {adminOtpSent && (
                    <div className="bg-gradient-to-r from-emerald-950/70 via-slate-800/80 to-emerald-950/50 border border-emerald-500/40 rounded-xl p-3.5 space-y-2.5 shadow-inner">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-emerald-300 uppercase tracking-wider flex items-center space-x-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Password Verified • OTP Sent</span>
                        </span>
                        <span className={`text-[11px] font-mono font-bold flex items-center space-x-1 ${
                          otpTimeRemaining > 30 ? 'text-emerald-400' : 'text-rose-400 animate-pulse'
                        }`}>
                          <Clock className="w-3 h-3" />
                          <span>
                            {Math.floor(otpTimeRemaining / 60)}:{(otpTimeRemaining % 60).toString().padStart(2, '0')}
                          </span>
                        </span>
                      </div>
                      <p className="text-xs text-slate-200">
                        Password verified! A 6-digit security OTP was emailed directly to <strong className="text-amber-400 font-mono">{adminEmailInput}</strong>. Please check your Gmail inbox (or Spam tab).
                      </p>

                      <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-700/60">
                        <span>Valid for exactly 3 minutes • Attempt {adminOtpAttemptsUsed}/5</span>
                        <button
                          type="button"
                          onClick={handleGetAdminOtp}
                          disabled={adminOtpLoading || isOtpLocked}
                          className="text-amber-400 hover:text-amber-300 font-semibold underline cursor-pointer"
                        >
                          Resend OTP
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 6-Digit OTP Input Field (Activated after OTP dispatched) */}
                  {adminOtpSent && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
                          <Lock className="w-3.5 h-3.5 text-violet-400" />
                          <span>Enter 6-Digit Email OTP</span>
                        </label>
                        <span className={`text-[10px] font-mono font-bold ${
                          adminOtpInput.length === 6 ? 'text-emerald-400' : 'text-slate-400'
                        }`}>
                          {adminOtpInput.length}/6 digits
                        </span>
                      </div>
                      <input
                        id="admin-otp-input"
                        type="tel"
                        inputMode="numeric"
                        maxLength={6}
                        value={adminOtpInput}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/\D/g, '').slice(0, 6);
                          setAdminOtpInput(digits);
                          setAdminLoginError('');
                        }}
                        placeholder="Type 6-digit OTP from email"
                        autoFocus
                        required
                        className="w-full bg-slate-800 border border-slate-700 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 font-bold placeholder-slate-500 outline-none transition-colors font-mono tracking-widest"
                      />
                    </div>
                  )}

                  {/* General Login / Auth Error */}
                  {adminLoginError && !passwordFailedAttempt && (
                    <div className="flex items-center space-x-2 bg-red-950/60 border border-red-500/50 rounded-xl px-3 py-2.5 text-xs text-rose-300">
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>{adminLoginError}</span>
                    </div>
                  )}

                  {/* Hint */}
                  <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl px-3 py-2 text-[11px] text-slate-500 flex items-center justify-between">
                    <div>
                      <span className="text-slate-400 font-medium">DB Login:</span>{' '}
                      <span className={adminTargetPortal === 'property_manager' ? 'text-amber-600 font-mono' : adminTargetPortal === 'sales_manager' ? 'text-emerald-400 font-mono' : 'text-violet-400 font-mono'}>
                        {adminTargetPortal === 'property_manager' ? PM_EMAIL : adminTargetPortal === 'sales_manager' ? SALES_EMAIL : ADMIN_EMAIL}
                      </span>
                    </div>
                    <span className="text-[10px] text-emerald-400 font-medium flex items-center space-x-1">
                      <Clock className="w-3 h-3" />
                      <span>Password-Verified OTP</span>
                    </span>
                  </div>

                  {/* Actions (Cancel & Verify OTP & Enter) */}
                  <div className="flex space-x-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAdminLoginModal(false);
                        resetAdminModalState();
                      }}
                      className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={adminLoginLoading || !adminOtpSent || adminOtpInput.length !== 6 || !adminEmailInput.trim()}
                      className={`flex-1 disabled:opacity-50 disabled:cursor-not-allowed py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 shadow-md ${
                        adminTargetPortal === 'property_manager'
                          ? 'bg-amber-500 hover:bg-amber-400 text-amber-950'
                          : adminTargetPortal === 'sales_manager'
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                          : 'bg-violet-600 hover:bg-violet-500 text-white'
                      }`}
                    >
                      {adminLoginLoading ? (
                        <>
                          <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          <span>Verifying OTP & Login...</span>
                        </>
                      ) : (
                        <span>Verify & Enter {adminTargetPortal === 'property_manager' ? 'Property Manager' : adminTargetPortal === 'sales_manager' ? 'Sales Manager' : 'Admin'}</span>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* About Project Modal */}
      <AboutProjectModal
        isOpen={aboutOpen}
        onClose={() => setAboutOpen(false)}
      />

      {/* Central Unified Settings & Appearance Modal */}
      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        currentTheme={theme}
        onSelectTheme={setTheme}
        customBgColor={customBgColor}
        onSelectCustomBg={(c) => {
          setCustomBgColor(c);
          try { localStorage.setItem('lyka_realty_custom_bg', c); } catch (_) {}
        }}
        onResetCustomBg={() => {
          setCustomBgColor('');
          try { localStorage.removeItem('lyka_realty_custom_bg'); } catch (_) {}
        }}
        adminAuthenticated={effectiveAdminAuthed}
        propertyManagerAuthenticated={effectivePmAuthed}
        salesManagerAuthenticated={effectiveSmAuthed}
        hideAdminTab={false}
        adminTargetPortal={adminTargetPortal}
        onSelectPortal={(portal) => {
          setAdminTargetPortal(portal);
          try {
            localStorage.setItem('lyka_admin_target_portal', portal);
          } catch (e) {}
          handleSelectPortalTab(portal);
        }}
        onOpenAdminPanel={() => {
          const isAuthed = adminTargetPortal === 'admin' 
            ? effectiveAdminAuthed 
            : adminTargetPortal === 'property_manager'
            ? (effectivePmAuthed || effectiveAdminAuthed)
            : (effectiveSmAuthed || effectiveAdminAuthed);
          if (!isAuthed) {
            handleSelectPortalTab(adminTargetPortal);
            setShowAdminLoginModal(true);
          } else {
            setAdminPanelOpen(true);
            if (adminTargetPortal === 'property_manager') {
              setActiveTab('properties');
            } else if (adminTargetPortal === 'sales_manager') {
              setActiveTab('sales_duplicates');
            } else {
              setActiveTab('crm');
            }
          }
        }}
        onOpenStaffAccess={() => {
          setAdminPanelOpen(true);
          setActiveTab('staff_access');
        }}
        onOpenCredentialsConfig={() => {
          setShowCredentialConfig(true);
          setConfigPortalTab(adminTargetPortal);
          setAdminPanelOpen(true);
          setShowAdminLoginModal(true);
        }}
        onAdminLogout={async () => {
          setAdminAuthenticated(false);
          setPropertyManagerAuthenticated(false);
          setSalesManagerAuthenticated(false);
          try {
            localStorage.removeItem('lyka_admin_authenticated');
            localStorage.removeItem('lyka_pm_authenticated');
            localStorage.removeItem('lyka_sm_authenticated');
            localStorage.removeItem('lyka_admin_target_portal');
          } catch (e) {}
          setAdminPanelOpen(false);
          setActiveTab('chat');
        }}
        engineProvider={engineProvider}
        onSelectEngineProvider={setEngineProvider}
        activeModel={activeModel}
        onSelectModel={setActiveModel}
        userLoggedIn={Boolean(currentUserId || auth.currentUser)}
        userName={currentLead?.full_name}
        userEmail={currentLead?.email}
        userAge={(currentLead as any)?.age ? String((currentLead as any).age) : undefined}
        onOpenAuthModal={() => {
          setActiveTab('chat');
        }}
        onUserLogout={async () => {
          try {
            await signOut(auth);
          } catch (_) {}
          localStorage.removeItem('lyka_client_user');
          setCurrentUserId(null);
        }}
      />

      {/* Visual Toast Notification for Favorite Actions */}
      {favoriteToast && (
        <div className="fixed bottom-6 right-6 z-[9999] flex items-center space-x-3 bg-espresso-950/95 dark:bg-slate-900/95 text-amber-200 border border-amber-500/50 px-4 py-3 rounded-2xl shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-4 duration-200 text-xs sm:text-sm font-semibold max-w-sm">
          <Heart className="w-4 h-4 text-red-400 fill-red-400 shrink-0" />
          <span className="flex-1">{favoriteToast}</span>
          {favoriteToast.includes('Sign In') && (
            <button
              onClick={() => {
                setFavoriteToast(null);
                setActiveTab('chat');
              }}
              className="px-2.5 py-1 rounded-lg bg-amber-500 text-espresso-950 hover:bg-amber-400 text-xs font-bold transition-all cursor-pointer shrink-0 ml-1 shadow-sm"
            >
              Sign In
            </button>
          )}
        </div>
      )}
    </div>
  );
}
