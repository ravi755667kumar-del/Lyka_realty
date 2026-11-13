import { NextResponse } from 'next/server';
import { isNeonConfigured, initNeonSchema, getNeonClient } from '@/lib/neon';
import { requireAuthenticatedApi } from '@/lib/serverAuth';

export async function GET(req: Request) {
  const auth = await requireAuthenticatedApi(req, { rateLimitBucket: 'neon-status' });
  if (!auth.ok) return auth.response;

  const configured = isNeonConfigured();
  if (!configured) {
    return NextResponse.json({
      configured: false,
      connected: false,
      message: 'Neon DB is not configured.',
    });
  }

  const sql = getNeonClient();
  if (!sql) {
    return NextResponse.json({
      configured: true,
      connected: false,
      message: 'Failed to initialize Neon DB client',
    });
  }

  try {
    const res = await sql`SELECT NOW() as current_time;`;
    await initNeonSchema();
    return NextResponse.json({
      configured: true,
      connected: true,
      time: res[0]?.current_time,
      message: 'Connected to Neon PostgreSQL successfully',
    });
  } catch (err: any) {
    console.error('[Neon Status Error]:', err);
    return NextResponse.json({
      configured: true,
      connected: false,
      message: 'Database connection check failed.',
    });
  }
}
