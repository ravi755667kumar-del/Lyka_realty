import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { CampaignState, SessionMemory } from '../types';
import type { SpeechEmotion, SpeechLanguage } from '../lib/speech';
import { recordLlmTurnUsage, recordSttUsage, recordTtsUsage, estimateTokens } from './aiUsageTracker';

export type CloudSttEngine = 'groq' | 'gemini' | 'openai' | 'deepgram' | 'sarvam';

export interface SttTranscriptionResult {
  transcript: string;
  detectedLanguage: string | null;
  conversationLanguage: SpeechLanguage | null;
}

const STT_PROVIDER_META: Record<CloudSttEngine, { endpoint: string; providerLabel: string }> = {
  groq: { endpoint: '/api/groq/stt', providerLabel: 'Groq Whisper-large-v3' },
  gemini: { endpoint: '/api/gemini/stt', providerLabel: 'Google Gemini STT' },
  openai: { endpoint: '/api/openai/stt', providerLabel: 'OpenAI Whisper-1' },
  deepgram: { endpoint: '/api/deepgram/stt', providerLabel: 'Deepgram Nova-2' },
  sarvam: { endpoint: '/api/sarvam/stt', providerLabel: 'Sarvam Saaras v2' },
};

/**
 * Transcribes a single recorded customer audio turn using the active cloud STT engine.
 * Supports `languageCode = 'auto'` for automatic Tamil / Hindi / English detection.
 */
export async function transcribeAudioTurn(
  engine: CloudSttEngine,
  audioBlob: Blob,
  languageCode: string = 'auto',
  model?: string
): Promise<SttTranscriptionResult> {
  const meta = STT_PROVIDER_META[engine];
  const ext = audioBlob.type.includes('mp4')
    ? 'mp4'
    : audioBlob.type.includes('ogg')
      ? 'ogg'
      : 'webm';
  const formData = new FormData();
  formData.append('file', audioBlob, `recording.${ext}`);
  formData.append('language_code', languageCode);
  if (model) formData.append('model', model);

  const res = await fetch(meta.endpoint, { method: 'POST', body: formData });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || `${engine} STT failed`);
  }

  const transcript = String(data.transcript || '').trim();
  if (transcript) {
    try {
      recordSttUsage({
        provider: meta.providerLabel,
        audioDurationSeconds: Math.max(2, Math.round(audioBlob.size / 16000)),
        transcriptText: transcript,
      });
    } catch (e) {}
  }

  return {
    transcript,
    detectedLanguage: typeof data.detectedLanguage === 'string' ? data.detectedLanguage : null,
    conversationLanguage: (data.conversationLanguage as SpeechLanguage | null | undefined) ?? null,
  };
}

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

export async function simulateCallAPI(data: {
  leadId: string;
  scenario: 'HOT' | 'WARM' | 'COLD' | 'OPT-OUT' | 'NO_ANSWER' | 'AGENT_CALLBACK';
}): Promise<{ success: boolean; message: string; lead: any }> {
  const { updateLead, getLeadById } = await import('./leadService');
  const currentLead = await getLeadById(data.leadId);
  const now = new Date().toISOString();
  const updates: any = {
    outcome: data.scenario,
    status: data.scenario === 'OPT-OUT' ? 'DNC' : 'CONTACTED',
    lastCallDate: now,
    notes: `Simulated call outcome: ${data.scenario} at ${new Date().toLocaleTimeString()}`,
  };
  if (data.scenario === 'HOT') {
    updates.qualificationScore = 95;
    updates.budget = '₹3-4 Cr';
    updates.propertyType = '3 BHK';
    updates.preferredLocation = 'Worli/Bandra';
  } else if (data.scenario === 'WARM') {
    updates.qualificationScore = 75;
    updates.budget = '₹1.5-2 Cr';
    updates.preferredLocation = 'Bangalore';
  } else if (data.scenario === 'OPT-OUT') {
    updates.qualificationScore = 0;
  }
  await updateLead(data.leadId, updates);
  return {
    success: true,
    message: `Call simulation completed with outcome: ${data.scenario}`,
    lead: { ...(currentLead || { id: data.leadId }), ...updates },
  };
}

