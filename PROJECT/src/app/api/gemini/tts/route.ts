import { NextResponse } from 'next/server';
import { getGeminiSettings } from '@/lib/serverConfig';
import { GEMINI_TTS_MODELS } from '@/lib/geminiClient';
import { prepareSpeech } from '@/lib/speech';
import { requireAuthenticatedApi, redactErrorMessage } from '@/lib/serverAuth';

/** Wraps raw 16-bit mono PCM audio in a standard 44-byte RIFF/WAV header if needed. */
function ensurePlayableWavBase64(base64Data: string, mimeType = ''): string {
  const raw = Buffer.from(base64Data, 'base64');
  if (raw.length >= 4 && raw.subarray(0, 4).toString('ascii') === 'RIFF') {
    return base64Data;
  }
  const rateMatch = mimeType.match(/rate=(\d+)/i);
  const sampleRate = rateMatch ? Number(rateMatch[1]) || 24000 : 24000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 4, 'ascii');
  header.writeUInt32LE(36 + raw.length, 4);
  header.write('WAVE', 8, 4, 'ascii');
  header.write('fmt ', 12, 4, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36, 4, 'ascii');
  header.writeUInt32LE(raw.length, 40);
  return Buffer.concat([header, raw]).toString('base64');
}

export async function POST(req: Request) {
  const auth = await requireAuthenticatedApi(req, { rateLimitBucket: 'ai-voice', maxRequestsPerMinute: 240 });
  if (!auth.ok) return auth.response;

  const geminiSettings = getGeminiSettings();
  const apiKey = geminiSettings.apiKey;
  const defaultVoice = geminiSettings.voice || 'Kore';
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

    let audio: string | null = null;
    let usedModel = '';
    let lastError = '';

    for (const model of GEMINI_TTS_MODELS) {
      // Preview TTS rejects unprompted conversational sentences unless framed verbatim
      const promptText = model.includes('2.5-flash')
        ? `Read aloud verbatim without adding or answering anything: ${prepared.text}`
        : prepared.text;

      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': apiKey,
            },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: promptText }] }],
              generationConfig: {
                responseModalities: ['AUDIO'],
                speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: { voiceName },
                  },
                },
              },
            }),
            signal: AbortSignal.timeout(12000),
          }
        );

        const data = await response.json();
        if (!response.ok) {
          lastError = data?.error?.message || `Gemini TTS returned ${response.status}`;
          console.warn(`[Gemini TTS] Model ${model} failed:`, lastError);
          continue;
        }

        const parts = data?.candidates?.[0]?.content?.parts || [];
        const audioPart = parts.find((p: { inlineData?: { data?: string; mimeType?: string } }) => p.inlineData?.data);
        if (audioPart?.inlineData?.data) {
          audio = ensurePlayableWavBase64(audioPart.inlineData.data, audioPart.inlineData.mimeType);
          usedModel = model;
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

    return NextResponse.json({ success: true, audio, format: 'audio/wav', model: usedModel });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, message: redactErrorMessage(error, 'Gemini speech generation failed.') },
      { status: 500 }
    );
  }
}
