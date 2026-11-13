import { NextResponse } from 'next/server';
import { getGeminiSettings, saveGeminiSettings } from '@/lib/serverConfig';
import { requireAuthenticatedApi } from '@/lib/serverAuth';

export async function GET(req: Request) {
  const auth = await requireAuthenticatedApi(req, { rateLimitBucket: 'settings' });
  if (!auth.ok) return auth.response;

  const current = getGeminiSettings();
  return NextResponse.json({
    apiKeyConfigured: Boolean(current.apiKey && current.apiKey.length > 5),
    voice: current.voice || 'Kore',
  });
}

export async function POST(req: Request) {
  const auth = await requireAuthenticatedApi(req, { rateLimitBucket: 'settings' });
  if (!auth.ok) return auth.response;

  try {
    const data = await req.json();
    saveGeminiSettings(data);
    return NextResponse.json({
      success: true,
      message: 'Gemini AI configuration updated successfully.',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to update Gemini settings.' },
      { status: 500 }
    );
  }
}