// ─── Google Gemini AI Client Functions ───────────────────────────────────────

export async function getGeminiConfig(): Promise<{ apiKeyConfigured: boolean; voice?: string }> {
  const res = await fetch('/api/gemini/settings');
  if (!res.ok) return { apiKeyConfigured: false };
  return res.json();
}

export async function updateGeminiConfig(data: {
  apiKey?: string;
  voice?: string;
}): Promise<{ success: boolean; message: string }> {
  const res = await fetch('/api/gemini/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to save Gemini settings' }));
    throw new Error(err.message || 'Failed to save Gemini settings');
  }
  return res.json();
}

export async function geminiChat(
  messages: any[],
  model: string = 'gemini-3.8-flash',
  leadName?: string,
  language?: string,
  agentName?: string,
  agentGender?: string,
  customerEmotion?: string,
  sessionMemory?: SessionMemory
): Promise<string> {
  const res = await fetch('/api/gemini/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, model, leadName, language, agentName, agentGender, customerEmotion, sessionMemory }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to chat with Gemini' }));
    throw new Error(err.message || err.error || 'Failed to chat with Gemini');
  }
  const data = await res.json();
  try {
    recordLlmTurnUsage({
      modelName: model || 'Google Gemini 2.5 Flash',
      promptTokens: data.usage?.prompt_tokens || estimateTokens(JSON.stringify(messages)),
      completionTokens: data.usage?.completion_tokens || estimateTokens(data.text || ''),
    });
  } catch (e) {}
  return data.text || data.reply || '';
}

export async function geminiSTT(audioBlob: Blob, languageCode: string): Promise<string> {
  const { transcript } = await transcribeAudioTurn('gemini', audioBlob, languageCode);
  return transcript;
}

