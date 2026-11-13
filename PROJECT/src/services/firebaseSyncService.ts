'use client';

import {
  collection,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  getDocs,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { Lead, PropertyItem } from '../types';

export interface FirebaseCrmLead {
  id?: string;
  name?: string;
  phone?: string;
  status?: string;
  consent?: boolean;
  blocked?: boolean;
  language?: string;
  budget?: string;
  location?: string;
  timeline?: string;
  buyerOrInvestor?: string;
  triggerCall?: boolean;
  salesStatus?: string;
  salesPriority?: string;
  salesManagerAlert?: boolean;
  siteVisitSchedule?: string;
  createdAt?: string | any;
  updatedAt?: string | any;
}

export function formatDurationDetailed(seconds?: number): string {
  if (!seconds || seconds <= 0) return '0s';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  if (secs === 0) return `${mins}m`;
  return `${mins}m ${secs}s`;
}

/**
 * Extracts site visit appointment timing from conversation Q&A or AI summary
 */
export function extractSiteVisitSchedule(qaHistory?: any[], summary?: string): string {
  if (Array.isArray(qaHistory) && qaHistory.length > 0) {
    const siteVisitItem = qaHistory.find(
      (item) =>
        item.extractedKey === 'Site Visit Schedule' ||
        (item.stepTitle && item.stepTitle.toLowerCase().includes('site visit')) ||
        (item.question && item.question.toLowerCase().includes('site visit'))
    );
    if (siteVisitItem && (siteVisitItem.extractedValue || siteVisitItem.answer)) {
      return siteVisitItem.extractedValue || siteVisitItem.answer;
    }
  }

  if (summary) {
    const match = summary.match(/(site visit [^.]+)/i) || summary.match(/(visit [^.]+)/i);
    if (match) return match[1];
  }

  return 'Not confirmed / Follow up required';
}

/**
 * Normalizes a Firebase Firestore document into our local Lead interface
 */
export function mapFirebaseDocToLead(docId: string, data: any): Lead {
  return {
    id: docId,
    name: data.name || 'Customer',
    phone: data.phone || '',
    consent: data.consent !== undefined ? Boolean(data.consent) : true,
    blocked: Boolean(data.blocked),
    status: data.status || 'Pending',
    language: data.language || 'English',
    outcome: data.outcome || 'PENDING',
    callCount: Number(data.callCount || 0),
    callTime: data.callTime || (data.updatedAt ? new Date(data.updatedAt).toISOString() : undefined),
    duration: data.duration !== undefined ? Number(data.duration) : undefined,
    transcript: data.transcript || '',
    summary: data.summary || '',
    buyerOrInvestor: data.buyerOrInvestor || (data.qualification?.buyerOrInvestor || 'unspecified'),
    budget: data.budget || data.qualification?.budget || '',
    location: data.location || data.qualification?.location || '',
    timeline: data.timeline || data.qualification?.timeline || '',
    nextAction: data.salesManagerActionRequired || data.nextAction || '',
    recordingReference: data.recordingReference || data.recordingUrl || '',
    qaHistory: data.qaHistory || [],
    createdAt: data.createdAt ? String(data.createdAt) : new Date().toISOString(),
    updatedAt: data.updatedAt ? String(data.updatedAt) : new Date().toISOString(),
  };
}

/**
 * Logs Firestore listener errors uniformly and handles missing remote rule permissions cleanly.
 */
function logListenerError(scope: 'Leads' | 'Properties', collectionName: string, err: any): void {
  const msg = String(err?.message || '').toLowerCase();
  if (err?.code === 'permission-denied' || msg.includes('permission') || msg.includes('insufficient')) {
    console.info(
      `[Firebase CRM Sync] ${scope} listener skipped (missing Firestore read permission on '${collectionName}' — publish firestore.rules to activate live sync).`
    );
    return;
  }
  console.warn(`[Firebase CRM Sync] ${scope} listener note:`, err);
}

/**
 * 1. Listen for leads added/updated by Super Admin in Firebase
 */
export function listenToFirebaseCrmLeads(callbacks: {
  onLeadsUpdated: (leads: Lead[]) => void;
  onNewPendingLead?: (lead: Lead) => void;
  onError?: (err: Error) => void;
}): () => void {
  try {
    const leadsRef = collection(db, 'leads');

    const unsubscribe = onSnapshot(
      leadsRef,
      (snapshot) => {
        const leadsList: Lead[] = [];
        snapshot.forEach((docSnap) => {
          leadsList.push(mapFirebaseDocToLead(docSnap.id, docSnap.data()));
        });

        callbacks.onLeadsUpdated(leadsList);

        // Check if any newly added or updated document needs a call
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added' || change.type === 'modified') {
            const data = change.doc.data();
            const lead = mapFirebaseDocToLead(change.doc.id, data);
            if (
              (data.status === 'PENDING' || data.status === 'Pending' || data.triggerCall) &&
              lead.consent &&
              !lead.blocked
            ) {
              if (callbacks.onNewPendingLead) {
                callbacks.onNewPendingLead(lead);
              }
            }
          }
        });
      },
      (err) => {
        logListenerError('Leads', 'leads', err);
        if (callbacks.onError) callbacks.onError(err);
      }
    );

    return unsubscribe;
  } catch (err: any) {
    console.warn('[Firebase CRM Sync] Failed to initialize leads listener:', err);
    return () => {};
  }
}

