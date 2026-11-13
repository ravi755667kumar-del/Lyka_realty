import { NextResponse } from 'next/server';
import { getOpenAISettings } from '@/lib/serverConfig';
import { prepareSpeech } from '@/lib/speech';
import { requireAuthenticatedApi } from '@/lib/serverAuth';

export async function POST(req: Request) {
  const auth = await requireAuthenticatedApi(req, { rateLimitBucket: 'ai-voice', maxRequestsPerMinute: 240 });
  if (!auth.ok) return auth.response;

  const settings = getOpenAISettings();
  const apiKey = settings.apiKey;

  if (!apiKey) {
    return NextResponse.json(
      { success: false, message: 'OpenAI API key (OPENAI_API_KEY / openai_key) is not configured.' },
      { status: 503 }
    );
  }

  try {
    const { text, voice, model, speed, language, gender, emotion } = await req.json();

    if (typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ success: false, message: 'Text is required.' }, { status: 400 });
    }

    const prepared = prepareSpeech(text, { language, emotion });
    const isMale = gender === 'male';

    // Model selection: 'tts-1' (low latency fast), 'tts-1-hd', or 'gpt-4o-mini-tts'
    const activeModel = model || settings.ttsModel || 'tts-1';

    // Voice selection:
    // Female (Priya): nova (natural warm), shimmer (bright lively), coral (expressive)
    // Male (Karthik): onyx (authoritative), echo (smooth), ash (modern)
    let activeVoice = voice || settings.voice;
    if (!voice) {
      activeVoice = isMale ? 'onyx' : 'nova';
    }

    // Speed: 0.25 to 4.0. Telecallers sound brisk and natural at 1.05 - 1.08x
    const activeSpeed = Math.min(2.0, Math.max(0.5, Number(speed) || prepared.delivery.pace || 1.05));

    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: activeModel,
        input: prepared.text,
        voice: activeVoice,
        response_format: 'mp3',
        speed: activeSpeed,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json(
        { success: false, message: `OpenAI TTS error (${response.status}): ${errText}` },
        { status: response.status }
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const base64Audio = Buffer.from(arrayBuffer).toString('base64');

    return NextResponse.json({
      success: true,
      audio: base64Audio,
      format: 'audio/mp3',
      voice: activeVoice,
      model: activeModel,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'OpenAI TTS request failed.' },
      { status: 500 }
    );
  }
}
