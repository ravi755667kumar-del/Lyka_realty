import { NextResponse } from 'next/server';
import { requireAuthenticatedApi } from '@/lib/serverAuth';

export async function POST(req: Request) {
  const auth = await requireAuthenticatedApi(req, { rateLimitBucket: 'campaign' });
  if (!auth.ok) return auth.response;

  return NextResponse.json({
    success: true,
    message: 'Campaign started successfully.',
  });
}
