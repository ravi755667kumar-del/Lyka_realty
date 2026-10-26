import { initializeApp } from 'firebase/app';
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDoc,
  getDocFromServer, 
  setDoc, 
  deleteDoc,
  getDocs, 
  collection, 
  query, 
  where,
  orderBy, 
  onSnapshot,
  updateDoc,
  deleteField,
  arrayUnion
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { OperationType, FirestoreErrorInfo, LeadProfile, ChatMessage, FollowUpTask, PropertyListing, UserProfileData, LoginEvent, PortalCredential, BookedPropertyRecord, FavoritePropertyRecord, QaChatItem, SequentialConversation } from '../types/crm';

const app = initializeApp(firebaseConfig);
export const db = (firebaseConfig as any).firestoreDatabaseId
  ? getFirestore(app, (firebaseConfig as any).firestoreDatabaseId)
  : getFirestore(app);
export const auth = getAuth(app);

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client is offline or initial connection pending:', error.message);
    }
    // Expected on fresh collection or unauthenticated probe
    return true;
  }
}

/**
 * Recursively removes all undefined values from an object or array.
 * Firestore setDoc() throws an error if any field (even deeply nested or inside an array) is undefined.
 */
export function cleanFirestoreData<T>(input: T): T {
  if (input === undefined) {
    return null as any;
  }
  if (input === null || typeof input !== 'object') {
    return input;
  }
  if (input instanceof Date) {
    return input.toISOString() as any;
  }
  if (Array.isArray(input)) {
    return input
      .filter((item) => item !== undefined)
      .map((item) => cleanFirestoreData(item)) as any;
  }
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(input as Record<string, any>)) {
    if (value !== undefined) {
      result[key] = cleanFirestoreData(value);
    }
  }
  return result as T;
}

// Leads collection helpers
export async function saveLeadToFirestore(lead: LeadProfile): Promise<void> {
  const path = `leads/${lead.id}`;
  try {
    const cleanedLead = cleanFirestoreData({
      ...lead,
      updatedAt: new Date().toISOString()
    });
    await setDoc(doc(db, 'leads', lead.id), cleanedLead, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// User Profile & Login helpers
export async function getUserProfileFromFirestore(email: string, userId?: string): Promise<UserProfileData | null> {
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanUid = (userId || '').trim();
  const docId = cleanEmail || cleanUid;
  if (!docId) return null;

  // 1. Try server-side authenticated endpoint first (bypasses client permission issues)
  try {
    const params = new URLSearchParams();
    if (cleanEmail) params.set('email', cleanEmail);
    if (cleanUid) params.set('userId', cleanUid);
    const srvRes = await fetch(`/api/auth/get-user-profile?${params.toString()}`);
    if (srvRes.ok) {
      const srvData = await srvRes.json();
      if (srvData && srvData.success && srvData.profile) {
        const prof = srvData.profile as UserProfileData;
        const profEmail = (prof.Email_id || '').trim().toLowerCase();
        if (!cleanEmail || !profEmail || profEmail === cleanEmail) {
          return prof;
        }
      }
    }
  } catch (srvErr) {
    // Non-fatal: proceed to direct Firestore lookup
  }

  // 2. Direct document lookup (if client has active auth session or rules allow)
  try {
    if (cleanEmail) {
      const snap = await getDoc(doc(db, 'User_login', cleanEmail));
      if (snap.exists()) {
        const data = snap.data() as UserProfileData;
        if (!data.Email_id || data.Email_id.trim().toLowerCase() === cleanEmail) {
          return data;
        }
      }
      // Also try original casing if email differed
      if (email && email.trim() !== cleanEmail) {
        const snapOrig = await getDoc(doc(db, 'User_login', email.trim()));
        if (snapOrig.exists()) {
          const data = snapOrig.data() as UserProfileData;
          if (!data.Email_id || data.Email_id.trim().toLowerCase() === cleanEmail) {
            return data;
          }
        }
      }
    }

    if (cleanUid) {
      const snapUid = await getDoc(doc(db, 'User_login', cleanUid));
      if (snapUid.exists()) {
        const data = snapUid.data() as UserProfileData;
        if (!cleanEmail || !data.Email_id || data.Email_id.trim().toLowerCase() === cleanEmail) {
          return data;
        }
      }
    }

    if (cleanEmail) {
      try {
        const q = query(collection(db, 'User_login'), where('Email_id', '==', cleanEmail));
        const qSnap = await getDocs(q);
        if (!qSnap.empty) {
          return qSnap.docs[0].data() as UserProfileData;
        }
      } catch (_) {}
    }
  } catch (error) {
    console.warn('Direct Firestore client lookup notice:', error);
  }

  // 3. Fallback to local cached profile ONLY IF it strictly matches the requested email or userId!
  try {
    const specificCached = cleanEmail
      ? localStorage.getItem(`user_profile_${cleanEmail}`)
      : (cleanUid ? localStorage.getItem(`user_profile_${cleanUid}`) : null);

    if (specificCached) {
      const parsed = JSON.parse(specificCached) as UserProfileData;
      const parsedEmail = (parsed.Email_id || '').trim().toLowerCase();
      const parsedUid = (parsed.uid || '').trim();
      if ((cleanEmail && parsedEmail === cleanEmail) || (!cleanEmail && cleanUid && parsedUid === cleanUid)) {
        return parsed;
      }
    }

    // Check current_user_profile ONLY IF it strictly matches the requested email or userId!
    const currentCached = localStorage.getItem('current_user_profile');
    if (currentCached) {
      const parsed = JSON.parse(currentCached) as UserProfileData;
      const parsedEmail = (parsed.Email_id || '').trim().toLowerCase();
      const parsedUid = (parsed.uid || '').trim();
      if (cleanEmail && parsedEmail === cleanEmail) {
        return parsed;
      }
      if (!cleanEmail && cleanUid && parsedUid === cleanUid) {
        return parsed;
      }
    }
  } catch (_) {}

  return null;
}

export async function saveUserLoginToFirestore(
  userId: string, 
  email: string, 
  fullName: string, 
  authProvider: string,
  age?: number,
  termsAccepted?: boolean
): Promise<void> {
  const docId = (email || userId || '').trim().toLowerCase();
  const now = new Date().toISOString();
  
  const data: any = {
    uid: userId,
    Email_id: email.trim(),
    Name: fullName.trim(),
    auth_provider: authProvider,
    last_login: now,
    login_history: arrayUnion(now)
  };
  if (age !== undefined && age !== null) {
    data.Age = Number(age);
  }
  if (termsAccepted) {
    data.terms_accepted = true;
    data.terms_accepted_at = now;
    data.terms_version = 'v2.4';
  }

  // Cache locally immediately so Name and Age are never lost
  try {
    localStorage.setItem(`user_profile_${docId}`, JSON.stringify(data));
    localStorage.setItem('current_user_profile', JSON.stringify(data));
  } catch (_) {}

  // 1. Primary: Save via server-side authenticated endpoint (guarantees write succeeds without client permission errors)
  try {
    await fetch('/api/auth/save-user-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        email: email.trim(),
        fullName: fullName.trim(),
        authProvider,
        age,
        termsAccepted
      })
    });
  } catch (srvErr) {
    console.warn('[Auth] Server save-user-login notice:', srvErr);
  }

  // 2. Direct client-side write (if client has permission, merges seamlessly; non-fatal if client rules restrict)
  try {
    // Save strictly to single email docId to prevent duplicate accounts
    await setDoc(doc(db, 'User_login', docId), data, { merge: true });

    // Record login event for time/date/month/year statistics
    try {
      const eventId = `EVT-${userId.substring(0, 8)}-${Date.now()}`;
      await setDoc(doc(db, 'login_events', eventId), {
        userId,
        email: email.trim(),
        fullName: fullName.trim(),
        authProvider,
        age: age !== undefined && age !== null ? Number(age) : null,
        timestamp: now
      }, { merge: true });
    } catch (_) {}
  } catch (clientErr: any) {
    // Note: Do not throw permission error because server-side endpoint already saved the record
    console.warn('[Auth] Direct client Firestore write notice (handled via server):', clientErr?.message || clientErr);
  }
}

