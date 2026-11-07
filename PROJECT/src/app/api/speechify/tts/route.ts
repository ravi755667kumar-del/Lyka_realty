import { NextResponse } from 'next/server';
import { getSpeechifySettings } from '@/lib/serverConfig';
import { prepareSpeech } from '@/lib/speech';

export async function POST(req: Request) {
  const settings = getSpeechifySettings();
  const apiKey = settings.apiKey;
  if (!apiKey) {
    return NextResponse.json(
      { success: false, message: 'Speechify API key is not configured. Please add speechify_api in .env.' },
      { status: 503 }
    );
  }

  try {
    const { text, voice, model, language, gender, emotion } = await req.json();
    if (typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ success: false, message: 'Text is required.' }, { status: 400 });
    }

    const prepared = prepareSpeech(text, { language, emotion });
    const isMale = gender === 'male';

    // Pick appropriate native Indian voice on Speechify based on language & gender
    let selectedVoice = voice;
    if (!selectedVoice) {
      if (prepared.language === 'Tamil-English') {
        selectedVoice = isMale ? 'aadi' : 'abirami';
      } else if (prepared.language === 'Hindi') {
        selectedVoice = isMale ? 'aadi' : 'aaliya';
      } else {
        selectedVoice = isMale ? 'alton' : 'geffen_32';
      }
    }

    const selectedModel = model || settings.model || 'simba-3.5';

    const response = await fetch('https://api.sws.speechify.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: prepared.text,
        model: selectedModel,
        voice_id: selectedVoice,
        audio_format: 'mp3',
      }),
    });

    if (!response.ok) {
      const errDetails = await response.text();
      throw new Error(`Speechify API returned ${response.status}: ${errDetails}`);
    }

    const data = await response.json();
    if (!data.audio_data) {
      throw new Error('Speechify API returned no audio_data.');
    }

    return NextResponse.json({
      success: true,
      audio: data.audio_data,
      format: 'audio/mp3',
      voice: selectedVoice,
      model: selectedModel,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Speechify TTS synthesis failed.';
    console.error('[Speechify TTS Error]:', message);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
