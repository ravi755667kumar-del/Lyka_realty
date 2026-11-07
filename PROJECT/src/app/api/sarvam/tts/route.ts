import { NextResponse } from 'next/server';
import { prepareSpeech, getSarvamSpeaker } from '@/lib/speech';

function getSarvamApiKey(): string {
  return (
    process.env.SARVAM_API_KEY ||
    process.env.sarvam_api_key ||
    ''
  );
}

export async function POST(req: Request) {
  const apiKey = getSarvamApiKey();
  if (!apiKey) {
    return NextResponse.json(
      { success: false, message: 'Sarvam API key (SARVAM_API_KEY) is not configured in .env.' },
      { status: 503 }
    );
  }

  try {
    const { text, speaker, language, gender, emotion } = await req.json();
    if (typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ success: false, message: 'Text is required.' }, { status: 400 });
    }

    const prepared = prepareSpeech(text, { language, emotion });
    const isMale = gender === 'male';

    let targetLangCode = 'ta-IN';
    if (prepared.language === 'Hindi') {
      targetLangCode = 'hi-IN';
    } else if (prepared.language === 'English') {
      targetLangCode = 'en-IN';
    }

    const selectedSpeaker =
      typeof speaker === 'string' && speaker.trim()
        ? speaker.trim()
        : getSarvamSpeaker(prepared.language, isMale ? 'male' : 'female');

    const response = await fetch('https://api.sarvam.ai/text-to-speech', {
      method: 'POST',
      headers: {
        'api-subscription-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: [prepared.text],
        target_language_code: targetLangCode,
        speaker: selectedSpeaker,
        model: 'bulbul:v3',
        pace: prepared.delivery.pace,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Sarvam TTS returned ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const base64Audio = data.audios?.[0] || '';

    if (!base64Audio) {
      throw new Error('Sarvam AI returned no audio.');
    }

    return NextResponse.json({
      success: true,
      audio: base64Audio,
      format: 'audio/wav',
      speaker: selectedSpeaker,
    });
  } catch (error: any) {
    const message = error instanceof Error ? error.message : 'Sarvam TTS failed.';
    console.error('[Sarvam TTS Error]:', message);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
