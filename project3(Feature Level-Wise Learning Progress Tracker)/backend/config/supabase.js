import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootEnvPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: rootEnvPath, override: true });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;

let supabase = null;

const isPlaceholder = !supabaseUrl || 
  supabaseUrl.includes('your-project-id') || 
  supabaseUrl.includes('placeholder') || 
  supabaseUrl === 'your_supabase_project_url' ||
  !supabaseKey ||
  supabaseKey.includes('your-supabase');

if (!isPlaceholder) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    console.log('✅ Supabase client successfully initialized with URL:', supabaseUrl);
  } catch (error) {
    console.warn('⚠️ Failed to initialize Supabase client:', error.message);
  }
} else {
  console.log('ℹ️ Running in local persistent database mode (backend/data/store.json).');
}

export const getSupabaseClient = () => supabase;
export const isSupabaseConfigured = () => Boolean(supabase);
