import { NextResponse } from 'next/server';
import { getOpenAISettings, saveOpenAISettings } from '@/lib/serverConfig';

export async function GET() {
  const settings = getOpenAISettings();
  const apiKeyConfigured = Boolean(settings.apiKey);
  const keyPreview = settings.apiKey
    ? `${settings.apiKey.slice(0, 7)}...${settings.apiKey.slice(-4)}`
    : undefined;

  return NextResponse.json({
    apiKeyConfigured,
    keyPreview,
    ttsModel: settings.ttsModel,
    sttModel: settings.sttModel,
    chatModel: settings.chatModel,
    voice: settings.voice,
  });
}

export async function POST(req: Request) {
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
      { success: false, message: error.message || 'Failed to update OpenAI settings' },
      { status: 500 }
    );
  }
}
