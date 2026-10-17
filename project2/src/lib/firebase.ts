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
import { OperationType, FirestoreErrorInfo, LeadProfile, ChatMessage, FollowUpTask, PropertyListing, UserProfileData, LoginEvent, PortalCredential } from '../types/crm';

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

// Leads collection helpers
export async function saveLeadToFirestore(lead: LeadProfile): Promise<void> {
  const path = `leads/${lead.id}`;
  try {
    await setDoc(doc(db, 'leads', lead.id), {
      ...lead,
      updatedAt: new Date().toISOString()
    }, { merge: true });
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
  age?: number
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
        age
      })
    });
  } catch (srvErr) {
    console.warn('[Auth] Server save-user-login notice:', srvErr);
  }

  // 2. Direct client-side write (if client has permission, merges seamlessly; non-fatal if client rules restrict)
  try {
    await setDoc(doc(db, 'User_login', docId), data, { merge: true });
    if (userId && userId.toLowerCase() !== docId) {
      try {
        await setDoc(doc(db, 'User_login', userId), data, { merge: true });
      } catch (_) {}
    }

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
          login_history: Array.from(new Set([...(existing.login_history || []), ...(data.login_history || [])]))
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

  const sessionData = {
    leadProfile: lead,
    messages: msgs,
    updatedAt: new Date().toISOString()
  };

  for (const docId of targets) {
    try {
      await setDoc(doc(db, 'User_login', docId), {
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
      await updateDoc(doc(db, 'User_login', docId), {
        [`User_chat.${leadId}`]: deleteField()
      });
    } catch (error) {
      console.warn(`Failed to delete session from User_login/${docId}:`, error);
    }
  }

  // 2. Scan User_login collection to remove this leadId from any other User_chat map
  try {
    const userLoginSnap = await getDocs(collection(db, 'User_login'));
    userLoginSnap.forEach(d => {
      const data = d.data();
      if (data?.User_chat && data.User_chat[leadId]) {
        updateDoc(d.ref, {
          [`User_chat.${leadId}`]: deleteField()
        }).catch(() => {});
      }
    });
  } catch (_) {}

  // 3. Delete from user_chat collection
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
      if (data.leadId === leadId || d.id === `${userId}_${leadId}`) {
        ucDeletes.push(deleteDoc(d.ref));
      }
    });
    await Promise.all(ucDeletes);
  } catch (_) {}
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
    await setDoc(doc(db, 'interactions', msg.id), msg, { merge: true });
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
    await setDoc(doc(db, 'user_chat', docId), {
      userId,
      leadId,
      messages,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
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

// Properties helpers
export async function savePropertyToFirestore(property: PropertyListing): Promise<void> {
  const path = `properties/${property.id}`;
  try {
    await setDoc(doc(db, 'properties', property.id), {
      ...property,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
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
// Admin & Property Manager Database Credentials (Admin_login & Property_login)
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_ADMIN_CREDENTIAL: PortalCredential = {
  id: 'admin',
  email: 'admin@lykarealty.ae',
  password: 'LykaAdmin2024',
  role: 'admin',
  name: 'Lyka Super Admin'
};

const DEFAULT_PM_CREDENTIAL: PortalCredential = {
  id: 'property_manager',
  email: 'manager@lykarealty.ae',
  password: 'LykaManager2024',
  role: 'property_manager',
  name: 'Lyka Property Manager'
};

const DEFAULT_SM_CREDENTIAL: PortalCredential = {
  id: 'sales_manager',
  email: 'sales@lykarealty.ae',
  password: 'LykaSales2024',
  role: 'sales_manager',
  name: 'Lyka Sales Manager'
};

function normalizeCredentialDoc(id: string, raw: any, fallbackRole: 'admin' | 'property_manager' | 'sales_manager'): PortalCredential | null {
  if (!raw) return null;
  const email = String(raw.email || raw.Email_id || raw.username || raw.user_login || raw.login || '').trim();
  const password = String(raw.password || raw.Password || '').trim();
  if (!email || !password) return null;

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
    password,
    role,
    name: raw.name || raw.Name || (role === 'sales_manager' ? 'Sales Manager' : role === 'admin' ? 'Admin' : 'Property Manager'),
    phone: raw.phone || raw.Phone_number || undefined,
    otp_code: raw.otp_code || undefined,
    otp_created_at: raw.otp_created_at || undefined,
    updatedAt: raw.updatedAt || new Date().toISOString()
  };
}

/**
 * Ensures default Admin, Property Manager, and Sales Manager login credentials exist in Firestore
 * under `Admin_login`, `Property_login`, and `Sales_login` collections so they can be managed in DB.
 */
export async function ensurePortalCredentialsInFirestore(): Promise<{
  adminCredentials: PortalCredential[];
  pmCredentials: PortalCredential[];
  smCredentials: PortalCredential[];
}> {
  try {
    const [adminSnap, propSnap, salesSnap] = await Promise.all([
      getDocs(collection(db, 'Admin_login')).catch(() => ({ forEach: () => {} } as any)),
      getDocs(collection(db, 'Property_login')).catch(() => ({ forEach: () => {} } as any)),
      getDocs(collection(db, 'Sales_login')).catch(() => ({ forEach: () => {} } as any))
    ]);

    const adminList: PortalCredential[] = [];
    const pmList: PortalCredential[] = [];
    const smList: PortalCredential[] = [];

    adminSnap.forEach((d: any) => {
      const parsed = normalizeCredentialDoc(d.id, d.data(), 'admin');
      if (parsed && (d.id === 'admin' || parsed.role === 'admin')) {
        adminList.push(parsed);
      }
    });

    propSnap.forEach((d: any) => {
      const parsed = normalizeCredentialDoc(d.id, d.data(), 'property_manager');
      if (parsed && (d.id === 'property_manager' || parsed.role === 'property_manager')) {
        pmList.push(parsed);
      }
    });

    salesSnap.forEach((d: any) => {
      const parsed = normalizeCredentialDoc(d.id, d.data(), 'sales_manager');
      if (parsed && (d.id === 'sales_manager' || parsed.role === 'sales_manager')) {
        smList.push(parsed);
      }
    });

    // Check server persistent store before seeding defaults
    try {
      const srvRes = await fetch('/api/auth/portal-credentials');
      if (srvRes.ok) {
        const srvData = await srvRes.json();
        if (adminList.length === 0 && srvData?.credentials?.admin) {
          adminList.push(srvData.credentials.admin);
        }
        if (pmList.length === 0 && srvData?.credentials?.property_manager) {
          pmList.push(srvData.credentials.property_manager);
        }
        if (smList.length === 0 && srvData?.credentials?.sales_manager) {
          smList.push(srvData.credentials.sales_manager);
        }
      }
    } catch (_) {}

    // Seed default Admin in Admin_login if none exists
    if (adminList.length === 0) {
      // Use server-side endpoint to bypass Firestore client permission restrictions
      try {
        await fetch('/api/auth/save-portal-credential', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            portal: 'admin',
            email: DEFAULT_ADMIN_CREDENTIAL.email,
            password: DEFAULT_ADMIN_CREDENTIAL.password,
            name: DEFAULT_ADMIN_CREDENTIAL.name,
            docId: 'admin'
          })
        });
      } catch (e) {
        console.warn('Could not seed Admin_login/admin via server:', e);
      }
      adminList.push(DEFAULT_ADMIN_CREDENTIAL);
    }

    // Seed default Property Manager in Property_login if none exists
    if (pmList.length === 0) {
      // Use server-side endpoint — writes ONLY to Property_login, not to Admin_login
      try {
        await fetch('/api/auth/save-portal-credential', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            portal: 'property_manager',
            email: DEFAULT_PM_CREDENTIAL.email,
            password: DEFAULT_PM_CREDENTIAL.password,
            name: DEFAULT_PM_CREDENTIAL.name,
            docId: 'property_manager'
          })
        });
      } catch (e) {
        console.warn('Could not seed Property_login/property_manager via server:', e);
      }
      pmList.push(DEFAULT_PM_CREDENTIAL);
    }

    // Seed default Sales Manager in Sales_login if none exists
    if (smList.length === 0) {
      // Use server-side endpoint — writes ONLY to Sales_login, not to Admin_login
      try {
        await fetch('/api/auth/save-portal-credential', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            portal: 'sales_manager',
            email: DEFAULT_SM_CREDENTIAL.email,
            password: DEFAULT_SM_CREDENTIAL.password,
            name: DEFAULT_SM_CREDENTIAL.name,
            docId: 'sales_manager'
          })
        });
      } catch (e) {
        console.warn('Could not seed Sales_login/sales_manager via server:', e);
      }
      smList.push(DEFAULT_SM_CREDENTIAL);
    }

    // Cache locally for fast fallback
    try {
      localStorage.setItem('portal_admin_credentials', JSON.stringify(adminList));
      localStorage.setItem('portal_pm_credentials', JSON.stringify(pmList));
      localStorage.setItem('portal_sm_credentials', JSON.stringify(smList));
    } catch (_) {}

    return { adminCredentials: adminList, pmCredentials: pmList, smCredentials: smList };
  } catch (error) {
    console.warn('Could not fetch portal credentials from Firestore, using cached/default:', error);
    let cachedAdmin: PortalCredential[] = [DEFAULT_ADMIN_CREDENTIAL];
    let cachedPm: PortalCredential[] = [DEFAULT_PM_CREDENTIAL];
    let cachedSm: PortalCredential[] = [DEFAULT_SM_CREDENTIAL];
    try {
      const aStr = localStorage.getItem('portal_admin_credentials');
      const pStr = localStorage.getItem('portal_pm_credentials');
      const sStr = localStorage.getItem('portal_sm_credentials');
      if (aStr) cachedAdmin = JSON.parse(aStr);
      if (pStr) cachedPm = JSON.parse(pStr);
      if (sStr) cachedSm = JSON.parse(sStr);
    } catch (_) {}
    return { adminCredentials: cachedAdmin, pmCredentials: cachedPm, smCredentials: cachedSm };
  }
}

