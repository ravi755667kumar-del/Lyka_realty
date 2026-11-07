import { NextResponse } from 'next/server';

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
    const formData = await req.formData();
    const file = formData.get('file');
    const languageCode = String(formData.get('language_code') || 'ta-IN');

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, message: 'Audio file is required.' }, { status: 400 });
    }

    const sarvamFormData = new FormData();
    sarvamFormData.append('file', file, 'speech.webm');
    sarvamFormData.append('model', 'saaras:v1');
    sarvamFormData.append('language_code', languageCode);

    const response = await fetch('https://api.sarvam.ai/speech-to-text', {
      method: 'POST',
      headers: {
        'api-subscription-key': apiKey,
      },
      body: sarvamFormData,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Sarvam STT returned ${response.status}: ${errText}`);
    }

    const data = await response.json();
    return NextResponse.json({
      success: true,
      transcript: (data.transcript || '').trim(),
    });
  } catch (error: any) {
    const message = error instanceof Error ? error.message : 'Sarvam STT failed.';
    console.error('[Sarvam STT Error]:', message);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
