import { NextResponse } from 'next/server';
import { supabaseAdmin, isSupabaseReady } from '@/lib/supabaseUserHistory';
import { getNeonClient, isNeonConfigured } from '@/lib/neon';

export async function POST(req: Request) {
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

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Ensure audio file has valid content
    if (buffer.length < 500) {
      return NextResponse.json(
        { success: false, error: 'Audio recording file is too small or empty' },
        { status: 400 }
      );
    }

    const safeLeadId = leadId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeCallId = callId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const ext = file.name?.endsWith('.mp4') ? 'mp4' : file.name?.endsWith('.wav') ? 'wav' : 'webm';
    const filename = `recordings/${safeLeadId}_${safeCallId}_${Date.now()}.${ext}`;

    // 1. Upload to Supabase Storage bucket 'voice-recordings'
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('voice-recordings')
      .upload(filename, buffer, {
        contentType: file.type || 'audio/webm',
        upsert: true,
      });

    if (uploadError) {
      console.error('[Supabase Storage] Upload error:', uploadError);
      return NextResponse.json(
        { success: false, error: uploadError.message },
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
