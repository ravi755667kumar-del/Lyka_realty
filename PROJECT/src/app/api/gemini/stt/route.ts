import { NextResponse } from 'next/server';
import { getGeminiSettings } from '@/lib/serverConfig';

export async function POST(req: Request) {
  const apiKey = getGeminiSettings().apiKey;
  if (!apiKey) {
    return NextResponse.json({ success: false, message: 'Gemini API key is not configured.' }, { status: 503 });
  }

  try {
    const formData = await req.formData();
    const audio = formData.get('file');
    const languageCode = String(formData.get('language_code') || '');
    if (!(audio instanceof File)) {
      return NextResponse.json({ success: false, message: 'An audio file is required.' }, { status: 400 });
    }

    const audioData = Buffer.from(await audio.arrayBuffer()).toString('base64');
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                text: `Transcribe the audio exactly as spoken. Keep the original language and script; do not translate, summarize, or answer. Preserve code-switching. Expected language: ${languageCode || 'auto-detect'}. Return only the transcript.`,
              },
              {
                inlineData: {
                  mimeType: audio.type.split(';', 1)[0] || 'audio/webm',
                  data: audioData,
                },
              },
            ],
          }],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 256,
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      }
    );
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error?.message || `Gemini STT returned ${response.status}`);
    }

    const transcript = data?.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text || '')
      .join('')
      .trim();
    return NextResponse.json({ success: true, transcript: transcript || '' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Gemini transcription failed.';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