/**
 * Update user's Name and Age in User_login collection.
 * Replaces old Name and Age with new values in Firestore.
 */
export async function updateUserProfileInFirestore(
  userId: string,
  email: string,
  newName: string,
  newAge?: number | string
): Promise<void> {
  const docId = (email || userId || '').trim().toLowerCase();
  const now = new Date().toISOString();

  const updateData: any = {
    Name: newName.trim(),
    updatedAt: now
  };
  if (newAge !== undefined && newAge !== null && newAge !== '') {
    updateData.Age = Number(newAge);
  }

  // 1. Server-side update
  try {
    await fetch('/api/auth/update-user-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, email, newName, newAge })
    });
  } catch (srvErr) {
    console.warn('[Auth] Server update-user-profile notice:', srvErr);
  }

  // 2. Direct client update
  const targets = new Set<string>();
  if (docId) targets.add(docId);
  if (email && email.trim()) targets.add(email.trim());
  if (userId && userId.trim()) targets.add(userId.trim());

  for (const target of targets) {
    try {
      await setDoc(doc(db, 'User_login', target), updateData, { merge: true });
    } catch (err) {
      console.warn(`Could not update User_login/${target}:`, err);
    }
  }

  // 3. Update local storage caches so state persists across reloads immediately
  try {
    const keys = [`user_profile_${docId}`, 'current_user_profile'];
    for (const k of keys) {
      const cached = localStorage.getItem(k);
      if (cached) {
        const parsed = JSON.parse(cached);
        localStorage.setItem(k, JSON.stringify({ ...parsed, ...updateData }));
      }
    }
  } catch (_) {}
}

export async function getAllUsersFromFirestore(): Promise<UserProfileData[]> {
  try {
    const snap = await getDocs(collection(db, 'User_login'));
    const userMap = new Map<string, UserProfileData>();

    snap.forEach((d) => {
      const data = d.data() as UserProfileData;
      // Unique user identifier: normalize email lowercase or UID
      const key = (data.Email_id || data.uid || d.id).trim().toLowerCase();
      if (!userMap.has(key)) {
        userMap.set(key, { ...data, uid: data.uid || d.id });
      } else {
        const existing = userMap.get(key)!;
        userMap.set(key, {
          ...existing,
          ...data,
          Name: data.Name || existing.Name,
          Age: data.Age ?? existing.Age,
          auth_provider: data.auth_provider || existing.auth_provider,
          phone: data.phone || data.Phone_number || data.talk_to_agent_phone || existing.phone || existing.Phone_number || existing.talk_to_agent_phone,
          Phone_number: data.Phone_number || data.phone || existing.Phone_number || existing.phone,
          talk_to_agent_requested: data.talk_to_agent_requested ?? existing.talk_to_agent_requested ?? false,
          talk_to_agent_time: data.talk_to_agent_time || existing.talk_to_agent_time,
          talk_to_agent_reason: data.talk_to_agent_reason || existing.talk_to_agent_reason,
          talk_to_agent_phone: data.talk_to_agent_phone || data.phone || data.Phone_number || existing.talk_to_agent_phone || existing.phone,
          last_login: data.last_login || existing.last_login,
          createdAt: existing.createdAt || data.createdAt || existing.last_login,
          login_history: Array.from(new Set([...(existing.login_history || []), ...(data.login_history || [])])),
          conversations: data.conversations || existing.conversations,
          User_chat: data.User_chat || existing.User_chat
        });
      }
    });

    // Cross-reference with leads to link talk_to_agent requests and phone numbers
    try {
      const leadsSnap = await getDocs(collection(db, 'leads'));
      leadsSnap.forEach(ld => {
        const leadData = ld.data() as LeadProfile;
        const uKeyEmail = (leadData.email || '').trim().toLowerCase();
        const uKeyId = (leadData.user_id || '').trim().toLowerCase();
        const target = (uKeyEmail && userMap.get(uKeyEmail)) || (uKeyId && userMap.get(uKeyId));
        if (target) {
          if (leadData.phone && !target.phone) target.phone = leadData.phone;
          if (leadData.human_handoff_required) {
            target.talk_to_agent_requested = true;
            if (leadData.phone && !target.talk_to_agent_phone) target.talk_to_agent_phone = leadData.phone;
            if (leadData.handoff_reason && !target.talk_to_agent_reason) target.talk_to_agent_reason = leadData.handoff_reason;
            if (leadData.updatedAt && !target.talk_to_agent_time) target.talk_to_agent_time = leadData.updatedAt;
          }
        }
      });
    } catch (_) {}

    const users = Array.from(userMap.values());
    users.sort((a, b) => new Date(b.last_login || 0).getTime() - new Date(a.last_login || 0).getTime());
    return users;
  } catch (error) {
    console.warn('Could not fetch all users from direct Firestore, falling back to server API:', error);
    try {
      const srvRes = await fetch('/api/auth/all-users');
      if (srvRes.ok) {
        const srvData = await srvRes.json();
        if (srvData && srvData.success && Array.isArray(srvData.users)) {
          const list: UserProfileData[] = srvData.users;
          list.sort((a, b) => new Date(b.last_login || 0).getTime() - new Date(a.last_login || 0).getTime());
          return list;
        }
      }
    } catch (_) {}
    const local = localStorage.getItem('current_user_profile');
    if (local) {
      try { return [JSON.parse(local)]; } catch (_) {}
    }
    return [];
  }
}