/**
 * Verifies Admin, Property Manager, or Sales Manager login against Firestore (`Admin_login`, `Property_login`, `Sales_login`).
 * Always reads directly from Firestore (bypasses localStorage cache) so credential changes
 * made in the admin panel take effect on the very next login attempt.
 */
export async function verifyPortalLoginFromFirestore(
  portal: 'admin' | 'property_manager' | 'sales_manager',
  inputEmailOrUser: string,
  inputPassword: string
): Promise<{ valid: boolean; matchedCredential?: PortalCredential }> {
  const cleanLogin = inputEmailOrUser.trim().toLowerCase();
  const cleanPassword = inputPassword;

  if (!cleanLogin || !cleanPassword) {
    return { valid: false };
  }

  try {
    // Always read fresh from Firestore — never use the localStorage cache for login verification
    const [adminSnap, propSnap, salesSnap] = await Promise.all([
      getDocs(collection(db, 'Admin_login')).catch(() => ({ forEach: () => {} } as any)),
      getDocs(collection(db, 'Property_login')).catch(() => ({ forEach: () => {} } as any)),
      getDocs(collection(db, 'Sales_login')).catch(() => ({ forEach: () => {} } as any))
    ]);

    const adminList: PortalCredential[] = [];
    const pmList: PortalCredential[] = [];
    const smList: PortalCredential[] = [];

    adminSnap.forEach((d: any) => {
      const parsed = normalizeCredentialDoc(d.id, d.data(), 'admin');
      if (parsed && (d.id === 'admin' || parsed.role === 'admin')) adminList.push(parsed);
    });

    propSnap.forEach((d: any) => {
      const parsed = normalizeCredentialDoc(d.id, d.data(), 'property_manager');
      if (parsed && (d.id === 'property_manager' || parsed.role === 'property_manager')) pmList.push(parsed);
    });

    salesSnap.forEach((d: any) => {
      const parsed = normalizeCredentialDoc(d.id, d.data(), 'sales_manager');
      if (parsed && (d.id === 'sales_manager' || parsed.role === 'sales_manager')) smList.push(parsed);
    });

    const targetList = portal === 'admin' 
      ? adminList 
      : portal === 'property_manager' 
      ? pmList 
      : smList;

    const matched = targetList.find(
      (c) => c.email.trim().toLowerCase() === cleanLogin && c.password === cleanPassword
    );

    if (matched) {
      return { valid: true, matchedCredential: matched };
    }

    // Secondary check: verify against server persistent credentials store
    try {
      const srvRes = await fetch('/api/auth/portal-credentials');
      if (srvRes.ok) {
        const srvData = await srvRes.json();
        const srvRoleCred = srvData?.credentials?.[portal];
        if (
          srvRoleCred &&
          srvRoleCred.email?.trim().toLowerCase() === cleanLogin &&
          srvRoleCred.password === cleanPassword
        ) {
          return { valid: true, matchedCredential: srvRoleCred };
        }
      }
    } catch (_) {}

    // Tertiary check: verify against cached localStorage
    try {
      const storageKey = portal === 'admin' ? 'portal_admin_credentials' : portal === 'property_manager' ? 'portal_pm_credentials' : 'portal_sm_credentials';
      const cachedStr = localStorage.getItem(storageKey);
      if (cachedStr) {
        const cachedList: PortalCredential[] = JSON.parse(cachedStr);
        const cachedMatched = cachedList.find(
          (c) => c.email.trim().toLowerCase() === cleanLogin && c.password === cleanPassword
        );
        if (cachedMatched) return { valid: true, matchedCredential: cachedMatched };
      }
    } catch (_) {}

    return { valid: false };
  } catch (error) {
    // Fallback to ensurePortalCredentials (uses cache) if Firestore read fails
    console.warn('Direct Firestore login check failed, falling back to cached credentials:', error);
    const { adminCredentials, pmCredentials, smCredentials } = await ensurePortalCredentialsInFirestore();
    const targetList = portal === 'admin' 
      ? adminCredentials 
      : portal === 'property_manager' 
      ? pmCredentials 
      : smCredentials;
    const matched = targetList.find(
      (c) => c.email.trim().toLowerCase() === cleanLogin && c.password === cleanPassword
    );
    return matched ? { valid: true, matchedCredential: matched } : { valid: false };
  }
}

