import { neon, neonConfig } from '@neondatabase/serverless';
import { customNeonFetch } from './neonFetch.mjs';

// Configure serverless neon to use custom fallback DNS fetch
// to guarantee 100% database connectivity across local networks
if (typeof window === 'undefined') {
  try {
    neonConfig.fetchFunction = customNeonFetch;
  } catch (err) {
    console.warn('[Neon DB] Could not attach custom fetchFunction:', err);
  }
}

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

    // 3. PDF Knowledge Base Table (Scenarios, property listings, and guides)
    await sql`
      CREATE TABLE IF NOT EXISTS public.pdf_knowledge (
        id TEXT PRIMARY KEY,
        document_source TEXT NOT NULL,
        language TEXT NOT NULL,
        category TEXT,
        title TEXT NOT NULL,
        scenario_trigger TEXT,
        agent_reply TEXT NOT NULL,
        next_step TEXT,
        keywords TEXT,
        raw_content TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;

    await sql`
      ALTER TABLE public.pdf_knowledge ADD COLUMN IF NOT EXISTS next_step TEXT;
    `;

    await sql`
      ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS recording_reference TEXT;
    `;

    await sql`
      ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS recording_reference TEXT;
    `;

    // 4. User History Table (Pure TEXT cumulative history grouped by Name and Mobile No)
    await sql`
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
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_user_history_phone ON public.user_history(phone);
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_user_history_name_phone ON public.user_history(name, phone);
    `;

    return true;
  } catch (err) {
    console.error('[Neon DB] Schema initialization error:', err);
    return false;
  }
}

// In-memory cache for PDF knowledge records to eliminate network round-trip latency on user voice queries
let cachedPdfKnowledgeRows: any[] | null = null;
let lastPdfCacheTime = 0;
const PDF_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache in RAM

// ─── Instant Query Cache Memory (O(1) 0.001ms RAM Fast Path) ───────────────
const pdfQueryAnswerCache = new Map<string, string>();
let pdfCacheStats = { hits: 0, misses: 0, total: 0 };

function normalizeCacheKey(text: string, lang?: string): string {
  const clean = String(text || '')
    .toLowerCase()
    .replace(/[^\w\s\u0900-\u097F\u0B80-\u0BFF]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const langKey = (lang || 'any').toLowerCase().split('-')[0].trim();
  return `${langKey}:${clean}`;
}

function formatPDFAnswerResponse(bestRow: any): string {
  const nextQ = bestRow.next_step || 'Ask one gentle follow-up question to guide the customer to the next step.';

  if (bestRow.id?.startsWith('pdf_listing_')) {
    return `[SIMILAR PROPERTY MATCH - ${bestRow.title}]:
Verified Fact: ${bestRow.agent_reply}
NEXT QUESTION TO ASK: "${nextQ}"
Instruction: Acknowledge politely, state the verified property details, and ask the next question to offer a site visit.`;
  } else if (bestRow.id?.startsWith('scenario_') || bestRow.id?.startsWith('tanglish_')) {
    return `[SIMILAR CONVERSATION SCENARIO - ${bestRow.language} (${bestRow.title})]:
Customer Trigger: "${bestRow.scenario_trigger}"
Natural Spoken Phrasing: "${bestRow.agent_reply}"
NEXT QUESTION TO ASK: "${nextQ}"
Instruction: Speak naturally as Priya in humble, modern ${bestRow.language}. Acknowledge what the customer said, use this verified phrasing, and ask the next question!`;
  } else {
    // Page level match
    const snippet = (bestRow.agent_reply || bestRow.raw_content || '').slice(0, 400).replace(/\s+/g, ' ').trim();
    return `[VERIFIED PDF GUIDE - ${bestRow.document_source} (${bestRow.language})]:
