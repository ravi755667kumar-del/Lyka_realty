import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Lead, LeadOutcome, CallRecord } from '../types';

const INITIAL_DEMO_LEADS: Lead[] = [
  {
    id: 'lead_001',
    name: 'Ravi Kumar',
    phone: '+91 98401 23456',
    consent: true,
    blocked: false,
    status: 'Completed',
    language: 'Tamil-English',
    outcome: 'HOT',
    callCount: 1,
    callTime: new Date(Date.now() - 3600000 * 2).toISOString(),
    duration: 88,
    summary: 'Ravi Kumar is looking to buy a 2 BHK flat in Velachery with a budget of ₹72 Lakhs. Needs immediate possession and agreed to site visit this weekend.',
    transcript: `AI: Vanakkam Ravi Kumar Sir! Naan Lyka Realty-la irundhu Priya pesaren. Ungalukku Tamil, English, illana Hindi — edhula pesa vasadhiya irukkum Sir?
Ravi Kumar: Tamil la pesunga, convenient ah irukkum.
AI: Romba sandhosham Ravi Kumar Sir! Ippo oru 2 nimisham pesa mudiyuma?
Ravi Kumar: Aama, free thaan, pesalam.
AI: Super Sir! Neenga veedu vaanganuma, vaadagaikku venuma, illa nilam (plot) vaanganuma?
Ravi Kumar: Veedu vaanga plan irukku, 2 BHK flat vaanganum.
AI: Romba nalladhu Sir! Chennai-la endha location or area-la thedureenga?
Ravi Kumar: Velachery area la paakuren, main road pakkatula venum.
AI: Kandippa Sir! Ungaloda budget range approximate-aa evvalavu irukku?
Ravi Kumar: En budget around 72 lakhs kulla paakaren.
AI: Velachery-la 72 lakhs-kulla super 2 BHK flats irukku Sir! Move-in eppo plan pandreenga?
Ravi Kumar: Udane ready to move venum, family oda shift aaganum.
AI: Direct site visit indha weekend sani yaayiru paaka mudiyuma Sir?
Ravi Kumar: This weekend sani yaayiru varren, location WhatsApp la anupunga.`,
    qaHistory: [
      {
        id: 'qa_1',
        stepNumber: 1,
        stepTitle: 'Step 1: Introduction & Availability Check',
        question: 'Vanakkam Ravi Kumar Sir! Ippo oru 2 nimisham pesa mudiyuma?',
        answer: 'Aama, free thaan, pesalam.',
        extractedKey: 'Availability',
        extractedValue: 'Available to talk',
      },
      {
        id: 'qa_2',
        stepNumber: 2,
        stepTitle: 'Step 2: Property Purpose (Buy / Rent / Plot)',
        question: 'Neenga veedu vaanganuma, vaadagaikku venuma, illa nilam (plot) vaanganuma?',
        answer: 'Veedu vaanga plan irukku, 2 BHK flat vaanganum.',
        extractedKey: 'Purpose',
        extractedValue: 'Looking to Buy 2 BHK Flat',
      },
      {
        id: 'qa_3',
        stepNumber: 3,
        stepTitle: 'Step 3: Preferred Location & Area',
        question: 'Chennai-la endha location or area-la thedureenga?',
        answer: 'Velachery area la paakuren, main road pakkatula venum.',
        extractedKey: 'Location',
        extractedValue: 'Velachery',
      },
      {
        id: 'qa_4',
        stepNumber: 4,
        stepTitle: 'Step 4: Budget Range & Expectation',
        question: 'Ungaloda budget range approximate-aa evvalavu irukku?',
        answer: 'En budget around 72 lakhs kulla paakaren.',
        extractedKey: 'Budget',
        extractedValue: '₹72 Lakhs',
      },
      {
        id: 'qa_5',
        stepNumber: 5,
        stepTitle: 'Step 5: Move-in Timeline',
        question: 'Move-in eppo plan pandreenga?',
        answer: 'Udane ready to move venum, family oda shift aaganum.',
        extractedKey: 'Timeline',
        extractedValue: 'Immediate Ready-to-Move',
      },
      {
        id: 'qa_6',
        stepNumber: 6,
        stepTitle: 'Step 6: Site Visit Day Scheduling',
        question: 'Direct site visit indha weekend sani yaayiru paaka mudiyuma Sir?',
        answer: 'This weekend sani yaayiru varren, location WhatsApp la anupunga.',
        extractedKey: 'Site Visit Schedule',
        extractedValue: 'Visiting this Weekend (Sat/Sun)',
      },
    ],
    budget: '₹72 Lakhs',
    location: 'Velachery',
    timeline: 'Immediate',
    buyerOrInvestor: 'buyer',
    nextAction: 'High Priority: Assign Senior Property Advisor for immediate site visit.',
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: 'lead_002',
    name: 'Divya Ramesh',
    phone: '+91 98402 34567',
    consent: true,
    blocked: false,
    status: 'Pending',
    language: 'Tamil-English',
    outcome: 'PENDING',
    callCount: 0,
    budget: '₹28,000 / month',
    location: 'Adyar',
    timeline: 'Within 1 Month',
    buyerOrInvestor: 'buyer',
    createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
  },
  {
    id: 'lead_003',
    name: 'Suresh Chandran',
    phone: '+91 98403 45678',
    consent: true,
    blocked: false,
    status: 'Pending',
    language: 'Tamil-English',
    outcome: 'PENDING',
    callCount: 0,
    budget: '₹18 Lakhs',
    location: 'Chengalpattu',
    timeline: 'Flexible',
    buyerOrInvestor: 'buyer',
    createdAt: new Date(Date.now() - 3600000 * 8).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 8).toISOString(),
  },
  {
    id: 'lead_004',
    name: 'Karthik Subramanian',
    phone: '+91 98404 56789',
    consent: true,
    blocked: false,
    status: 'Pending',
    language: 'English',
    outcome: 'PENDING',
    callCount: 0,
    budget: '₹1.25 Crore',
    location: 'OMR, Sholinganallur',
    timeline: 'Dec 2026',
    buyerOrInvestor: 'investor',
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 24).toISOString(),
  },
];

