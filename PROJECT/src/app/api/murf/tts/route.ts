import { NextResponse } from 'next/server';
import { prepareSpeech } from '@/lib/speech';
import { requireAuthenticatedApi } from '@/lib/serverAuth';

function getMurfApiKey(): string {
  return process.env.murf_api || process.env.MURF_API_KEY || '';
}

export async function POST(req: Request) {
  const auth = await requireAuthenticatedApi(req, { rateLimitBucket: 'ai-voice', maxRequestsPerMinute: 240 });
  if (!auth.ok) return auth.response;

  const apiKey = getMurfApiKey();
  if (!apiKey) {
    return NextResponse.json(
      { success: false, message: 'Murf AI API key (murf_api) is not configured in .env.' },
      { status: 503 }
    );
  }

  try {
    const { text, voice, language, gender, emotion } = await req.json();
    if (typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ success: false, message: 'Text is required.' }, { status: 400 });
    }

    const prepared = prepareSpeech(text, { language, emotion });
    const isMale = gender === 'male';

    // Map Murf GEN2 native Indian voices:
    let voiceId = isMale ? 'en-IN-aarav' : 'en-IN-priya';

    if (prepared.language === 'Tamil-English') {
      voiceId = isMale ? 'ta-IN-sarvesh' : 'ta-IN-iniya';
    } else if (prepared.language === 'Hindi') {
      voiceId = isMale ? 'hi-IN-kabir' : 'hi-IN-ayushi';
    } else {
      voiceId = isMale ? 'en-IN-aarav' : 'en-IN-priya';
    }

    if (typeof voice === 'string' && voice.trim()) {
      voiceId = voice.trim();
    }

    const response = await fetch('https://api.murf.ai/v1/speech/generate', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        voiceId,
        text: prepared.text,
        modelVersion: 'GEN2',
        format: 'MP3',
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Murf AI returned ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const audioUrl = data.audioFile;

    if (!audioUrl) {
      throw new Error('Murf AI did not return an audioFile URL.');
    }

    return NextResponse.json({
      success: true,
      audioUrl,
      format: 'audio/mp3',
      voice: voiceId,
    });
  } catch (error: any) {
    const message = error instanceof Error ? error.message : 'Murf TTS failed.';
    console.error('[Murf TTS Error]:', message);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
