import { NextResponse } from 'next/server';
import { getGroqSettings, saveGroqSettings } from '@/lib/serverConfig';
import { requireAuthenticatedApi } from '@/lib/serverAuth';

export async function GET(req: Request) {
  const auth = await requireAuthenticatedApi(req, { rateLimitBucket: 'settings' });
  if (!auth.ok) return auth.response;

  const current = getGroqSettings();
  return NextResponse.json({
    apiKeyConfigured: Boolean(current.apiKey && current.apiKey.length > 5),
  });
}

export async function POST(req: Request) {
  const auth = await requireAuthenticatedApi(req, { rateLimitBucket: 'settings' });
  if (!auth.ok) return auth.response;

  try {
    const data = await req.json();
    saveGroqSettings(data);
    return NextResponse.json({
      success: true,
      message: 'Groq AI configuration updated successfully.',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to update Groq settings.' },
      { status: 500 }
    );
  }
}