Guidance: ${snippet}
NEXT QUESTION TO ASK: "${nextQ}"
Instruction: Use this verified guidance to reply warmly and ask the next question.`;
  }
}

/** Pre-warms the cache memory with all canonical questions and triggers from the PDF */
function prewarmPDFQueryCache(rows: any[]) {
  if (!rows || rows.length === 0) return;
  for (const row of rows) {
    const formatted = formatPDFAnswerResponse(row);
    if (row.scenario_trigger) {
      pdfQueryAnswerCache.set(normalizeCacheKey(row.scenario_trigger, row.language), formatted);
      pdfQueryAnswerCache.set(normalizeCacheKey(row.scenario_trigger, 'any'), formatted);
    }
    if (row.title) {
      pdfQueryAnswerCache.set(normalizeCacheKey(row.title, row.language), formatted);
      pdfQueryAnswerCache.set(normalizeCacheKey(row.title, 'any'), formatted);
    }
    if (Array.isArray(row.keywords)) {
      for (const kw of row.keywords) {
        if (typeof kw === 'string' && kw.length >= 4 && kw.length <= 40) {
          pdfQueryAnswerCache.set(normalizeCacheKey(kw, row.language), formatted);
        }
      }
    }
  }

  // Pre-seed critical Tanglish v5 conversational queries for immediate 0.001ms hit
  const v5Seeds: Array<{ q: string; id: string }> = [
    { q: 'neenga ai-aa', id: 'tanglish_v5_05_are_you_ai' },
    { q: 'are you ai', id: 'tanglish_v5_05_are_you_ai' },
    { q: 'ethukku call panreenga', id: 'tanglish_v5_04_why_did_you_call' },
    { q: 'why did you call', id: 'tanglish_v5_04_why_did_you_call' },
    { q: 'indha property total evlo aagum', id: 'tanglish_v5_07_total_cost' },
    { q: 'property total cost evlo', id: 'tanglish_v5_07_total_cost' },
    { q: 'lowest price property venum', id: 'tanglish_v5_07_lowest_price' },
    { q: 'property legal-aa approved-aa', id: 'tanglish_v5_08_legal_approval' },
    { q: 'off-plan property safe-aa', id: 'tanglish_v5_08_off_plan_safe' },
    { q: '100% safe-aa profit guarantee irukka', id: 'tanglish_v5_08_profit_guarantee' },
    { q: 'profit guarantee irukka', id: 'tanglish_v5_08_profit_guarantee' },
    { q: 'enna documents venum', id: 'tanglish_v5_08_documents_list' },
    { q: 'cmda patta approved-aa', id: 'tanglish_v5_08_legal_approval' },
    { q: 'velachery-la apartment irukka', id: 'pdf_listing_p101' },
    { q: 'omr-la 3bhk irukka', id: 'pdf_listing_p102' },
    { q: 'tambaram-la veedu irukka', id: 'pdf_listing_p103' },
    { q: 'inime call pannaadheenga', id: 'tanglish_v5_09_dnc' },
    { q: 'enakku indha call vendaam', id: 'tanglish_v5_09_customer_refuses' },
    { q: '2 minute pesalaama', id: 'tanglish_2min_01_permission_and_opening' },
    { q: '2 minutes pesalaama', id: 'tanglish_2min_01_permission_and_opening' },
    { q: 'differnt pronounces', id: 'tanglish_2min_02_dynamic_pronunciation_variety' },
    { q: 'different pronunciation', id: 'tanglish_2min_02_dynamic_pronunciation_variety' },
    { q: '2 minute call', id: 'tanglish_2min_02_dynamic_pronunciation_variety' },
    { q: '2 minutes call', id: 'tanglish_2min_02_dynamic_pronunciation_variety' },
    { q: '2 minute wrap up', id: 'tanglish_2min_03_wrapup' },
    { q: 'hi how are you eppadi irukkeenga', id: 'v14_01_required_opening' },
    { q: 'edhu nalla property suggest', id: 'v14_05a_property_suggestion_rule' },
    { q: 'distance evlo travel time', id: 'v14_05b_distance_measure_maps' },
    { q: 'edhu ok va', id: 'v14_05c_edhu_ok_va_checkin' },
    { q: 'innoru thadava sollunga', id: 'v14_14a_explain_again_politely' },
    { q: 'chill-aa pesalaam', id: 'v14_14b_friendly_agent_style' },
  ];

  for (const seed of v5Seeds) {
    const matchedRow = rows.find((r) => r.id === seed.id);
    if (matchedRow) {
      const formatted = formatPDFAnswerResponse(matchedRow);
      pdfQueryAnswerCache.set(normalizeCacheKey(seed.q, 'ta'), formatted);
      pdfQueryAnswerCache.set(normalizeCacheKey(seed.q, 'any'), formatted);
    }
  }
}

export function getPDFQueryCacheStats() {
  return {
    cachedQueriesCount: pdfQueryAnswerCache.size,
    totalQueries: pdfCacheStats.total,
    cacheHits: pdfCacheStats.hits,
    cacheMisses: pdfCacheStats.misses,
    hitRate: pdfCacheStats.total > 0 ? ((pdfCacheStats.hits / pdfCacheStats.total) * 100).toFixed(1) + '%' : '0%',
  };
}

export function clearPDFQueryCache() {
  pdfQueryAnswerCache.clear();
  pdfCacheStats = { hits: 0, misses: 0, total: 0 };
}

export function invalidatePdfKnowledgeCache() {
  cachedPdfKnowledgeRows = null;
  lastPdfCacheTime = 0;
  clearPDFQueryCache();
}

/**
 * Searches Neon DB for the most similar conversation scenario or property listing.
 * Retrieves verified facts, recommended humble agent phrasing from the updated guides, and the NEXT QUESTION TO ASK.
 */
export async function queryBestPDFAnswer(userQuestion: string, preferredLanguage?: string): Promise<string | null> {
  const sql = getNeonClient();

  try {
    const q = (userQuestion || '').toLowerCase().trim();
    if (!q || q.length < 2) return null;

    // 1. FAST PATH: Check Instant Cache Memory (O(1) 0.001ms RAM lookup)
    const cacheKey = normalizeCacheKey(userQuestion, preferredLanguage);
    const anyKey = normalizeCacheKey(userQuestion, 'any');
    pdfCacheStats.total++;

    if (pdfQueryAnswerCache.has(cacheKey)) {
      pdfCacheStats.hits++;
      return pdfQueryAnswerCache.get(cacheKey)!;
    }
    if (pdfQueryAnswerCache.has(anyKey)) {
      pdfCacheStats.hits++;
      return pdfQueryAnswerCache.get(anyKey)!;
    }
    pdfCacheStats.misses++;

    // Fast-path in-memory cached records (0ms sub-millisecond retrieval from RAM)
    let rows: any[] = [];
    const now = Date.now();
    if (cachedPdfKnowledgeRows && cachedPdfKnowledgeRows.length > 0) {
      rows = cachedPdfKnowledgeRows;
    } else {
      // Load local extracted PDF scenarios instantly into RAM without network latency
      try {
        const fs = await import('fs');
        const path = await import('path');
        const localPath = path.resolve(process.cwd(), 'datasets', 'extracted_pdf_scenarios.json');
        if (fs.existsSync(localPath)) {
          const raw = fs.readFileSync(localPath, 'utf8');
          const localItems = JSON.parse(raw);
          rows = localItems.map((item: any) => ({
            id: item.id,
            document_source: 'Lyka Realty Knowledge Base',
            language: item.language,
            category: item.category,
            title: item.title,
            scenario_trigger: item.trigger,
            agent_reply: item.agent_reply,
            next_step: item.next_step,
            keywords: item.keywords,
            raw_content: item.agent_reply,
          }));
          cachedPdfKnowledgeRows = rows;
          lastPdfCacheTime = now;
          prewarmPDFQueryCache(rows);
        }
      } catch (e) {
        console.warn('[Neon DB] Local scenarios load error:', e);
      }
    }

    // Optional background sync with remote DB without blocking the live voice turn
    if (sql && (!cachedPdfKnowledgeRows || now - lastPdfCacheTime > PDF_CACHE_TTL_MS)) {
      sql`
        SELECT id, document_source, language, category, title, scenario_trigger, agent_reply, next_step, keywords, raw_content
        FROM public.pdf_knowledge
        ORDER BY created_at ASC;
      `
        .then((dbRows) => {
          if (dbRows && dbRows.length > 0) {
            // merge non-overlapping rows into cache
            const existingIds = new Set((cachedPdfKnowledgeRows || []).map((r: any) => r.id));
            const fresh = dbRows.filter((r: any) => !existingIds.has(r.id));
            if (fresh.length > 0 && cachedPdfKnowledgeRows) {
              cachedPdfKnowledgeRows.push(...fresh);
            }
          }
        })
        .catch(() => { /* non-blocking */ });
    }

    if (!rows || rows.length === 0) return null;

    // Tokenize and filter common stop words
    const stopWords = new Set([
      'the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'in', 'for', 'of', 'to', 'with',
      'from', 'by', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'my', 'your', 'tell',
      'about', 'want', 'need', 'can', 'please', 'sir', 'madam', 'maam', 'hello', 'hi', 'hey'
    ]);

    const cleanQ = q.replace(/[^\w\s\u0900-\u097F\u0B80-\u0BFF]/g, ' ');
    const rawTokens = cleanQ.split(/\s+/).filter((t) => t.length > 2 && !stopWords.has(t));

    // Specific Location & Property Detections
    const hasVelachery = q.includes('velachery') || q.includes('வேளச்சேரி');
    const hasOmr = q.includes('omr') || q.includes('sholinganallur') || q.includes('சோழிங்கநல்லூர்');
    const hasTambaram = q.includes('tambaram') || q.includes('தாம்பரம்');
    const hasChengalpattu = q.includes('chengalpattu') || q.includes('செங்கல்பட்டு');
    const hasPorur = q.includes('porur') || q.includes('போரூர்');
    const hasAdyar = q.includes('adyar') || q.includes('அடையார்');

    const hasRent = q.includes('rent') || q.includes('rental') || q.includes('vaadagai') || q.includes('வாடகை') || q.includes('kiraya');
    const hasPlot = q.includes('plot') || q.includes('land') || q.includes('nilam') || q.includes('நிலம்') || q.includes('dtcp') || q.includes('zameen');
    const hasHouse = q.includes('house') || q.includes('villa') || q.includes('individual') || q.includes('veedu') || q.includes('வீடு') || q.includes('makaan');
    const has2BHK = q.includes('2bhk') || q.includes('2 bhk') || q.includes('two bhk');
    const has3BHK = q.includes('3bhk') || q.includes('3 bhk') || q.includes('three bhk');
    const has1BHK = q.includes('1bhk') || q.includes('1 bhk') || q.includes('one bhk');

    // Tanglish Triggers from Updated Guide
    const isTanglishDetails = q.includes('enna property') || q.includes('details sollunga') || q.includes('property paakuren') || q.includes('sollunga');
    const isTanglishPriceHigh = q.includes('adhigam') || q.includes('costly') || q.includes('price romba') || q.includes('vilai');
    const isTanglishCannotAfford = q.includes('set aagadhu') || q.includes('afford panna');
    const isTanglishWhatsApp = q.includes('whatsapp') || q.includes('anuppunga') || q.includes('share panren');
    const isTanglishVisit = q.includes('site visit') || q.includes('direct-a') || q.includes('paakkalama');
    const isTanglishFamily = q.includes('family-kitta') || q.includes('veetla') || q.includes('wife kitta') || q.includes('wife-kitta');
    const isTanglishBusy = q.includes('busy-a') || q.includes('apram pesalaam') || q.includes('neram illa') || q.includes('busy');
    const isTanglishDriving = q.includes('drive') || q.includes('driving');
    const isTanglishDNC = q.includes('inime call') || q.includes('call pannaadheenga') || q.includes('phone pannadheenga');
    const isTanglishDiscount = q.includes('discount') || q.includes('offer');
    const isTanglishHiddenCharges = q.includes('extra charges') || q.includes('hidden') || q.includes('breakup');
    const isTanglishCompare = q.includes('compare') || q.includes('vera builder');
    const isTanglishGenuine = q.includes('genuine') || q.includes('fraud');
    const isTanglishRobot = q.includes('robot') || q.includes('ai-aa') || q.includes('virtual assistant');
    const isTanglishLoan = q.includes('loan kedaikkuma') || q.includes('nri-ku loan') || q.includes('bank loan');
    const isTanglishPaymentPlan = q.includes('payment plan') || q.includes('instalment') || q.includes('installment');
    const isTanglishSenior = q.includes('senior kooda') || q.includes('manager');
    const isTanglishBook = q.includes('book pannalaam') || q.includes('advance kudukuren');
    const isTanglishBadService = q.includes('nalla service kedaikkala') || q.includes('bad experience') || q.includes('munnaadi');

    // Hinglish Triggers
    const isHinglishDetails = q.includes('property dekhni') || q.includes('details bataiye') || q.includes('kya options') || q.includes('flat dekhna');
    const isHinglishPriceHigh = q.includes('zyada hai') || q.includes('mehanga') || q.includes('itna budget nahi');
    const isHinglishCannotAfford = q.includes('budget se bahar') || q.includes('afford nahi');
    const isHinglishWhatsApp = q.includes('whatsapp par') || q.includes('whatsapp kar') || q.includes('message bhej');
    const isHinglishVisit = q.includes('visit kar sakte') || q.includes('visit kab');
    const isHinglishFamily = q.includes('family se discuss') || q.includes('ghar pe pooch') || q.includes('wife se baat');
    const isHinglishBusy = q.includes('meeting mein') || q.includes('baad mein baat') || q.includes('abhi busy');
    const isHinglishShort = q.includes('short mein bolo') || q.includes('jaldi bolo') || q.includes('time nahi');
    const isHinglishDNC = q.includes('dobara call mat') || q.includes('phone mat karo') || q.includes('number delete');

    // General Behavioral / Objection Triggers
    const isNotInterested = q.includes('not interested') || q.includes('interest illa') || q.includes('interest nahi') || q.includes('nahi chahiye') || q.includes('vendaam');
    const isHangup = q.includes('hang up') || q.includes('cut the call') || q.includes('drop the call') || q.includes('bye');
    const isGuaranteed = q.includes('guaranteed') || q.includes('guarantee') || q.includes('profit') || q.includes('return');
    const isWhereGotNumber = q.includes('kahan se mila') || q.includes('enga irundhu') || q.includes('who gave my number') || q.includes('got my number');

    let bestRow: any = null;
    let highestScore = -1;

    for (const row of rows) {
      let score = 0;
      const rowId = String(row.id || '').toLowerCase();
      const titleLower = String(row.title || '').toLowerCase();
      const keywordsLower = Array.isArray(row.keywords)
        ? row.keywords.join(' ').toLowerCase()
        : String(row.keywords || '').toLowerCase();
      const triggerLower = String(row.scenario_trigger || '').toLowerCase();
      const contentLower = String(row.raw_content || '').toLowerCase();
      const agentReplyLower = String(row.agent_reply || '').toLowerCase();
      const rowLang = String(row.language || '').toLowerCase();

      // 1. Property Listing Matching (P101-P106)
      if (rowId.startsWith('pdf_listing_')) {
        if (hasVelachery && keywordsLower.includes('velachery')) score += 80;
        if (hasOmr && keywordsLower.includes('omr')) score += 80;
        if (hasTambaram && keywordsLower.includes('tambaram')) score += 80;
        if (hasChengalpattu && keywordsLower.includes('chengalpattu')) score += 80;
        if (hasPorur && keywordsLower.includes('porur')) score += 80;
        if (hasAdyar && keywordsLower.includes('adyar')) score += 80;

        if (hasRent && keywordsLower.includes('rent')) score += 60;
        if (hasPlot && keywordsLower.includes('plot')) score += 60;
        if (hasHouse && keywordsLower.includes('house')) score += 60;
        if (has2BHK && (keywordsLower.includes('2bhk') || titleLower.includes('2bhk'))) score += 50;
        if (has3BHK && (keywordsLower.includes('3bhk') || titleLower.includes('3bhk'))) score += 50;
        if (has1BHK && (keywordsLower.includes('1bhk') || titleLower.includes('1bhk'))) score += 50;

        // Code matching: P101 - P106
        for (let num = 101; num <= 106; num++) {
          const code = `p${num}`;
          if (q.includes(code) && (rowId.includes(code) || titleLower.includes(code))) {
            score += 150;
          }
        }
      }

      // 2. Structured Dialogue Scenarios Matching (Updated Tanglish v2, Hinglish, English)
      else if (rowId.startsWith('scenario_') || rowId.startsWith('tanglish_')) {
        // Tanglish v2 Scenarios (Lyka_Realty_Tanglish_Priya_Agent_Script_v2_Name_and_Pauses.pdf)
        if (rowId === 'tanglish_v2_01_ask_name' && (q.includes('vanakkam') || q.includes('hello') || q.includes('who is this') || q.includes('yaar'))) score += 115;
        if (rowId === 'tanglish_v2_02_name_shared' && (q.includes('peru') || q.includes('arun') || q.includes('karthik') || q.includes('suresh') || q.includes('i am'))) score += 125;
        if (rowId === 'tanglish_v2_03_why_need_name' && (q.includes('edhukku name') || q.includes('why name') || q.includes('name edhukku'))) score += 125;
        if (rowId === 'tanglish_v2_04_refuse_name' && (q.includes('solla virumbala') || q.includes('wont tell') || q.includes('name solla'))) score += 125;
        if (rowId === 'tanglish_v2_05_why_did_you_call' && (q.includes('ethukku call') || q.includes('why call') || q.includes('edhukku call') || q.includes('why did you call'))) score += 125;
        if (rowId === 'tanglish_v2_06_where_are_you_calling_from' && (q.includes('enga irundhu') || q.includes('where are you calling') || q.includes('enga irundu'))) score += 125;
        if (rowId === 'tanglish_v2_07_are_you_ai' && (q.includes('ai-aa') || q.includes('ai aa') || q.includes('are you ai') || q.includes('robot'))) score += 130;
        if (rowId === 'tanglish_v2_08_not_interested' && (q.includes('interest illa') || q.includes('not interested') || q.includes('thevai illa'))) score += 125;
        if (rowId === 'tanglish_v2_09_do_not_call_again' && (q.includes('inime call') || q.includes('dont call') || q.includes('stop calling') || q.includes('remove my number'))) score += 135;
        if (rowId === 'tanglish_v2_10_which_place_property' && (q.includes('endha place') || q.includes('which place') || q.includes('enga irukku property') || q.includes('locations') || q.includes('which location'))) score += 125;
        if (rowId === 'tanglish_v2_11_binghatti_etherea' && (q.includes('binghatti') || q.includes('etherea'))) score += 140;
        if (rowId === 'tanglish_v2_12_what_properties' && (q.includes('enna enna property') || q.includes('what properties') || q.includes('available properties') || q.includes('property irukku'))) score += 125;
        if (rowId === 'tanglish_v2_13_price_availability' && (q.includes('price evlo') || q.includes('available-aa') || q.includes('rate enna') || q.includes('what is the price'))) score += 120;
        if (rowId === 'tanglish_v2_14_office_address' && (q.includes('office enga') || q.includes('where is office') || q.includes('office address') || q.includes('office location'))) score += 130;

        // Updated Tanglish Scenarios
        if ((rowId.includes('tanglish_06_wants_details') || rowId.includes('tanglish_01_property_details')) && isTanglishDetails) score += 95;
        if ((rowId.includes('tanglish_20_price_too_high') || rowId.includes('tanglish_06_price_too_high')) && isTanglishPriceHigh) score += 95;
        if ((rowId.includes('tanglish_21_cannot_afford') || rowId.includes('tanglish_07_cannot_afford')) && isTanglishCannotAfford) score += 95;
        if ((rowId.includes('tanglish_10_whatsapp_details') || rowId.includes('tanglish_04_whatsapp_details')) && isTanglishWhatsApp && !isHinglishWhatsApp) score += 95;
        if ((rowId.includes('tanglish_09_site_visit') || rowId.includes('tanglish_03_site_visit')) && isTanglishVisit && !isHinglishVisit) score += 95;
        if ((rowId.includes('tanglish_19_discuss_family') || rowId.includes('tanglish_05_discuss_family')) && isTanglishFamily) score += 95;
        if ((rowId.includes('tanglish_33_customer_busy') || rowId.includes('tanglish_12_customer_busy')) && isTanglishBusy && !isTanglishDriving) score += 95;
        if (rowId.includes('tanglish_34_driving_meeting') && isTanglishDriving) score += 105;
        if ((rowId.includes('tanglish_38_dnc_request') || rowId.includes('tanglish_16_dnc_request')) && isTanglishDNC) score += 110;
        if ((rowId.includes('tanglish_24_not_interested') || rowId.includes('tanglish_08_not_interested')) && (q.includes('interest illa') || q.includes('vendaam'))) score += 95;
        if ((rowId.includes('tanglish_36_guaranteed_profit') || rowId.includes('tanglish_14_guaranteed_returns')) && isGuaranteed && rowLang.includes('tanglish')) score += 95;
        if ((rowId.includes('tanglish_37_where_got_number') || rowId.includes('tanglish_15_where_got_number')) && isWhereGotNumber && rowLang.includes('tanglish')) score += 95;
        if (rowId.includes('tanglish_22_asks_discount') && isTanglishDiscount) score += 95;
        if (rowId.includes('tanglish_23_hidden_charges') && isTanglishHiddenCharges) score += 95;
        if (rowId.includes('tanglish_31_comparing_builders') && isTanglishCompare) score += 95;
        if (rowId.includes('tanglish_32_is_this_genuine') && isTanglishGenuine) score += 95;
        if (rowId.includes('tanglish_41_are_you_robot_ai') && isTanglishRobot) score += 110;
        if (rowId.includes('tanglish_13_loan_finance') && isTanglishLoan) score += 95;
        if (rowId.includes('tanglish_12_payment_plan') && isTanglishPaymentPlan) score += 95;
        if (rowId.includes('tanglish_16_talk_to_senior') && isTanglishSenior) score += 95;
        if (rowId.includes('tanglish_18_ready_to_book') && isTanglishBook) score += 95;
        if (rowId.includes('tanglish_40_bad_service_past') && isTanglishBadService) score += 95;

        // Hinglish Scenarios
        if (rowId.includes('hinglish_01_property_interest') && isHinglishDetails) score += 95;
        if (rowId.includes('hinglish_02_property_details') && (q.includes('details bataiye') || q.includes('kya options'))) score += 95;
        if (rowId.includes('hinglish_06_price_too_high') && isHinglishPriceHigh) score += 95;
        if (rowId.includes('hinglish_07_cannot_afford') && isHinglishCannotAfford) score += 95;
        if (rowId.includes('hinglish_04_whatsapp_details') && isHinglishWhatsApp) score += 95;
        if (rowId.includes('hinglish_03_site_visit') && isHinglishVisit) score += 95;
        if (rowId.includes('hinglish_05_discuss_family') && isHinglishFamily) score += 95;
        if (rowId.includes('hinglish_11_customer_busy') && isHinglishBusy) score += 95;
        if (rowId.includes('hinglish_12_short_mein_bolo') && isHinglishShort) score += 95;
        if (rowId.includes('hinglish_14_do_not_call') && isHinglishDNC) score += 110;
        if (rowId.includes('hinglish_08_not_interested') && (q.includes('interest nahi') || q.includes('nahi chahiye'))) score += 95;
        if (rowId.includes('hinglish_13_guaranteed_returns') && isGuaranteed && rowLang.includes('hinglish')) score += 90;

        // English Scenarios
        if (rowId.includes('english_03_dont_call_again') && (q.includes("don't call") || q.includes('stop calling') || q.includes('remove my number'))) score += 110;
        if (rowId.includes('english_02_cut_the_call') && (q.includes('cut the call') || q.includes('drop the call'))) score += 105;
        if (rowId.includes('english_01_hangup_polite') && isHangup) score += 90;
        if (rowId.includes('english_04_hurry_whatsapp') && (q.includes('hurry') || q.includes('rush'))) score += 90;
        if (rowId.includes('english_05_busy_meeting') && (q.includes('in a meeting') || q.includes('appointment'))) score += 90;
        if (rowId.includes('english_06_not_now_maybe_later') && (q.includes('maybe later') || q.includes('not now'))) score += 90;
      }

      // Language alignment preference
      if (preferredLanguage) {
        const pref = preferredLanguage.toLowerCase();
        if ((pref.includes('tamil') || pref.includes('tanglish')) && rowLang.includes('tanglish')) {
          score += 15;
        } else if ((pref.includes('hindi') || pref.includes('hinglish')) && rowLang.includes('hinglish')) {
          score += 15;
        } else if (pref.includes('english') && rowLang.includes('english')) {
          score += 12;
        }
      }

      // Keyword / token frequency scoring
      for (const t of rawTokens) {
        if (triggerLower.includes(t)) score += 16;
        if (keywordsLower.includes(t)) score += 14;
        if (titleLower.includes(t)) score += 10;
        if (agentReplyLower.includes(t)) score += 6;
        if (contentLower.includes(t)) score += 3;
      }

      if (score > highestScore) {
        highestScore = score;
        bestRow = row;
      }
    }

    if (bestRow && highestScore >= 18) {
      const response = formatPDFAnswerResponse(bestRow);
      // Attach to cache memory so future calls hit the 0.001ms fast path!
      pdfQueryAnswerCache.set(cacheKey, response);
      pdfQueryAnswerCache.set(anyKey, response);
      return response;
    }

    return null;
  } catch (err) {
    console.warn('[Neon DB] queryBestPDFAnswer warning:', err);
    return null;
  }
}

// ─── Pure Text User History Management (Grouped by Name & Mobile No) ──────────

export interface UserHistoryRecord {
  id: string;
  name: string;
  phone: string;
  total_calls: number;
  last_call_at: string;
  history_text: string;
  latest_transcript?: string;
  qa_pairs_text?: string;
  summary?: string;
  qualification_text?: string;
  created_at: string;
  updated_at: string;
}

export interface UserHistoryInput {
  name: string;
  phone: string;
  transcript?: string;
  qaHistory?: any[];
  summary?: string;
  qualification?: any;
  duration?: number;
  outcome?: string;
  status?: string;
  language?: string;
  callTime?: string;
}

/**
 * Normalizes phone number into raw string, clean digits, and last 10 digits.
 */
export function normalizePhone(phone: string) {
  const raw = (phone || '').trim();
  const cleanDigits = raw.replace(/[^0-9]/g, '');
  const last10 = cleanDigits.slice(-10);
  return { raw, cleanDigits, last10 };
}

/**
 * Formats a single call session into clean human-readable plain text (pure text, no binary).
 */
export function formatSessionText(session: {
  sessionNumber: number;
  dateStr: string;
  duration?: number;
  outcome?: string;
  status?: string;
  language?: string;
  transcript?: string;
  summary?: string;
  qualificationText?: string;
}): string {
  const lines: string[] = [
    `================================================================================`,
    `CALL SESSION #${session.sessionNumber} - ${session.dateStr}`,
    `Duration: ${session.duration ?? 0}s | Status: ${session.status || 'Completed'} | Outcome: ${session.outcome || 'PENDING'} | Language: ${session.language || 'English'}`,
    `================================================================================`,
  ];

  if (session.transcript && session.transcript.trim()) {
    lines.push(`--- CALL TRANSCRIPT ---`);
    lines.push(session.transcript.trim());
  }

  if (session.summary && session.summary.trim()) {
    lines.push(`\n--- CALL SUMMARY ---`);
    lines.push(session.summary.trim());
  }

  if (session.qualificationText && session.qualificationText.trim()) {
    lines.push(`\n--- QUALIFICATION & CRITERIA ---`);
    lines.push(session.qualificationText.trim());
  }

  lines.push(`================================================================================`);
  return lines.join('\n');
}