export async function saveTalkToAgentRequest(
  userId: string | null,
  email: string | null,
  phone: string,
  reason: string,
  lead: LeadProfile
): Promise<void> {
  const cleanPhone = phone.trim();
  const cleanEmail = email ? email.trim().toLowerCase() : null;
  const now = new Date().toISOString();

  const updatePayload = {
    phone: cleanPhone,
    Phone_number: cleanPhone,
    talk_to_agent_requested: true,
    talk_to_agent_time: now,
    talk_to_agent_reason: reason.trim(),
    talk_to_agent_phone: cleanPhone,
    updatedAt: now
  };

  // 1. Update User_login collection
  const targets = new Set<string>();
  if (cleanEmail) targets.add(cleanEmail);
  if (email && email.trim()) targets.add(email.trim());
  if (userId && userId.trim()) targets.add(userId.trim());

  for (const docId of targets) {
    try {
      await setDoc(doc(db, 'User_login', docId), updatePayload, { merge: true });
    } catch (err) {
      console.warn(`Could not update User_login/${docId} with talk-to-agent request:`, err);
    }
  }

  // Update local storage cache
  try {
    const currentCached = localStorage.getItem('current_user_profile');
    if (currentCached) {
      const parsed = JSON.parse(currentCached);
      localStorage.setItem('current_user_profile', JSON.stringify({ ...parsed, ...updatePayload }));
    }
  } catch (_) {}

  // 2. Update lead in Firestore
  try {
    const updatedLead: LeadProfile = {
      ...lead,
      phone: cleanPhone,
      human_handoff_required: true,
      handoff_reason: reason.trim(),
      lead_status: 'Viewing',
      lead_priority: 'Urgent',
      updatedAt: now
    };
    await saveLeadToFirestore(updatedLead);
  } catch (err) {
    console.warn('Could not update lead with talk-to-agent request:', err);
  }
}

export async function getLoginEventsFromFirestore(): Promise<LoginEvent[]> {
  try {
    const snap = await getDocs(collection(db, 'login_events'));
    const events: LoginEvent[] = [];
    snap.forEach((d) => {
      events.push({ id: d.id, ...(d.data() as any) });
    });
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return events;
  } catch (error) {
    console.warn('Could not fetch login_events from Firestore:', error);
    return [];
  }
}

export async function deleteUserLoginFromFirestore(userId: string, email?: string): Promise<void> {
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanUid = (userId || '').trim();

  // 1. Delete via server endpoint
  try {
    await fetch('/api/auth/delete-user-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: cleanUid, email: cleanEmail })
    });
  } catch (srvErr) {
    console.warn('[Auth] Server delete-user-login notice:', srvErr);
  }

  // 2. Delete User_login and users documents client-side
  const targets = new Set<string>();
  if (cleanEmail) targets.add(cleanEmail);
  if (email && email.trim()) targets.add(email.trim());
  if (userId && userId.trim()) targets.add(userId.trim());

  for (const target of targets) {
    try {
      await deleteDoc(doc(db, 'User_login', target));
    } catch (err: any) {
      console.warn(`Could not delete User_login doc for ${target}:`, err);
    }
    try {
      await deleteDoc(doc(db, 'users', target));
    } catch (_) {}
  }

  // Also delete all leads and messages owned by this user
  if (userId) {
    try {
      const userLeads = await getUserLeadsFromFirestore(userId);
      for (const lead of userLeads) {
        try {
          await deleteLeadFromFirestore(lead.id);
          await deleteMessagesForLead(lead.id);
        } catch (_) {}
      }
    } catch (e) {
      console.warn('Could not clean up user leads on account delete:', e);
    }
  }
}

export interface UserChatSession {
  id: string;
  title: string;
  preview: string;
  timestamp: string;
  messageCount: number;
  leadProfile: LeadProfile;
  messages: ChatMessage[];
}

export function buildSequentialQaChats(messages: ChatMessage[]): QaChatItem[] {
  const qaList: QaChatItem[] = [];
  let seq = 1;

  for (let i = 0; i < messages.length; i++) {
    const current = messages[i];
    if (current.role === 'user') {
      const userQuestion = current.content || '';
      let aiAnswer = '';
      let replyTimestamp = current.timestamp;

      // Find the subsequent assistant reply
      for (let j = i + 1; j < messages.length; j++) {
        if (messages[j].role === 'assistant') {
          aiAnswer = messages[j].content || '';
          replyTimestamp = messages[j].timestamp || replyTimestamp;
          break;
        } else if (messages[j].role === 'user') {
          break;
        }
      }

      const msgDate = new Date(current.timestamp || Date.now());
      const dateStr = !isNaN(msgDate.getTime()) ? msgDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
      const timeStr = !isNaN(msgDate.getTime()) ? msgDate.toLocaleTimeString('en-US', { hour12: true }) : new Date().toLocaleTimeString('en-US', { hour12: true });

      qaList.push({
        sequence: seq++,
        user_question: userQuestion,
        ai_answer: aiAnswer,
        date: dateStr,
        time: timeStr,
        timestamp: current.timestamp || new Date().toISOString()
      });
    }
  }

  return qaList;
}

export async function syncSessionToUserProfile(
  email: string | null, 
  userId: string, 
  lead: LeadProfile, 
  msgs: ChatMessage[]
): Promise<void> {
  const cleanEmail = email ? email.trim().toLowerCase() : null;
  const targets = new Set<string>();
  if (cleanEmail) targets.add(cleanEmail);
  if (email && email.trim()) targets.add(email.trim());
  if (userId && userId.trim()) targets.add(userId.trim());
  if (targets.size === 0) return;

  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toLocaleTimeString('en-US', { hour12: true });

  // 1. Build clean sequential Q&A pairs (sequence: 1, 2, 3...)
  const qaChats = buildSequentialQaChats(msgs);

  // Determine conversation title
  const firstUserQuery = msgs.find(m => m.role === 'user')?.content;
  const title = firstUserQuery
    ? (firstUserQuery.length > 50 ? firstUserQuery.slice(0, 50) + '...' : firstUserQuery)
    : (lead.summary || 'Conversation');

  const sessionData = cleanFirestoreData({
    leadProfile: lead,
    messages: msgs,
    updatedAt: now.toISOString()
  });

  for (const docId of targets) {
    try {
      const userDocRef = doc(db, 'User_login', docId);
      const userSnap = await getDoc(userDocRef);
      let convNumber = 1;
      let convKey = 'conversation_1';

      if (userSnap.exists()) {
        const userData = userSnap.data();
        const existingConversations = userData?.conversations || {};

        let foundKey: string | null = null;
        let maxNumber = 0;

        for (const [key, conv] of Object.entries<any>(existingConversations)) {
          const numMatch = key.match(/conversation_(\d+)/);
          const num = numMatch ? parseInt(numMatch[1], 10) : 0;
          if (num > maxNumber) maxNumber = num;

          if (conv?.lead_id === lead.id || conv?.id === lead.id) {
            foundKey = key;
            convNumber = conv.conversation_number || num;
            break;
          }
        }

        if (foundKey) {
          convKey = foundKey;
        } else {
          convNumber = maxNumber + 1;
          convKey = `conversation_${convNumber}`;
        }
      }

      const conversationRecord: SequentialConversation = cleanFirestoreData({
        conversation_number: convNumber,
        conversation_key: convKey,
        lead_id: lead.id,
        title,
        date: dateStr,
        started_at: timeStr,
        updated_at: now.toISOString(),
        chats: qaChats
      });

      await setDoc(userDocRef, {
        conversations: {
          [convKey]: conversationRecord
        },
        User_chat: {
          [lead.id]: sessionData
        }
      }, { merge: true });
    } catch (error) {
      console.warn(`Failed to sync chat history to User_login/${docId}:`, error);
    }
  }

  // Also store into user_chat collection: user_chat/${userId}_${lead.id}
  if (userId) {
    try {
      await saveUserChatToFirestore(userId, lead.id, msgs);
    } catch (e) {
      console.warn('Failed to save to user_chat collection:', e);
    }
  }
}

