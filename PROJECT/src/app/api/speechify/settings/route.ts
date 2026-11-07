import { NextResponse } from 'next/server';
import { getSpeechifySettings, saveSpeechifySettings } from '@/lib/serverConfig';

export async function GET() {
  const current = getSpeechifySettings();
  return NextResponse.json({
    apiKeyConfigured: Boolean(current.apiKey && current.apiKey.length > 5),
    voice: current.voice,
    model: current.model,
  });
}

export async function POST(req: Request) {
  try {
    const data = await req.json();
    saveSpeechifySettings(data);
    return NextResponse.json({
      success: true,
      message: 'Speechify configuration updated successfully.',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to update Speechify settings.' },
      { status: 500 }
    );
  }
}