// Local store fallback for when Supabase keys are blank in .env
const LOCAL_STORAGE_LEADS_KEY = 'lyka_local_leads_v2';

function getInitialLeads(): Lead[] {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_LEADS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      // ignore
    }
  }
  return [...INITIAL_DEMO_LEADS];
}

let localLeadsStore: Lead[] = getInitialLeads();

const LOCAL_STORAGE_CALLS_KEY = 'lyka_local_calls_v2';

function getInitialCalls(): CallRecord[] {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_CALLS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      // ignore
    }
  }

  // Pre-seed demo calls from INITIAL_DEMO_LEADS
  return INITIAL_DEMO_LEADS
    .filter((l) => Boolean(l.transcript))
    .map((l) => ({
      id: l.lastCallId || `call_${l.id}_demo`,
      customerId: l.id,
      name: l.name,
      phone: l.phone,
      language: l.language || 'English',
      status: l.status,
      outcome: l.outcome || 'HOT',
      startedAt: l.callTime || new Date(Date.now() - 3600000 * 2).toISOString(),
      endedAt: l.callTime || new Date(Date.now() - 3600000 * 2 + 88000).toISOString(),
      duration: l.duration || 88,
      qualification: {
        interested: l.outcome === 'COLD' ? 'No' : 'Yes',
        buyerOrInvestor: l.buyerOrInvestor || 'buyer',
        budget: l.budget,
        location: l.location,
        timeline: l.timeline,
      },
      summary: l.summary,
      transcript: l.transcript,
      qaHistory: l.qaHistory,
      noAnswer: false,
    }));
}

let localCallsStore: CallRecord[] = getInitialCalls();

function saveLocalCalls() {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(LOCAL_STORAGE_CALLS_KEY, JSON.stringify(localCallsStore));
    } catch (e) {
      // ignore
    }
  }
}

const localSubscribers: Set<(leads: Lead[]) => void> = new Set();

function notifyLocalSubscribers() {
  const copy = [...localLeadsStore];
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(LOCAL_STORAGE_LEADS_KEY, JSON.stringify(copy));
    } catch (e) {
      // ignore
    }
  }
  localSubscribers.forEach((cb) => cb(copy));
}