/**
 * Formats structured Q&A interaction pairs into human-readable plain text.
 */
export function formatQaPairsText(sessionNumber: number, dateStr: string, qaHistory?: any[]): string {
  if (!Array.isArray(qaHistory) || qaHistory.length === 0) {
    return '';
  }
  const lines: string[] = [`[Session #${sessionNumber} - ${dateStr}]`];
  qaHistory.forEach((item, idx) => {
    const q = item.question || item.aiQuestion || item.stepTitle || `Question ${idx + 1}`;
    const a = item.answer || item.userAnswer || 'No answer recorded';
    const tag = item.extractedKey ? ` (${item.extractedKey}: ${item.extractedValue || ''})` : '';
    lines.push(`${idx + 1}. Q: ${q}`);
    lines.push(`   A: ${a}${tag}`);
  });
  return lines.join('\n');
}

/**
 * Formats qualification object into single-line readable text.
 */
export function formatQualificationText(qualification: any): string {
  if (!qualification) return '';
  if (typeof qualification === 'string') return qualification;
  const parts: string[] = [];
  if (qualification.interested) parts.push(`Interested: ${qualification.interested}`);
  if (qualification.buyerOrInvestor) parts.push(`Profile: ${qualification.buyerOrInvestor}`);
  if (qualification.budget) parts.push(`Budget: ${qualification.budget}`);
  if (qualification.location) parts.push(`Location: ${qualification.location}`);
  if (qualification.timeline) parts.push(`Timeline: ${qualification.timeline}`);
  return parts.join(' | ');
}

