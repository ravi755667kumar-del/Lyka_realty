import { NextResponse } from 'next/server';
import { getGeminiSettings } from '@/lib/serverConfig';
import { buildGeminiSttCandidates, callGeminiGenerateContent } from '@/lib/geminiClient';
import {
  detectUserConversationLanguage,
  mapSttDetectedLanguageToConversationLanguage,
} from '@/lib/speech';
import { requireAuthenticatedApi, redactErrorMessage } from '@/lib/serverAuth';

export async function POST(req: Request) {
  const auth = await requireAuthenticatedApi(req, { rateLimitBucket: 'ai-voice', maxRequestsPerMinute: 240 });
  if (!auth.ok) return auth.response;

  const geminiSettings = getGeminiSettings();
  const apiKey = geminiSettings.apiKey;
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
      ? 'Write Hindi or Hinglish speech in clean Devanagari Hindi script (हिंदी). If the caller switches to Tamil or English, write Tamil in Tamil script (தமிழ்) and English cleanly in English.'
      : lowerLang.startsWith('ta')
        ? 'Write spoken Tamil words in clean Tamil script (தமிழ்), English sentences or property terms (1 BHK, 2 BHK, sq ft, Velachery, OMR) in English, and Hindi in Devanagari Hindi script (हिंदी).'
        : 'Write spoken Tamil words in clean Tamil script (தமிழ்), Hindi words in clean Devanagari Hindi script (हिंदी), and English speech in clean English. Keep property terms like 1 BHK, 2 BHK, 3 BHK, sq ft as spoken. Do not translate, summarize, or answer.';

    const audioData = Buffer.from(await audio.arrayBuffer()).toString('base64');
    const sttModels = buildGeminiSttCandidates(geminiSettings.model);
    const result = await callGeminiGenerateContent({
      apiKey,
      models: sttModels,
      contents: [
        {
          parts: [
            {
              text: `Transcribe the audio verbatim as spoken. ${scriptHint} Expected language: ${languageCode || 'auto-detect'}. Return only the transcript.`,
            },
            {
              inlineData: {
                mimeType: audio.type.split(';', 1)[0] || 'audio/webm',
                data: audioData,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 256,
      },
      disableThinking: false,
      logScope: 'Gemini STT',
    });

    if (!result.ok) {
      throw new Error(result.lastError || `Gemini STT returned ${result.status}`);
    }

    const transcript = result.text;
    const hintedLang = mapSttDetectedLanguageToConversationLanguage(lowerLang);
    const detected = detectUserConversationLanguage(transcript, hintedLang || 'Tamil-English');
    const conversationLanguage = /[\u0900-\u097F]/.test(transcript)
      ? 'Hindi'
      : /[\u0B80-\u0BFF]/.test(transcript)
        ? 'Tamil-English'
        : detected.reason !== 'unchanged'
          ? detected.language
          : hintedLang || null;

    return NextResponse.json({
      success: true,
      transcript,
      model: result.model,
      detectedLanguage: lowerLang && lowerLang !== 'auto' ? lowerLang : null,
      conversationLanguage,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, message: redactErrorMessage(error, 'Gemini transcription failed.') },
      { status: 500 }
    );
  }
}