function mapRowToLead(row: any): Lead {
  return {
    id: row.id,
    name: row.name || '',
    phone: row.phone || '',
    consent: Boolean(row.consent),
    blocked: Boolean(row.blocked),
    status: row.status || 'PENDING',
    language: row.language || 'English',
    outcome: row.outcome || 'PENDING',
    lastCallId: row.last_call_id,
    callCount: Number(row.call_count || 0),
    callTime: row.call_time,
    duration: Number(row.duration || 0),
    transcript: row.transcript || '',
    summary: row.summary || '',
    buyerOrInvestor: row.buyer_or_investor || 'unspecified',
    budget: row.budget || '',
    location: row.location || '',
    timeline: row.timeline || '',
    nextAction: row.next_action || '',
    recordingReference: row.recording_reference,
    vapiCallId: row.vapi_call_id,
    qaHistory: typeof row.qa_history === 'string'
      ? (() => { try { return JSON.parse(row.qa_history); } catch { return []; } })()
      : Array.isArray(row.qa_history)
      ? row.qa_history
      : row.qaHistory || undefined,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapLeadToRow(lead: Partial<Lead>): any {
  const row: any = {};
  if (lead.id !== undefined) row.id = lead.id;
  if (lead.name !== undefined) row.name = lead.name;
  if (lead.phone !== undefined) row.phone = lead.phone;
  if (lead.consent !== undefined) row.consent = lead.consent;
  if (lead.blocked !== undefined) row.blocked = lead.blocked;
  if (lead.status !== undefined) row.status = lead.status;
  if (lead.language !== undefined) row.language = lead.language;
  if (lead.outcome !== undefined) row.outcome = lead.outcome;
  if (lead.lastCallId !== undefined) row.last_call_id = lead.lastCallId;
  if (lead.callCount !== undefined) row.call_count = lead.callCount;
  if (lead.callTime !== undefined) row.call_time = lead.callTime;
  if (lead.duration !== undefined) row.duration = lead.duration;
  if (lead.transcript !== undefined) row.transcript = lead.transcript;
  if (lead.summary !== undefined) row.summary = lead.summary;
  if (lead.buyerOrInvestor !== undefined) row.buyer_or_investor = lead.buyerOrInvestor;
  if (lead.budget !== undefined) row.budget = lead.budget;
  if (lead.location !== undefined) row.location = lead.location;
  if (lead.timeline !== undefined) row.timeline = lead.timeline;
  if (lead.nextAction !== undefined) row.next_action = lead.nextAction;
  if (lead.recordingReference !== undefined) row.recording_reference = lead.recordingReference;
  if (lead.vapiCallId !== undefined) row.vapi_call_id = lead.vapiCallId;
  if (lead.qaHistory !== undefined) {
    row.qa_history = typeof lead.qaHistory === 'string' ? lead.qaHistory : JSON.stringify(lead.qaHistory);
  }
  if (lead.createdBy !== undefined) row.created_by = lead.createdBy;
  if (lead.createdAt !== undefined) row.created_at = lead.createdAt;
  if (lead.updatedAt !== undefined) row.updated_at = lead.updatedAt;
  return row;
}

export function subscribeToLeads(
  onUpdate: (leads: Lead[]) => void,
  onError?: (error: Error) => void
): () => void {
  if (!isSupabaseConfigured) {
    localSubscribers.add(onUpdate);
    onUpdate([...localLeadsStore]);
    return () => {
      localSubscribers.delete(onUpdate);
    };
  }

  // Fetch initial data
  fetchAllLeads()
    .then((leads) => onUpdate(leads))
    .catch((err) => onError && onError(err));

  // Set up Supabase Realtime channel
  const channel = supabase
    .channel('public:leads')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'leads' },
      () => {
        fetchAllLeads().then((leads) => onUpdate(leads));
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export async function fetchAllLeads(): Promise<Lead[]> {
  if (!isSupabaseConfigured) {
    return [...localLeadsStore];
  }

  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Supabase fetchAllLeads error:', error);
    return [...localLeadsStore];
  }

  return (data || []).map(mapRowToLead);
}

export async function createLead(leadData: Omit<Lead, 'id'>, customId?: string): Promise<string> {
  const leadId = customId || `lead_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const newLead: Lead = {
    ...leadData,
    id: leadId,
    status: leadData.status || 'PENDING',
    consent: Boolean(leadData.consent),
    blocked: Boolean(leadData.blocked),
    callCount: leadData.callCount || 0,
    createdAt: leadData.createdAt || now,
    updatedAt: now,
  };

  if (!isSupabaseConfigured) {
    localLeadsStore = [newLead, ...localLeadsStore];
    notifyLocalSubscribers();
    return leadId;
  }

  const row = mapLeadToRow(newLead);
  const { error } = await supabase.from('leads').insert(row);
  if (error) {
    console.error('Supabase createLead error:', error);
    // Fallback to local store
    localLeadsStore = [newLead, ...localLeadsStore];
    notifyLocalSubscribers();
  }

  return leadId;
}

export async function bulkCreateLeads(
  leads: Array<{ name: string; phone: string; consent: boolean }>
): Promise<number> {
  let createdCount = 0;
  for (const lead of leads) {
    const cleanPhone = lead.phone.trim();
    const cleanName = lead.name.trim();
    if (!cleanPhone || !cleanName) continue;

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

export async function updateLead(leadId: string, updates: Partial<Lead>): Promise<void> {
  const now = new Date().toISOString();
  const updatePayload = { ...updates, updatedAt: now };

  if (!isSupabaseConfigured) {
    localLeadsStore = localLeadsStore.map((lead) =>
      lead.id === leadId ? { ...lead, ...updatePayload } : lead
    );
    notifyLocalSubscribers();
    return;
  }

  const row = mapLeadToRow(updatePayload);
  delete row.id;

  const { error } = await supabase.from('leads').update(row).eq('id', leadId);
  if (error) {
    console.error('Supabase updateLead error:', error);
    localLeadsStore = localLeadsStore.map((lead) =>
      lead.id === leadId ? { ...lead, ...updatePayload } : lead
    );
    notifyLocalSubscribers();
  }
}

export async function deleteLead(leadId: string): Promise<void> {
  if (!isSupabaseConfigured) {
    localLeadsStore = localLeadsStore.filter((l) => l.id !== leadId);
    notifyLocalSubscribers();
    return;
  }

  const { error } = await supabase.from('leads').delete().eq('id', leadId);
  if (error) {
    console.error('Supabase deleteLead error:', error);
    localLeadsStore = localLeadsStore.filter((l) => l.id !== leadId);
    notifyLocalSubscribers();
  }
}

export async function getLeadById(leadId: string): Promise<Lead | null> {
  if (!isSupabaseConfigured) {
    return localLeadsStore.find((l) => l.id === leadId) || null;
  }

  const { data, error } = await supabase.from('leads').select('*').eq('id', leadId).single();
  if (error || !data) return null;
  return mapRowToLead(data);
}

export async function saveLeadLanguage(leadId: string, language: string): Promise<void> {
  await updateLead(leadId, { language });
}

export async function createCallRecord(callData: CallRecord): Promise<string> {
  const callId = callData.id || `call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const record: CallRecord = {
    ...callData,
    id: callId,
  };

  if (!isSupabaseConfigured) {
    localCallsStore.unshift(record);
    saveLocalCalls();
    return callId;
  }

  const row = {
    id: callId,
    customer_id: record.customerId,
    name: record.name,
    phone: record.phone,
    language: record.language,
    status: record.status,
    outcome: record.outcome,
    started_at: record.startedAt,
    ended_at: record.endedAt,
    duration: record.duration,
    qualification: record.qualification,
    summary: record.summary,
    transcript: record.transcript,
    no_answer: Boolean(record.noAnswer),
    created_at: new Date().toISOString(),
  };

  const { error } = await supabase.from('calls').insert(row);
  if (error) {
    console.error('Supabase createCallRecord error:', error);
    localCallsStore.unshift(record);
    saveLocalCalls();
  }

  return callId;
}

export async function completeBrowserCallSession(params: {
  lead: Lead;
  callData: Omit<CallRecord, 'id' | 'customerId' | 'name' | 'phone'>;
  leadUpdates: Partial<Lead>;
}): Promise<{ callId: string }> {
  const { lead, callData, leadUpdates } = params;
  const callId = `call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  // 1. Save Call to calls table
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
    qaHistory: callData.qaHistory || leadUpdates.qaHistory,
    noAnswer: Boolean(callData.noAnswer),
  });

  // 2. Update Lead record in leads table
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
    qaHistory: leadUpdates.qaHistory || callData.qaHistory,
    buyerOrInvestor: (leadUpdates.buyerOrInvestor || callData.qualification?.buyerOrInvestor || 'unspecified') as any,
    budget: leadUpdates.budget || callData.qualification?.budget || '',
    location: leadUpdates.location || callData.qualification?.location || '',
    timeline: leadUpdates.timeline || callData.qualification?.timeline || '',
    nextAction:
      leadUpdates.nextAction ||
      (callData.outcome === 'HOT'
        ? 'High Priority: Assign Senior Property Advisor for immediate site visit.'
        : 'Follow up according to lead qualification.'),
    updatedAt: new Date().toISOString(),
  });

  // 3. Sync Call and Qualification data to Neon DB
  try {
    fetch('/api/neon/save-call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
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
      }),
    }).catch(() => {});
  } catch (e) {
    // non-blocking
  }

  return { callId };
}

export async function fetchCallsForLead(customerId: string): Promise<CallRecord[]> {
  if (!isSupabaseConfigured) {
    return localCallsStore.filter((c) => c.customerId === customerId);
  }

  const { data, error } = await supabase
    .from('calls')
    .select('*')
    .eq('customer_id', customerId)
    .order('started_at', { ascending: false });

  if (error || !data) return [];

  return data.map((d: any) => ({
    id: d.id,
    customerId: d.customer_id,
    name: d.name,
    phone: d.phone,
    language: d.language,
    status: d.status,
    outcome: d.outcome,
    startedAt: d.started_at,
    endedAt: d.ended_at,
    duration: d.duration,
    qualification: d.qualification || {},
    summary: d.summary,
    transcript: d.transcript,
    noAnswer: Boolean(d.no_answer),
  }));
}

export async function fetchAllCallHistory(): Promise<CallRecord[]> {
  const existingCustomerIds = new Set(localCallsStore.map((c) => c.customerId));
  const additionalFromLeads: CallRecord[] = localLeadsStore
    .filter((l) => Boolean(l.transcript) && !existingCustomerIds.has(l.id))
    .map((l) => ({
      id: l.lastCallId || `call_${l.id}_auto`,
      customerId: l.id,
      name: l.name,
      phone: l.phone,
      language: l.language || 'English',
      status: l.status,
      outcome: l.outcome || 'PENDING',
      startedAt: l.callTime || l.updatedAt || l.createdAt || new Date().toISOString(),
      endedAt: l.callTime || l.updatedAt || l.createdAt || new Date().toISOString(),
      duration: l.duration || 0,
      qualification: {
        interested: l.outcome === 'COLD' ? 'No' : 'Yes',
        buyerOrInvestor: l.buyerOrInvestor || 'unspecified',
        budget: l.budget,
        location: l.location,
        timeline: l.timeline,
      },
      summary: l.summary,
      transcript: l.transcript,
      qaHistory: l.qaHistory,
      noAnswer: Boolean(l.status === 'No Answer'),
    }));

  const allLocal = [...localCallsStore, ...additionalFromLeads];
  allLocal.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

  if (!isSupabaseConfigured) {
    return allLocal;
  }

  try {
    const { data, error } = await supabase
      .from('calls')
      .select('*')
      .order('started_at', { ascending: false });

    if (error || !data || data.length === 0) {
      return allLocal;
    }

    return data.map((d: any) => ({
      id: d.id,
      customerId: d.customer_id,
      name: d.name,
      phone: d.phone,
      language: d.language || 'English',
      status: d.status,
      outcome: d.outcome || 'PENDING',
      startedAt: d.started_at,
      endedAt: d.ended_at,
      duration: d.duration || 0,
      qualification: d.qualification || {},
      summary: d.summary || '',
      transcript: d.transcript || '',
      qaHistory: typeof d.qa_history === 'string' ? JSON.parse(d.qa_history) : d.qa_history,
      noAnswer: Boolean(d.no_answer),
    }));
  } catch (e) {
    return allLocal;
  }
}
