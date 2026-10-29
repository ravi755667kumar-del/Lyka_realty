import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Lead, LeadOutcome, CallRecord } from '../types';

const INITIAL_DEMO_LEADS: Lead[] = [
  {
    id: 'lead_001',
    name: 'Ravi Kumar',
    phone: '+91 98401 23456',
    consent: true,
    blocked: false,
    status: 'Pending',
    language: 'Tamil-English',
    outcome: 'PENDING',
    callCount: 0,
    budget: '₹72 Lakhs',
    location: 'Velachery',
    timeline: 'Immediate',
    buyerOrInvestor: 'buyer',
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
let localLeadsStore: Lead[] = [...INITIAL_DEMO_LEADS];
let localCallsStore: CallRecord[] = [];
const localSubscribers: Set<(leads: Lead[]) => void> = new Set();

function notifyLocalSubscribers() {
  const copy = [...localLeadsStore];
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
