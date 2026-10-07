import { doc, onSnapshot, setDoc, Unsubscribe } from 'firebase/firestore';
import { db } from '../firebase/config';
import { handleFirestoreError, OperationType } from '../firebase/errors';
import { CampaignState, VapiConfig } from '../types';

const CAMPAIGN_DOC_PATH = 'campaigns/lyka_cold_call_mvp';

export function subscribeToCampaignState(
  onUpdate: (state: CampaignState | null) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, CAMPAIGN_DOC_PATH),
    (snap) => {
      if (snap.exists()) {
        onUpdate({ id: snap.id, ...(snap.data() as Omit<CampaignState, 'id'>) });
      } else {
        onUpdate(null);
      }
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.GET, CAMPAIGN_DOC_PATH);
    }
  );
}

export async function initCampaignDoc(): Promise<void> {
  try {
    const docRef = doc(db, CAMPAIGN_DOC_PATH);
    await setDoc(
      docRef,
      {
        id: 'lyka_cold_call_mvp',
        name: 'Lyka Realty Outbound Cold-Calling MVP',
        isRunning: false,
        activeLeadId: null,
        activeLeadName: null,
        activeLeadPhone: null,
        totalLeads: 0,
        completedCalls: 0,
        hotCount: 0,
        warmCount: 0,
        coldCount: 0,
        optOutCount: 0,
        noAnswerCount: 0,
        agentCallbackCount: 0,
        lastUpdated: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, CAMPAIGN_DOC_PATH);
  }
}

// Server API calls
export async function startCampaignAPI(): Promise<{ success: boolean; message: string; activeLead?: any }> {
  const res = await fetch('/api/campaign/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to start campaign' }));
    throw new Error(err.message || 'Failed to start campaign');
  }
  return res.json();
}

export async function stopCampaignAPI(): Promise<{ success: boolean; message: string }> {
  const res = await fetch('/api/campaign/stop', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to stop campaign' }));
    throw new Error(err.message || 'Failed to stop campaign');
  }
  return res.json();
}

export async function callSingleLeadAPI(leadId: string): Promise<{ success: boolean; message: string; callId?: string; simulated?: boolean }> {
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

// ─── Sarvam AI API Client Functions ──────────────────────────────────────────

/** Fetch Sarvam API config status (just whether key is configured) */
export async function getSarvamConfig(): Promise<{ apiKeyConfigured: boolean }> {
  const res = await fetch('/api/sarvam/settings');
  if (!res.ok) throw new Error('Failed to fetch Sarvam settings');
  return res.json();
}

/** Save Sarvam API key to server (never stored on client) */
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
  language_code: string;   // e.g. 'en-IN', 'hi-IN', 'ta-IN'
  speaker?: string;        // e.g. 'anushka', 'ishita', 'pavithra', 'meera'
  pace?: number;           // 0.5 – 2.0
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
  return data.audio as string | null;  // base64 WAV
}

/**
 * Sarvam Speech-to-Text via server proxy.
 * Accepts a Blob (WAV/WebM audio) and returns the transcript string.
 */
export async function sarvamSTT(audioBlob: Blob, languageCode: string): Promise<string> {
  const formData = new FormData();
  formData.append('file', audioBlob, 'recording.wav');
  formData.append('model', 'saaras:v2');
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

export async function groqChat(messages: any[], model: string = 'llama-3.1-70b-versatile'): Promise<string> {
  const res = await fetch('/api/groq/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, model }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to chat with Groq' }));
    throw new Error(err.message || 'Failed to chat with Groq');
  }
  const data = await res.json();
  return data.text;
}
