import { NextResponse } from 'next/server';
import { getGeminiSettings } from '@/lib/serverConfig';
import { mapSttDetectedLanguageToConversationLanguage } from '@/lib/speech';

export async function POST(req: Request) {
  const apiKey = getGeminiSettings().apiKey;
  if (!apiKey) {
    return NextResponse.json({ success: false, message: 'Gemini API key is not configured.' }, { status: 503 });
  }

  try {
    const formData = await req.formData();
    const audio = formData.get('file');
    const languageCode = String(formData.get('language_code') || '').trim();
    if (!(audio instanceof File)) {
      return NextResponse.json({ success: false, message: 'An audio file is required.' }, { status: 400 });
    }

    const lowerLang = languageCode.toLowerCase();
    const scriptHint = lowerLang.startsWith('hi')
      ? 'Write Hindi or Hinglish speech in clean Devanagari Hindi script (हिंदी).'
      : 'Keep the original language and script; do not translate, summarize, or answer. Preserve code-switching.';

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
                text: `Transcribe the audio exactly as spoken. ${scriptHint} Expected language: ${languageCode || 'auto-detect'}. Return only the transcript.`,
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

    const transcript = (data?.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text || '')
      .join('')
      .trim()) || '';
    const conversationLanguage =
      (/[\u0900-\u097F]/.test(transcript) || lowerLang.startsWith('hi'))
        ? 'Hindi'
        : (/[\u0B80-\u0BFF]/.test(transcript) || lowerLang.startsWith('ta'))
          ? 'Tamil-English'
          : mapSttDetectedLanguageToConversationLanguage(lowerLang) || null;
    return NextResponse.json({
      success: true,
      transcript,
      detectedLanguage: lowerLang && lowerLang !== 'auto' ? lowerLang : null,
      conversationLanguage,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Gemini transcription failed.';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