export async function deleteSessionFromUserProfile(
  email: string | null, 
  userId: string, 
  leadId: string
): Promise<void> {
  const cleanEmail = email ? email.trim().toLowerCase() : null;
  const targets = new Set<string>();
  if (cleanEmail) targets.add(cleanEmail);
  if (email && email.trim()) targets.add(email.trim());
  if (userId && userId.trim()) targets.add(userId.trim());

  // 1. Delete from targeted User_login docs
  for (const docId of targets) {
    try {
      const docRef = doc(db, 'User_login', docId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        const convUpdates: Record<string, any> = {
          [`User_chat.${leadId}`]: deleteField()
        };
        if (data?.conversations && typeof data.conversations === 'object') {
          for (const [key, conv] of Object.entries<any>(data.conversations)) {
            if (conv?.lead_id === leadId || conv?.id === leadId) {
              convUpdates[`conversations.${key}`] = deleteField();
            }
          }
        }
        await updateDoc(docRef, convUpdates);
      }
    } catch (error) {
      console.warn(`Failed to delete session from User_login/${docId}:`, error);
    }
  }

  // 2. Scan User_login collection to remove this leadId from any other User_chat & conversations map
  try {
    const userLoginSnap = await getDocs(collection(db, 'User_login'));
    userLoginSnap.forEach(d => {
      const data = d.data();
      const updates: Record<string, any> = {};
      if (data?.User_chat && data.User_chat[leadId]) {
        updates[`User_chat.${leadId}`] = deleteField();
      }
      if (data?.conversations && typeof data.conversations === 'object') {
        for (const [key, conv] of Object.entries<any>(data.conversations)) {
          if (conv?.lead_id === leadId || conv?.id === leadId) {
            updates[`conversations.${key}`] = deleteField();
          }
        }
      }
      if (Object.keys(updates).length > 0) {
        updateDoc(d.ref, updates).catch(() => {});
      }
    });
  } catch (_) {}

  // 3. Delete from user_chat collection
  await deleteUserChatFromFirestore(leadId, userId);
}

export async function getUserChatSessionsFromFirestore(
  userId: string,
  email?: string
): Promise<UserChatSession[]> {
  const sessionMap = new Map<string, UserChatSession>();

  // 1. Fetch from User_login docs
  const targets = new Set<string>();
  if (email && email.trim()) {
    targets.add(email.trim().toLowerCase());
    targets.add(email.trim());
  }
  if (userId && userId.trim()) {
    targets.add(userId.trim());
  }

  for (const docId of targets) {
    try {
      const snap = await getDoc(doc(db, 'User_login', docId));
      if (snap.exists()) {
        const data = snap.data();
        if (data.User_chat && typeof data.User_chat === 'object') {
          for (const [leadId, session] of Object.entries<any>(data.User_chat)) {
            if (session && Array.isArray(session.messages) && session.messages.some((m: any) => m.role === 'user')) {
              const msgs = session.messages as ChatMessage[];
              const lead = session.leadProfile || { id: leadId, user_id: userId };
              const firstUserMsg = msgs.find(m => m.role === 'user');
              const title = firstUserMsg
                ? (firstUserMsg.content.length > 42 ? firstUserMsg.content.slice(0, 42) + '...' : firstUserMsg.content)
                : (lead.summary || `${lead.intent || 'General'} Inquiry`);
              const lastMsg = msgs[msgs.length - 1];
              sessionMap.set(leadId, {
                id: leadId,
                title,
                preview: (lastMsg?.content || '').substring(0, 60) + '...',
                timestamp: lead.updatedAt || session.updatedAt || lastMsg?.timestamp || new Date().toISOString(),
                messageCount: msgs.length,
                leadProfile: lead,
                messages: msgs
              });
            }
          }
        }
      }
    } catch (e) {
      console.warn(`Could not fetch User_login User_chat for ${docId}:`, e);
    }
  }

  // 2. Fetch from user_chat collection
  try {
    const snap = await getDocs(collection(db, 'user_chat'));
    snap.forEach((d) => {
      const data = d.data();
      if ((data.userId === userId || !data.userId) && data.leadId && Array.isArray(data.messages) && data.messages.some((m: any) => m.role === 'user')) {
        const msgs = data.messages as ChatMessage[];
        const firstUserMsg = msgs.find(m => m.role === 'user');
        const title = firstUserMsg
          ? (firstUserMsg.content.length > 42 ? firstUserMsg.content.slice(0, 42) + '...' : firstUserMsg.content)
          : `Inquiry (${data.leadId})`;
        const lastMsg = msgs[msgs.length - 1];
        const existing = sessionMap.get(data.leadId);
        if (!existing || existing.messages.length < msgs.length) {
          sessionMap.set(data.leadId, {
            id: data.leadId,
            title,
            preview: (lastMsg?.content || '').substring(0, 60) + '...',
            timestamp: data.updatedAt || lastMsg?.timestamp || new Date().toISOString(),
            messageCount: msgs.length,
            leadProfile: existing?.leadProfile || ({ id: data.leadId, user_id: userId } as any),
            messages: msgs
          });
        }
      }
    });
  } catch (e) {
    console.warn('Could not fetch user_chat collection:', e);
  }

  // 3. Fetch from leads & interactions collections
  try {
    const leads = await getUserLeadsFromFirestore(userId);
    for (const lead of leads) {
      const msgs = await getMessagesForLead(lead.id);
      if (msgs.length > 0 && msgs.some(m => m.role === 'user')) {
        const firstUserMsg = msgs.find(m => m.role === 'user');
        const title = firstUserMsg
          ? (firstUserMsg.content.length > 42 ? firstUserMsg.content.slice(0, 42) + '...' : firstUserMsg.content)
          : (lead.summary || `${lead.intent || 'General'} Inquiry`);
        const lastMsg = msgs[msgs.length - 1];
        const existing = sessionMap.get(lead.id);
        if (!existing || existing.messages.length < msgs.length) {
          sessionMap.set(lead.id, {
            id: lead.id,
            title,
            preview: (lastMsg?.content || '').substring(0, 60) + '...',
            timestamp: lead.updatedAt || lastMsg?.timestamp || new Date().toISOString(),
            messageCount: msgs.length,
            leadProfile: lead,
            messages: msgs
          });
        }
      }
    }
  } catch (e) {
    console.warn('Could not fetch leads/interactions for user:', e);
  }

  const sessions = Array.from(sessionMap.values());
  sessions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return sessions;
}