/**
 * 2. Listen for properties added by Property Admin in Firebase
 */
export function listenToFirebaseCrmProperties(callbacks: {
  onPropertiesUpdated: (properties: PropertyItem[]) => void;
  onError?: (err: Error) => void;
}): () => void {
  try {
    const propsRef = collection(db, 'properties');

    const unsubscribe = onSnapshot(
      propsRef,
      (snapshot) => {
        const propsList: PropertyItem[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          propsList.push({
            id: docSnap.id,
            title: d.title || 'Untitled Property',
            price: d.price || 'Price on request',
            bhk: d.bhk || '2 BHK',
            propertyType: d.propertyType || 'Apartment',
            listingType: d.listingType || 'Buy',
            location: d.location || 'Chennai',
            nearbyLocation: d.nearbyLocation || '',
            description: d.description || '',
            possession: d.possession || 'Ready to Move',
            nextStep: d.nextStep || 'Would you like to schedule a site visit this weekend?',
            size: d.size || '',
          });
        });

        if (propsList.length > 0) {
          callbacks.onPropertiesUpdated(propsList);
          // Sync with local property API so AI prompt uses it immediately
          syncPropertiesToLocalApi(propsList).catch(() => {});
        }
      },
      (err) => {
        logListenerError('Properties', 'properties', err);
        if (callbacks.onError) callbacks.onError(err);
      }
    );

    return unsubscribe;
  } catch (err: any) {
    console.warn('[Firebase CRM Sync] Failed to initialize properties listener:', err);
    return () => {};
  }
}

/**
 * 3. Update Call In-Progress status in Firebase
 * Immediately notifies Sales Manager: "AI is on a live call with customer"
 */
export async function updateCallInProgressInFirebaseCRM(params: {
  leadId: string;
  lead: Lead;
  callingMethod: string;
}): Promise<boolean> {
  const { leadId, lead, callingMethod } = params;
  try {
    const nowIso = new Date().toISOString();
    const leadDocRef = doc(db, 'leads', leadId);

    // 1. Update lead document
    await setDoc(
      leadDocRef,
      {
        status: 'CALLING',
        salesStatus: 'CALL_IN_PROGRESS',
        salesManagerAlert: true,
        callingAgent: 'Priya AI (Lyka Realty)',
        callingMethod,
        callStartTime: nowIso,
        summary: `Live AI outbound call in progress via ${callingMethod}...`,
        updatedAt: nowIso,
      },
      { merge: true }
    );

    // 2. Write live alert to sales_manager_alerts collection
    const alertId = `calling_${leadId}_${Date.now()}`;
    const alertDocRef = doc(db, 'sales_manager_alerts', alertId);
    await setDoc(alertDocRef, {
      id: alertId,
      alertType: 'CALL_IN_PROGRESS',
      leadId,
      customerName: lead.name,
      customerPhone: lead.phone,
      callingMethod,
      message: `Priya AI is currently on a live call with ${lead.name} (${lead.phone}) via ${callingMethod}.`,
      unread: true,
      createdAt: nowIso,
    });

    console.log(`[Firebase CRM Sync] Updated call in-progress for Sales Manager: ${leadId}`);
    return true;
  } catch (err) {
    console.error('[Firebase CRM Sync] Call in-progress update note:', err);
    return false;
  }
}

/**
 * 4. Write completed call report back to Firebase Firestore
 * This updates Super Admin AND Sales Manager in real-time with complete Q&A and next action!
 */
