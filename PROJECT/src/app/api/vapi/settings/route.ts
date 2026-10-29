import { NextResponse } from 'next/server';
import { getVapiSettings, saveVapiSettings } from '@/lib/serverConfig';

export async function GET() {
  const current = getVapiSettings();
  return NextResponse.json({
    apiKeyConfigured: Boolean(current.apiKey && current.apiKey.length > 5),
    phoneNumberIdConfigured: Boolean(current.phoneNumberId && current.phoneNumberId.length > 3),
    assistantIdConfigured: Boolean(current.assistantId && current.assistantId.length > 3),
    phoneNumberId: current.phoneNumberId || '',
    assistantId: current.assistantId || '',
    hasCustomKey: Boolean(current.apiKey && !process.env.VAPI_API_KEY),
  });
}

export async function POST(req: Request) {
  try {
    const data = await req.json();
    saveVapiSettings(data);
    return NextResponse.json({
      success: true,
      message: 'Vapi configuration updated successfully.',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to update settings.' },
      { status: 500 }
    );
  }
}
