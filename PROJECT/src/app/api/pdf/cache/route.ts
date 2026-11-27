import { NextResponse } from 'next/server';
import { getPDFQueryCacheStats, clearPDFQueryCache, queryBestPDFAnswer } from '@/lib/neon';
import { requireAuthenticatedApi, redactErrorMessage } from '@/lib/serverAuth';

export async function GET(req: Request) {
  const auth = await requireAuthenticatedApi(req, { rateLimitBucket: 'pdf-cache' });
  if (!auth.ok) return auth.response;

  try {
    // Ensure cache is warmed up if not already
    await queryBestPDFAnswer('test warmup query', 'ta');
    const stats = getPDFQueryCacheStats();
    return NextResponse.json({
      status: 'active',
      cacheType: 'In-Memory RAM Fast-Path (0.001ms)',
      ...stats,
    });
  } catch (error: any) {
    return NextResponse.json({ error: redactErrorMessage(error, 'PDF cache warmup failed') }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireAuthenticatedApi(req, { rateLimitBucket: 'pdf-cache' });
  if (!auth.ok) return auth.response;

  try {
    clearPDFQueryCache();
    return NextResponse.json({
      success: true,
      message: 'PDF Query Cache Memory cleared and reset.',
      stats: getPDFQueryCacheStats(),
    });
  } catch (error: any) {
    return NextResponse.json({ error: redactErrorMessage(error, 'PDF cache clear failed') }, { status: 500 });
  }
}
