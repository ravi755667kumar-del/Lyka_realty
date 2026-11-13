import { NextResponse } from 'next/server';
import { supabaseAdmin, isSupabaseReady } from '@/lib/supabaseUserHistory';
import { getNeonClient, isNeonConfigured } from '@/lib/neon';
import { requireAuthenticatedApi, redactErrorMessage } from '@/lib/serverAuth';

const MAX_RECORDING_BYTES = 25 * 1024 * 1024; // 25 MB limit
const ALLOWED_AUDIO_MIME_TYPES = new Set([
  'audio/webm',
  'audio/mp4',
  'audio/wav',
  'audio/x-wav',
  'audio/ogg',
  'audio/mpeg',
  'audio/mp3',
]);

export async function POST(req: Request) {
  const auth = await requireAuthenticatedApi(req, { rateLimitBucket: 'upload', maxRequestsPerMinute: 60 });
  if (!auth.ok) return auth.response;

  try {
    if (!isSupabaseReady || !supabaseAdmin) {
      return NextResponse.json(
        { success: false, error: 'Supabase storage is not configured' },
        { status: 500 }
      );
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const leadId = (formData.get('leadId') as string) || 'lead_general';
    const callId = (formData.get('callId') as string) || `call_${Date.now()}`;
    const name = (formData.get('name') as string) || '';
    const phone = (formData.get('phone') as string) || '';

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'Audio file is required for upload' },
        { status: 400 }
      );
    }

    const baseMime = (file.type || 'audio/webm').split(';')[0].trim().toLowerCase();
    if (!ALLOWED_AUDIO_MIME_TYPES.has(baseMime)) {
      return NextResponse.json(
        { success: false, error: 'Unsupported file type. Only audio recordings are allowed.' },
        { status: 400 }
      );
    }

    if (file.size > MAX_RECORDING_BYTES) {
      return NextResponse.json(
        { success: false, error: 'Audio recording exceeds maximum allowed size (25 MB).' },
        { status: 413 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Ensure audio file has valid content
    if (buffer.length < 500 || buffer.length > MAX_RECORDING_BYTES) {
      return NextResponse.json(
        { success: false, error: 'Audio recording file size is invalid' },
        { status: 400 }
      );
    }

    const safeLeadId = leadId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
    const safeCallId = callId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
    const ext = file.name?.endsWith('.mp4') ? 'mp4' : file.name?.endsWith('.wav') ? 'wav' : 'webm';
    const filename = `recordings/${safeLeadId}_${safeCallId}_${Date.now()}.${ext}`;

    // 1. Upload to Supabase Storage bucket 'voice-recordings'
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('voice-recordings')
      .upload(filename, buffer, {
        contentType: baseMime,
        upsert: true,
      });

    if (uploadError) {
      console.error('[Supabase Storage] Upload error:', uploadError);
      return NextResponse.json(
        { success: false, error: redactErrorMessage(uploadError, 'Recording upload failed') },
        { status: 500 }
      );
    }

    // 2. Get Public URL for the uploaded voice recording
    const {
      data: { publicUrl },
    } = supabaseAdmin.storage.from('voice-recordings').getPublicUrl(filename);

    // 3. Update Supabase Database records if leads/calls tables exist
    try {
      if (leadId) {
        await supabaseAdmin
          .from('leads')
          .update({ recording_reference: publicUrl, updated_at: new Date().toISOString() })
          .eq('id', leadId);
      }
      if (callId) {
        await supabaseAdmin
          .from('calls')
          .update({ recording_reference: publicUrl })
          .eq('id', callId);
      }
    } catch (dbErr) {
      // Non-blocking if tables are not yet created in Supabase
    }

    // 4. Update Neon DB records if configured
    if (isNeonConfigured()) {
      const sql = getNeonClient();
      if (sql) {
        try {
          if (leadId) {
            await sql`
              UPDATE public.leads
              SET recording_reference = ${publicUrl}, updated_at = NOW()
              WHERE id = ${leadId};
            `;
          }
          if (callId) {
            await sql`
              UPDATE public.calls
              SET recording_reference = ${publicUrl}
              WHERE id = ${callId};
            `;
          }
        } catch (neonErr) {
          console.warn('[Neon DB] Recording reference update warning:', neonErr);
        }
      }
    }

    return NextResponse.json({
      success: true,
      recordingUrl: publicUrl,
      filename,
      bucket: 'voice-recordings',
      message: 'Call recording saved successfully to Supabase Storage bucket voice-recordings',
    });
  } catch (error: any) {
    console.error('[/api/recording/upload] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to process audio recording upload' },
      { status: 500 }
    );
  }
}
