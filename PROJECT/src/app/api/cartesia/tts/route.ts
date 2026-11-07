import { NextResponse } from 'next/server';
import { prepareSpeech } from '@/lib/speech';

function getCartesiaApiKey(): string {
  return (
    process.env.casteria_api_key ||
    process.env.cartesia_api_key ||
    process.env.CARTESIA_API_KEY ||
    ''
  );
}

export async function POST(req: Request) {
  const apiKey = getCartesiaApiKey();
  if (!apiKey) {
    return NextResponse.json(
      { success: false, message: 'Cartesia API key (casteria_api_key) is not configured in .env.' },
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

    let langCode = 'en';
    let voiceId = isMale ? 'd2870b91-1b4c-47ab-81a8-3718d8e9c222' : 'dec57575-274e-4544-b4c5-9058bb26b152'; // Kanmani (Tamil Female)

    if (prepared.language === 'Tamil-English') {
      langCode = 'ta';
      voiceId = isMale ? '19f28c21-ae34-499f-b64a-f7b09cd9b516' : 'dec57575-274e-4544-b4c5-9058bb26b152'; // Karthik / Kanmani
    } else if (prepared.language === 'Hindi') {
      langCode = 'hi';
      voiceId = isMale ? '78e608e9-7258-464d-83c0-badcef173bab' : 'ce45ddca-5f4b-4047-ada3-3fce2bc78acd'; // Ritesh / Kavya
    } else {
      langCode = 'en';
      voiceId = isMale ? '1259b7e3-cb8a-43df-9446-30971a46b8b0' : 'f8f5f1b2-f02d-4d8e-a40d-fd850a487b3d'; // Devansh / Kiara
    }

    if (typeof voice === 'string' && voice.trim()) {
      voiceId = voice.trim();
    }

    const response = await fetch('https://api.cartesia.ai/tts/bytes', {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        'Cartesia-Version': '2024-06-10',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model_id: 'sonic-3.5',
        language: langCode,
        transcript: prepared.text,
        voice: { mode: 'id', id: voiceId },
        output_format: { container: 'wav', encoding: 'pcm_f32le', sample_rate: 44100 },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Cartesia API returned ${response.status}: ${errText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    return NextResponse.json({
      success: true,
      audio: base64,
      format: 'audio/wav',
      voice: voiceId,
      model: 'sonic-3.5',
    });
  } catch (error: any) {
    const message = error instanceof Error ? error.message : 'Cartesia TTS failed.';
    console.error('[Cartesia TTS Error]:', message);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
