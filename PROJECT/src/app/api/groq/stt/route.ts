import { NextResponse } from 'next/server';
import { getGroqSettings } from '@/lib/serverConfig';
import { requireAuthenticatedApi } from '@/lib/serverAuth';
import {
  mapSttDetectedLanguageToConversationLanguage,
  type SpeechLanguage,
} from '@/lib/speech';

const WHISPER_HALLUCINATION_PHRASES = new Set([
  '',
  'thank you',
  'thank you very much',
  'thanks for watching',
  'you',
  'bye',
  'bye bye',
  'subtitles by',
  'amara org',
]);

interface WhisperSegment {
  text?: string;
  no_speech_prob?: number;
}

interface GroqVerboseResponse {
  text?: string;
  language?: string;
  segments?: WhisperSegment[];
  error?: { message?: string };
}

function isLikelyWhisperSilenceHallucination(data: GroqVerboseResponse, transcript: string): boolean {
  const segments = Array.isArray(data.segments) ? data.segments : [];
  if (segments.length === 0) return false;

  const allHighNoSpeech = segments.every((seg) => (seg.no_speech_prob ?? 0) > 0.88);
  if (!allHighNoSpeech) return false;

  const veryHighNoSpeech = segments.every((seg) => (seg.no_speech_prob ?? 0) > 0.94);
  if (veryHighNoSpeech) return true;

  const normalized = transcript
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return WHISPER_HALLUCINATION_PHRASES.has(normalized);
}

function resolveConversationLanguage(
  detectedLanguage: string | null,
  transcript: string
): SpeechLanguage | null {
  const mapped = mapSttDetectedLanguageToConversationLanguage(detectedLanguage);
  if (mapped) return mapped;
  if (/[\u0900-\u097F]/.test(transcript)) return 'Hindi';
  if (/[\u0B80-\u0BFF]/.test(transcript)) return 'Tamil-English';
  return null;
}

class UpstreamHttpError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function runGroqWhisper(
  apiKey: string,
  audio: File,
  isoLang: string
): Promise<GroqVerboseResponse> {
  const groqForm = new FormData();
  groqForm.append('file', audio, audio.name || 'recording.webm');
  groqForm.append('model', 'whisper-large-v3-turbo');
  groqForm.append('response_format', 'verbose_json');
  groqForm.append('temperature', '0');
  if (isoLang) {
    groqForm.append('language', isoLang);
  }

  const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: groqForm,
  });
  const data = (await response.json()) as GroqVerboseResponse;
  if (!response.ok) {
    const rawMsg = data?.error?.message || `Groq STT returned ${response.status}`;
    const friendlyMsg =
      response.status === 401
        ? 'Groq API key is invalid or expired (401). Please update GROQ_API_KEY in Settings or .env.'
        : rawMsg;
    throw new UpstreamHttpError(friendlyMsg, response.status);
  }
  return data;
}

export async function POST(req: Request) {
  const auth = await requireAuthenticatedApi(req, { rateLimitBucket: 'ai-voice', maxRequestsPerMinute: 240 });
  if (!auth.ok) return auth.response;

  const apiKey = getGroqSettings().apiKey;
  if (!apiKey) {
    return NextResponse.json({ success: false, message: 'Groq API key is not configured.' }, { status: 503 });
  }

  try {
    const formData = await req.formData();
    const audio = formData.get('file');
    const languageCode = String(formData.get('language_code') || '').trim().toLowerCase();
    if (!(audio instanceof File)) {
      return NextResponse.json({ success: false, message: 'An audio file is required.' }, { status: 400 });
    }

    let explicitIsoLang = '';
    if (languageCode && languageCode !== 'auto') {
      if (languageCode.startsWith('hi')) explicitIsoLang = 'hi';
      else if (languageCode.startsWith('ta')) explicitIsoLang = 'ta';
      else if (languageCode.startsWith('en')) explicitIsoLang = 'en';
    }

    let data = await runGroqWhisper(apiKey, audio, explicitIsoLang);
    let transcript = String(data.text || '').trim();
    let detectedLanguage = String(data.language || explicitIsoLang || '').trim().toLowerCase() || null;

    if (isLikelyWhisperSilenceHallucination(data, transcript)) {
      return NextResponse.json({
        success: true,
        transcript: '',
        detectedLanguage,
        conversationLanguage: null,
      });
    }

    // Whisper auto-detect occasionally labels short Hindi audio as Urdu (Perso-Arabic script).
    // Retry once forcing Hindi ('hi') so the transcript renders in clean Devanagari script.
    if (
      !explicitIsoLang &&
      transcript &&
      (detectedLanguage === 'urdu' || detectedLanguage === 'ur' || /[\u0600-\u06FF]/.test(transcript))
    ) {
      data = await runGroqWhisper(apiKey, audio, 'hi');
      transcript = String(data.text || '').trim();
      detectedLanguage = 'hindi';
      if (isLikelyWhisperSilenceHallucination(data, transcript)) {
        transcript = '';
      }
    }

    return NextResponse.json({
      success: true,
      transcript,
      detectedLanguage,
      conversationLanguage: resolveConversationLanguage(detectedLanguage, transcript),
    });
  } catch (error: unknown) {
    const status =
      error instanceof UpstreamHttpError && error.status >= 400 && error.status < 600
        ? error.status
        : 500;
    const message = error instanceof Error ? error.message : 'Groq transcription failed.';
    return NextResponse.json({ success: false, message }, { status });
  }
}