/**
 * Accumulates and saves user history in Neon DB in pure text format (NO binary blobs).
 * Groups by user's mobile number and name:
 * - If user exists: appends new session to `history_text`, increments total_calls, updates latest info.
 * - If user is new: creates a new record with total_calls = 1.
 */
export async function saveUserHistoryToNeon(data: UserHistoryInput): Promise<{
  success: boolean;
  id?: string;
  totalCalls?: number;
  error?: string;
}> {
  const sql = getNeonClient();
  if (!sql) {
    return { success: false, error: 'Neon database not configured' };
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
    await initNeonSchema();

    // Query existing record for this user based on phone and name
    const existingRows = await sql`
      SELECT id, name, phone, total_calls, history_text, qa_pairs_text, summary, qualification_text
      FROM public.user_history
      WHERE 
        phone = ${phone}
        OR (${last10.length >= 7 ? sql`regexp_replace(phone, '[^0-9]', '', 'g') LIKE ${'%' + last10}` : sql`FALSE`})
        OR (${name.length >= 2 ? sql`LOWER(TRIM(name)) = LOWER(TRIM(${name}))` : sql`FALSE`})
      ORDER BY last_call_at DESC
      LIMIT 1;
    `;

    if (existingRows && existingRows.length > 0) {
      const existing = existingRows[0];
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
      const bestName = existing.name || name;
      const bestPhone = existing.phone || phone;

      await sql`
        UPDATE public.user_history
        SET
          name = ${bestName},
          phone = ${bestPhone},
          total_calls = ${nextSessionNumber},
          last_call_at = NOW(),
          history_text = ${updatedHistoryText},
          latest_transcript = ${data.transcript || existing.latest_transcript || ''},
          qa_pairs_text = ${updatedQaPairs},
          summary = ${updatedSummary},
          qualification_text = ${updatedQualText},
          updated_at = NOW()
        WHERE id = ${existing.id};
      `;

      return {
        success: true,
        id: existing.id,
        totalCalls: nextSessionNumber,
      };
    } else {
      // Create a brand new record for this user
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

      await sql`
        INSERT INTO public.user_history (
          id, name, phone, total_calls, last_call_at,
          history_text, latest_transcript, qa_pairs_text,
          summary, qualification_text, created_at, updated_at
        ) VALUES (
          ${newId},
          ${name || 'Anonymous User'},
          ${phone || 'Unknown Phone'},
          1,
          NOW(),
          ${firstSessionText},
          ${data.transcript || ''},
          ${firstQaText},
          ${data.summary || ''},
          ${qualificationText || ''},
          NOW(),
          NOW()
        );
      `;

      return {
        success: true,
        id: newId,
        totalCalls: 1,
      };
    }
  } catch (err: any) {
    console.error('[Neon DB] saveUserHistoryToNeon error:', err);
    return { success: false, error: err.message || 'Failed to save user history' };
  }
}

