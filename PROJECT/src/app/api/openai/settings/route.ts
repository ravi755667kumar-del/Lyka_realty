import { NextResponse } from 'next/server';
import { getOpenAISettings, saveOpenAISettings } from '@/lib/serverConfig';
import { requireAuthenticatedApi, redactErrorMessage } from '@/lib/serverAuth';

export async function GET(req: Request) {
  const auth = await requireAuthenticatedApi(req, { rateLimitBucket: 'settings' });
  if (!auth.ok) return auth.response;

  const settings = getOpenAISettings();
  const apiKeyConfigured = Boolean(settings.apiKey);

  return NextResponse.json({
    apiKeyConfigured,
    ttsModel: settings.ttsModel,
    sttModel: settings.sttModel,
    chatModel: settings.chatModel,
    voice: settings.voice,
  });
}

export async function POST(req: Request) {
  const auth = await requireAuthenticatedApi(req, { rateLimitBucket: 'settings' });
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const updated = saveOpenAISettings(body);
    return NextResponse.json({
      success: true,
      apiKeyConfigured: Boolean(updated.apiKey),
      ttsModel: updated.ttsModel,
      sttModel: updated.sttModel,
      chatModel: updated.chatModel,
      voice: updated.voice,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: redactErrorMessage(error, 'Failed to update OpenAI settings') },
      { status: 500 }
    );
  }
}
