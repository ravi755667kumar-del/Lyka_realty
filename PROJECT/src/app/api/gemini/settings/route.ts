import { NextResponse } from 'next/server';
import { getGeminiSettings, saveGeminiSettings } from '@/lib/serverConfig';

export async function GET() {
  const current = getGeminiSettings();
  return NextResponse.json({
    apiKeyConfigured: Boolean(current.apiKey && current.apiKey.length > 5),
    voice: current.voice || 'Kore',
  });
}

export async function POST(req: Request) {
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