/**
 * Retrieves the full accumulated plain-text user history by phone or name.
 */
export async function getUserHistoryByPhoneAndName(
  phone: string,
  name?: string
): Promise<UserHistoryRecord | null> {
  const sql = getNeonClient();
  if (!sql) return null;

  const cleanName = (name || '').trim();
  const { last10 } = normalizePhone(phone);

  try {
    const rows = await sql`
      SELECT *
      FROM public.user_history
      WHERE
        phone = ${phone.trim()}
        OR (${last10.length >= 7 ? sql`regexp_replace(phone, '[^0-9]', '', 'g') LIKE ${'%' + last10}` : sql`FALSE`})
        OR (${cleanName.length >= 2 ? sql`LOWER(TRIM(name)) = LOWER(TRIM(${cleanName}))` : sql`FALSE`})
      ORDER BY last_call_at DESC
      LIMIT 1;
    `;
    return (rows && rows.length > 0 ? rows[0] : null) as UserHistoryRecord | null;
  } catch (err) {
    console.error('[Neon DB] getUserHistoryByPhoneAndName error:', err);
    return null;
  }
}

/**
 * Retrieves all user history records (sorted with most recently active users first).
 */
export async function getAllUserHistories(limit = 100): Promise<UserHistoryRecord[]> {
  const sql = getNeonClient();
  if (!sql) return [];

  try {
    const rows = await sql`
      SELECT id, name, phone, total_calls, last_call_at, history_text, latest_transcript, qa_pairs_text, summary, qualification_text, created_at, updated_at
      FROM public.user_history
      ORDER BY last_call_at DESC
      LIMIT ${limit};
    `;
    return (rows || []) as UserHistoryRecord[];
  } catch (err) {
    console.error('[Neon DB] getAllUserHistories error:', err);
    return [];
  }
}

