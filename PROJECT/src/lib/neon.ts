import { neon } from '@neondatabase/serverless';

export function getNeonConnectionString(): string {
  return (
    process.env.neon_db ||
    process.env.DATABASE_URL ||
    process.env.NEON_DATABASE_URL ||
    ''
  );
}

export function isNeonConfigured(): boolean {
  const conn = getNeonConnectionString();
  return Boolean(conn && conn.length > 20 && !conn.includes('****'));
}

export function getNeonClient() {
  const conn = getNeonConnectionString();
  if (!conn || conn.includes('****')) {
    return null;
  }
  try {
    return neon(conn);
  } catch (err) {
    console.warn('[Neon DB] Client initialization error:', err);
    return null;
  }
}

/**
 * Auto-initializes Neon Database schema tables if they do not exist.
 */
export async function initNeonSchema(): Promise<boolean> {
  const sql = getNeonClient();
  if (!sql) return false;

  try {
    // 1. Leads Table
    await sql`
      CREATE TABLE IF NOT EXISTS public.leads (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        consent BOOLEAN DEFAULT TRUE,
        blocked BOOLEAN DEFAULT FALSE,
        status TEXT DEFAULT 'PENDING',
        language TEXT DEFAULT 'English',
        outcome TEXT DEFAULT 'PENDING',
        last_call_id TEXT,
        call_count INTEGER DEFAULT 0,
        call_time TEXT,
        duration INTEGER DEFAULT 0,
        transcript TEXT,
        summary TEXT,
        buyer_or_investor TEXT,
        budget TEXT,
        location TEXT,
        timeline TEXT,
        next_action TEXT,
        recording_reference TEXT,
        vapi_call_id TEXT,
        created_by TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;

    // 2. Calls Table (Turn-by-turn logs & talk history)
    await sql`
      CREATE TABLE IF NOT EXISTS public.calls (
        id TEXT PRIMARY KEY,
        customer_id TEXT,
        name TEXT,
        phone TEXT,
        language TEXT DEFAULT 'English',
        status TEXT,
        outcome TEXT,
        started_at TEXT,
        ended_at TEXT,
        duration INTEGER DEFAULT 0,
        qualification JSONB DEFAULT '{}'::jsonb,
        summary TEXT,
        transcript TEXT,
        no_answer BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;

    // 3. PDF Knowledge Base Table (PDF properties, FAQs, and scripts)
    await sql`
      CREATE TABLE IF NOT EXISTS public.pdf_knowledge (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL,
        title TEXT NOT NULL,
        property_type TEXT,
        location TEXT,
        size TEXT,
        price TEXT,
        status TEXT,
        features TEXT,
        keywords TEXT,
        raw_content TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;

    // Seed PDF Listings if table is empty
    await seedPDFKnowledgeTable();

    return true;
  } catch (err) {
    console.error('[Neon DB] Schema initialization error:', err);
    return false;
  }
}

/**
 * Seeds the PDF Property listings (P101-P106) and knowledge base into Neon DB.
 */
export async function seedPDFKnowledgeTable(): Promise<void> {
  const sql = getNeonClient();
  if (!sql) return;

  try {
    const existing = await sql`SELECT COUNT(*)::int as count FROM public.pdf_knowledge;`;
    if (existing[0]?.count > 0) return;

    const listings = [
      {
        id: 'pdf_p101',
        code: 'P101',
        title: '2BHK Apartment in Velachery',
        property_type: '2 BHK Flat / Apartment',
        location: 'Velachery, Chennai',
        size: '950 sq ft',
        price: 'Rs. 72 Lakhs',
        status: 'Ready to Move',
        features: 'Ready to move, 2 car parking, lift, near MRT station, bank loan assistance available from partner banks (SBI, HDFC, ICICI).',
        keywords: 'velachery, 2bhk, apartment, flat, 72 lakhs, 950 sq ft, ready to move, car parking, mrt',
        raw_content: 'P101: 2BHK in Velachery, 950 sq ft, Rs. 72 Lakhs, ready to move, 2 car parking, lift, near MRT station. Partner bank loan assistance available.',
      },
      {
        id: 'pdf_p102',
        code: 'P102',
        title: '3BHK Apartment in OMR Sholinganallur',
        property_type: '3 BHK Flat / Apartment',
        location: 'OMR, Sholinganallur, Chennai',
        size: '1450 sq ft',
        price: 'Rs. 1.25 Crore',
        status: 'Under Construction (Possession Dec 2026)',
        features: 'Gym, swimming pool, CMDA approved, possession Dec 2026, premium IT corridor connectivity.',
        keywords: 'omr, sholinganallur, 3bhk, 1.25 crore, gym, pool, cmda, it corridor',
        raw_content: 'P102: 3BHK in OMR Sholinganallur, 1450 sq ft, Rs. 1.25 Crore, gym, swimming pool, CMDA approved, Dec 2026 possession.',
      },
      {
        id: 'pdf_p103',
        code: 'P103',
        title: 'Individual House / Villa in Tambaram',
        property_type: 'Individual House (3 BHK)',
        location: 'Tambaram, Chennai',
        size: '1800 sq ft',
        price: 'Rs. 1.6 Crore',
        status: 'New Construction / Ready Soon',
        features: 'East facing, 3 spacious bedrooms, independent terrace, calm residential neighborhood.',
        keywords: 'tambaram, individual house, villa, 3 bedrooms, 1.6 crore, east facing, terrace',
        raw_content: 'P103: Individual House in Tambaram, 1800 sq ft, Rs. 1.6 Crore, East facing, 3 bedrooms, new construction.',
      },
      {
        id: 'pdf_p104',
        code: 'P104',
        title: 'DTCP Approved Residential Plot in Chengalpattu',
        property_type: 'DTCP Plot / Land',
        location: 'Chengalpattu, Chennai Outer',
        size: '1200 sq ft',
        price: 'Rs. 18 Lakhs',
        status: 'Ready for Registration',
        features: 'Clear patta, 100% DTCP approved, near GST highway, gated community with sweet ground water, bank loan available.',
        keywords: 'chengalpattu, plot, land, dtcp, patta, 18 lakhs, 1200 sq ft, investment',
        raw_content: 'P104: DTCP Plot in Chengalpattu, 1200 sq ft, Rs. 18 Lakhs, clear patta, near highway, gated community.',
      },
      {
        id: 'pdf_p105',
        code: 'P105',
        title: '1BHK Rental Apartment in Porur',
        property_type: '1 BHK Rental Flat',
        location: 'Porur, Chennai',
        size: '550 sq ft',
        price: 'Rs. 14,000 / month',
        status: 'Immediate Occupancy',
        features: 'Deposit 3 months, 24/7 water supply, close to DLF IT Park and Ramachandra Hospital.',
        keywords: 'porur, rent, rental, 1bhk, 14000, 14k, dlf, ramachandra',
        raw_content: 'P105: 1BHK Rent in Porur, 550 sq ft, Rs. 14,000 / month, deposit 3 months, near DLF.',
      },
      {
        id: 'pdf_p106',
        code: 'P106',
        title: '2BHK Rental Apartment in Adyar',
        property_type: '2 BHK Rental Flat',
        location: 'Adyar, Chennai',
        size: '900 sq ft',
        price: 'Rs. 28,000 / month',
        status: 'Immediate Occupancy',
        features: 'Families only, pets allowed, quiet green avenue, close to top schools and beach.',
        keywords: 'adyar, rent, rental, 2bhk, 28000, 28k, family, pets allowed',
        raw_content: 'P106: 2BHK Rent in Adyar, 900 sq ft, Rs. 28,000 / month, family only, pets allowed.',
      },
    ];

    for (const item of listings) {
      await sql`
        INSERT INTO public.pdf_knowledge (id, code, title, property_type, location, size, price, status, features, keywords, raw_content)
        VALUES (${item.id}, ${item.code}, ${item.title}, ${item.property_type}, ${item.location}, ${item.size}, ${item.price}, ${item.status}, ${item.features}, ${item.keywords}, ${item.raw_content})
        ON CONFLICT (id) DO NOTHING;
      `;
    }
  } catch (err) {
    console.warn('[Neon DB] Seed knowledge base warning:', err);
  }
}

/**
 * Searches Neon DB for the best matching property listing or FAQ to answer customer question.
 */
export async function queryBestPDFAnswer(userQuestion: string): Promise<string | null> {
  const sql = getNeonClient();
  if (!sql) return null;

  try {
    const q = userQuestion.toLowerCase();
    const rows = await sql`
      SELECT code, title, property_type, location, size, price, features, raw_content
      FROM public.pdf_knowledge
      ORDER BY created_at ASC;
    `;

    // Match keywords against user query
    for (const row of rows) {
      const locMatch = row.location && q.includes(row.location.toLowerCase().split(',')[0].trim());
      const codeMatch = row.code && q.includes(row.code.toLowerCase());
      const typeMatch =
        (q.includes('rent') && row.property_type?.toLowerCase().includes('rent')) ||
        (q.includes('plot') && row.property_type?.toLowerCase().includes('plot')) ||
        ((q.includes('buy') || q.includes('house')) && row.property_type?.toLowerCase().includes('house')) ||
        (q.includes('2bhk') && row.code === 'P101') ||
        (q.includes('3bhk') && (row.code === 'P102' || row.code === 'P103'));

      if (locMatch || codeMatch || typeMatch) {
        return `${row.code}: ${row.title} in ${row.location}. Size: ${row.size}, Price: ${row.price}. Key Features: ${row.features}`;
      }
    }

    return null;
  } catch (err) {
    console.warn('[Neon DB] queryBestPDFAnswer warning:', err);
    return null;
  }
}

/**
 * Persists a completed call session (including full talk history & qualification) into Neon DB.
 */
export async function saveCallToNeon(callData: {
  id: string;
  customerId: string;
  name: string;
  phone: string;
  language?: string;
  status: string;
  outcome?: string;
  startedAt?: string;
  endedAt?: string;
  duration?: number;
  qualification?: any;
  summary?: string;
  transcript?: string;
  noAnswer?: boolean;
}): Promise<boolean> {
  const sql = getNeonClient();
  if (!sql) return false;

  try {
    await initNeonSchema();

    await sql`
      INSERT INTO public.calls (
        id, customer_id, name, phone, language, status, outcome,
        started_at, ended_at, duration, qualification, summary, transcript, no_answer
      ) VALUES (
        ${callData.id},
        ${callData.customerId},
        ${callData.name},
        ${callData.phone},
        ${callData.language || 'English'},
        ${callData.status},
        ${callData.outcome || 'PENDING'},
        ${callData.startedAt || new Date().toISOString()},
        ${callData.endedAt || new Date().toISOString()},
        ${callData.duration || 0},
        ${JSON.stringify(callData.qualification || {})},
        ${callData.summary || ''},
        ${callData.transcript || ''},
        ${Boolean(callData.noAnswer)}
      )
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        outcome = EXCLUDED.outcome,
        duration = EXCLUDED.duration,
        qualification = EXCLUDED.qualification,
        summary = EXCLUDED.summary,
        transcript = EXCLUDED.transcript;
    `;

    // Also update or insert lead
    await sql`
      INSERT INTO public.leads (
        id, name, phone, status, outcome, duration, transcript, summary,
        language, updated_at
      ) VALUES (
        ${callData.customerId},
        ${callData.name},
        ${callData.phone},
        ${callData.status},
        ${callData.outcome || 'PENDING'},
        ${callData.duration || 0},
        ${callData.transcript || ''},
        ${callData.summary || ''},
        ${callData.language || 'English'},
        NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        outcome = EXCLUDED.outcome,
        duration = EXCLUDED.duration,
        transcript = EXCLUDED.transcript,
        summary = EXCLUDED.summary,
        updated_at = NOW();
    `;

    return true;
  } catch (err) {
    console.error('[Neon DB] saveCallToNeon error:', err);
    return false;
  }
}
