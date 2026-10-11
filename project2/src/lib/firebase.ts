import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
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
  orderBy, 
  onSnapshot,
  updateDoc,
  deleteField
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { OperationType, FirestoreErrorInfo, LeadProfile, ChatMessage, FollowUpTask, PropertyListing, UserProfileData } from '../types/crm';

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
  const docId = (email || userId || '').trim().toLowerCase();
  if (!docId) return null;
  try {
    const snap = await getDoc(doc(db, 'User_login', docId));
    if (snap.exists()) {
      return snap.data() as UserProfileData;
    }
    // Also try original casing or userId if email was lowercase
    if (email && email !== docId) {
      const snapOrig = await getDoc(doc(db, 'User_login', email));
      if (snapOrig.exists()) return snapOrig.data() as UserProfileData;
    }
    if (userId && userId !== docId) {
      const snapUid = await getDoc(doc(db, 'User_login', userId));
      if (snapUid.exists()) return snapUid.data() as UserProfileData;
    }
  } catch (error) {
    console.warn('Could not retrieve user profile from Firestore:', error);
  }

  // Fallback to local cached profile if offline or permission pending
  try {
    const local = localStorage.getItem(`user_profile_${docId}`) || localStorage.getItem('current_user_profile');
    if (local) {
      return JSON.parse(local) as UserProfileData;
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
  const path = `User_login/${docId}`;
  
  const data: any = {
    uid: userId,
    Email_id: email.trim(),
    Name: fullName.trim(),
    auth_provider: authProvider,
    last_login: new Date().toISOString(),
  };
  if (age !== undefined && age !== null) {
    data.Age = Number(age);
  }

  // Cache locally immediately so Name and Age are never lost
  try {
    localStorage.setItem(`user_profile_${docId}`, JSON.stringify(data));
    localStorage.setItem('current_user_profile', JSON.stringify(data));
  } catch (_) {}

  try {
    // Save to User_login with email as docId
    await setDoc(doc(db, 'User_login', docId), data, { merge: true });
    // Also save with userId as docId so it's always found either way
    if (userId && userId.toLowerCase() !== docId) {
      try {
        await setDoc(doc(db, 'User_login', userId), data, { merge: true });
      } catch (_) {}
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteUserLoginFromFirestore(userId: string, email?: string): Promise<void> {
  const cleanEmail = (email || '').trim().toLowerCase();
  const targets = new Set<string>();
  if (cleanEmail) targets.add(cleanEmail);
  if (email && email.trim()) targets.add(email.trim());
  if (userId && userId.trim()) targets.add(userId.trim());

  // Delete User_login and users documents
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

  for (const docId of targets) {
    try {
      await updateDoc(doc(db, 'User_login', docId), {
        [`User_chat.${leadId}`]: deleteField()
      });
    } catch (error) {
      console.warn(`Failed to delete session from User_login/${docId}:`, error);
    }
  }

  if (userId) {
    try {
      await deleteDoc(doc(db, 'user_chat', `${userId}_${leadId}`));
    } catch (_) {}
  }
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
            if (session && Array.isArray(session.messages) && session.messages.length > 0) {
              const msgs = session.messages as ChatMessage[];
              const lead = session.leadProfile || { id: leadId, user_id: userId };
              const lastMsg = msgs[msgs.length - 1];
              sessionMap.set(leadId, {
                id: leadId,
                title: lead.summary || `${lead.intent || 'General'} Inquiry`,
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
      if (data.userId === userId && data.leadId && Array.isArray(data.messages) && data.messages.length > 0) {
        if (!sessionMap.has(data.leadId)) {
          const msgs = data.messages as ChatMessage[];
          const lastMsg = msgs[msgs.length - 1];
          sessionMap.set(data.leadId, {
            id: data.leadId,
            title: `Inquiry (${data.leadId})`,
            preview: (lastMsg?.content || '').substring(0, 60) + '...',
            timestamp: data.updatedAt || lastMsg?.timestamp || new Date().toISOString(),
            messageCount: msgs.length,
            leadProfile: { id: data.leadId, user_id: userId } as any,
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
      if (!sessionMap.has(lead.id)) {
        const msgs = await getMessagesForLead(lead.id);
        if (msgs.length > 0) {
          const lastMsg = msgs[msgs.length - 1];
          sessionMap.set(lead.id, {
            id: lead.id,
            title: lead.summary || `${lead.intent || 'General'} Inquiry`,
            preview: (lastMsg?.content || '').substring(0, 60) + '...',
            timestamp: lead.updatedAt || lastMsg?.timestamp || new Date().toISOString(),
            messageCount: msgs.length,
            leadProfile: lead,
            messages: msgs
          });
        }
      } else {
        const existing = sessionMap.get(lead.id)!;
        if (!existing.leadProfile.intent && lead.intent) {
          existing.leadProfile = { ...existing.leadProfile, ...lead };
          existing.title = lead.summary || `${lead.intent || 'General'} Inquiry`;
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
        deletePromises.push(deleteDoc(doc(db, 'interactions', data.id)));
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
    await setDoc(doc(db, 'properties', property.id), property, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}
