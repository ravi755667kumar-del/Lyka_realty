import { NextResponse } from 'next/server';
import { getGroqSettings } from '@/lib/serverConfig';

export async function POST(req: Request) {
  const apiKey = getGroqSettings().apiKey;
  if (!apiKey) {
    return NextResponse.json({ success: false, message: 'Groq API key is not configured.' }, { status: 503 });
  }

  try {
    const formData = await req.formData();
    const audio = formData.get('file');
    const languageCode = String(formData.get('language_code') || '');
    if (!(audio instanceof File)) {
      return NextResponse.json({ success: false, message: 'An audio file is required.' }, { status: 400 });
    }

    const groqForm = new FormData();
    groqForm.append('file', audio, audio.name || 'recording.webm');
    groqForm.append('model', 'whisper-large-v3-turbo');
    groqForm.append('response_format', 'json');
    if (languageCode.startsWith('hi')) groqForm.append('language', 'hi');
    else if (languageCode.startsWith('ta')) groqForm.append('language', 'ta');
    else if (languageCode.startsWith('en')) groqForm.append('language', 'en');

    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: groqForm,
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error?.message || `Groq STT returned ${response.status}`);
    }

    return NextResponse.json({ success: true, transcript: data.text || '' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Groq transcription failed.';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
