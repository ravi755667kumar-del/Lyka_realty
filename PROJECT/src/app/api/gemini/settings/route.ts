import { NextResponse } from 'next/server';
import { getGeminiSettings, saveGeminiSettings } from '@/lib/serverConfig';
import { requireAuthenticatedApi, redactErrorMessage } from '@/lib/serverAuth';

export async function GET(req: Request) {
  const auth = await requireAuthenticatedApi(req, { rateLimitBucket: 'settings' });
  if (!auth.ok) return auth.response;

  const current = getGeminiSettings();
  return NextResponse.json({
    apiKeyConfigured: Boolean(current.apiKey && current.apiKey.length > 5),
    voice: current.voice || 'Kore',
    model: current.model || 'gemini-4-neon',
  });
}

export async function POST(req: Request) {
  const auth = await requireAuthenticatedApi(req, { rateLimitBucket: 'settings' });
  if (!auth.ok) return auth.response;

  try {
    const data = await req.json();
    const apiKey = typeof data?.apiKey === 'string' ? data.apiKey.trim().slice(0, 256) : undefined;
    const voice = typeof data?.voice === 'string' ? data.voice.trim().slice(0, 50) : undefined;
    const model = typeof data?.model === 'string' ? data.model.trim().slice(0, 80) : undefined;
    saveGeminiSettings({ apiKey, voice, model });
    return NextResponse.json({
      success: true,
      message: 'Gemini AI configuration updated successfully.',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: redactErrorMessage(error, 'Failed to update Gemini settings.') },
      { status: 500 }
    );
  }
}