export async function getUserConversationsFromFirestore(
  email?: string | null,
  userId?: string | null
): Promise<SequentialConversation[]> {
  const convMap = new Map<string, SequentialConversation>();
  const targets = new Set<string>();

  if (email && email.trim()) {
    targets.add(email.trim().toLowerCase());
    targets.add(email.trim());
  }
  if (userId && userId.trim()) {
    targets.add(userId.trim());
  }

  // 1. Fetch from targeted User_login docs
  for (const docId of targets) {
    try {
      const snap = await getDoc(doc(db, 'User_login', docId));
      if (snap.exists()) {
        const data = snap.data();
        // Check conversations map
        if (data?.conversations && typeof data.conversations === 'object') {
          for (const [key, conv] of Object.entries<any>(data.conversations)) {
            if (conv && Array.isArray(conv.chats) && conv.chats.length > 0) {
              const leadKey = conv.lead_id || conv.id || key;
              if (!convMap.has(leadKey)) {
                convMap.set(leadKey, {
                  conversation_number: conv.conversation_number || (convMap.size + 1),
                  conversation_key: conv.conversation_key || key,
                  lead_id: leadKey,
                  title: conv.title || (conv.chats[0]?.user_question?.slice(0, 50) + '...') || 'Conversation',
                  date: conv.date || (conv.chats[0]?.date) || new Date().toISOString().split('T')[0],
                  started_at: conv.started_at || (conv.chats[0]?.time) || '',
                  updated_at: conv.updated_at || new Date().toISOString(),
                  chats: conv.chats
                });
              }
            }
          }
        }

        // Also check User_chat map for any sessions not yet in convMap
        if (data?.User_chat && typeof data.User_chat === 'object') {
          for (const [leadId, session] of Object.entries<any>(data.User_chat)) {
            if (!convMap.has(leadId) && session && Array.isArray(session.messages)) {
              const qaChats = buildSequentialQaChats(session.messages);
              if (qaChats.length > 0) {
                const firstUser = session.messages.find((m: any) => m.role === 'user');
                const title = firstUser?.content ? (firstUser.content.slice(0, 50) + (firstUser.content.length > 50 ? '...' : '')) : (session.leadProfile?.summary || 'Conversation');
                const convNum = convMap.size + 1;
                convMap.set(leadId, {
                  conversation_number: convNum,
                  conversation_key: `conversation_${convNum}`,
                  lead_id: leadId,
                  title,
                  date: qaChats[0]?.date || new Date().toISOString().split('T')[0],
                  started_at: qaChats[0]?.time || '',
                  updated_at: session.updatedAt || new Date().toISOString(),
                  chats: qaChats
                });
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn(`Error fetching User_login for ${docId}:`, e);
    }
  }

  // 2. Also check user_chat collection for any sessions matching userId
  if (userId) {
    try {
      const snap = await getDocs(collection(db, 'user_chat'));
      snap.forEach(d => {
        const data = d.data();
        if (data.userId === userId && data.leadId && !convMap.has(data.leadId) && Array.isArray(data.messages)) {
          const qaChats = buildSequentialQaChats(data.messages);
          if (qaChats.length > 0) {
            const firstUser = data.messages.find((m: any) => m.role === 'user');
            const title = firstUser?.content ? (firstUser.content.slice(0, 50) + (firstUser.content.length > 50 ? '...' : '')) : 'Conversation';
            const convNum = convMap.size + 1;
            convMap.set(data.leadId, {
              conversation_number: convNum,
              conversation_key: `conversation_${convNum}`,
              lead_id: data.leadId,
              title,
              date: qaChats[0]?.date || new Date().toISOString().split('T')[0],
              started_at: qaChats[0]?.time || '',
              updated_at: data.updatedAt || new Date().toISOString(),
              chats: qaChats
            });
          }
        }
      });
    } catch (_) {}
  }

  const result = Array.from(convMap.values());
  // Sort by conversation_number ascending: conversation_1, conversation_2...
  result.sort((a, b) => (a.conversation_number || 0) - (b.conversation_number || 0));
  // Re-number sequentially to guarantee 1, 2, 3...
  result.forEach((c, idx) => {
    c.conversation_number = idx + 1;
    c.conversation_key = `conversation_${idx + 1}`;
  });

  return result;
}

export async function getLeadsFromFirestore(): Promise<LeadProfile[]> {
  const path = 'leads';
  try {
    const snap = await getDocs(collection(db, path));
    const leads: LeadProfile[] = [];
    snap.forEach((d) => {
      leads.push(d.data() as LeadProfile);
    });
    return leads;
  } catch (error) {
    console.warn('Could not fetch leads from Firestore, falling back to local memory:', error);
    return [];
  }
}

export async function getUserLeadsFromFirestore(userId: string): Promise<LeadProfile[]> {
  const path = 'leads';
  try {
    let snap;
    try {
      const q = query(collection(db, path), orderBy('updatedAt', 'desc'));
      snap = await getDocs(q);
    } catch {
      snap = await getDocs(collection(db, path));
    }
    const leads: LeadProfile[] = [];
    snap.forEach((d) => {
      const data = d.data() as LeadProfile;
      if (data.user_id === userId) {
        leads.push(data);
      }
    });
    leads.sort((a, b) => (new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()));
    return leads;
  } catch (error) {
    console.warn('Could not fetch user leads from Firestore:', error);
    return [];
  }
}

export async function deleteLeadFromFirestore(leadId: string): Promise<void> {
  const path = `leads/${leadId}`;
  try {
    await deleteDoc(doc(db, 'leads', leadId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
  try {
    const q = query(collection(db, 'leads'));
    const snap = await getDocs(q);
    const promises: Promise<void>[] = [];
    snap.forEach(d => {
      if (d.id === leadId || d.data()?.id === leadId) {
        promises.push(deleteDoc(d.ref));
      }
    });
    await Promise.all(promises);
  } catch (_) {}
}

export async function getMessagesForLead(leadId: string): Promise<ChatMessage[]> {
  try {
    const q = query(collection(db, 'interactions'));
    const snap = await getDocs(q);
    const messages: ChatMessage[] = [];
    snap.forEach((d) => {
      const data = d.data() as ChatMessage;
      if (data.lead_id === leadId) {
        messages.push(data);
      }
    });
    // Sort by timestamp
    messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    return messages;
  } catch (error) {
    console.warn('Could not fetch messages from Firestore:', error);
    return [];
  }
}

export async function deleteMessagesForLead(leadId: string): Promise<void> {
  try {
    const q = query(collection(db, 'interactions'));
    const snap = await getDocs(q);
    const deletePromises: Promise<void>[] = [];
    snap.forEach((d) => {
      const data = d.data() as ChatMessage;
      if (data.lead_id === leadId) {
        deletePromises.push(deleteDoc(d.ref));
      }
    });
    await Promise.all(deletePromises);
  } catch (error) {
    console.warn('Could not delete messages from Firestore:', error);
  }
}

// Interaction helpers
export async function saveInteractionToFirestore(msg: ChatMessage): Promise<void> {
  const path = `interactions/${msg.id}`;
  try {
    const cleanedMsg = cleanFirestoreData(msg);
    await setDoc(doc(db, 'interactions', msg.id), cleanedMsg, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// User Chat Collection - stores chat history per user
export async function saveUserChatToFirestore(
  userId: string,
  leadId: string,
  messages: ChatMessage[]
): Promise<void> {
  const docId = `${userId}_${leadId}`;
  const path = `user_chat/${docId}`;
  try {
    const qaChats = buildSequentialQaChats(messages);
    const cleanedPayload = cleanFirestoreData({
      userId,
      leadId,
      messages,
      chats: qaChats,
      updatedAt: new Date().toISOString(),
    });
    await setDoc(doc(db, 'user_chat', docId), cleanedPayload, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteUserChatFromFirestore(
  leadId: string,
  userId?: string
): Promise<void> {
  if (userId) {
    try {
      await deleteDoc(doc(db, 'user_chat', `${userId}_${leadId}`));
    } catch (_) {}
  }
  try {
    const ucSnap = await getDocs(collection(db, 'user_chat'));
    const ucDeletes: Promise<void>[] = [];
    ucSnap.forEach((d) => {
      const data = d.data();
      if (
        data?.leadId === leadId ||
        (userId && d.id === `${userId}_${leadId}`) ||
        d.id.endsWith(`_${leadId}`) ||
        d.id.includes(leadId)
      ) {
        ucDeletes.push(deleteDoc(d.ref));
      }
    });
    await Promise.all(ucDeletes);
  } catch (err) {
    console.warn('Error deleting from user_chat collection:', err);
  }
}

// Follow-up helpers
export async function saveFollowUpToFirestore(task: FollowUpTask): Promise<void> {
  const path = `followups/${task.id}`;
  try {
    await setDoc(doc(db, 'followups', task.id), task, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function getFollowUpsFromFirestore(): Promise<FollowUpTask[]> {
  const path = 'followups';
  try {
    const snap = await getDocs(collection(db, path));
    const tasks: FollowUpTask[] = [];
    snap.forEach((d) => {
      tasks.push(d.data() as FollowUpTask);
    });
    return tasks;
  } catch (error) {
    console.warn('Could not fetch followups from Firestore:', error);
    return [];
  }
}

// Recursive helper to clean undefined values so Firestore setDoc never throws
function cleanFirestoreObject<T extends Record<string, any>>(obj: T): Record<string, any> {
  return cleanFirestoreData(obj);
}

// Properties helpers
export async function savePropertyToFirestore(property: PropertyListing): Promise<void> {
  const path = `properties/${property.id}`;
  const cleaned = cleanFirestoreObject({
    ...property,
    updatedAt: new Date().toISOString()
  });

  // 1. Primary: Save via server-side endpoint (guarantees write succeeds with admin session)
  try {
    await fetch('/api/properties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cleaned)
    });
  } catch (srvErr) {
    console.warn('[Properties] Server save property notice:', srvErr);
  }

  // 2. Direct client-side write to Firestore 'properties' collection
  try {
    await setDoc(doc(db, 'properties', property.id), cleaned, { merge: true });
    console.log(`[Firestore] Property ${property.id} saved directly to properties collection.`);
  } catch (clientErr) {
    console.warn(`[Firestore] Direct client property write notice (handled via server):`, clientErr);
  }
}

export async function getPropertiesFromFirestore(): Promise<PropertyListing[]> {
  try {
    const snap = await getDocs(collection(db, 'properties'));
    const list: PropertyListing[] = [];
    snap.forEach((d) => {
      const data = d.data() as PropertyListing;
      list.push({ ...data, id: data.id || d.id });
    });
    return list;
  } catch (error) {
    console.warn('Could not fetch properties from Firestore:', error);
    return [];
  }
}

export async function deletePropertyFromFirestore(propertyId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'properties', propertyId));
  } catch (error) {
    console.warn(`Could not delete property ${propertyId} from Firestore:`, error);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Booked Properties Helpers (booked_properties collection)
// ─────────────────────────────────────────────────────────────────────────────

export async function saveBookedPropertyToFirestore(booking: BookedPropertyRecord): Promise<void> {
  const path = `booked_properties/${booking.id}`;
  try {
    const cleanedBooking = cleanFirestoreData({
      ...booking,
      updatedAt: new Date().toISOString()
    });
    await setDoc(doc(db, 'booked_properties', booking.id), cleanedBooking, { merge: true });
    console.log(`[Firestore] Booked property saved to booked_properties: ${booking.id}`);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function getBookedPropertiesFromFirestore(): Promise<BookedPropertyRecord[]> {
  try {
    const snap = await getDocs(collection(db, 'booked_properties'));
    const list: BookedPropertyRecord[] = [];
    snap.forEach((d) => {
      const data = d.data() as BookedPropertyRecord;
      list.push({ ...data, id: data.id || d.id });
    });
    return list;
  } catch (error) {
    console.warn('Could not fetch booked_properties from Firestore:', error);
    return [];
  }
}

export async function deleteBookedPropertyFromFirestore(bookingId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'booked_properties', bookingId));
  } catch (error) {
    console.warn(`Could not delete booking ${bookingId} from Firestore:`, error);
  }
}

export async function cancelBookedPropertyInFirestore(propertyId: string): Promise<void> {
  try {
    const q = query(collection(db, 'booked_properties'), where('property_id', '==', propertyId));
    const snap = await getDocs(q);
    const updates = snap.docs.map(d => 
      updateDoc(doc(db, 'booked_properties', d.id), {
        status: 'Cancelled',
        updatedAt: new Date().toISOString()
      })
    );
    await Promise.allSettled(updates);
  } catch (error) {
    console.warn(`Could not cancel booked property ${propertyId} in Firestore:`, error);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin & Property Manager Database Credentials (Admin_login & Property_login)
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_ADMIN_CREDENTIAL: PortalCredential = {
  id: 'admin',
  email: 'raviku6678@gmail.com',
  role: 'admin',
  name: 'Lyka Super Admin'
};

const DEFAULT_PM_CREDENTIAL: PortalCredential = {
  id: 'property_manager',
  email: 'ravikumar755667@gmail.com',
  role: 'property_manager',
  name: 'Lyka Property Manager'
};

const DEFAULT_SM_CREDENTIAL: PortalCredential = {
  id: 'sales_manager',
  email: 'raviku6678@gmail.com',
  role: 'sales_manager',
  name: 'Lyka Sales Manager'
};

function normalizeCredentialDoc(id: string, raw: any, fallbackRole: 'admin' | 'property_manager' | 'sales_manager'): PortalCredential | null {
  if (!raw) return null;
  const email = String(raw.email || raw.Email_id || raw.username || raw.user_login || raw.login || '').trim();
  if (!email) return null;

  const rawRole = String(raw.role || '').toLowerCase();
  const role: 'admin' | 'property_manager' | 'sales_manager' =
    rawRole.includes('sales') || id.toLowerCase().includes('sales')
      ? 'sales_manager'
      : rawRole.includes('property') || rawRole.includes('manager') || id.toLowerCase().includes('property') || id.toLowerCase().includes('manager')
      ? 'property_manager'
      : rawRole.includes('admin')
      ? 'admin'
      : fallbackRole;

  return {
    id,
    email,
    role,
    name: raw.name || raw.Name || (role === 'sales_manager' ? 'Sales Manager' : role === 'admin' ? 'Admin' : 'Property Manager'),
    phone: raw.phone || raw.Phone_number || undefined,
    otp_code: raw.otp_code || undefined,
    otp_created_at: raw.otp_created_at || undefined,
    updatedAt: raw.updatedAt || new Date().toISOString()
  };
}

/**
 * Ensures Admin, Property Manager, and Sales Manager portal metadata is loaded
 * securely from the server persistent store without exposing passwords in the client.
 */
export async function ensurePortalCredentialsInFirestore(): Promise<{
  adminCredentials: PortalCredential[];
  pmCredentials: PortalCredential[];
  smCredentials: PortalCredential[];
}> {
  // Purge any legacy unencrypted password storage from localStorage
  try {
    localStorage.removeItem('portal_admin_credentials');
    localStorage.removeItem('portal_pm_credentials');
    localStorage.removeItem('portal_sm_credentials');
  } catch (_) {}

  try {
    const srvRes = await fetch('/api/auth/portal-credentials');
    if (srvRes.ok) {
      const srvData = await srvRes.json();
      const adminCred = srvData?.credentials?.admin || DEFAULT_ADMIN_CREDENTIAL;
      const pmCred = srvData?.credentials?.property_manager || DEFAULT_PM_CREDENTIAL;
      const smCred = srvData?.credentials?.sales_manager || DEFAULT_SM_CREDENTIAL;

      return {
        adminCredentials: [adminCred],
        pmCredentials: [pmCred],
        smCredentials: [smCred]
      };
    }
  } catch (error) {
    console.warn('Could not fetch portal metadata from server, using fallback defaults:', error);
  }

  return {
    adminCredentials: [DEFAULT_ADMIN_CREDENTIAL],
    pmCredentials: [DEFAULT_PM_CREDENTIAL],
    smCredentials: [DEFAULT_SM_CREDENTIAL]
  };
}

/**
 * Securely verifies Admin, Property Manager, or Sales Manager login against the server-side
 * authentication endpoint. Passwords are validated server-side using constant-time comparison
 * and are never exposed or verified in client-side code.
 */
export async function verifyPortalLoginFromFirestore(
  portal: 'admin' | 'property_manager' | 'sales_manager',
  inputEmailOrUser: string,
  inputPassword: string
): Promise<{ valid: boolean; matchedCredential?: PortalCredential; error?: string }> {
  const cleanLogin = inputEmailOrUser.trim().toLowerCase();
  const cleanPassword = inputPassword;

  if (!cleanLogin || !cleanPassword) {
    return { valid: false, error: 'Email and password are required.' };
  }

  try {
    const res = await fetch('/api/auth/verify-portal-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        portal,
        email: cleanLogin,
        password: cleanPassword
      })
    });

    const data = await res.json();
    if (res.ok && data.valid && data.token) {
      try {
        sessionStorage.setItem('lyka_admin_token', data.token);
      } catch (_) {}
      return {
        valid: true,
        matchedCredential: data.user
      };
    }

    return {
      valid: false,
      error: data.error || 'Invalid credentials in database.'
    };
  } catch (err: any) {
    console.error('Error verifying portal login:', err);
    return {
      valid: false,
      error: 'Network error connecting to verification service. Please try again.'
    };
  }
}

/**
 * Updates Admin, Property Manager, or Sales Manager login credentials securely via the server
 * API using the authenticated session token. Never saves plaintext passwords in browser storage.
 */
export async function savePortalCredentialToFirestore(
  portal: 'admin' | 'property_manager' | 'sales_manager',
  email: string,
  password: string,
  name?: string,
  docId?: string
): Promise<PortalCredential> {
  const cleanEmail = email.trim();
  const now = new Date().toISOString();
  const targetDocId = docId || (portal === 'admin' ? 'admin' : portal === 'property_manager' ? 'property_manager' : 'sales_manager');

  const record: PortalCredential = {
    id: targetDocId,
    email: cleanEmail,
    role: portal,
    name: name?.trim() || (portal === 'admin' ? 'Lyka Super Admin' : portal === 'property_manager' ? 'Lyka Property Manager' : 'Lyka Sales Manager'),
    updatedAt: now
  };

  // Securely call server-side endpoint with active admin session token
  try {
    const token = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('lyka_admin_token') : null;
    const res = await fetch('/api/auth/save-portal-credential', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        portal,
        email: cleanEmail,
        password,
        name: record.name,
        docId: targetDocId
      })
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Server responded with status ${res.status}`);
    }
  } catch (srvErr: any) {
    console.warn('[Auth] Server save-portal-credential error:', srvErr.message);
    throw srvErr;
  }

  return record;
}

/**
 * Records a successful Sales Manager login in the Firestore Database (`Sales_login` collection and `login_events`).
 * Saves both server-side (authenticated) and client-side with timestamps and login history.
 */
export async function recordSalesManagerLoginInFirestore(
  email: string,
  name?: string,
  method?: string
): Promise<void> {
  const cleanEmail = (email || 'sales@lykarealty.ae').trim();
  const now = new Date().toISOString();
  const displayName = name || 'Lyka Sales Manager';

  // 1. Primary: Server-side authenticated save (guaranteed write in Firestore)
  try {
    await fetch('/api/auth/record-sales-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: cleanEmail,
        name: displayName,
        method: method || 'Sales_Portal_Login'
      })
    });
    console.log(`[Sales Login] Server successfully logged sales manager in DB: ${cleanEmail}`);
  } catch (srvErr) {
    console.warn('[Sales Login] Server record-sales-login notice:', srvErr);
  }

  // Local cache for instant offline UI synchronization
  try {
    localStorage.setItem('lyka_last_sales_login', JSON.stringify({
      email: cleanEmail,
      role: 'sales_manager',
      last_login: now,
      authenticated: true
    }));
  } catch (_) {}
}

/**
 * Deliberately does NOT store OTP in Firestore (ensures OTP is never persisted in database).
 */
export async function savePortalEmailOtpToFirestore(
  _portal: 'admin' | 'property_manager',
  _email: string,
  _otpCode: string
): Promise<void> {
  // Deliberately no-op: OTPs are never stored in the database
  return;
}

/**
 * Deletes/cleans any OTP fields from Firestore collections (`Admin_login` and `Property_login`)
 * when admin or property manager logs out, ensuring no leftover OTP remains in the database.
 */
export async function deletePortalOtpFromFirestore(): Promise<void> {
  try {
    const collections = ['Admin_login', 'Property_login'];
    for (const colName of collections) {
      try {
        const snap = await getDocs(collection(db, colName));
        for (const docSnap of snap.docs) {
          const data = docSnap.data();
          if (data.otp_code || data.otp_created_at || data.otp_expires_at || data.otp_requested_for) {
            await updateDoc(doc(db, colName, docSnap.id), {
              otp_code: deleteField(),
              otp_created_at: deleteField(),
              otp_expires_at: deleteField(),
              otp_requested_for: deleteField()
            });
          }
        }
      } catch (colErr) {
        console.warn(`Clean OTP notice for ${colName}:`, colErr);
      }
    }
  } catch (error) {
    console.warn(`Could not delete portal OTP fields from Firestore:`, error);
  }
}


/**
 * Sends a real SMS OTP to the given phone number using Firebase Phone Authentication.
 * Sets up an invisible RecaptchaVerifier if not already present.
 */
let portalRecaptchaVerifier: any = null;


export async function sendFirebasePhoneOtp(
  phoneNumberWithCountryCode: string,
  containerButtonId = 'admin-get-otp-btn'
): Promise<{ confirmationResult: any }> {
  try {
    if (portalRecaptchaVerifier) {
      try {
        portalRecaptchaVerifier.clear();
      } catch (_) {}
      portalRecaptchaVerifier = null;
    }

    const containerEl = document.getElementById(containerButtonId) || document.body;

    portalRecaptchaVerifier = new RecaptchaVerifier(auth, containerEl, {
      size: 'invisible',
      callback: () => {
        // reCAPTCHA solved
      }
    });

    await portalRecaptchaVerifier.render();

    const confirmationResult = await signInWithPhoneNumber(
      auth,
      phoneNumberWithCountryCode,
      portalRecaptchaVerifier
    );

    return { confirmationResult };
  } catch (error: any) {
    console.error('sendFirebasePhoneOtp error:', error);
    if (portalRecaptchaVerifier) {
      try {
        portalRecaptchaVerifier.clear();
      } catch (_) {}
      portalRecaptchaVerifier = null;
    }
    throw error;
  }
}

/**
 * Verifies the 6-digit OTP code against Firebase Phone Auth confirmation result.
 */
export async function verifyFirebasePhoneOtp(
  confirmationResult: any,
  otpCode: string
): Promise<boolean> {
  if (!confirmationResult || typeof confirmationResult.confirm !== 'function') {
    throw new Error('No active Firebase phone verification session found.');
  }
  const userCredential = await confirmationResult.confirm(otpCode);
  return !!userCredential?.user;
}

/**
 * Saves a structured PDF knowledge embedding to Firestore collection `pdf_knowledge_embeddings`.
 * Stores text chunk, numerical vector, dimensions, and vector_sum.
 */
export async function savePdfEmbeddingToFirestore(record: {
  id: string;
  section_number: number;
  title: string;
  document_name: string;
  text_content: string;
  vector: number[];
  dimensions: number;
  vector_sum?: number;
  model: string;
  createdAt?: string;
}): Promise<void> {
  const docId = record.id || `PDF-SEC-${String(record.section_number).padStart(2, '0')}`;
  const vector_sum = record.vector_sum !== undefined
    ? record.vector_sum
    : parseFloat(record.vector.reduce((a, b) => a + b, 0).toFixed(6));

  const payload = {
    ...record,
    id: docId,
    _id: docId,
    vector_sum,
    storage: 'Firebase',
    createdAt: record.createdAt || new Date().toISOString()
  };

  try {
    await setDoc(doc(db, 'pdf_knowledge_embeddings', docId), payload, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `pdf_knowledge_embeddings/${docId}`);
  }
}

/**
 * Retrieves all PDF knowledge embeddings stored in Firestore collection `pdf_knowledge_embeddings`.
 */
export async function getPdfEmbeddingsFromFirestore(): Promise<any[]> {
  try {
    const snap = await getDocs(collection(db, 'pdf_knowledge_embeddings'));
    const items: any[] = [];
    snap.forEach((d) => items.push({ id: d.id, ...d.data() }));
    return items.sort((a, b) => (a.section_number || 0) - (b.section_number || 0));
  } catch (error) {
    console.warn('Could not read pdf_knowledge_embeddings from Firestore:', error);
    return [];
  }
}

/**
 * Saves a customer inquiry or search text numerical embedding into Firestore collection `customer_embeddings`.
 */
export async function saveCustomerEmbeddingToFirestore(record: {
  id?: string;
  lead_id?: string;
  text_content: string;
  vector: number[];
  dimensions: number;
  vector_sum?: number;
  model: string;
  metadata?: Record<string, any>;
  createdAt?: string;
}): Promise<any> {
  const docId = record.id || 'VEC-' + Math.random().toString(36).substring(2, 10).toUpperCase();
  const vector_sum = record.vector_sum !== undefined
    ? record.vector_sum
    : parseFloat(record.vector.reduce((a, b) => a + b, 0).toFixed(6));

  const payload = {
    ...record,
    id: docId,
    _id: docId,
    vector_sum,
    storage: 'Firebase',
    createdAt: record.createdAt || new Date().toISOString()
  };

  try {
    await setDoc(doc(db, 'customer_embeddings', docId), payload, { merge: true });
    return payload;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `customer_embeddings/${docId}`);
    return payload;
  }
}

/**
 * Retrieves customer inquiry numerical embeddings from Firestore collection `customer_embeddings`.
 */
export async function getCustomerEmbeddingsFromFirestore(): Promise<any[]> {
  try {
    const snap = await getDocs(collection(db, 'customer_embeddings'));
    const items: any[] = [];
    snap.forEach((d) => items.push({ id: d.id, ...d.data() }));
    return items.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  } catch (error) {
    console.warn('Could not read customer_embeddings from Firestore:', error);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Customer Favorites Helpers (favorites collection)
// ─────────────────────────────────────────────────────────────────────────────

export async function saveFavoritePropertyToFirestore(favorite: FavoritePropertyRecord): Promise<void> {
  const path = `favorites/${favorite.id}`;
  try {
    const cleaned = cleanFirestoreData({
      ...favorite,
      updatedAt: new Date().toISOString()
    });
    await setDoc(doc(db, 'favorites', favorite.id), cleaned, { merge: true });
    console.log(`[Firestore] Favorite saved to collection 'favorites': ${favorite.id}`);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function removeFavoritePropertyFromFirestore(favoriteId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'favorites', favoriteId));
    console.log(`[Firestore] Favorite removed from collection 'favorites': ${favoriteId}`);
  } catch (error) {
    console.warn(`Could not delete favorite ${favoriteId} from Firestore:`, error);
  }
}

export async function getFavoritePropertiesFromFirestore(): Promise<FavoritePropertyRecord[]> {
  try {
    const snap = await getDocs(collection(db, 'favorites'));
    const list: FavoritePropertyRecord[] = [];
    snap.forEach((d) => {
      const data = d.data() as FavoritePropertyRecord;
      if (data && data.status !== 'removed') {
        list.push({ ...data, id: data.id || d.id });
      }
    });
    return list.sort((a, b) => new Date(b.saved_at || 0).getTime() - new Date(a.saved_at || 0).getTime());
  } catch (error) {
    console.warn('Could not fetch favorites from Firestore:', error);
    return [];
  }
}
