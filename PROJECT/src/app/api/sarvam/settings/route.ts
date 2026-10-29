import { NextResponse } from 'next/server';
import { getSarvamSettings, saveSarvamSettings } from '@/lib/serverConfig';

export async function GET() {
  const current = getSarvamSettings();
  return NextResponse.json({
    apiKeyConfigured: Boolean(current.apiKey && current.apiKey.length > 5),
  });
}

export async function POST(req: Request) {
  try {
    const data = await req.json();
    saveSarvamSettings(data);
    return NextResponse.json({
      success: true,
      message: 'Sarvam AI configuration updated successfully.',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to update Sarvam settings.' },
      { status: 500 }
    );
  }
}
