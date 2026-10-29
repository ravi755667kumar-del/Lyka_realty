import { NextResponse } from 'next/server';
import { saveCallToNeon, isNeonConfigured } from '@/lib/neon';

export async function POST(req: Request) {
  try {
    if (!isNeonConfigured()) {
      return NextResponse.json({
        success: false,
        message: 'Neon database is not configured. Check neon_db in .env',
      });
    }

    const body = await req.json();
    const success = await saveCallToNeon(body);

    return NextResponse.json({
      success,
      message: success ? 'Call record saved to Neon DB successfully' : 'Failed to save call to Neon DB',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Neon save call error' },
      { status: 500 }
    );
  }
}
