import { NextResponse } from 'next/server';
import { getOpenAISettings } from '@/lib/serverConfig';

export async function POST(req: Request) {
  const settings = getOpenAISettings();
  const apiKey = settings.apiKey;

  if (!apiKey) {
    return NextResponse.json(
      { success: false, message: 'OpenAI API key (OPENAI_API_KEY / openai_key) is not configured.' },
      { status: 503 }
    );
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file');
    const languageCode = String(formData.get('language_code') || 'en-IN');
    const requestedModel = String(formData.get('model') || settings.sttModel || 'whisper-1');

    if (!file || typeof file === 'string') {
      return NextResponse.json({ success: false, message: 'Audio file is required.' }, { status: 400 });
    }

    // Map language code: whisper supports ISO 639-1 ('ta', 'hi', 'en')
    let isoLang = 'en';
    if (languageCode.startsWith('ta')) isoLang = 'ta';
    else if (languageCode.startsWith('hi')) isoLang = 'hi';

    const openAiFormData = new FormData();
    openAiFormData.append('file', file, 'recording.webm');
    openAiFormData.append('model', requestedModel);
    openAiFormData.append('language', isoLang);
    openAiFormData.append('temperature', '0.0');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: openAiFormData,
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json(
        { success: false, message: `OpenAI STT error (${response.status}): ${errText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    const transcript = data.text || '';

    return NextResponse.json({
      success: true,
      transcript: transcript.trim(),
      model: requestedModel,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'OpenAI STT request failed.' },
      { status: 500 }
    );
  }
}