export async function writeReportBackToFirebaseCRM(params: {
  leadId: string;
  lead: Lead;
  callReport: {
    status?: string;
    outcome?: string;
    duration?: number;
    summary?: string;
    transcript?: string;
    qaHistory?: any[];
    qualification?: any;
    recordingReference?: string;
    callTime?: string;
  };
}): Promise<boolean> {
  const { leadId, lead, callReport } = params;
  try {
    const leadDocRef = doc(db, 'leads', leadId);
    const nowIso = new Date().toISOString();

    const outcome = (callReport.outcome || 'HOT').toUpperCase();
    const durationSeconds = callReport.duration || 0;
    const durationFormatted = formatDurationDetailed(durationSeconds);
    const siteVisitSchedule = extractSiteVisitSchedule(callReport.qaHistory, callReport.summary);

    // Determine Sales Manager Action and Priority
    let salesPriority = 'LOW';
    let salesStatus = 'COLD_CLOSED';
    let salesActionRequired = 'Follow up per standard cycle.';

    if (outcome === 'HOT') {
      salesPriority = 'HIGH';
      salesStatus = 'HOT_LEAD_ACTION_REQUIRED';
      salesActionRequired = `🔥 HIGH PRIORITY: Assign Property Specialist. Customer agreed for site visit: ${siteVisitSchedule}.`;
    } else if (outcome === 'WARM') {
      salesPriority = 'MEDIUM';
      salesStatus = 'WARM_NURTURE';
      salesActionRequired = '🟡 Send verified property brochure & pricing sheet on WhatsApp.';
    } else if (outcome === 'AGENT_CALLBACK') {
      salesPriority = 'HIGH';
      salesStatus = 'CALLBACK_REQUESTED';
      salesActionRequired = '📞 URGENT: Customer requested a human agent to call back.';
    } else if (outcome === 'OPT-OUT') {
      salesPriority = 'NONE';
      salesStatus = 'DO_NOT_CONTACT';
      salesActionRequired = '⛔ Customer opted out. Do not call.';
    }

    // 1. Update the lead record in 'leads' collection
    const updatePayload: Record<string, any> = {
      status: callReport.status || 'COMPLETED',
      outcome,
      duration: durationSeconds,
      durationFormatted,
      callTime: callReport.callTime || nowIso,
      updatedAt: nowIso,
      // Dedicated Sales Manager Fields:
      salesStatus,
      salesPriority,
      salesManagerAlert: outcome === 'HOT' || outcome === 'WARM' || outcome === 'AGENT_CALLBACK',
      siteVisitSchedule,
      salesManagerActionRequired: salesActionRequired,
      unreadBySalesManager: true,
      budget: callReport.qualification?.budget || lead.budget || '',
      location: callReport.qualification?.location || lead.location || '',
      timeline: callReport.qualification?.timeline || lead.timeline || '',
      buyerOrInvestor: callReport.qualification?.buyerOrInvestor || lead.buyerOrInvestor || 'buyer',
    };

    if (callReport.summary) updatePayload.summary = callReport.summary;
    if (callReport.transcript) updatePayload.transcript = callReport.transcript;
    if (callReport.qaHistory) updatePayload.qaHistory = callReport.qaHistory;
    if (callReport.qualification) updatePayload.qualification = callReport.qualification;
    if (callReport.recordingReference) updatePayload.recordingReference = callReport.recordingReference;

    await setDoc(leadDocRef, updatePayload, { merge: true });

    // 2. Write an Action Ticket directly to 'sales_manager_alerts' collection in Firebase
    const alertId = `alert_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const alertDocRef = doc(db, 'sales_manager_alerts', alertId);
    await setDoc(alertDocRef, {
      id: alertId,
      alertType: outcome === 'HOT' ? 'HOT_LEAD' : outcome === 'AGENT_CALLBACK' ? 'CALLBACK_REQUEST' : 'CALL_COMPLETED',
      leadId,
      customerName: lead.name,
      customerPhone: lead.phone,
      customerLanguage: lead.language || 'English',
      outcome,
      salesPriority,
      salesStatus,
      durationSeconds,
      durationFormatted,
      budget: callReport.qualification?.budget || lead.budget || 'Not specified',
      location: callReport.qualification?.location || lead.location || 'Chennai',
      timeline: callReport.qualification?.timeline || lead.timeline || 'Flexible',
      siteVisitSchedule,
      summary: callReport.summary || '',
      actionRequired: salesActionRequired,
      transcriptSnippet: (callReport.transcript || '').slice(0, 300),
      unread: true,
      createdAt: nowIso,
    });

    // 3. Write a full call record in the 'calls' collection for Super Admin historical analytics
    const callRecordId = `call_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const callDocRef = doc(db, 'calls', callRecordId);
    await setDoc(callDocRef, {
      id: callRecordId,
      customerId: leadId,
      name: lead.name,
      phone: lead.phone,
      language: lead.language || 'English',
      status: callReport.status || 'COMPLETED',
      outcome,
      duration: durationSeconds,
      startedAt: callReport.callTime || nowIso,
      endedAt: nowIso,
      summary: callReport.summary || '',
      transcript: callReport.transcript || '',
      qualification: callReport.qualification || {},
      qaHistory: callReport.qaHistory || [],
      recordingReference: callReport.recordingReference || '',
      siteVisitSchedule,
      createdAt: nowIso,
    });

    console.log(`[Firebase CRM Sync] Successfully updated Sales Manager & Super Admin in Firebase for lead ${leadId}`);
    return true;
  } catch (err) {
    console.error('[Firebase CRM Sync] Failed writing report back to Firebase:', err);
    return false;
  }
}

/**
 * Helper: Save properties fetched from Firebase to local property catalog
 */
async function syncPropertiesToLocalApi(props: PropertyItem[]) {
  try {
    for (const p of props) {
      await fetch('/api/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: p.title,
          price: p.price,
          bhk: p.bhk,
          propertyType: p.propertyType,
          listingType: p.listingType || 'Buy',
          location: p.location,
          nearbyLocation: p.nearbyLocation,
          description: p.description,
          possession: p.possession,
          nextStep: p.nextStep,
          size: p.size,
        }),
      });
    }
  } catch (e) {
    // non-blocking
  }
}
