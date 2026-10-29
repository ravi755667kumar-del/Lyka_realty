import { NextResponse } from 'next/server';
import { getSarvamSettings } from '@/lib/serverConfig';
import { refineForSpeech } from '@/lib/speech';

// Sarvam TTS proxy — text → base64 WAV via Bulbul v3.
// Delivery is tuned for a natural, calm, respectful phone voice:
//   pace 0.95  → moderate, comfortable rate (never rushed)
//   loudness 1.5 → consistent, comfortable level for phone playback
//   enable_preprocessing → the engine formats numbers, dates and pauses itself
// Text arriving here is already speech-refined, but we re-run the stage so any
// caller benefits (the transform is idempotent and costs microseconds).

export async function POST(req: Request) {
  const { text, language_code, speaker, pace, loudness } = await req.json().catch(() => ({}));
  if (!text) {
    return NextResponse.json({ success: false, message: 'text is required' }, { status: 400 });
  }

  const sarvamKey = getSarvamSettings().apiKey;
  if (!sarvamKey) {
    return NextResponse.json(
      { success: false, message: 'Sarvam API key not configured. Please set it in Settings.' },
      { status: 503 }
    );
  }

  try {
    const refinedText = refineForSpeech(text);
    console.log(
      `[Sarvam TTS] Synthesizing "${refinedText.substring(0, 60)}..." [${language_code || 'en-IN'}, ${speaker || 'priya'}]`
    );

    const response = await fetch('https://api.sarvam.ai/text-to-speech', {
      method: 'POST',
      headers: {
        'api-subscription-key': sarvamKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        target_language_code: language_code || 'en-IN',
        text: refinedText,
        speaker: speaker || 'priya', // warm natural female voice (matches the Priya persona)
        model: 'bulbul:v3',
        pace: typeof pace === 'number' && pace > 0 ? pace : 0.95,
        loudness: typeof loudness === 'number' && loudness > 0 ? loudness : 1.5,
        enable_preprocessing: true,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error('[Sarvam TTS Error]:', errBody);
      throw new Error(`Sarvam TTS returned ${response.status}: ${errBody}`);
    }

    const data = await response.json();
    // Sarvam returns { audios: [base64_wav_string], ... }
    return NextResponse.json({ success: true, audio: data.audios?.[0] || null });
  } catch (err: any) {
    console.error('[Sarvam TTS error]:', err);
    return NextResponse.json(
      { success: false, message: err.message || 'TTS synthesis failed' },
      { status: 500 }
    );
  }
}
