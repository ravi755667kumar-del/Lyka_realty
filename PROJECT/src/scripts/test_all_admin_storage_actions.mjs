import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Load .env
function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  const content = fs.readFileSync(envPath, 'utf8');
  const env = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
    }
  }
  return env;
}

const env = loadEnv();
const url = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || anonKey;

const client = createClient(url, anonKey);
const adminClient = createClient(url, serviceKey);

async function runStorageVerification() {
  console.log('\n================================================================');
  console.log('   END-TO-END VERIFICATION: DOES EVERYTHING STORE IN SUPABASE?   ');
  console.log('================================================================\n');

  let passCount = 0;
  let totalCount = 0;

  async function check(actionName, fn) {
    totalCount++;
    try {
      await fn();
      passCount++;
      console.log(`✅ [PASS] ${actionName}`);
    } catch (err) {
      console.error(`❌ [FAIL] ${actionName}:`, err.message);
    }
  }

  // 1. ADD LEAD
  const testLeadId = `lead_verify_${Date.now()}`;
  await check('1. Admin adds a Lead (stores in Supabase leads table)', async () => {
    const { error: insErr } = await client.from('leads').insert({
      id: testLeadId,
      name: 'Ravi Admin Test',
      phone: '+91 98401 99999',
      consent: true,
      status: 'PENDING',
      outcome: 'HOT',
      language: 'Tamil-English',
      budget: 'Rs. 72 Lakhs',
      location: 'Velachery, Chennai',
      timeline: 'Immediate',
      summary: 'Admin created lead for verification',
      call_count: 0
    });
    if (insErr) throw insErr;

    // Verify it was saved
    const { data, error: selErr } = await client.from('leads').select('*').eq('id', testLeadId).single();
    if (selErr) throw selErr;
    if (data.name !== 'Ravi Admin Test') throw new Error('Lead name mismatch');
  });

  // 2. CSV BULK LEADS
  const testCsvId1 = `lead_csv_1_${Date.now()}`;
  const testCsvId2 = `lead_csv_2_${Date.now()}`;
  await check('2. Admin uploads CSV Leads (stores multiple rows in Supabase leads)', async () => {
    const { error: bulkErr } = await client.from('leads').insert([
      { id: testCsvId1, name: 'CSV Lead 1', phone: '+91 91111 11111', status: 'PENDING' },
      { id: testCsvId2, name: 'CSV Lead 2', phone: '+91 92222 22222', status: 'PENDING' }
    ]);
    if (bulkErr) throw bulkErr;

    const { data: rows, error: selErr } = await client.from('leads').select('id').in('id', [testCsvId1, testCsvId2]);
    if (selErr) throw selErr;
    if (rows.length !== 2) throw new Error(`Expected 2 leads, found ${rows.length}`);
  });

  // 3. UPDATE LEAD
  await check('3. Admin edits Lead details (updates row in Supabase leads)', async () => {
    const { error: upErr } = await client.from('leads').update({
      status: 'Completed',
      outcome: 'HOT',
      budget: 'Rs. 85 Lakhs',
      next_action: 'Site visit scheduled for Saturday'
    }).eq('id', testLeadId);
    if (upErr) throw upErr;

    const { data, error: selErr } = await client.from('leads').select('budget, status').eq('id', testLeadId).single();
    if (selErr) throw selErr;
    if (data.budget !== 'Rs. 85 Lakhs') throw new Error('Updated budget mismatch');
  });

  // 4. LOG CALL & TRANSCRIPT
  const testCallId = `call_verify_${Date.now()}`;
  await check('4. Call completes & transcript generated (stores in Supabase calls table)', async () => {
    const { error: callErr } = await client.from('calls').insert({
      id: testCallId,
      customer_id: testLeadId,
      name: 'Ravi Admin Test',
      phone: '+91 98401 99999',
      language: 'Tamil-English',
      status: 'Completed',
      outcome: 'HOT',
      started_at: new Date().toISOString(),
      duration: 75,
      summary: 'Customer confirmed interest in 2BHK flat Velachery',
      transcript: 'AI: Vanakkam! Ravi: Yes, I want 2BHK in Velachery.'
    });
    if (callErr) throw callErr;

    const { data, error: selErr } = await client.from('calls').select('*').eq('id', testCallId).single();
    if (selErr) throw selErr;
    if (!data.transcript.includes('Vanakkam')) throw new Error('Transcript not stored');
  });

  // 5. CUMULATIVE USER TALK HISTORY
  const userHistoryId = `uh_verify_${Date.now()}`;
  await check('5. Multi-call history & AI memory (stores in Supabase user_history table)', async () => {
    const { error: uhErr } = await adminClient.from('user_history').insert({
      id: userHistoryId,
      name: 'Ravi Admin Test',
      phone: '+91 98401 99999',
      total_calls: 1,
      history_text: 'Session 1: Customer interested in Velachery 2BHK at 72L.',
      latest_transcript: 'AI: Vanakkam! Ravi: Yes, I want 2BHK.',
      qa_pairs_text: 'Q: What location? A: Velachery',
      summary: 'Verified hot lead for site visit'
    });
    if (uhErr) throw uhErr;

    const { data, error: selErr } = await adminClient.from('user_history').select('*').eq('id', userHistoryId).single();
    if (selErr) throw selErr;
    if (!data.history_text.includes('Velachery')) throw new Error('User history not stored');
  });

  // 6. PROPERTY CATALOG
  const testPropId = `prop_verify_${Date.now()}`;
  await check('6. Admin adds a Property (stores in Supabase properties table)', async () => {
    const { error: propErr } = await adminClient.from('properties').insert({
      id: testPropId,
      title: '3BHK Villa in ECR Akkarai',
      property_type: 'Villa',
      bhk: '3 BHK',
      listing_type: 'Buy',
      price: 'Rs. 2.1 Crore',
      size: '2200 sq ft',
      location: 'ECR Akkarai, Chennai',
      nearby_location: 'Near Akkarai Beach, 10 mins to Thiruvanmiyur',
      description: 'Luxury beachside villa with swimming pool and private terrace.',
      possession: 'Ready to Move',
      next_step: 'Shall I book an exclusive site walkthrough for you?'
    });
    if (propErr) throw propErr;

    const { data, error: selErr } = await client.from('properties').select('*').eq('id', testPropId).single();
    if (selErr) throw selErr;
    if (data.title !== '3BHK Villa in ECR Akkarai') throw new Error('Property title mismatch');
  });

  // 7. VOICE RECORDING STORAGE
  const testAudioFilename = `voice_recordings/test_call_recording_${Date.now()}.mp3`;
  await check('7. Call voice audio is uploaded (stores in Supabase voice-recordings bucket)', async () => {
    const dummyAudioBuffer = Buffer.from('ID3...mp3_dummy_audio_bytes_testing_supabase_storage...');
    const { error: upErr } = await adminClient.storage
      .from('voice-recordings')
      .upload(testAudioFilename, dummyAudioBuffer, { contentType: 'audio/mpeg', upsert: true });
    if (upErr) throw upErr;

    // Check public URL
    const { data: pubData } = adminClient.storage.from('voice-recordings').getPublicUrl(testAudioFilename);
    if (!pubData?.publicUrl) throw new Error('Public audio URL not generated');

    // Clean up test file
    await adminClient.storage.from('voice-recordings').remove([testAudioFilename]);
  });

  // 8. CAMPAIGN STATE
  await check('8. Outbound Calling Campaign runs (stores live state in Supabase campaigns table)', async () => {
    const { error: campErr } = await client.from('campaigns').upsert({
      id: 'lyka_cold_call_mvp',
      name: 'Lyka Realty Outbound Cold-Calling MVP',
      is_running: true,
      active_lead_id: testLeadId,
      active_lead_name: 'Ravi Admin Test',
      active_lead_phone: '+91 98401 99999',
      total_leads: 10,
      completed_calls: 1,
      hot_count: 1
    });
    if (campErr) throw campErr;

    const { data, error: selErr } = await client.from('campaigns').select('*').eq('id', 'lyka_cold_call_mvp').single();
    if (selErr) throw selErr;
    if (data.hot_count !== 1) throw new Error('Campaign state mismatch');

    // Reset campaign to idle
    await client.from('campaigns').update({ is_running: false }).eq('id', 'lyka_cold_call_mvp');
  });

  // 9. CLEANUP TEST DATA
  await check('9. Admin deletes a Lead (deletes from Supabase leads table)', async () => {
    await client.from('leads').delete().in('id', [testLeadId, testCsvId1, testCsvId2]);
    await client.from('calls').delete().eq('id', testCallId);
    await adminClient.from('user_history').delete().eq('id', userHistoryId);
    await adminClient.from('properties').delete().eq('id', testPropId);

    const { data: verifyLead } = await client.from('leads').select('id').eq('id', testLeadId);
    if (verifyLead && verifyLead.length > 0) throw new Error('Lead was not cleaned up');
  });

  console.log('\n================================================================');
  console.log(` RESULT: ${passCount} / ${totalCount} OPERATIONS STORED IN SUPABASE SUCCESSFULLY!`);
  console.log('================================================================\n');

  if (passCount === totalCount) {
    console.log('🎉 YES! Every single piece of admin data is 100% saved in Supabase!\n');
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runStorageVerification();
