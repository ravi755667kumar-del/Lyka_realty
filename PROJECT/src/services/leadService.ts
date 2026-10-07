import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { handleFirestoreError, OperationType } from '../firebase/errors';
import { Lead, LeadOutcome, LeadStatus, CallRecord } from '../types';

const LEADS_COLLECTION = 'leads';
const CALLS_COLLECTION = 'calls';

export function subscribeToLeads(
  onUpdate: (leads: Lead[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const q = query(collection(db, LEADS_COLLECTION), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const leads: Lead[] = [];
      snapshot.forEach((docSnap) => {
        leads.push({ id: docSnap.id, ...(docSnap.data() as Omit<Lead, 'id'>) });
      });
      onUpdate(leads);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.GET, LEADS_COLLECTION);
    }
  );
}

export async function fetchAllLeads(): Promise<Lead[]> {
  try {
    const q = query(collection(db, LEADS_COLLECTION), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    const leads: Lead[] = [];
    snapshot.forEach((docSnap) => {
      leads.push({ id: docSnap.id, ...(docSnap.data() as Omit<Lead, 'id'>) });
    });
    return leads;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, LEADS_COLLECTION);
  }
}

export async function createLead(leadData: Omit<Lead, 'id'>, customId?: string): Promise<string> {
  const leadId = customId || `lead_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const docPath = `${LEADS_COLLECTION}/${leadId}`;
  try {
    const newDocRef = doc(db, LEADS_COLLECTION, leadId);
    await setDoc(newDocRef, {
      ...leadData,
      id: leadId,
      status: leadData.status || 'PENDING',
      consent: Boolean(leadData.consent),
      blocked: Boolean(leadData.blocked),
      callCount: leadData.callCount || 0,
      createdAt: leadData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return leadId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

export async function bulkCreateLeads(
  leads: Array<{ name: string; phone: string; consent: boolean }>
): Promise<number> {
  let createdCount = 0;
  for (const lead of leads) {
    const cleanPhone = lead.phone.trim();
    const cleanName = lead.name.trim();
    if (!cleanPhone || !cleanName) continue;
    
    // Normalise ID based on clean phone
    const safePhoneId = cleanPhone.replace(/[^0-9a-zA-Z]/g, '');
    const leadId = `lead_${safePhoneId}_${Date.now().toString(36)}`;
    await createLead(
      {
        name: cleanName,
        phone: cleanPhone,
        consent: Boolean(lead.consent),
        blocked: false,
        status: 'PENDING',
        outcome: 'PENDING',
        callCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      leadId
    );
    createdCount++;
  }
  return createdCount;
}

export async function updateLead(
  leadId: string,
  updates: Partial<Lead>
): Promise<void> {
  const docPath = `${LEADS_COLLECTION}/${leadId}`;
  try {
    const docRef = doc(db, LEADS_COLLECTION, leadId);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, docPath);
  }
}

export async function deleteLead(leadId: string): Promise<void> {
  const docPath = `${LEADS_COLLECTION}/${leadId}`;
  try {
    const docRef = doc(db, LEADS_COLLECTION, leadId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}

export async function getLeadById(leadId: string): Promise<Lead | null> {
  const docPath = `${LEADS_COLLECTION}/${leadId}`;
  try {
    const docRef = doc(db, LEADS_COLLECTION, leadId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return { id: snap.id, ...(snap.data() as Omit<Lead, 'id'>) };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, docPath);
  }
}

export async function saveLeadLanguage(leadId: string, language: string): Promise<void> {
  const docPath = `${LEADS_COLLECTION}/${leadId}`;
  try {
    const docRef = doc(db, LEADS_COLLECTION, leadId);
    await updateDoc(docRef, {
      language,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, docPath);
  }
}

export async function createCallRecord(callData: CallRecord): Promise<string> {
  const callId = callData.id || `call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const docPath = `${CALLS_COLLECTION}/${callId}`;
  try {
    const callRef = doc(db, CALLS_COLLECTION, callId);
    await setDoc(callRef, {
      ...callData,
      id: callId,
      createdAt: new Date().toISOString(),
    });
    return callId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

export async function completeBrowserCallSession(params: {
  lead: Lead;
  callData: Omit<CallRecord, 'id' | 'customerId' | 'name' | 'phone'>;
  leadUpdates: Partial<Lead>;
}): Promise<{ callId: string }> {
  const { lead, callData, leadUpdates } = params;
  const callId = `call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  
  // 1. Save Call to calls collection
  await createCallRecord({
    id: callId,
    customerId: lead.id,
    name: lead.name,
    phone: lead.phone,
    language: callData.language || lead.language || 'English',
    status: callData.status,
    outcome: callData.outcome,
    startedAt: callData.startedAt,
    endedAt: callData.endedAt,
    duration: callData.duration,
    qualification: callData.qualification,
    summary: callData.summary,
    transcript: callData.transcript,
    noAnswer: Boolean(callData.noAnswer),
  });

  // 2. Update Lead document in leads collection
  await updateLead(lead.id, {
    status: leadUpdates.status || (callData.noAnswer ? 'No Answer' : 'Completed'),
    language: callData.language || lead.language || 'English',
    outcome: (leadUpdates.outcome || callData.outcome) as LeadOutcome,
    blocked: leadUpdates.blocked !== undefined ? leadUpdates.blocked : callData.outcome === 'OPT-OUT',
    lastCallId: callId,
    callCount: (lead.callCount || 0) + 1,
    callTime: callData.startedAt || new Date().toISOString(),
    duration: callData.duration,
    summary: callData.summary,
    transcript: callData.transcript,
    buyerOrInvestor: (leadUpdates.buyerOrInvestor || callData.qualification?.buyerOrInvestor || 'unspecified') as any,
    budget: leadUpdates.budget || callData.qualification?.budget || '',
    location: leadUpdates.location || callData.qualification?.location || '',
    timeline: leadUpdates.timeline || callData.qualification?.timeline || '',
    nextAction: leadUpdates.nextAction || (callData.outcome === 'HOT' ? 'High Priority: Assign Senior Property Advisor for immediate site visit.' : 'Follow up according to lead qualification.'),
    updatedAt: new Date().toISOString(),
  });

  return { callId };
}

export async function fetchCallsForLead(customerId: string): Promise<CallRecord[]> {
  try {
    const q = query(
      collection(db, CALLS_COLLECTION),
      where('customerId', '==', customerId),
      orderBy('startedAt', 'desc')
    );
    const snap = await getDocs(q);
    const records: CallRecord[] = [];
    snap.forEach((d) => records.push({ id: d.id, ...(d.data() as any) }));
    return records;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, CALLS_COLLECTION);
  }
}
