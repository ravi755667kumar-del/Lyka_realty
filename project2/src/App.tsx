import React, { useState, useEffect } from 'react';
import { 
  LeadProfile, 
  ChatMessage, 
  PropertyListing, 
  FollowUpTask, 
  LeadStatus,
  AgenticDecision,
  PortalCredential
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
  savePortalEmailOtpToFirestore,
  savePropertyToFirestore,
  getPropertiesFromFirestore,
  auth
} from './lib/firebase';
import { Navbar } from './components/Navbar';
import { AgenticChat } from './components/AgenticChat';
import { LeadProfileSidebar } from './components/LeadProfileSidebar';
import { CrmPipeline } from './components/CrmPipeline';
import { PropertyInventory } from './components/PropertyInventory';
import { MongoEmbeddingHub } from './components/MongoEmbeddingHub';
import { KnowledgeBaseView } from './components/KnowledgeBaseView';
import { AdminStats } from './components/AdminStats';
import { CustomerAnalytics } from './components/CustomerAnalytics';
import { CustomerProfiles } from './components/CustomerProfiles';
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
  Clock
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'chat' | 'crm' | 'properties' | 'embeddings' | 'knowledge' | 'stats' | 'customers' | 'login_stats'>('chat');
  const [customerCount, setCustomerCount] = useState<number>(0);
  const [currentLead, setCurrentLead] = useState<LeadProfile>(createInitialLeadProfile());
  const [leadsList, setLeadsList] = useState<LeadProfile[]>([]);
  const [followUpsList, setFollowUpsList] = useState<FollowUpTask[]>([]);
  const [propertiesList, setPropertiesList] = useState<PropertyListing[]>(() => {
    try {
      const saved = localStorage.getItem('localProperties');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const existingIds = new Set(ALL_VERIFIED_PROPERTIES.map(p => p.id));
          const customOnly = parsed.filter((p: any) => !existingIds.has(p.id));
          return [...customOnly, ...ALL_VERIFIED_PROPERTIES];
        }
      }
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
  const [adminTargetPortal, setAdminTargetPortal] = useState<'admin' | 'property_manager'>('admin');
  // Admin authentication gate — SEPARATE states for each portal
  const [adminAuthenticated, setAdminAuthenticated] = useState(false);
  const [propertyManagerAuthenticated, setPropertyManagerAuthenticated] = useState(false);
  const isPortalAuthed = adminTargetPortal === 'admin' ? adminAuthenticated : propertyManagerAuthenticated;
  const [showAdminLoginModal, setShowAdminLoginModal] = useState(false);
  const [adminEmailInput, setAdminEmailInput] = useState('');
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [adminLoginError, setAdminLoginError] = useState('');
  const [adminLoginLoading, setAdminLoginLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);

  // Database-backed Admin & Property Manager credentials (from Firestore Admin_login & Property_login)
  const [adminDbCredentials, setAdminDbCredentials] = useState<PortalCredential[]>([
    { id: 'admin', email: 'admin@lykarealty.ae', password: 'LykaAdmin2024', role: 'admin', name: 'Lyka Super Admin' }
  ]);
  const [pmDbCredentials, setPmDbCredentials] = useState<PortalCredential[]>([
    { id: 'property_manager', email: 'manager@lykarealty.ae', password: 'LykaManager2024', role: 'property_manager', name: 'Lyka Property Manager' }
  ]);
  const [showCredentialConfig, setShowCredentialConfig] = useState(false);
  const [configEmailInput, setConfigEmailInput] = useState('');
  const [configPasswordInput, setConfigPasswordInput] = useState('');
  const [configSaving, setConfigSaving] = useState(false);
  const [configSuccessMsg, setConfigSuccessMsg] = useState('');
  const [configErrorMsg, setConfigErrorMsg] = useState('');

  const ADMIN_EMAIL = adminDbCredentials[0]?.email || 'admin@lykarealty.ae';
  const PM_EMAIL = pmDbCredentials[0]?.email || 'manager@lykarealty.ae';

  // Email 6-Digit OTP states for Admin / Property Manager Login (Valid for 3 Minutes)
  const [adminOtpInput, setAdminOtpInput] = useState('');
  const [adminOtpSent, setAdminOtpSent] = useState(false);
  const [adminOtpLoading, setAdminOtpLoading] = useState(false);
  const [adminOtpSuccessMsg, setAdminOtpSuccessMsg] = useState('');
  const [adminOtpExpiresAt, setAdminOtpExpiresAt] = useState<number | null>(null);
  const [otpTimeRemaining, setOtpTimeRemaining] = useState<number>(180); // 3 minutes = 180s
  const [adminGeneratedOtpBackup, setAdminGeneratedOtpBackup] = useState<string | null>(null);

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

  const resetAdminModalState = () => {
    setAdminLoginError('');
    setAdminOtpInput('');
    setAdminOtpSent(false);
    setAdminOtpLoading(false);
    setAdminOtpSuccessMsg('');
    setAdminOtpExpiresAt(null);
    setOtpTimeRemaining(180);
    setAdminGeneratedOtpBackup(null);
    setConfigSuccessMsg('');
    setConfigErrorMsg('');
  };

  const handleGetAdminOtp = async () => {
    setAdminLoginError('');
    setAdminOtpSuccessMsg('');
    setAdminGeneratedOtpBackup(null);

    const targetEmail = adminEmailInput.trim();
    if (!targetEmail || !targetEmail.includes('@')) {
      setAdminLoginError('Please enter your valid Admin/Manager email address to receive your 6-digit OTP.');
      return;
    }

    setAdminOtpLoading(true);

    try {
      // Call server endpoint that delivers via Brevo API
      const res = await fetch('/api/auth/send-email-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: targetEmail,
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

      if (!res.ok) {
        if (data.otpBackup) {
          const now = Date.now();
          const expiresAt = now + 3 * 60 * 1000;
          setAdminOtpExpiresAt(expiresAt);
          setOtpTimeRemaining(180);
          setAdminOtpSent(true);
          setAdminGeneratedOtpBackup(data.otpBackup);
          await savePortalEmailOtpToFirestore(adminTargetPortal, targetEmail, data.otpBackup);
          setAdminLoginError(data.error || 'Brevo email delivery notice.');
          return;
        }
        throw new Error(data.error || data.message || `Server returned ${res.status} (${res.statusText || 'Not Found'}). Please make sure the server has been restarted.`);
      }

      const now = Date.now();
      const expiresAt = now + 3 * 60 * 1000; // strictly 3 minutes
      setAdminOtpExpiresAt(expiresAt);
      setOtpTimeRemaining(180);
      setAdminOtpSent(true);
      setAdminOtpSuccessMsg(`6-Digit OTP sent directly to ${targetEmail}! Valid for 3 minutes.`);

      if (data.otpBackup) {
        setAdminGeneratedOtpBackup(data.otpBackup);
      }

      // Sync into Firestore collection (Admin_login or Property_login)
      if (data.otpBackup) {
        await savePortalEmailOtpToFirestore(adminTargetPortal, targetEmail, data.otpBackup);
      }

    } catch (err: any) {
      console.warn('Brevo Email send notice:', err.message);
      setAdminLoginError(`Error sending OTP: ${err.message || 'Please check email address.'}`);
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

      // Load custom properties from Firestore
      try {
        const firestoreProps = await getPropertiesFromFirestore();
        if (firestoreProps.length > 0) {
          setPropertiesList(prev => {
            const existingIds = new Set(prev.map(p => p.id));
            const newFromFirestore = firestoreProps.filter(p => !existingIds.has(p.id));
            if (newFromFirestore.length === 0) return prev;
            const updated = [...newFromFirestore, ...prev];
            try {
              localStorage.setItem('localProperties', JSON.stringify(updated));
            } catch (_) {}
            return updated;
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

      // Ensure Admin & Property Manager credentials exist in Firestore (Admin_login & Property_login)
      try {
        const { adminCredentials, pmCredentials } = await ensurePortalCredentialsInFirestore();
        if (adminCredentials.length > 0) setAdminDbCredentials(adminCredentials);
        if (pmCredentials.length > 0) setPmDbCredentials(pmCredentials);
      } catch (err) {
        console.warn('Portal credentials init notice:', err);
      }
    }

    init();
  }, []);

  useEffect(() => {
    if (currentUserId && currentLead.id) {
      // Sync the full JSON of this chat into the user's profile
      syncSessionToUserProfile(currentUserEmail || currentLead.email || null, currentUserId, currentLead, messages);
    }
  }, [currentUserId, currentUserEmail, currentLead, messages]);

  const handleAuthChange = async (uid: string | null, email?: string) => {
    setCurrentUserId(uid);
    if (email) setCurrentUserEmail(email);

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
    if (currentUserId) {
      saveLeadToFirestore(lead);
    } else {
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
      // Sync to firestore or local
      saveLeadData(merged);
      // Sync to local store backup
      fetch('/api/leads/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(merged)
      }).catch(() => {});
      return merged;
    });
  };

  // Start new customer chat
  const handleStartNewChat = () => {
    // Save active chat before switching to a new one
    if (currentUserId && currentLead.id && messages.length > 1) {
      saveLeadToFirestore(currentLead).catch(() => {});
      saveUserChatToFirestore(currentUserId, currentLead.id, messages).catch(() => {});
      syncSessionToUserProfile(currentUserEmail || currentLead.email || null, currentUserId, currentLead, messages).catch(() => {});
    }

    const newLead = { ...createInitialLeadProfile(), user_id: currentUserId || undefined, email: currentUserEmail || '' };
    setCurrentLead(newLead);
    setLeadsList(prev => [newLead, ...prev]);
    saveLeadData(newLead);

    const initMsg: ChatMessage = {
      id: 'MSG-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
      lead_id: newLead.id,
      role: 'assistant',
      content: `Hello, and welcome! Thanks for reaching out to Lyka Realty.\n\nWhat brings you to us today? Are you looking to invest, buy, sell, or something else?`,
      timestamp: new Date().toISOString(),
    };

    setMessages([initMsg]);
    saveInteractionData(initMsg);

    setActiveTab('chat');
    setAdminPanelOpen(false);
  };

  const handleLoadChat = (lead: LeadProfile, msgs: ChatMessage[]) => {
    // 1. If currently in another chat with messages, save it first before switching
    if (currentUserId && currentLead.id && messages.length > 1 && currentLead.id !== lead.id) {
      saveLeadToFirestore(currentLead).catch(() => {});
      saveUserChatToFirestore(currentUserId, currentLead.id, messages).catch(() => {});
      syncSessionToUserProfile(currentUserEmail || currentLead.email || null, currentUserId, currentLead, messages).catch(() => {});
    }

    // 2. Reconstruct full lead profile with safe defaults
    const fullLead: LeadProfile = {
      ...createInitialLeadProfile(),
      ...(lead || {}),
      user_id: currentUserId || (lead && lead.user_id) || undefined
    };

    setCurrentLead(fullLead);
    setMessages(msgs && msgs.length > 0 ? msgs : [
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
    // 1. Remove from active state
    setLeadsList(prev => prev.filter(l => l.id !== leadId));
    if (currentLead.id === leadId) {
      handleStartNewChat();
    }
    
    // 2. Resolve effective user ID & email
    const effectiveUid = currentUserId || auth.currentUser?.uid;
    const effectiveEmail = currentUserEmail || auth.currentUser?.email;

    // 3. Delete from Firebase Firestore (leads, interactions, user_chat, User_login)
    try {
      await deleteLeadFromFirestore(leadId);
      await deleteMessagesForLead(leadId);
      if (effectiveUid) {
        await deleteSessionFromUserProfile(effectiveEmail || null, effectiveUid, leadId);
      }
    } catch (err) {
      console.warn('Error deleting chat from Firestore:', err);
    }

    // 4. Also clean local storage
    try {
      let localLeads = JSON.parse(localStorage.getItem('localLeads') || '[]');
      localLeads = localLeads.filter((l: LeadProfile) => l.id !== leadId);
      localStorage.setItem('localLeads', JSON.stringify(localLeads));

      let localMsgs = JSON.parse(localStorage.getItem('localInteractions') || '[]');
      localMsgs = localMsgs.filter((m: ChatMessage) => m.lead_id !== leadId);
      localStorage.setItem('localInteractions', JSON.stringify(localMsgs));
    } catch (e) { console.warn(e); }
  };

  const saveInteractionData = (msg: ChatMessage) => {
    if (currentUserId) {
      saveInteractionToFirestore(msg);
      // Also save to user_chat collection for chat history per user
      // Fetch all messages for this lead and save as a session
      getMessagesForLead(msg.lead_id).then(messages => {
        saveUserChatToFirestore(currentUserId, msg.lead_id, messages);
      }).catch(() => {}); // fire-and-forget, don't block UI
    } else {
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
    }
  };

  // Maps current lead state to the correct LangGraph conversation stage
  const mapLeadToStage = (lead: typeof currentLead): string => {
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
      // 1. Agentic Extraction
      const extracted = extractEntitiesFromText(userText, currentLead);
      const mergedLead: LeadProfile = {
        ...currentLead,
        ...extracted,
        updatedAt: new Date().toISOString(),
      };

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

      // 5. Match properties if user asked a property query OR if enough criteria collected
      let matchingProps: PropertyListing[] = [];
      const isPropInquiry = isPropertyQuery(userText);
      if (isPropInquiry) {
        const pool = propertiesList.length > 0 ? propertiesList : ALL_VERIFIED_PROPERTIES;
        const isLowest = /\b(lowest|cheapest|min|minimum|least|affordable|budget)\b/i.test(userText) || /\blow\s*(perperty|property|price)?\b/i.test(userText);
        const isHighest = /\b(highest|most expensive|maximum|max price|luxury|costliest)\b/i.test(userText);
        if (isLowest) {
          const sorted = [...pool].sort((a, b) => a.price_aed - b.price_aed);
          matchingProps = sorted.slice(0, 2);
        } else if (isHighest) {
          const sorted = [...pool].sort((a, b) => b.price_aed - a.price_aed);
          matchingProps = sorted.slice(0, 2);
        } else {
          const commMatch = pool.filter(p => userText.toLowerCase().includes(p.community.toLowerCase()));
          matchingProps = commMatch.length > 0 ? commMatch.slice(0, 2) : pool.slice(0, 2);
        }
      } else if (completeness >= 40 || mergedLead.preferred_communities.length > 0 || mergedLead.budget_max) {
        matchingProps = findMatchingProperties(mergedLead);
      }

      // 6. Next Question logic
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
            conversationStage: mapLeadToStage(mergedLead),
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

      const finalProperties = serverMatchedProperties.length > 0
        ? serverMatchedProperties.slice(0, 3)
        : matchingProps.length > 0 ? matchingProps.slice(0, 3) : undefined;

      const assistantMsg: ChatMessage = {
        id: 'MSG-A-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
        lead_id: mergedLead.id,
        role: 'assistant',
        content: assistantReply,
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

      // Asynchronously generate numerical vector embedding and store into Firebase Firestore
      fetch('/api/embeddings/store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: mergedLead.id,
          text_content: `${mergedLead.full_name || 'Customer'} inquiry: ${userText}. Extracted: ${mergedLead.intent} ${mergedLead.property_type || ''} in ${(mergedLead.preferred_communities || []).join(', ')} budget AED ${mergedLead.budget_max || ''}`,
          metadata: {
            customer_name: mergedLead.full_name || 'Prospect',
            intent: mergedLead.intent,
            budget_max: mergedLead.budget_max,
            communities: mergedLead.preferred_communities
          }
        })
      }).catch(e => console.warn('Vector store background sync:', e));

    } catch (err) {
      console.error('Agentic execution error:', err);
    } finally {
      setIsLoading(false);
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

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 font-sans text-slate-300 overflow-hidden">
      {/* Navigation Header */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          if (tab === 'chat') setAdminPanelOpen(false);
        }}
        leadCount={leadsList.filter(l => l.lead_status !== 'New').length}
        propertyCount={propertiesList.length}
        customerCount={customerCount}
        firestoreActive={firestoreActive}
        vectorStatus={mongoStatus}
        onStartNewChat={handleStartNewChat}
        adminPanelOpen={adminPanelOpen}
        adminAuthenticated={adminAuthenticated}
        propertyManagerAuthenticated={propertyManagerAuthenticated}
        adminTargetPortal={adminTargetPortal}
        onSelectPortal={(portal) => {
          setAdminTargetPortal(portal);
          const isAuthed = portal === 'admin' ? adminAuthenticated : propertyManagerAuthenticated;
          if (!isAuthed) {
            resetAdminModalState();
            setAdminEmailInput('');
            setAdminPasswordInput('');
            setShowAdminLoginModal(true);
          } else {
            setAdminPanelOpen(true);
            if (portal === 'property_manager') {
              setActiveTab('properties');
            } else {
              setActiveTab('crm');
            }
          }
        }}
        onToggleAdminPanel={() => {
          if (adminPanelOpen) {
            // Close admin → go back to chat
            setAdminPanelOpen(false);
            setActiveTab('chat');
          } else {
            const isAuthed = adminTargetPortal === 'admin' ? adminAuthenticated : propertyManagerAuthenticated;
            if (!isAuthed) {
              // Not logged in → show login gate
              resetAdminModalState();
              setAdminEmailInput('');
              setAdminPasswordInput('');
              setShowAdminLoginModal(true);
            } else {
              // Already authed → open portal
              setAdminPanelOpen(true);
              if (adminTargetPortal === 'property_manager') {
                setActiveTab('properties');
              } else {
                setActiveTab('crm');
              }
            }
          }
        }}
        onAdminLogout={() => {
          if (adminTargetPortal === 'admin') {
            setAdminAuthenticated(false);
          } else {
            setPropertyManagerAuthenticated(false);
          }
          setAdminPanelOpen(false);
          setActiveTab('chat');
        }}
      />

      {/* Main Body */}
      {/* Main Body: AI Chat is always the base. Admin pages shown when admin tab is active */}
      <main className="flex-1 flex overflow-hidden relative">
        {/* AI Chat — always rendered, hidden behind admin pages when admin active */}
        <div className={`absolute inset-0 flex w-full h-full overflow-hidden transition-opacity duration-200 ${
          activeTab === 'chat' ? 'opacity-100 z-10 pointer-events-auto' : 'opacity-0 z-0 pointer-events-none'
        }`}>
          <AgenticChat
            messages={messages}
            currentLead={currentLead}
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
            onBookViewing={(prop) => setViewingModalProperty(prop)}
            onOpenAgentHandoff={() => {
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
          />
          {sidebarOpen && (
            <LeadProfileSidebar
              lead={currentLead}
              onUpdateLead={updateActiveLead}
              onTriggerHandoff={() => {
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

        {/* Admin Pages — shown when admin tab is active */}
        {activeTab !== 'chat' && (
          <div className="flex-1 flex w-full h-full overflow-hidden">

            {/* Admin Portal Pages — require adminAuthenticated */}
            {adminAuthenticated && activeTab === 'crm' && (
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

            {adminAuthenticated && activeTab === 'embeddings' && (
              <MongoEmbeddingHub currentLead={currentLead} />
            )}

            {adminAuthenticated && activeTab === 'knowledge' && (
              <KnowledgeBaseView />
            )}

            {/* Stats — Admin only */}
            {adminAuthenticated && activeTab === 'stats' && (
              <AdminStats properties={propertiesList} />
            )}

            {/* Customer Profiles & Activity (Which Customer Logged In) — Admin only */}
            {adminAuthenticated && activeTab === 'customers' && (
              <CustomerProfiles onNavigateToTrends={() => setActiveTab('login_stats')} />
            )}

            {/* Login Trends & Aggregates (Date/Day/Month/Year) — Admin only */}
            {adminAuthenticated && activeTab === 'login_stats' && (
              <CustomerAnalytics onNavigateToProfiles={() => setActiveTab('customers')} />
            )}

            {/* Property Manager & Admin Portal Pages — require propertyManagerAuthenticated or adminAuthenticated */}
            {(propertyManagerAuthenticated || adminAuthenticated) && activeTab === 'properties' && (
              <PropertyInventory
                properties={propertiesList}
                currentLead={currentLead}
                onBookViewing={(prop) => setViewingModalProperty(prop)}
                onAddProperty={async (newProp) => {
                  // 1. Immediately update UI state & local cache
                  setPropertiesList(prev => {
                    const updated = [newProp, ...prev];
                    try {
                      localStorage.setItem('localProperties', JSON.stringify(updated));
                    } catch (e) {
                      console.warn('Could not save localProperties to localStorage:', e);
                    }
                    return updated;
                  });

                  // 2. Persist to Firestore database ('properties' collection)
                  try {
                    await savePropertyToFirestore(newProp);
                  } catch (err) {
                    console.warn('Could not save property to Firestore:', err);
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
                      setAdminLoginError('');
                      setAdminEmailInput('');
                      setAdminPasswordInput('');
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
        )}
      </main>

      {/* Viewing Scheduler Modal */}
      {viewingModalProperty && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
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
                <p className="text-[11px] text-amber-600 font-semibold mt-0.5">AED {viewingModalProperty.price_aed.toLocaleString()}</p>
                <p className="text-[10px] text-slate-400">{viewingModalProperty.community} • {viewingModalProperty.bedrooms} BR</p>
              </div>
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
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
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
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
            {/* Header */}
            <div className={`px-6 py-5 shrink-0 transition-colors ${
              adminTargetPortal === 'property_manager'
                ? 'bg-gradient-to-r from-amber-700 via-amber-600 to-yellow-600'
                : 'bg-gradient-to-r from-violet-700 via-violet-600 to-purple-700'
            }`}>
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center">
                  {adminTargetPortal === 'property_manager' ? (
                    <Building2 className="w-5 h-5 text-amber-100" />
                  ) : (
                    <ShieldCheck className="w-5 h-5 text-slate-300" />
                  )}
                </div>
                <div>
                  <h2 className="text-slate-800 font-bold text-base">
                    {adminTargetPortal === 'property_manager' ? 'Property Manager Portal' : 'Admin Portal Access'}
                  </h2>
                  <p className="text-slate-700 text-xs mt-0.5">
                    {adminTargetPortal === 'property_manager'
                      ? 'Lyka Realty Property Inventory & Statistics'
                      : 'Lyka Realty CRM & System Management'}
                  </p>
                </div>
              </div>
            </div>

            {/* Portal Switcher Tabs */}
            <div className="px-6 pt-4 pb-0 space-y-2.5 shrink-0">
              <div className="flex bg-slate-800/80 p-1 rounded-xl border border-slate-700/60">
                <button
                  type="button"
                  onClick={() => {
                    setAdminTargetPortal('admin');
                    resetAdminModalState();
                  }}
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
                  onClick={() => {
                    setAdminTargetPortal('property_manager');
                    resetAdminModalState();
                  }}
                  className={`flex-1 flex items-center justify-center space-x-1.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    adminTargetPortal === 'property_manager'
                      ? 'bg-amber-500 text-amber-950 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>Property Manager</span>
                </button>
              </div>

              {/* Firestore DB Collection Indicator & Toggle to Configure Credentials */}
              <div className="flex items-center justify-between text-[11px] bg-slate-800/50 border border-slate-700/50 rounded-xl px-3 py-1.5">
                <div className="flex items-center space-x-1.5 text-emerald-400 font-medium">
                  <Database className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    DB: <code className="font-mono text-[10px] text-slate-200">{adminTargetPortal === 'property_manager' ? 'Property_login' : 'Admin_login'}</code>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const nextShow = !showCredentialConfig;
                    setShowCredentialConfig(nextShow);
                    setConfigErrorMsg('');
                    setConfigSuccessMsg('');
                    if (nextShow) {
                      setConfigEmailInput(adminTargetPortal === 'property_manager' ? PM_EMAIL : ADMIN_EMAIL);
                      setConfigPasswordInput('');
                    }
                  }}
                  className="text-[11px] font-semibold text-amber-600 hover:text-amber-700 flex items-center space-x-1 underline"
                >
                  <Settings className="w-3 h-3" />
                  <span>{showCredentialConfig ? 'Back to Login' : 'Set DB Login'}</span>
                </button>
              </div>
            </div>

            {/* Scrollable Form Body */}
            <div className="overflow-y-auto px-6 py-4 flex-1">
              {showCredentialConfig ? (
                /* ── Set / Update DB Credentials Form (Writes to Admin_login / Property_login) ── */
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!configEmailInput.trim() || !configPasswordInput.trim()) {
                      setConfigErrorMsg('Please provide both login email/username and password.');
                      return;
                    }
                    setConfigSaving(true);
                    setConfigErrorMsg('');
                    setConfigSuccessMsg('');
                    try {
                      const saved = await savePortalCredentialToFirestore(
                        adminTargetPortal,
                        configEmailInput.trim(),
                        configPasswordInput
                      );
                      if (adminTargetPortal === 'admin') {
                        setAdminDbCredentials([saved]);
                      } else {
                        setPmDbCredentials([saved]);
                      }
                      setAdminEmailInput(saved.email);
                      setAdminPasswordInput('');
                      setConfigSuccessMsg(
                        `Saved to Firestore (${adminTargetPortal === 'property_manager' ? 'Property_login' : 'Admin_login'})!`
                      );
                      setTimeout(() => {
                        setShowCredentialConfig(false);
                        setConfigSuccessMsg('');
                      }, 1200);
                    } catch (err: any) {
                      setConfigErrorMsg(err.message || 'Failed to save credentials to database.');
                    } finally {
                      setConfigSaving(false);
                    }
                  }}
                  className="space-y-4"
                >
                  <div className="bg-slate-800/70 border border-slate-700/60 rounded-xl p-3 text-xs text-slate-300 space-y-1">
                    <p className="font-bold text-white flex items-center space-x-1.5">
                      <Database className="w-3.5 h-3.5 text-amber-600" />
                      <span>
                        Update {adminTargetPortal === 'property_manager' ? 'Property Manager' : 'Admin'} DB Login
                      </span>
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Saves login & password directly to Firestore collection{' '}
                      <code className="text-amber-700 font-mono">
                        {adminTargetPortal === 'property_manager' ? 'Property_login' : 'Admin_login'}
                      </code>.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      New {adminTargetPortal === 'property_manager' ? 'Property Manager' : 'Admin'} Login (Email / Username)
                    </label>
                    <input
                      type="text"
                      value={configEmailInput}
                      onChange={(e) => { setConfigEmailInput(e.target.value); setConfigErrorMsg(''); }}
                      placeholder={adminTargetPortal === 'property_manager' ? 'manager@lykarealty.ae' : 'admin@lykarealty.ae'}
                      required
                      className="w-full bg-slate-800 border border-slate-700 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-sm text-slate-300 placeholder-slate-500 outline-none transition-colors"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      New Password
                    </label>
                    <input
                      type="text"
                      value={configPasswordInput}
                      onChange={(e) => { setConfigPasswordInput(e.target.value); setConfigErrorMsg(''); }}
                      placeholder="Enter new password for database"
                      required
                      className="w-full bg-slate-800 border border-slate-700 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-sm text-slate-300 placeholder-slate-500 outline-none transition-colors font-mono"
                    />
                  </div>

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

                  <div className="flex space-x-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowCredentialConfig(false)}
                      className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2.5 rounded-xl text-xs font-semibold transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={configSaving}
                      className="flex-1 bg-amber-500 hover:bg-amber-400 text-amber-950 py-2.5 rounded-xl text-xs font-bold transition-colors flex items-center justify-center space-x-1.5 shadow-md"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{configSaving ? 'Saving...' : 'Save'}</span>
                    </button>
                  </div>
                </form>
              ) : (
                /* ── Standard Portal Login Form (Verifies Email, Password & 6-Digit OTP against Firestore DB) ── */
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
                      setAdminLoginError('Please click "Get OTP" first to receive your 6-digit verification code.');
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

                    // 5. Verify OTP via server endpoint or backup match
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
                        // Backup check if offline / fallback
                        if (adminGeneratedOtpBackup && adminOtpInput.trim() === adminGeneratedOtpBackup.trim()) {
                          otpVerified = true;
                        } else {
                          setAdminLoginError(verData.message || 'Invalid or expired OTP code. Please check your email.');
                          setAdminLoginLoading(false);
                          return;
                        }
                      }
                    } catch (netErr) {
                      if (adminGeneratedOtpBackup && adminOtpInput.trim() === adminGeneratedOtpBackup.trim()) {
                        otpVerified = true;
                      } else {
                        setAdminLoginError('Invalid OTP code. Please check your email.');
                        setAdminLoginLoading(false);
                        return;
                      }
                    }

                    if (!otpVerified) {
                      setAdminLoginError('Invalid OTP code. Please enter the 6-digit code sent to your email.');
                      setAdminLoginLoading(false);
                      return;
                    }

                    // 6. Verify credentials against Firestore (Admin_login or Property_login)
                    const { valid } = await verifyPortalLoginFromFirestore(
                      adminTargetPortal,
                      adminEmailInput,
                      adminPasswordInput
                    );

                    // Refresh state from Firestore so hint stays current
                    const { adminCredentials, pmCredentials } = await ensurePortalCredentialsInFirestore();
                    if (adminCredentials.length > 0) setAdminDbCredentials(adminCredentials);
                    if (pmCredentials.length > 0) setPmDbCredentials(pmCredentials);

                    if (valid) {
                      if (adminTargetPortal === 'admin') {
                        setAdminAuthenticated(true);
                      } else {
                        setPropertyManagerAuthenticated(true);
                      }
                      setShowAdminLoginModal(false);
                      setAdminPanelOpen(true);
                      if (adminTargetPortal === 'property_manager') {
                        setActiveTab('properties');
                      } else {
                        setActiveTab('crm');
                      }
                    } else {
                      setAdminLoginError(
                        `Invalid login or password in ${adminTargetPortal === 'property_manager' ? 'Property_login' : 'Admin_login'} database.`
                      );
                    }
                    setAdminLoginLoading(false);
                  }}
                  className="space-y-4"
                >
                  {/* Email / Login with Get OTP button */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                      <span>{adminTargetPortal === 'property_manager' ? 'Manager Email / Login' : 'Admin Email / Login'}</span>
                      <span className="text-[10px] text-amber-600 font-medium">OTP sent to this email</span>
                    </label>
                    <div className="flex space-x-2">
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2">
                          <Mail className="w-4 h-4 text-slate-500" />
                        </span>
                        <input
                          id="admin-email-input"
                          type="email"
                          value={adminEmailInput}
                          onChange={(e) => { setAdminEmailInput(e.target.value); setAdminLoginError(''); }}
                          placeholder={adminTargetPortal === 'property_manager' ? PM_EMAIL : ADMIN_EMAIL}
                          autoFocus
                          required
                          className="w-full bg-slate-800 border border-slate-700 focus:border-violet-500 rounded-xl pl-9 pr-3 py-2.5 text-sm text-slate-300 placeholder-slate-500 outline-none transition-colors"
                        />
                      </div>
                      <button
                        id="admin-get-otp-btn"
                        type="button"
                        onClick={handleGetAdminOtp}
                        disabled={!adminEmailInput.trim() || adminOtpLoading}
                        className={`px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 shrink-0 shadow-sm ${
                          adminEmailInput.trim() && !adminOtpLoading
                            ? 'bg-amber-500 hover:bg-amber-400 text-amber-950 cursor-pointer active:scale-95'
                            : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-60'
                        }`}
                      >
                        {adminOtpLoading ? (
                          <>
                            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            <span>Sending...</span>
                          </>
                        ) : adminOtpSent ? (
                          <>
                            <KeyRound className="w-3.5 h-3.5" />
                            <span>Resend OTP</span>
                          </>
                        ) : (
                          <>
                            <KeyRound className="w-3.5 h-3.5" />
                            <span>Get OTP</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Password */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Password</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2">
                        <Lock className="w-4 h-4 text-slate-500" />
                      </span>
                      <input
                        id="admin-password-input"
                        type="password"
                        value={adminPasswordInput}
                        onChange={(e) => { setAdminPasswordInput(e.target.value); setAdminLoginError(''); }}
                        placeholder="Enter password"
                        required
                        className="w-full bg-slate-800 border border-slate-700 focus:border-violet-500 rounded-xl pl-9 pr-3 py-2.5 text-sm text-slate-300 placeholder-slate-500 outline-none transition-colors"
                      />
                    </div>
                  </div>

                  {/* Email OTP Sent Notice Card with 3-Minute Live Timer */}
                  {adminOtpSent && (
                    <div className="bg-gradient-to-r from-emerald-950/70 via-slate-800/80 to-emerald-950/50 border border-emerald-500/40 rounded-xl p-3.5 space-y-2 shadow-inner">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-emerald-300 uppercase tracking-wider flex items-center space-x-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>OTP Dispatched via Brevo</span>
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
                        A 6-digit verification code was emailed to <strong className="text-amber-700">{adminEmailInput}</strong>. Check your inbox/spam folder.
                      </p>
                      <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-700/60">
                        <span>Valid for exactly 3 minutes</span>
                        {otpTimeRemaining === 0 && (
                          <span className="text-rose-400 font-bold">Expired. Click 'Resend OTP'</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 6-Digit OTP Input Field */}
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
                      disabled={!adminOtpSent}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\D/g, '').slice(0, 6);
                        setAdminOtpInput(digits);
                        setAdminLoginError('');
                      }}
                      placeholder={adminOtpSent ? "Type 6-digit OTP from email" : "Click 'Get OTP' above first"}
                      required
                      className={`w-full bg-slate-800 border rounded-xl px-3.5 py-2.5 text-sm text-slate-200 placeholder-slate-500 outline-none transition-colors font-mono tracking-widest ${
                        !adminOtpSent
                          ? 'opacity-50 cursor-not-allowed border-slate-700'
                          : 'border-slate-700 focus:border-amber-500'
                      }`}
                    />
                    {!adminOtpSent && (
                      <p className="text-[11px] text-amber-600/90 flex items-center space-x-1">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        <span>Enter email above and click "Get OTP" to receive your code.</span>
                      </p>
                    )}
                  </div>

                  {/* Login / Auth Error */}
                  {adminLoginError && (
                    <div className="flex items-center space-x-2 bg-red-950/60 border border-red-500/50 rounded-xl px-3 py-2.5 text-xs text-rose-300">
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>{adminLoginError}</span>
                    </div>
                  )}

                  {/* Hint */}
                  <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl px-3 py-2 text-[11px] text-slate-500 flex items-center justify-between">
                    <div>
                      <span className="text-slate-400 font-medium">DB Login:</span>{' '}
                      <span className={adminTargetPortal === 'property_manager' ? 'text-amber-600 font-mono' : 'text-violet-400 font-mono'}>
                        {adminTargetPortal === 'property_manager' ? PM_EMAIL : ADMIN_EMAIL}
                      </span>
                    </div>
                    <span className="text-[10px] text-emerald-400 font-medium flex items-center space-x-1">
                      <Clock className="w-3 h-3" />
                      <span>3-Min Security OTP</span>
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex space-x-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAdminLoginModal(false);
                        resetAdminModalState();
                      }}
                      className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2.5 rounded-xl text-xs font-semibold transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={adminLoginLoading || !adminOtpSent || adminOtpInput.length !== 6 || !adminEmailInput.trim()}
                      className={`flex-1 disabled:opacity-50 disabled:cursor-not-allowed py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 shadow-md ${
                        adminTargetPortal === 'property_manager'
                          ? 'bg-amber-500 hover:bg-amber-400 text-amber-950'
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
                        <span>Verify & Enter {adminTargetPortal === 'property_manager' ? 'Property Manager' : 'Admin'}</span>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
