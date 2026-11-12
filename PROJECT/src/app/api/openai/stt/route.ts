import { NextResponse } from 'next/server';
import { getOpenAISettings } from '@/lib/serverConfig';
import { mapSttDetectedLanguageToConversationLanguage } from '@/lib/speech';

function getExplicitIsoLang(languageCode: string): string {
  const normalized = languageCode.trim().toLowerCase();
  if (!normalized || normalized === 'auto') return '';
  if (normalized.startsWith('ta')) return 'ta';
  if (normalized.startsWith('hi')) return 'hi';
  if (normalized.startsWith('en')) return 'en';
  return '';
}

async function callOpenAIStt(
  apiKey: string,
  file: Blob,
  fileName: string,
  requestedModel: string,
  isoLang: string
) {
  const openAiFormData = new FormData();
  openAiFormData.append('file', file, fileName);
  openAiFormData.append('model', requestedModel);
  openAiFormData.append('temperature', '0.0');
  if (isoLang) {
    openAiFormData.append('language', isoLang);
  }
  if (requestedModel === 'whisper-1') {
    openAiFormData.append('response_format', 'verbose_json');
  }

  return fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: openAiFormData,
  });
}

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
    const languageCode = String(formData.get('language_code') || 'auto');
    const requestedModel = String(formData.get('model') || settings.sttModel || 'whisper-1');

    if (!file || typeof file === 'string') {
      return NextResponse.json({ success: false, message: 'Audio file is required.' }, { status: 400 });
    }

    const fileName = file instanceof File && file.name ? file.name : 'recording.webm';
    const explicitIsoLang = getExplicitIsoLang(languageCode);

    let response = await callOpenAIStt(apiKey, file, fileName, requestedModel, explicitIsoLang);

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json(
        { success: false, message: `OpenAI STT error (${response.status}): ${errText}` },
        { status: response.status }
      );
    }

    let data = await response.json();
    let transcript = String(data.text || '').trim();
    let detectedLanguage = String(data.language || explicitIsoLang || '').trim().toLowerCase() || null;

    if (
      !explicitIsoLang &&
      transcript &&
      (detectedLanguage === 'urdu' || detectedLanguage === 'ur' || /[\u0600-\u06FF]/.test(transcript))
    ) {
      response = await callOpenAIStt(apiKey, file, fileName, requestedModel, 'hi');
      if (response.ok) {
        data = await response.json();
        transcript = String(data.text || '').trim();
        detectedLanguage = 'hindi';
      }
    }

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
      model: requestedModel,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'OpenAI STT request failed.' },
      { status: 500 }
    );
  }
}
