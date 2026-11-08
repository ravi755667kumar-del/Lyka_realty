import { NextResponse } from 'next/server';
import {
  saveUserHistoryToNeon,
  getUserHistoryByPhoneAndName,
  getAllUserHistories,
  isNeonConfigured,
} from '@/lib/neon';
import {
  saveUserHistoryToSupabase,
  getUserHistoryFromSupabase,
  getAllUserHistoriesFromSupabase,
  isSupabaseReady,
} from '@/lib/supabaseUserHistory';

/**
 * GET /api/user-history
 * Query parameters:
 *   - phone: User's mobile number (e.g. +91 98401 23456 or 9840123456)
 *   - name: User's full name (optional, used for fallback / matching)
 *   - limit: Maximum records to return if querying all users (default: 50)
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const phone = searchParams.get('phone');
    const name = searchParams.get('name');
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    // If specific phone or name requested, fetch single user accumulated history
    if (phone || name) {
      // 1. Try Supabase first
      let history = null;
      let source = 'Supabase DB';
      if (isSupabaseReady) {
        history = await getUserHistoryFromSupabase(phone || '', name || '');
      }

      // 2. Fallback to Neon DB if not found in Supabase
      if (!history && isNeonConfigured()) {
        history = await getUserHistoryByPhoneAndName(phone || '', name || '');
        source = 'Neon DB';
      }

      return NextResponse.json({
        success: true,
        source: history ? source : undefined,
        userHistory: history,
        message: history
          ? `Found history for ${history.name} (${history.phone}) with ${history.total_calls} calls (from ${source}).`
          : 'No user history record found for the provided details.',
      });
    }

    // Otherwise, return all user histories
    let all: any[] = [];
    if (isSupabaseReady) {
      all = await getAllUserHistoriesFromSupabase(limit);
    }
    if ((!all || all.length === 0) && isNeonConfigured()) {
      all = await getAllUserHistories(limit);
    }

    return NextResponse.json({
      success: true,
      count: all.length,
      userHistories: all,
    });
  } catch (error: any) {
    console.error('[/api/user-history GET] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch user history' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/user-history
 * Body payload:
 * {
 *   name: string;
 *   phone: string;
 *   transcript?: string;
 *   qaHistory?: any[];
 *   summary?: string;
 *   qualification?: any;
 *   duration?: number;
 *   outcome?: string;
 *   status?: string;
 *   language?: string;
 *   callTime?: string;
 * }
 *
 * Saves or appends user history in pure text format (grouped by mobile no and name).
 * Stores directly into Supabase DB (and keeps Neon DB in sync).
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (!body.phone && !body.name) {
      return NextResponse.json(
        { success: false, error: 'User name or mobile phone number is required.' },
        { status: 400 }
      );
    }

    const payload = {
      name: body.name,
      phone: body.phone,
      transcript: body.transcript,
      qaHistory: body.qaHistory,
      summary: body.summary,
      qualification: body.qualification,
      duration: body.duration,
      outcome: body.outcome,
      status: body.status,
      language: body.language,
      callTime: body.callTime,
    };

    let supabaseResult = { success: false, id: '', totalCalls: 0, error: '' };
    let neonResult = { success: false, id: '', totalCalls: 0, error: '' };

    // 1. Store in Supabase DB
    if (isSupabaseReady) {
      supabaseResult = (await saveUserHistoryToSupabase(payload)) as any;
    }

    // 2. Also store in Neon DB (dual-write to keep both synchronized)
    if (isNeonConfigured()) {
      neonResult = (await saveUserHistoryToNeon(payload)) as any;
    }

    const isSuccess = supabaseResult.success || neonResult.success;
    const finalId = supabaseResult.id || neonResult.id;
    const finalCalls = supabaseResult.totalCalls || neonResult.totalCalls || 1;

    if (!isSuccess) {
      return NextResponse.json(
        {
          success: false,
          error: supabaseResult.error || neonResult.error || 'Failed to save user history to database',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      id: finalId,
      totalCalls: finalCalls,
      storedIn: {
        supabase: supabaseResult.success,
        neon: neonResult.success,
      },
      message: `User history successfully stored in text format. Total calls: ${finalCalls}.`,
    });
  } catch (error: any) {
    console.error('[/api/user-history POST] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to process user history' },
      { status: 500 }
    );
  }
}
