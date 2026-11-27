import { NextResponse } from 'next/server';
import { getGeminiSettings } from '@/lib/serverConfig';
import { prepareSpeech } from '@/lib/speech';
import { requireAuthenticatedApi } from '@/lib/serverAuth';

export async function POST(req: Request) {
  const auth = await requireAuthenticatedApi(req, { rateLimitBucket: 'ai-voice', maxRequestsPerMinute: 240 });
  if (!auth.ok) return auth.response;

  const apiKey = getGeminiSettings().apiKey;
  const defaultVoice = getGeminiSettings().voice || 'Kore';
  if (!apiKey) {
    return NextResponse.json({ success: false, message: 'Gemini API key is not configured.' }, { status: 503 });
  }

  try {
    const { text, gender = 'female', language, emotion } = await req.json();
    if (typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ success: false, message: 'Text is required.' }, { status: 400 });
    }

    const prepared = prepareSpeech(text, { language, emotion });
    const voiceName = gender === 'male' ? 'Puck' : defaultVoice;

    // Try gemini-3.8-flash-tts first, fall back to gemini-2.5-flash-preview-tts
    const ttsModels = ['gemini-3.8-flash-tts', 'gemini-2.5-flash-preview-tts'];
    let audio: string | null = null;
    let lastError = '';

    for (const model of ttsModels) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: prepared.text }] }],
              generationConfig: {
                responseModalities: ['AUDIO'],
                speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: { voiceName },
                  },
                },
              },
            }),
          }
        );

        const data = await response.json();
        if (!response.ok) {
          lastError = data?.error?.message || `Gemini TTS returned ${response.status}`;
          console.warn(`[Gemini TTS] Model ${model} failed:`, lastError);
          continue;
        }

        // Extract base64 audio from inlineData
        const parts = data?.candidates?.[0]?.content?.parts || [];
        const audioPart = parts.find((p: { inlineData?: { data?: string } }) => p.inlineData?.data);
        if (audioPart?.inlineData?.data) {
          audio = audioPart.inlineData.data;
          break;
        }

        lastError = 'Gemini returned no audio data.';
      } catch (err: unknown) {
        lastError = err instanceof Error ? err.message : 'Unknown error';
        console.warn(`[Gemini TTS] Model ${model} exception:`, lastError);
      }
    }

    if (!audio) {
      throw new Error(lastError || 'Gemini TTS: all models failed to generate audio.');
    }

    return NextResponse.json({ success: true, audio, format: 'audio/wav' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Gemini speech generation failed.';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
