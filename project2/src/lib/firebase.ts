import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
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
import { OperationType, FirestoreErrorInfo, LeadProfile, ChatMessage, FollowUpTask, PropertyListing } from '../types/crm';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
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

// User Logins helper
export async function saveUserLoginToFirestore(
  userId: string, 
  email: string, 
  fullName: string, 
  authProvider: string,
  age?: number
): Promise<void> {
  const docId = email || userId;
  const path = `User_login/${docId}`;
  try {
    const data: any = {
      uid: userId,
      Email_id: email,
      Name: fullName,
      auth_provider: authProvider,
      last_login: new Date().toISOString(),
    };
    if (age) {
      data.Age = age;
    }
    // Initialize User_chat as empty object so chat messages have a persistence target
    data.User_chat = {};
    
    await setDoc(doc(db, 'User_login', docId), data, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteUserLoginFromFirestore(userId: string, email?: string): Promise<void> {
  const docId = email || userId;
  const path = `User_login/${docId}`;
  try {
    await deleteDoc(doc(db, 'User_login', docId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function syncSessionToUserProfile(email: string | null, userId: string, lead: LeadProfile, msgs: ChatMessage[]): Promise<void> {
  const docId = email || userId;
  if (!docId) return;
  try {
    await setDoc(doc(db, 'User_login', docId), {
      User_chat: {
        [lead.id]: {
          leadProfile: lead,
          messages: msgs
        }
      }
    }, { merge: true });
  } catch (error) {
    console.warn('Failed to sync chat history JSON to user profile', error);
  }
}

export async function deleteSessionFromUserProfile(email: string | null, userId: string, leadId: string): Promise<void> {
  const docId = email || userId;
  if (!docId) return;
  try {
    await updateDoc(doc(db, 'User_login', docId), {
      [`User_chat.${leadId}`]: deleteField()
    });
  } catch (error) {
    console.warn('Failed to delete chat history JSON from user profile', error);
  }
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
    const q = query(collection(db, path), orderBy('updatedAt', 'desc'));
    const snap = await getDocs(q);
    const leads: LeadProfile[] = [];
    snap.forEach((d) => {
      const data = d.data() as LeadProfile;
      if (data.user_id === userId) {
        leads.push(data);
      }
    });
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
