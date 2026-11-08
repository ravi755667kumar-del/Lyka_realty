import fs from 'fs';
import path from 'path';
import { neon } from '@neondatabase/serverless';

const envPath = path.resolve(process.cwd(), '.env');
const env = fs.readFileSync(envPath, 'utf8');
const match = env.match(/neon_db\s*=\s*(.+)/);
if (!match) {
  console.error('neon_db not found in .env');
  process.exit(1);
}
const connStr = match[1].trim();
const sql = neon(connStr);

async function setup() {
  console.log('Connecting to Neon DB...');
  await sql.query(`
    CREATE TABLE IF NOT EXISTS public.user_history (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      total_calls INTEGER DEFAULT 1,
      last_call_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      history_text TEXT NOT NULL,
      latest_transcript TEXT,
      qa_pairs_text TEXT,
      summary TEXT,
      qualification_text TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);
  console.log('Created public.user_history table');

  await sql.query(`
    CREATE INDEX IF NOT EXISTS idx_user_history_phone ON public.user_history(phone)
  `);
  await sql.query(`
    CREATE INDEX IF NOT EXISTS idx_user_history_name_phone ON public.user_history(name, phone)
  `);
  console.log('Created indexes on (name, phone)');

  const cols = await sql.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'user_history';
  `);
  console.log('user_history columns:');
  console.table(cols);
}

setup().catch(console.error);
