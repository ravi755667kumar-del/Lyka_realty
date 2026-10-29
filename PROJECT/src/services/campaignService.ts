import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { CampaignState, VapiConfig } from '../types';

const DEFAULT_CAMPAIGN: CampaignState = {
  id: 'lyka_cold_call_mvp',
  name: 'Lyka Realty Outbound Cold-Calling MVP',
  isRunning: false,
  activeLeadId: null,
  activeLeadName: null,
  activeLeadPhone: null,
  totalLeads: 4,
  completedCalls: 0,
  hotCount: 0,
  warmCount: 0,
  coldCount: 0,
  optOutCount: 0,
  noAnswerCount: 0,
  agentCallbackCount: 0,
  lastUpdated: new Date().toISOString(),
};

let localCampaignState: CampaignState = { ...DEFAULT_CAMPAIGN };
const localSubscribers: Set<(state: CampaignState | null) => void> = new Set();

function notifyLocalCampaign() {
  const copy = { ...localCampaignState };
  localSubscribers.forEach((cb) => cb(copy));
}

function mapRowToCampaign(row: any): CampaignState {
  return {
    id: row.id,
    name: row.name || DEFAULT_CAMPAIGN.name,
    isRunning: Boolean(row.is_running),
    activeLeadId: row.active_lead_id || null,
    activeLeadName: row.active_lead_name || null,
    activeLeadPhone: row.active_lead_phone || null,
    totalLeads: Number(row.total_leads || 0),
    completedCalls: Number(row.completed_calls || 0),
    hotCount: Number(row.hot_count || 0),
    warmCount: Number(row.warm_count || 0),
    coldCount: Number(row.cold_count || 0),
    optOutCount: Number(row.opt_out_count || 0),
    noAnswerCount: Number(row.no_answer_count || 0),
    agentCallbackCount: Number(row.agent_callback_count || 0),
    lastUpdated: row.last_updated || new Date().toISOString(),
  };
}

export function subscribeToCampaignState(
  onUpdate: (state: CampaignState | null) => void,
  onError?: (error: Error) => void
): () => void {
  if (!isSupabaseConfigured) {
    localSubscribers.add(onUpdate);
    onUpdate({ ...localCampaignState });
    return () => {
      localSubscribers.delete(onUpdate);
    };
  }

  // Initial fetch
  supabase
    .from('campaigns')
    .select('*')
    .eq('id', 'lyka_cold_call_mvp')
    .maybeSingle()
    .then(({ data, error }) => {
      if (error) {
        if (onError) onError(new Error(error.message));
        onUpdate({ ...DEFAULT_CAMPAIGN });
        return;
      }
      if (data) {
        onUpdate(mapRowToCampaign(data));
      } else {
        initCampaignDoc().then(() => onUpdate({ ...DEFAULT_CAMPAIGN }));
      }
    });

  // Realtime subscription
  const channel = supabase
    .channel('public:campaigns')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'campaigns' },
      (payload) => {
        if (payload.new) {
          onUpdate(mapRowToCampaign(payload.new));
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export async function initCampaignDoc(): Promise<void> {
  if (!isSupabaseConfigured) {
    localCampaignState = { ...DEFAULT_CAMPAIGN };
    notifyLocalCampaign();
    return;
  }

  const { error } = await supabase.from('campaigns').upsert(
    {
      id: 'lyka_cold_call_mvp',
      name: 'Lyka Realty Outbound Cold-Calling MVP',
      is_running: false,
      last_updated: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );

  if (error) {
    console.warn('initCampaignDoc note:', error.message);
  }
}

// ─── Server API Route Calls ──────────────────────────────────────────────────

export async function startCampaignAPI(): Promise<{ success: boolean; message: string; activeLead?: any }> {
  try {
    const res = await fetch('/api/campaign/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Failed to start campaign' }));
      throw new Error(err.message || 'Failed to start campaign');
    }
    return res.json();
  } catch (e: any) {
    // In local fallback mode
    localCampaignState.isRunning = true;
    notifyLocalCampaign();
    return { success: true, message: 'Campaign started in local interactive mode.' };
  }
}

