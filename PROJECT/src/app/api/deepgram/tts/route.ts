import { NextResponse } from 'next/server';
import { prepareSpeech } from '@/lib/speech';

function getDeepgramApiKey(): string {
  return (
    process.env.deepgram_api_key ||
    process.env.DEEPGRAM_API_KEY ||
    ''
  );
}

export async function POST(req: Request) {
  const apiKey = getDeepgramApiKey();
  if (!apiKey) {
    return NextResponse.json(
      { success: false, message: 'Deepgram API key (deepgram_api_key) is not configured in .env.' },
      { status: 503 }
    );
  }

  try {
    const { text, voice, gender, language, emotion } = await req.json();
    if (typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ success: false, message: 'Text is required.' }, { status: 400 });
    }

    const prepared = prepareSpeech(text, { language, emotion });
    const isMale = gender === 'male';

    let model = isMale ? 'aura-orion-en' : 'aura-asteria-en';
    if (typeof voice === 'string' && voice.trim()) {
      model = voice.trim();
    }

    const response = await fetch(`https://api.deepgram.com/v1/speak?model=${encodeURIComponent(model)}`, {
      method: 'POST',
      headers: {
        Authorization: `Token ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: prepared.text }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Deepgram TTS returned ${response.status}: ${errText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    return NextResponse.json({
      success: true,
      audio: base64,
      format: 'audio/mp3',
      voice: model,
    });
  } catch (error: any) {
    const message = error instanceof Error ? error.message : 'Deepgram TTS failed.';
    console.error('[Deepgram TTS Error]:', message);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
