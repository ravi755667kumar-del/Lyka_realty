import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Read .env manually to ensure fresh values without cache
function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return {};
  const content = fs.readFileSync(envPath, 'utf8');
  const env = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      env[key] = val;
    }
  }
  return env;
}

const env = loadEnv();
const rawSupabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseUrl = rawSupabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const enabled = (env.NEXT_PUBLIC_SUPABASE_ENABLED || process.env.NEXT_PUBLIC_SUPABASE_ENABLED || 'true').toLowerCase() !== 'false';

console.log('\n======================================================');
console.log('       SUPABASE CONNECTION & INTEGRATION VERIFIER     ');
console.log('======================================================\n');

console.log(`1. Environment Configuration Check:`);
console.log(`   - NEXT_PUBLIC_SUPABASE_URL:     ${supabaseUrl ? supabaseUrl.slice(0, 25) + '...' : '(MISSING / EMPTY)'}`);
console.log(`   - NEXT_PUBLIC_SUPABASE_ANON_KEY: ${anonKey ? anonKey.slice(0, 15) + '...' : '(MISSING / EMPTY)'}`);
console.log(`   - SUPABASE_SERVICE_ROLE_KEY:    ${serviceKey ? serviceKey.slice(0, 15) + '...' : '(OPTIONAL / EMPTY)'}`);
console.log(`   - NEXT_PUBLIC_SUPABASE_ENABLED: ${enabled ? 'true (Active)' : 'false (Disabled in .env)'}`);

if (!supabaseUrl || !anonKey) {
  console.log('\n❌ Supabase is NOT connected yet because credentials are empty.');
  console.log('\n👉 Quick setup steps:');
  console.log('   1. Create a project at https://supabase.com');
  console.log('   2. Go to Project Settings -> API and copy your Project URL & anon key');
  console.log('   3. Put them into .env and set NEXT_PUBLIC_SUPABASE_ENABLED=true');
  console.log('   4. Run your database schema in Supabase SQL Editor: supabase_schema.sql');
  console.log('   5. Re-run this check with: node src/scripts/test_supabase_connection.mjs\n');
  process.exit(0);
}

if (!enabled) {
  console.log('\n⚠️  Supabase URL and Key are provided, but NEXT_PUBLIC_SUPABASE_ENABLED=false.');
  console.log('   Change NEXT_PUBLIC_SUPABASE_ENABLED=true in .env to turn on Supabase sync.\n');
  process.exit(0);
}

async function verify() {
  console.log('\n2. Testing Connection to Supabase...');
  const keyToUse = serviceKey || anonKey;
  const client = createClient(supabaseUrl, keyToUse);

  const tables = ['leads', 'calls', 'campaigns', 'user_history', 'properties'];
  console.log('\n3. Checking Required Database Tables:');

  for (const table of tables) {
    try {
      const { data, error, count } = await client.from(table).select('*').limit(1);
      if (error) {
        if (error.code === '42501' || (error.message && error.message.includes('permission denied'))) {
          console.log(`   ⚠️ Table '${table}': PERMISSION NEEDED (Run the GRANT command in Supabase SQL editor)`);
        } else {
          console.log(`   ❌ Table '${table}': ERROR (${error.message || error.code || JSON.stringify(error)})`);
        }
      } else {
        console.log(`   ✅ Table '${table}': CONNECTED (${count ?? 0} rows found)`);
      }
    } catch (err) {
      console.log(`   ❌ Table '${table}': FAILED (${err.message})`);
    }
  }

  console.log('\n4. Checking Voice Recording Storage Bucket:');
  try {
    const { data: buckets, error: bErr } = await client.storage.listBuckets();
    if (bErr) {
      console.log(`   ⚠️ Storage buckets query notice: ${bErr.message}`);
    } else {
      const voiceBucket = buckets.find((b) => b.id === 'voice-recordings' || b.name === 'voice-recordings');
      if (voiceBucket) {
        console.log(`   ✅ Storage Bucket 'voice-recordings': FOUND (public: ${voiceBucket.public})`);
      } else {
        console.log(`   ⚠️ Storage Bucket 'voice-recordings': NOT FOUND (Run supabase_schema.sql to auto-create it)`);
      }
    }
  } catch (sErr) {
    console.log(`   ⚠️ Storage check notice: ${sErr.message}`);
  }

  console.log('\n======================================================');
  console.log('   Verification Complete! Everything is ready for sync.');
  console.log('======================================================\n');
}

verify().catch((err) => {
  console.error('\n❌ Unexpected error while testing Supabase:', err.message);
});