export async function stopCampaignAPI(): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch('/api/campaign/stop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Failed to stop campaign' }));
      throw new Error(err.message || 'Failed to stop campaign');
    }
    return res.json();
  } catch (e: any) {
    localCampaignState.isRunning = false;
    notifyLocalCampaign();
    return { success: true, message: 'Campaign stopped.' };
  }
}

export async function callSingleLeadAPI(
  leadId: string
): Promise<{ success: boolean; message: string; callId?: string; simulated?: boolean }> {
  const res = await fetch('/api/campaign/call-lead', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ leadId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to call lead' }));
    throw new Error(err.message || 'Failed to call lead');
  }
  return res.json();
}

export async function getVapiConfig(): Promise<VapiConfig> {
  const res = await fetch('/api/vapi/settings');
  if (!res.ok) throw new Error('Failed to fetch Vapi settings');
  return res.json();
}

export async function updateVapiConfig(data: {
  apiKey?: string;
  phoneNumberId?: string;
  assistantId?: string;
}): Promise<{ success: boolean; message: string }> {
  const res = await fetch('/api/vapi/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to save settings' }));
    throw new Error(err.message || 'Failed to save settings');
  }
  return res.json();
}

export async function simulateCallAPI(data: {
  leadId: string;
  scenario: 'HOT' | 'WARM' | 'COLD' | 'OPT-OUT' | 'NO_ANSWER' | 'AGENT_CALLBACK';
}): Promise<{ success: boolean; message: string; lead: any }> {
  const res = await fetch('/api/vapi/simulate-call', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to simulate call' }));
    throw new Error(err.message || 'Failed to simulate call');
  }
  return res.json();
}

export async function getSarvamConfig(): Promise<{ apiKeyConfigured: boolean }> {
  const res = await fetch('/api/sarvam/settings');
  if (!res.ok) throw new Error('Failed to fetch Sarvam settings');
  return res.json();
}

export async function updateSarvamConfig(data: {
  apiKey?: string;
}): Promise<{ success: boolean; message: string }> {
  const res = await fetch('/api/sarvam/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to save Sarvam settings' }));
    throw new Error(err.message || 'Failed to save Sarvam settings');
  }
  return res.json();
}


/**
 * Sarvam Text-to-Speech via server proxy.
 * Returns base64-encoded WAV string from Bulbul v3.
 */
export async function sarvamTTS(params: {
  text: string;
  language_code: string;
  speaker?: string;
  pace?: number;
}): Promise<string | null> {
  const res = await fetch('/api/sarvam/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Sarvam TTS failed');
  }
  return data.audio as string | null;
}

/**
 * Sarvam Speech-to-Text via server proxy.
 * Accepts a Blob (WAV/WebM audio) and returns the transcript string.
 */
export async function sarvamSTT(audioBlob: Blob, languageCode: string): Promise<string> {
  const formData = new FormData();
  formData.append('file', audioBlob, 'recording.wav');
  // saaras:v3 handles English/Hindi/Tamil plus code-mixed Tanglish (saaras:v2 was retired)
  formData.append('model', 'saaras:v3');
  formData.append('language_code', languageCode);
  formData.append('with_timestamps', 'false');

  const res = await fetch('/api/sarvam/stt', {
    method: 'POST',
    body: formData,
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Sarvam STT failed');
  }
  return data.transcript as string;
}

// ─── Groq API Client Functions ──────────────────────────────────────────

export async function getGroqConfig(): Promise<{ apiKeyConfigured: boolean }> {
  const res = await fetch('/api/groq/settings');
  if (!res.ok) throw new Error('Failed to fetch Groq settings');
  return res.json();
}

export async function updateGroqConfig(data: {
  apiKey?: string;
}): Promise<{ success: boolean; message: string }> {
  const res = await fetch('/api/groq/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to save Groq settings' }));
    throw new Error(err.message || 'Failed to save Groq settings');
  }
  return res.json();
}

export async function groqChat(
  messages: any[],
  model: string = 'llama-3.3-70b-versatile',
  leadName?: string
): Promise<string> {
  const res = await fetch('/api/groq/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, model, leadName }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to chat with Groq' }));
    throw new Error(err.message || err.error || 'Failed to chat with Groq');
  }
  const data = await res.json();
  return data.text || data.reply || '';
}
