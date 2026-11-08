import { createClient } from '@supabase/supabase-js';
import {
  normalizePhone,
  formatSessionText,
  formatQaPairsText,
  formatQualificationText,
  UserHistoryInput,
  UserHistoryRecord,
} from './neon';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || '';

export const isSupabaseReady = Boolean(
  supabaseUrl &&
  serviceRoleKey &&
  supabaseUrl.startsWith('http') &&
  !supabaseUrl.includes('placeholder')
);

// Server-side Supabase client with admin/service-role access (bypasses RLS)
export const supabaseAdmin = isSupabaseReady
  ? createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    })
  : null;

/**
 * Saves or appends user history directly in Supabase DB in pure TEXT format (no binary).
 * Groups by user's mobile number and name:
 * - If user exists: appends new session to `history_text`, increments total_calls.
 * - If new: creates record with total_calls = 1.
 */
export async function saveUserHistoryToSupabase(data: UserHistoryInput): Promise<{
  success: boolean;
  id?: string;
  totalCalls?: number;
  error?: string;
}> {
  if (!supabaseAdmin) {
    return { success: false, error: 'Supabase client is not configured' };
  }

  const name = (data.name || '').trim();
  const phone = (data.phone || '').trim();
  if (!phone && !name) {
    return { success: false, error: 'Name or phone required' };
  }

  const { cleanDigits, last10 } = normalizePhone(phone);
  const nowIso = data.callTime || new Date().toISOString();
  const qualificationText = formatQualificationText(data.qualification);

  try {
    // 1. Check if user already exists in Supabase
    // Match by exact phone OR last 10 digits OR exact name
    let existing: any = null;

    if (phone) {
      const { data: byPhone } = await supabaseAdmin
        .from('user_history')
        .select('*')
        .eq('phone', phone)
        .order('last_call_at', { ascending: false })
        .limit(1);

      if (byPhone && byPhone.length > 0) {
        existing = byPhone[0];
      }
    }

    if (!existing && last10 && last10.length >= 7) {
      const { data: byDigits } = await supabaseAdmin
        .from('user_history')
        .select('*')
        .ilike('phone', `%${last10}`)
        .order('last_call_at', { ascending: false })
        .limit(1);

      if (byDigits && byDigits.length > 0) {
        existing = byDigits[0];
      }
    }

    if (!existing && name && name.length >= 2) {
      const { data: byName } = await supabaseAdmin
        .from('user_history')
        .select('*')
        .ilike('name', name)
        .order('last_call_at', { ascending: false })
        .limit(1);

      if (byName && byName.length > 0) {
        existing = byName[0];
      }
    }

    // 2. If user exists in Supabase, append new session text and increment calls
    if (existing) {
      const nextSessionNumber = (Number(existing.total_calls) || 1) + 1;

      const newSessionText = formatSessionText({
        sessionNumber: nextSessionNumber,
        dateStr: nowIso,
        duration: data.duration,
        outcome: data.outcome,
        status: data.status,
        language: data.language,
        transcript: data.transcript,
        summary: data.summary,
        qualificationText,
      });

      const updatedHistoryText = existing.history_text
        ? `${existing.history_text}\n\n${newSessionText}`
        : newSessionText;

      const newQaText = formatQaPairsText(nextSessionNumber, nowIso, data.qaHistory);
      const updatedQaPairs = existing.qa_pairs_text
        ? (newQaText ? `${existing.qa_pairs_text}\n\n${newQaText}` : existing.qa_pairs_text)
        : (newQaText || '');

      const updatedSummary = data.summary || existing.summary || '';
      const updatedQualText = qualificationText || existing.qualification_text || '';

      const { error: updateErr } = await supabaseAdmin
        .from('user_history')
        .update({
          name: existing.name || name,
          phone: existing.phone || phone,
          total_calls: nextSessionNumber,
          last_call_at: nowIso,
          history_text: updatedHistoryText,
          latest_transcript: data.transcript || existing.latest_transcript || '',
          qa_pairs_text: updatedQaPairs,
          summary: updatedSummary,
          qualification_text: updatedQualText,
          updated_at: nowIso,
        })
        .eq('id', existing.id);

      if (updateErr) {
        console.error('[Supabase DB] update user_history error:', updateErr);
        return { success: false, error: updateErr.message };
      }

      return {
        success: true,
        id: existing.id,
        totalCalls: nextSessionNumber,
      };
    } else {
      // 3. Brand new user in Supabase
      const newId = `uh_${Date.now()}_${cleanDigits.slice(-6) || Math.random().toString(36).substring(2, 7)}`;
      const firstSessionText = formatSessionText({
        sessionNumber: 1,
        dateStr: nowIso,
        duration: data.duration,
        outcome: data.outcome,
        status: data.status,
        language: data.language,
        transcript: data.transcript,
        summary: data.summary,
        qualificationText,
      });

      const firstQaText = formatQaPairsText(1, nowIso, data.qaHistory);

      const { error: insertErr } = await supabaseAdmin
        .from('user_history')
        .insert({
          id: newId,
          name: name || 'Anonymous User',
          phone: phone || 'Unknown Phone',
          total_calls: 1,
          last_call_at: nowIso,
          history_text: firstSessionText,
          latest_transcript: data.transcript || '',
          qa_pairs_text: firstQaText,
          summary: data.summary || '',
          qualification_text: qualificationText || '',
          created_at: nowIso,
          updated_at: nowIso,
        });

      if (insertErr) {
        console.error('[Supabase DB] insert user_history error:', insertErr);
        return { success: false, error: insertErr.message };
      }

      return {
        success: true,
        id: newId,
        totalCalls: 1,
      };
    }
  } catch (err: any) {
    console.error('[Supabase DB] saveUserHistoryToSupabase unexpected error:', err);
    return { success: false, error: err.message || 'Supabase save failed' };
  }
}

