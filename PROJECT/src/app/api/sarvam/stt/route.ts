import { NextResponse } from 'next/server';
import { getSarvamSettings } from '@/lib/serverConfig';

// Sarvam STT proxy — forwards the recorded audio blob to Saaras v2 and
// returns the transcript. The browser MediaRecorder sends multipart/form-data
// (file + model + language_code + with_timestamps), which we pass through
// unchanged apart from the subscription header.

export async function POST(req: Request) {
  const sarvamKey = getSarvamSettings().apiKey;
  if (!sarvamKey) {
    return NextResponse.json(
      { success: false, message: 'Sarvam API key not configured.' },
      { status: 503 }
    );
  }

  try {
    const contentType = req.headers.get('content-type') || '';
    const body = await req.arrayBuffer();

    const response = await fetch('https://api.sarvam.ai/speech-to-text', {
      method: 'POST',
      headers: {
        'api-subscription-key': sarvamKey,
        'content-type': contentType,
      },
      body,
    });

    const data = await response.json();
    if (!response.ok) {
      const detail = data?.error?.message || data?.detail || data?.message || `Sarvam STT returned ${response.status}`;
      throw new Error(detail);
    }
    return NextResponse.json({ success: true, transcript: data.transcript || '' });
  } catch (err: any) {
    console.error('[Sarvam STT error]:', err);
    return NextResponse.json(
      { success: false, message: err.message || 'STT transcription failed' },
      { status: 500 }
    );
  }
}
