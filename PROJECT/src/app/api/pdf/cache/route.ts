import { NextResponse } from 'next/server';
import { getPDFQueryCacheStats, clearPDFQueryCache, queryBestPDFAnswer } from '@/lib/neon';

export async function GET() {
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST() {
  try {
    clearPDFQueryCache();
    return NextResponse.json({
      success: true,
      message: 'PDF Query Cache Memory cleared and reset.',
      stats: getPDFQueryCacheStats(),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