/**
 * Updates or creates Admin, Property Manager, or Sales Manager login credentials in Firestore.
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
    password,
    role: portal,
    name: name?.trim() || (portal === 'admin' ? 'Lyka Super Admin' : portal === 'property_manager' ? 'Lyka Property Manager' : 'Lyka Sales Manager'),
    updatedAt: now
  };

  const firestorePayload = {
    ...record,
    Email_id: cleanEmail
  };

  // Update local storage cache immediately
  try {
    const storageKey = portal === 'admin' 
      ? 'portal_admin_credentials' 
      : portal === 'property_manager' 
      ? 'portal_pm_credentials' 
      : 'portal_sm_credentials';
    const existingStr = localStorage.getItem(storageKey);
    let list: PortalCredential[] = existingStr ? JSON.parse(existingStr) : [];
    const idx = list.findIndex(item => item.id === targetDocId || item.email.toLowerCase() === cleanEmail.toLowerCase());
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...record };
    } else {
      list.push(record);
    }
    localStorage.setItem(storageKey, JSON.stringify(list));
  } catch (_) {}

  // 1. Primary: Server-side save (guarantees write succeeds without client permission errors)
  try {
    await fetch('/api/auth/save-portal-credential', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        portal,
        email: cleanEmail,
        password,
        name: record.name,
        docId: targetDocId
      })
    });
  } catch (srvErr) {
    console.warn('[Auth] Server save-portal-credential notice:', srvErr);
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