/**
 * Retrieves user history from Supabase DB by phone or name.
 */
export async function getUserHistoryFromSupabase(
  phone: string,
  name?: string
): Promise<UserHistoryRecord | null> {
  if (!supabaseAdmin) return null;

  const { last10 } = normalizePhone(phone);
  const cleanName = (name || '').trim();

  try {
    if (phone) {
      const { data } = await supabaseAdmin
        .from('user_history')
        .select('*')
        .eq('phone', phone.trim())
        .order('last_call_at', { ascending: false })
        .limit(1);

      if (data && data.length > 0) return data[0] as UserHistoryRecord;
    }

    if (last10 && last10.length >= 7) {
      const { data } = await supabaseAdmin
        .from('user_history')
        .select('*')
        .ilike('phone', `%${last10}`)
        .order('last_call_at', { ascending: false })
        .limit(1);

      if (data && data.length > 0) return data[0] as UserHistoryRecord;
    }

    if (cleanName && cleanName.length >= 2) {
      const { data } = await supabaseAdmin
        .from('user_history')
        .select('*')
        .ilike('name', cleanName)
        .order('last_call_at', { ascending: false })
        .limit(1);

      if (data && data.length > 0) return data[0] as UserHistoryRecord;
    }

    return null;
  } catch (err) {
    console.warn('[Supabase DB] getUserHistoryFromSupabase error:', err);
    return null;
  }
}

/**
 * Retrieves all user histories from Supabase DB.
 */
export async function getAllUserHistoriesFromSupabase(limit = 100): Promise<UserHistoryRecord[]> {
  if (!supabaseAdmin) return [];

  try {
    const { data, error } = await supabaseAdmin
      .from('user_history')
      .select('*')
      .order('last_call_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.warn('[Supabase DB] getAllUserHistoriesFromSupabase error:', error.message);
      return [];
    }

    return (data || []) as UserHistoryRecord[];
  } catch (err) {
    console.warn('[Supabase DB] getAllUserHistoriesFromSupabase unexpected error:', err);
    return [];
  }
}