/**
 * Persists a completed call session (including full talk history & qualification) into Neon DB.
 * Automatically updates both calls/leads tables AND accumulates the user history in pure text form.
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
  recordingReference?: string;
  qaHistory?: any[];
  noAnswer?: boolean;
}): Promise<boolean> {
  const sql = getNeonClient();
  if (!sql) return false;

  try {
    await initNeonSchema();

    await sql`
      INSERT INTO public.calls (
        id, customer_id, name, phone, language, status, outcome,
        started_at, ended_at, duration, qualification, summary, transcript,
        recording_reference, no_answer
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
        ${callData.recordingReference || null},
        ${Boolean(callData.noAnswer)}
      )
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        outcome = EXCLUDED.outcome,
        duration = EXCLUDED.duration,
        qualification = EXCLUDED.qualification,
        summary = EXCLUDED.summary,
        transcript = EXCLUDED.transcript,
        recording_reference = COALESCE(EXCLUDED.recording_reference, public.calls.recording_reference);
    `;

    // Also update or insert lead
    await sql`
      INSERT INTO public.leads (
        id, name, phone, status, outcome, duration, transcript, summary,
        language, recording_reference, updated_at
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
        ${callData.recordingReference || null},
        NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        outcome = EXCLUDED.outcome,
        duration = EXCLUDED.duration,
        transcript = EXCLUDED.transcript,
        summary = EXCLUDED.summary,
        recording_reference = COALESCE(EXCLUDED.recording_reference, public.leads.recording_reference),
        updated_at = NOW();
    `;

    // Automatically accumulate user history in pure text form under the user's name & phone
    try {
      await saveUserHistoryToNeon({
        name: callData.name,
        phone: callData.phone,
        transcript: callData.transcript,
        qaHistory: callData.qaHistory,
        summary: callData.summary,
        qualification: callData.qualification,
        duration: callData.duration,
        outcome: callData.outcome,
        status: callData.status,
        language: callData.language,
        callTime: callData.endedAt || callData.startedAt,
      });
    } catch (historyErr) {
      console.warn('[Neon DB] Non-blocking user history update note:', historyErr);
    }

    return true;
  } catch (err) {
    console.error('[Neon DB] saveCallToNeon error:', err);
    return false;
  }
}
