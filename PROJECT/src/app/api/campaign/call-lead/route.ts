import { NextResponse } from 'next/server';
import { requireAuthenticatedApi } from '@/lib/serverAuth';

export async function POST(req: Request) {
  const auth = await requireAuthenticatedApi(req, { rateLimitBucket: 'campaign' });
  if (!auth.ok) return auth.response;

  try {
    const { leadId } = await req.json();
    return NextResponse.json({
      success: true,
      message: `Call initiated for lead ${leadId}. Launching browser AI telecaller.`,
      simulated: true,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Call lead error' },
      { status: 500 }
    );
  }
}
