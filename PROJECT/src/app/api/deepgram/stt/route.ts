import { NextResponse } from 'next/server';

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
    const formData = await req.formData();
    const file = formData.get('file');
    const languageCode = String(formData.get('language_code') || 'en-IN');

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, message: 'Audio file is required.' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Map language code: Deepgram Nova-3 supports multilingual
    let dgLang = 'en';
    if (languageCode.startsWith('ta')) dgLang = 'ta';
    else if (languageCode.startsWith('hi')) dgLang = 'hi';

    const url = `https://api.deepgram.com/v1/listen?model=nova-2&language=${dgLang}&smart_format=true`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Token ${apiKey}`,
        'Content-Type': file.type || 'audio/webm',
      },
      body: buffer,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Deepgram STT returned ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const transcript = data.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';

    return NextResponse.json({
      success: true,
      transcript: transcript.trim(),
    });
  } catch (error: any) {
    const message = error instanceof Error ? error.message : 'Deepgram STT failed.';
    console.error('[Deepgram STT Error]:', message);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
