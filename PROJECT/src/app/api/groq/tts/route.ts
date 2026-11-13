import { NextResponse } from 'next/server';
import { getGroqSettings } from '@/lib/serverConfig';
import { prepareSpeech } from '@/lib/speech';
import { requireAuthenticatedApi } from '@/lib/serverAuth';

export async function POST(req: Request) {
  const auth = await requireAuthenticatedApi(req, { rateLimitBucket: 'ai-voice', maxRequestsPerMinute: 240 });
  if (!auth.ok) return auth.response;

  const settings = getGroqSettings();
  const apiKey = settings.apiKey;
  const defaultVoice = settings.voice || 'autumn';
  if (!apiKey) {
    return NextResponse.json({ success: false, message: 'Groq API key is not configured.' }, { status: 503 });
  }

  try {
    const { text, voice, speed, language, emotion } = await req.json();
    if (typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ success: false, message: 'Text is required.' }, { status: 400 });
    }
    const prepared = prepareSpeech(text, { language, emotion });

    const response = await fetch('https://api.groq.com/openai/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'audio/wav',
      },
      body: JSON.stringify({
        model: 'canopylabs/orpheus-v1-english',
        input: prepared.text,
        voice: typeof voice === 'string' && voice.trim() ? voice.trim() : defaultVoice,
        response_format: 'wav',
        speed: Math.max(0.7, Math.min(1.2, Number(speed) || prepared.delivery.pace)),
      }),
    });

    if (!response.ok) {
      const details = await response.text();
      // Detect terms-not-accepted — return 503 so the client can gracefully auto-fallback
      if (response.status === 400 && details.includes('model_terms_required')) {
        return NextResponse.json(
          {
            success: false,
            message:
              'Groq Orpheus TTS requires terms acceptance. Visit https://console.groq.com/playground?model=canopylabs%2Forpheus-v1-english and accept as org admin, then try again.',
            code: 'model_terms_required',
          },
          { status: 503 }
        );
      }
      throw new Error(`Groq TTS returned ${response.status}: ${details}`);
    }

    const audio = Buffer.from(await response.arrayBuffer()).toString('base64');
    return NextResponse.json({ success: true, audio, format: response.headers.get('content-type') || 'audio/wav' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Groq speech generation failed.';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
