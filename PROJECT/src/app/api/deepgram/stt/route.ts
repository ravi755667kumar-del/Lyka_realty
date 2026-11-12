import { NextResponse } from 'next/server';
import { mapSttDetectedLanguageToConversationLanguage } from '@/lib/speech';

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
    const languageCode = String(formData.get('language_code') || 'auto').trim().toLowerCase();

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, message: 'Audio file is required.' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const queryParams = new URLSearchParams({
      model: 'nova-2',
      smart_format: 'true',
    });

    if (!languageCode || languageCode === 'auto') {
      queryParams.set('detect_language', 'true');
    } else if (languageCode.startsWith('ta')) {
      queryParams.set('language', 'ta');
    } else if (languageCode.startsWith('hi')) {
      queryParams.set('language', 'hi');
    } else {
      queryParams.set('language', 'en');
    }

    const url = `https://api.deepgram.com/v1/listen?${queryParams.toString()}`;

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
    const channel = data.results?.channels?.[0];
    const transcript = String(channel?.alternatives?.[0]?.transcript || '').trim();
    const detectedLanguage =
      String(
        channel?.detected_language ||
          (!languageCode || languageCode === 'auto' ? '' : queryParams.get('language') || '')
      )
        .trim()
        .toLowerCase() || null;

    const conversationLanguage =
      mapSttDetectedLanguageToConversationLanguage(detectedLanguage) ||
      (/[\u0900-\u097F]/.test(transcript)
        ? 'Hindi'
        : /[\u0B80-\u0BFF]/.test(transcript)
          ? 'Tamil-English'
          : null);

    return NextResponse.json({
      success: true,
      transcript,
      detectedLanguage,
      conversationLanguage,
    });
  } catch (error: any) {
    const message = error instanceof Error ? error.message : 'Deepgram STT failed.';
    console.error('[Deepgram STT Error]:', message);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
