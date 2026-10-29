import { NextResponse } from 'next/server';
import { isNeonConfigured, initNeonSchema, getNeonClient } from '@/lib/neon';

export async function GET() {
  const configured = isNeonConfigured();
  if (!configured) {
    return NextResponse.json({
      configured: false,
      connected: false,
      message: 'Neon DB connection string has placeholder password (asterisks). Please add actual password in .env',
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
    const res = await sql`SELECT NOW() as current_time, current_database() as db_name;`;
    await initNeonSchema();
    return NextResponse.json({
      configured: true,
      connected: true,
      database: res[0]?.db_name,
      time: res[0]?.current_time,
      message: 'Connected to Neon PostgreSQL successfully',
    });
  } catch (err: any) {
    return NextResponse.json({
      configured: true,
      connected: false,
      error: err.message,
    });
  }
}