export async function geminiTTS(params: {
  text: string;
  gender?: 'female' | 'male';
  language?: string;
  emotion?: SpeechEmotion;
}): Promise<{ audio: string; format: string }> {
  const res = await fetch('/api/gemini/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.message || 'Gemini TTS failed');
  try {
    recordTtsUsage({
      provider: 'Google Gemini TTS',
      text: params.text,
    });
  } catch (e) {}
  return { audio: data.audio, format: data.format || 'audio/wav' };
}

// ─── Groq API Client Functions ───────────────────────────────────────────────

export async function getGroqConfig(): Promise<{ apiKeyConfigured: boolean; voice?: string }> {
  const res = await fetch('/api/groq/settings');
  if (!res.ok) throw new Error('Failed to fetch Groq settings');
  return res.json();
}

export async function updateGroqConfig(data: {
  apiKey?: string;
  voice?: string;
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
  leadName?: string,
  language?: string,
  agentName?: string,
  agentGender?: string,
  customerEmotion?: string,
  temperature?: number,
  conversationStyle?: 'engaging' | 'polite',
  sessionMemory?: SessionMemory
): Promise<string> {
  const res = await fetch('/api/groq/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages,
      model,
      leadName,
      language,
      agentName,
      agentGender,
      customerEmotion,
      temperature,
      conversationStyle,
      sessionMemory,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to chat with Groq' }));
    throw new Error(err.message || err.error || 'Failed to chat with Groq');
  }
  const data = await res.json();
  try {
    recordLlmTurnUsage({
      modelName: model ? `Groq (${model})` : 'Groq Llama 3.3 70B',
      promptTokens: data.usage?.prompt_tokens || estimateTokens(JSON.stringify(messages)),
      completionTokens: data.usage?.completion_tokens || estimateTokens(data.text || ''),
    });
  } catch (e) {}
  return data.text || data.reply || '';
}

export async function groqSTT(audioBlob: Blob, languageCode: string): Promise<string> {
  const { transcript } = await transcribeAudioTurn('groq', audioBlob, languageCode);
  return transcript;
}

export async function groqTTS(params: {
  text: string;
  voice: string;
  speed?: number;
  language?: string;
  emotion?: SpeechEmotion;
}): Promise<{ audio: string; format: string }> {
  const res = await fetch('/api/groq/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.message || 'Groq TTS failed');
  try {
    recordTtsUsage({
      provider: 'Groq Voice',
      text: params.text,
    });
  } catch (e) {}
  return { audio: data.audio, format: data.format || 'audio/wav' };
}

export async function speechifyTTS(params: {
  text: string;
  voice?: string;
  model?: string;
  gender?: 'female' | 'male';
  language?: string;
  emotion?: SpeechEmotion;
}): Promise<{ audio: string; format: string; voice?: string }> {
  const res = await fetch('/api/speechify/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.message || 'Speechify TTS failed');
  try {
    recordTtsUsage({
      provider: 'Speechify',
      text: params.text,
    });
  } catch (e) {}
  return { audio: data.audio, format: data.format || 'audio/mp3', voice: data.voice };
}

export async function cartesiaTTS(params: {
  text: string;
  voice?: string;
  gender?: 'female' | 'male';
  language?: string;
  emotion?: SpeechEmotion;
}): Promise<{ audio: string; format: string; voice?: string }> {
  const res = await fetch('/api/cartesia/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.message || 'Cartesia TTS failed');
  try {
    recordTtsUsage({
      provider: 'Cartesia Sonic',
      text: params.text,
    });
  } catch (e) {}
  return { audio: data.audio, format: data.format || 'audio/wav', voice: data.voice };
}

export async function deepgramTTS(params: {
  text: string;
  voice?: string;
  gender?: 'female' | 'male';
  language?: string;
  emotion?: SpeechEmotion;
}): Promise<{ audio: string; format: string; voice?: string }> {
  const res = await fetch('/api/deepgram/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.message || 'Deepgram TTS failed');
  try {
    recordTtsUsage({
      provider: 'Deepgram Aura',
      text: params.text,
    });
  } catch (e) {}
  return { audio: data.audio, format: data.format || 'audio/mp3', voice: data.voice };
}

export async function deepgramSTT(audioBlob: Blob, languageCode: string): Promise<string> {
  const { transcript } = await transcribeAudioTurn('deepgram', audioBlob, languageCode);
  return transcript;
}

export async function sarvamTTS(params: {
  text: string;
  speaker?: string;
  gender?: 'female' | 'male';
  language?: string;
  emotion?: SpeechEmotion;
}): Promise<{ audio: string; format: string; speaker?: string }> {
  const res = await fetch('/api/sarvam/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.message || 'Sarvam TTS failed');
  try {
    recordTtsUsage({
      provider: 'Sarvam Bulbul v3',
      text: params.text,
    });
  } catch (e) {}
  return { audio: data.audio, format: data.format || 'audio/wav', speaker: data.speaker };
}

export async function sarvamSTT(audioBlob: Blob, languageCode: string): Promise<string> {
  const { transcript } = await transcribeAudioTurn('sarvam', audioBlob, languageCode);
  return transcript;
}

export async function murfTTS(params: {
  text: string;
  voice?: string;
  gender?: 'female' | 'male';
  language?: string;
  emotion?: SpeechEmotion;
}): Promise<{ audioUrl: string; format: string; voice?: string }> {
  const res = await fetch('/api/murf/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.message || 'Murf TTS failed');
  try {
    recordTtsUsage({
      provider: 'Murf Falcon',
      text: params.text,
    });
  } catch (e) {}
  return { audioUrl: data.audioUrl, format: data.format || 'audio/mp3', voice: data.voice };
}

// ─── OpenAI Config & API Services ───────────────────────────────────────────
export async function getOpenAIConfig(): Promise<{
  apiKeyConfigured: boolean;
  keyPreview?: string;
  ttsModel?: string;
  sttModel?: string;
  chatModel?: string;
  voice?: string;
}> {
  const res = await fetch('/api/openai/settings');
  if (!res.ok) return { apiKeyConfigured: false };
  return res.json();
}

export async function updateOpenAIConfig(data: {
  apiKey?: string;
  ttsModel?: string;
  sttModel?: string;
  chatModel?: string;
  voice?: string;
}): Promise<{ success: boolean; apiKeyConfigured: boolean }> {
  const res = await fetch('/api/openai/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update OpenAI config');
  return res.json();
}

export async function openaiTTS(params: {
  text: string;
  voice?: string;
  model?: string;
  gender?: 'female' | 'male';
  language?: string;
  emotion?: SpeechEmotion;
  speed?: number;
}): Promise<{ audio: string; format: string; voice?: string; model?: string }> {
  const res = await fetch('/api/openai/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.message || 'OpenAI TTS failed');
  try {
    recordTtsUsage({
      provider: 'OpenAI TTS-1',
      text: params.text,
    });
  } catch (e) {}
  return { audio: data.audio, format: data.format || 'audio/mp3', voice: data.voice, model: data.model };
}

export async function openaiSTT(
  audioBlob: Blob,
  languageCode: string,
  model?: string
): Promise<string> {
  const { transcript } = await transcribeAudioTurn('openai', audioBlob, languageCode, model);
  return transcript;
}

export async function openaiChat(
  messages: any[],
  model: string = 'gpt-4o-mini',
  leadName?: string,
  language?: string,
  agentName?: string,
  agentGender?: string,
  customerEmotion?: string,
  sessionMemory?: SessionMemory
): Promise<string> {
  const res = await fetch('/api/openai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages,
      model,
      leadName,
      language,
      agentName,
      agentGender,
      customerEmotion,
      sessionMemory,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to chat with OpenAI' }));
    throw new Error(err.message || 'Failed to chat with OpenAI');
  }
  const data = await res.json();
  try {
    recordLlmTurnUsage({
      modelName: model ? `OpenAI (${model})` : 'OpenAI GPT-4o-mini',
      promptTokens: data.usage?.prompt_tokens || estimateTokens(JSON.stringify(messages)),
      completionTokens: data.usage?.completion_tokens || estimateTokens(data.text || ''),
    });
  } catch (e) {}
  return data.text || data.reply || '';
}

// ─── Twilio Physical Calling API Client Functions ───────────────────────────

export interface TwilioConfig {
  configured: boolean;
  accountSid?: string;
  accountSidMasked?: string;
  phoneNumber?: string;
  phoneNumberMasked?: string;
  hasAuthToken: boolean;
}

export async function getTwilioConfig(): Promise<TwilioConfig> {
  const res = await fetch('/api/twilio/settings');
  if (!res.ok) throw new Error('Failed to fetch Twilio configuration');
  return res.json();
}

export async function updateTwilioConfig(data: {
  accountSid?: string;
  authToken?: string;
  phoneNumber?: string;
}): Promise<{ success: boolean; message: string }> {
  const res = await fetch('/api/twilio/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const json = await res.json().catch(() => ({ message: 'Failed to update Twilio settings' }));
  if (!res.ok) {
    throw new Error(json.message || 'Failed to update Twilio settings');
  }
  return json;
}

export async function placeTwilioCall(data: {
  leadId: string;
  phone: string;
  name: string;
  language?: string;
}): Promise<{ success: boolean; callSid?: string; status?: string; message: string }> {
  const res = await fetch('/api/twilio/call', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const json = await res.json().catch(() => ({ message: 'Physical call request failed' }));
  if (!res.ok) {
    throw new Error(json.message || 'Physical call request failed');
  }
  return json;
}
