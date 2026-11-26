import { NextResponse } from 'next/server';
import { getGeminiSettings } from '@/lib/serverConfig';
import { prepareSpeech } from '@/lib/speech';
import { requireAuthenticatedApi } from '@/lib/serverAuth';

export async function POST(req: Request) {
  const auth = await requireAuthenticatedApi(req, { rateLimitBucket: 'ai-voice', maxRequestsPerMinute: 240 });
  if (!auth.ok) return auth.response;

  const apiKey = getGeminiSettings().apiKey;
  const defaultVoice = getGeminiSettings().voice || 'Kore';
  if (!apiKey) {
    return NextResponse.json({ success: false, message: 'Gemini API key is not configured.' }, { status: 503 });
  }

  try {
    const { text, gender = 'female', language, emotion } = await req.json();
    if (typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ success: false, message: 'Text is required.' }, { status: 400 });
    }
    const prepared = prepareSpeech(text, { language, emotion });
    const languageStyle = prepared.language === 'Tamil-English'
      ? prepared.isCodeMixed ? 'natural Tamil-English code-mixed speech' : 'natural Tamil speech'
      : prepared.language === 'Hindi'
      ? prepared.isCodeMixed ? 'natural Hindi-English code-mixed speech' : 'natural Hindi speech'
      : 'natural Indian English speech';

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/interactions?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gemini-3.8-flash-tts',
          input: [{
            type: 'user_input',
            content: [{
              type: 'text',
              text: prepared.text,
              annotations: [{
                type: 'speech_metadata',
                style: `${languageStyle}; ${prepared.delivery.geminiStyle}`,
              }],
            }],
          }],
          response_format: { type: 'audio' },
          generation_config: {
            speech_config: [{ voice: gender === 'male' ? 'Puck' : defaultVoice }],
          },
          store: false,
        }),
      }
    );
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error?.message || `Gemini TTS returned ${response.status}`);
    }

    const audioParts = data?.steps?.flatMap((step: { content?: Array<{ type?: string; data?: string }> }) => step.content || []) || [];
    const audio = data?.output_audio?.data || audioParts.find((part: { type?: string }) => part.type === 'audio')?.data;
    if (!audio) {
      throw new Error('Gemini returned no audio data.');
    }

    return NextResponse.json({ success: true, audio, format: 'audio/wav' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Gemini speech generation failed.';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
