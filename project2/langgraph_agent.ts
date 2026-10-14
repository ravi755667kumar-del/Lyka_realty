/**
 * Lyka Realty – LangGraph Agentic Pipeline
 * ==========================================
 * Implements a stateful conversation graph with dedicated nodes:
 *   greet → classify_intent → qualify_[buy|rent|invest|sell] → search_properties → present_results
 *
 * Each node:
 *  1. Reads the current AgentState
 *  2. Calls the LLM (Groq / Gemini) with polite, natural language
 *  3. Searches the property dataset when enough context is collected
 *  4. Augments the prompt with RAG context from the PDF knowledge vectors
 *  5. Returns the next reply + updated state
 */

import Groq from 'groq-sdk';
import { StateGraph, Annotation, END } from '@langchain/langgraph';
// Reuse the browser's regex extractor as the fast path for answer extraction.
import { extractEntitiesFromText, isPropertyQuery, queryGeneralKnowledge } from './src/lib/agentic_engine.js';
import { ALL_VERIFIED_PROPERTIES } from './src/data/all_properties.js';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PropertyRecord {
  id: string;
  title: string;
  city?: string;
  community: string;
  property_type: string;
  bedrooms: string;
  price_aed: number;
  price_inr?: number;
  rental_price_annual_aed?: number;
  rental_price_annual_inr?: number;
  status: string;
  developer: string;
  rera_id?: string;
  size_sqft: number;
  expected_roi?: string;
  amenities: string[];
  description: string;
  features: string[];
}

export interface PdfKnowledgeChunk {
  title: string;
  text_content: string;
  vector: number[];
}

export interface CustomerProfile {
  intent?: string;            // Buy | Rent | Invest | Sell
  budget_max?: number | null;
  preferred_communities?: string[];
  property_type?: string;
  bedrooms?: string | null;
  ready_or_offplan?: string;
  financing?: string;
  timeline?: string;
  rental_budget?: number | null;
  furnishing?: string;
  move_in_date?: string;
  investment_goal?: string;
  full_name?: string;
  mobile?: string;
  email?: string;
  contact_declined?: boolean;
  contact_pending?: 'name' | 'mobile' | 'email';
  contact_recheck_asked?: boolean;
  /**
   * Slots the prospect explicitly could not answer ("not sure", "open to
   * suggestions"). Per Instructions Section 5.3 these are marked unsure and
   * never asked again — and must not be used as search filters.
   */
  unsure_slots?: string[];
  is_nri?: boolean;
  target_city?: string;
  requirement_completeness?: number;
}

// ─── LangGraph State Schema ──────────────────────────────────────────────────

const AgentStateAnnotation = Annotation.Root({
  // Conversation
  userMessage:    Annotation<string>({ reducer: (_, y) => y, default: () => '' }),
  chatHistory:    Annotation<{ role: string; content: string }[]>({
    reducer: (x, y) => [...x, ...y],
    default: () => [],
  }),
  reply:          Annotation<string>({ reducer: (_, y) => y, default: () => '' }),
  provider:       Annotation<string>({ reducer: (_, y) => y, default: () => 'LangGraph Agent' }),

  // Customer context
  profile:        Annotation<CustomerProfile>({ reducer: (x, y) => ({ ...x, ...y }), default: () => ({}) }),

  // RAG context from PDF knowledge base
  ragContext:     Annotation<string>({ reducer: (_, y) => y, default: () => '' }),

  // Matched properties
  matchedProperties: Annotation<PropertyRecord[]>({ reducer: (_, y) => y, default: () => [] }),

  // Flow control
  currentNode:    Annotation<string>({ reducer: (_, y) => y, default: () => 'greet' }),
  isComplete:     Annotation<boolean>({ reducer: (_, y) => y, default: () => false }),
});

type AgentState = typeof AgentStateAnnotation.State;

// ─── External References (injected at runtime) ───────────────────────────────

let groqClient: Groq | null = null;
let geminiClient: any | null = null;
// Set from GROQ_MODEL in .env — previously read by server.ts but never used,
// so editing .env had no effect on which model answered.
let groqModelName = 'llama-3.3-70b-versatile';
let pdfKnowledgeChunks: PdfKnowledgeChunk[] = [];
let allProperties: PropertyRecord[] = (ALL_VERIFIED_PROPERTIES || []) as any[];

export function injectDependencies(opts: {
  groq: Groq | null;
  gemini?: any | null;
  groqModel?: string;
  pdfChunks: PdfKnowledgeChunk[];
  properties: PropertyRecord[];
}) {
  groqClient = opts.groq;
  geminiClient = opts.gemini || null;
  if (opts.groqModel) groqModelName = opts.groqModel;
  pdfKnowledgeChunks = opts.pdfChunks;
  allProperties = opts.properties;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < len; i++) { dot += a[i]*b[i]; na += a[i]*a[i]; nb += b[i]*b[i]; }
  return na === 0 || nb === 0 ? 0 : dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function deterministicVector(text: string, dim = 128): number[] {
  const vec: number[] = new Array(dim).fill(0);
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    vec[i % dim] += code;
    vec[(i * 7 + 3) % dim] += code * 0.3;
  }
  const mag = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map(v => v / mag);
}

export function getRagContext(userMessage: string): string {
  if (pdfKnowledgeChunks.length === 0) return '';
  const qVec = deterministicVector(userMessage);
  const scored = pdfKnowledgeChunks
    .map(c => ({ ...c, score: cosineSimilarity(qVec, c.vector) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  return scored.map(c => `📋 ${c.title}:\n${c.text_content}`).join('\n\n');
}

/**
 * Detect if user message is a DIGRESSION (general knowledge question)
 * vs an ANSWER to the current qualification slot.
 * 
 * Returns true if user is asking a general question unrelated to the slot.
 */
export function isDigression(userMessage: string, currentSlot: string | null): boolean {
  const text = userMessage.toLowerCase().trim();
  
  // Empty or very short messages are likely answers, not questions
  if (text.length < 5) return false;
  
  // Explicit question patterns
  const questionPatterns = [
    /^\s*(what|how|why|when|where|who|which|can|could|would|will|is|are|do|does|did)\s/i,
    /\?\s*$/,
    /tell me about/i,
    /explain/i,
    /what is/i,
    /how much/i,
    /how many/i,
    /how long/i,
    /what are/i,
    /which is/i,
    /give me/i,
    /show me/i,
    /know about/i,
    /information about/i,
    /details? about/i,
  ];
  
  // Slot-specific answer patterns (for NON-questions - direct answers)
  const slotAnswerPatterns: Record<string, RegExp[]> = {
    budget_max: [
      /^\s*\d+/,  // starts with number
      /\b(aed|inr|usd|\$|crore|lakh|million|k)\b/i,
      /between|around|about|approx|roughly|max|maximum|upto|up to/i,
    ],
    rental_budget: [
      /^\s*\d+/,
      /\b(aed|inr|usd|\$|per year|per month|monthly|annual|yearly)\b/i,
      /between|around|about|approx|roughly|max|maximum|upto|up to/i,
    ],
    preferred_communities: [
      /\b(marina|downtown|palm|business bay|hills|jvc|jlt|marina|creek|arabian ranches|emirates hills|dubai hills)\b/i,
      /\b(mumbai|worli|bandra|juhu|bkc|powai|andheri|thane|navi mumbai)\b/i,
      /any|anywhere|no preference|surprise me/i,
    ],
    property_type: [
      /\b(apartment|villa|townhouse|penthouse|duplex|studio)\b/i,
    ],
    bedrooms: [
      /^\s*(studio|1|2|3|4|5)\b/i,
      /\b(bed|br)\b/i,
    ],
    ready_or_offplan: [
      /\b(ready|off.?plan|offplan|off plan)\b/i,
    ],
    financing: [
      /\b(cash|mortgage|loan|finance|bank)\b/i,
    ],
    timeline: [
      /\b(days?|weeks?|months?|years?|soon|asap|immediate|flexible|no rush)\b/i,
      /within|in\s+\d+/i,
    ],
    move_in_date: [
      /\b(this month|next month|in \d+|soon|asap|flexible)\b/i,
      /^\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i,
    ],
    furnishing: [
      /\b(furnished|unfurnished|semi.?furnished|semi furnished)\b/i,
    ],
    purpose: [
      /\b(yield|roi|capital|appreciation|golden visa|income|rental)\b/i,
    ],
    contact_name: [/^[a-z]+\s+[a-z]+/i],
    contact_mobile: [/^\+?\d/],
    contact_email: [/@/],
  };
  
  // Check if it looks like a question
  const isQuestion = questionPatterns.some(p => p.test(text));
  
  // If it's a question, it's ALWAYS a digression (user asking something unrelated)
  if (isQuestion) return true;
  
  // If it's NOT a question, check if it matches expected answer pattern for current slot
  if (currentSlot && slotAnswerPatterns[currentSlot]) {
    const matchesAnswer = slotAnswerPatterns[currentSlot].some(p => p.test(text));
    if (matchesAnswer) return false; // It's a direct answer, not a digression
  }
  
  // Non-question that doesn't match expected answer pattern
  return false;
}

/**
 * Get the current slot being asked in the qualification flow
 */
export function getCurrentSlot(profile: CustomerProfile, intent: string): string | null {
  const slots = intent === 'Buy' 
    ? ['budget_max', 'preferred_communities', 'property_type', 'bedrooms', 'ready_or_offplan', 'financing', 'timeline']
    : intent === 'Rent'
      ? ['rental_budget', 'preferred_communities', 'property_type', 'bedrooms', 'furnishing', 'move_in_date']
      : intent === 'Invest'
        ? ['budget_max', 'purpose', 'preferred_communities', 'property_type', 'ready_or_offplan']
        : [];
  
  for (const slot of slots) {
    const val = (profile as any)[slot];
    if (val === null || val === undefined || val === '' || (Array.isArray(val) && val.length === 0)) {
      return slot;
    }
  }
  return null;
}

// Bedrooms arrive in several shapes ("2", 2, "2BR", "2 bed", "Studio"), so
// compare on a normalised form instead of raw equality.
function normalizeBedrooms(value: unknown): string {
  if (value === null || value === undefined) return '';
  const raw = String(value).toLowerCase().trim();
  if (!raw) return '';
  if (raw.includes('studio')) return 'Studio';
  const digits = raw.match(/\d+/);
  return digits ? digits[0] : raw;
}

function searchProperties(profile: CustomerProfile, limit = 3): PropertyRecord[] {
  let pool = [...allProperties];

  // A slot the prospect marked unsure carries no constraint, so it must not
  // become a filter either — otherwise "not sure about budget" would still be
  // filtered out by an empty budget.
  const unsure = (field: string) => profile.unsure_slots?.includes(field);
  const has = (field: string) => !unsure(field) && !isEmptySlot((profile as any)[field]);

  // Every stated criterion is a HARD filter: if it matches nothing we return no
  // results so the agent can offer a Senior Advisor, per Instructions & Operating
  // Guide v2.0 Section 7.2. These filters previously fell back to the unfiltered
  // pool, so the agent presented unrelated listings for a community it had no
  // stock in.
  const apply = (label: string, subset: PropertyRecord[]): PropertyRecord[] | null => {
    if (subset.length === 0) {
      console.warn(`[LangGraph] No verified listings match ${label} — routing to Senior Advisor escalation.`);
      return null;
    }
    return subset;
  };

  // Filter by city preference
  if (profile.target_city && profile.target_city !== 'Both') {
    const cityLower = profile.target_city.toLowerCase();
    const byCity = pool.filter(p => (p.city || 'Dubai').toLowerCase() === cityLower);
    const next = apply(`city "${profile.target_city}"`, byCity);
    if (!next) return [];
    pool = next;
  }

  // Filter by community
  if (has('preferred_communities') && profile.preferred_communities!.length > 0) {
    const comms = profile.preferred_communities!.map(c => c.toLowerCase());
    const byComm = pool.filter(p => {
      const propComm = p.community.toLowerCase();
      return comms.some(c => propComm.includes(c) || c.includes(propComm));
    });
    const next = apply(`community "${profile.preferred_communities!.join(', ')}"`, byComm);
    if (!next) return [];
    pool = next;
  }

  // Filter by budget
  if (profile.intent === 'Rent' && has('rental_budget') && profile.rental_budget) {
    const byBudget = pool.filter(p => p.rental_price_annual_aed && p.rental_price_annual_aed <= profile.rental_budget! * 1.3);
    const next = apply('rental budget', byBudget);
    if (!next) return [];
    pool = next;
  } else if (has('budget_max') && profile.budget_max) {
    const byBudget = pool.filter(p => p.price_aed <= profile.budget_max! * 1.2);
    const next = apply(`budget AED ${profile.budget_max}`, byBudget);
    if (!next) return [];
    pool = next;
  }

  // Filter by bedrooms
  const wantBeds = has('bedrooms') ? normalizeBedrooms(profile.bedrooms) : '';
  if (wantBeds) {
    const byBed = pool.filter(p => normalizeBedrooms(p.bedrooms) === wantBeds);
    const next = apply(`${wantBeds} bedrooms`, byBed);
    if (!next) return [];
    pool = next;
  }

  // Filter by property type
  if (has('property_type') && profile.property_type) {
    const wantType = profile.property_type.toLowerCase().trim();
    const byType = pool.filter(p => p.property_type.toLowerCase() === wantType);
    const next = apply(`property type "${profile.property_type}"`, byType);
    if (!next) return [];
    pool = next;
  }

  // Filter by ready/offplan
  if (has('ready_or_offplan') && (profile.ready_or_offplan === 'Ready' || profile.ready_or_offplan === 'Off-plan')) {
    const byStatus = pool.filter(p => p.status === profile.ready_or_offplan);
    const next = apply(profile.ready_or_offplan, byStatus);
    if (!next) return [];
    pool = byStatus;
  }

  return pool.slice(0, limit);
}

/**
 * Query properties database for contextual answers
 * Handles queries like: "lowest property in Dubai Marina", "highest price in Downtown", 
 * "average price in Dubai Marina", "cheapest 2 bedroom apartment", etc.
 */
function queryPropertyDatabase(query: string): string {
  const text = query.toLowerCase().trim();
  let pool = [...allProperties];
  
  if (pool.length === 0) {
    return 'No property data available in the database.';
  }
  
  // Extract community/location from query
  const communities = [
    'dubai marina', 'downtown dubai', 'downtown', 'palm jumeirah', 'palm', 
    'business bay', 'dubai hills estate', 'dubai hills', 'jvc', 'jlt', 
    'arabian ranches', 'emirates hills', 'creek harbour', 'dubai creek harbour',
    'mumbai', 'worli', 'bandra', 'juhu', 'bkc', 'powai', 'andheri', 'thane', 'navi mumbai'
  ];
  
  let matchedCommunity = '';
  for (const comm of communities) {
    if (text.includes(comm)) {
      matchedCommunity = comm;
      break;
    }
  }
  
  // Extract property type
  let matchedType = '';
  const types = ['apartment', 'villa', 'townhouse', 'penthouse', 'duplex', 'studio'];
  for (const t of types) {
    if (text.includes(t)) {
      matchedType = t;
      break;
    }
  }
  
  // Extract bedrooms
  let matchedBeds = '';
  const bedMatch = text.match(/(\d+)\s*(bed|br|bedroom)/i) || text.match(/\b(studio)\b/i);
  if (bedMatch) {
    matchedBeds = bedMatch[1] || 'Studio';
  }
  
  // Apply filters
  if (matchedCommunity) {
    const commLower = matchedCommunity.toLowerCase();
    pool = pool.filter(p => p.community.toLowerCase().includes(commLower) || commLower.includes(p.community.toLowerCase()));
  }
  
  if (matchedType) {
    pool = pool.filter(p => p.property_type.toLowerCase() === matchedType);
  }
  
  if (matchedBeds) {
    const normBeds = normalizeBedrooms(matchedBeds);
    pool = pool.filter(p => normalizeBedrooms(p.bedrooms) === normBeds);
  }
  
  if (pool.length === 0) {
    let filterDesc = '';
    if (matchedCommunity) filterDesc += ` in ${matchedCommunity}`;
    if (matchedType) filterDesc += ` for ${matchedType}s`;
    if (matchedBeds) filterDesc += ` with ${matchedBeds} bedroom${matchedBeds !== 'Studio' ? 's' : ''}`;
    return `No properties found${filterDesc}.`;
  }
  
  // Determine query type
  const isLowest = text.includes('lowest') || text.includes('cheapest') || text.includes('minimum') || text.includes('lowest price');
  const isHighest = text.includes('highest') || text.includes('most expensive') || text.includes('maximum') || text.includes('top price');
  const isAverage = text.includes('average') || text.includes('mean') || text.includes('typical price');
  const isCount = text.includes('how many') || text.includes('count') || text.includes('number of');
  const isList = text.includes('list') || text.includes('show') || text.includes('what are');
  
  let answer = '';
  const filterDesc = (matchedCommunity ? ` in ${matchedCommunity}` : '') + 
                     (matchedType ? ` for ${matchedType}s` : '') + 
                     (matchedBeds ? ` with ${matchedBeds} bedroom${matchedBeds !== 'Studio' ? 's' : ''}` : '');
  
  if (isLowest) {
    const lowest = pool.reduce((min, p) => p.price_aed < min.price_aed ? p : min);
    answer = `The lowest priced property${filterDesc} is **${lowest.title}** in **${lowest.community}** at **AED ${lowest.price_aed.toLocaleString()}** (${lowest.bedrooms} BR, ${lowest.size_sqft} sq ft).`;
  } else if (isHighest) {
    const highest = pool.reduce((max, p) => p.price_aed > max.price_aed ? p : max);
    answer = `The highest priced property${filterDesc} is **${highest.title}** in **${highest.community}** at **AED ${highest.price_aed.toLocaleString()}** (${highest.bedrooms} BR, ${highest.size_sqft} sq ft).`;
  } else if (isAverage) {
    const avg = Math.round(pool.reduce((sum, p) => sum + p.price_aed, 0) / pool.length);
    const min = Math.min(...pool.map(p => p.price_aed));
    const max = Math.max(...pool.map(p => p.price_aed));
    answer = `The average price${filterDesc} is **AED ${avg.toLocaleString()}** across ${pool.length} propert${pool.length === 1 ? 'y' : 'ies'} (range: AED ${min.toLocaleString()} – AED ${max.toLocaleString()}).`;
  } else if (isCount) {
    answer = `There are **${pool.length}** propert${pool.length === 1 ? 'y' : 'ies'}${filterDesc}.`;
  } else if (isList) {
    const top5 = pool.sort((a, b) => a.price_aed - b.price_aed).slice(0, 5);
    answer = `Here are the top ${top5.length} propert${top5.length === 1 ? 'y' : 'ies'}${filterDesc}:\n` + 
      top5.map((p, i) => `${i+1}. **${p.title}** – AED ${p.price_aed.toLocaleString()} (${p.community}, ${p.bedrooms} BR, ${p.size_sqft} sq ft)`).join('\n');
  } else {
    // Default: show summary stats
    const min = Math.min(...pool.map(p => p.price_aed));
    const max = Math.max(...pool.map(p => p.price_aed));
    const avg = Math.round(pool.reduce((sum, p) => sum + p.price_aed, 0) / pool.length);
    answer = `Found **${pool.length}** propert${pool.length === 1 ? 'y' : 'ies'}${filterDesc}.\n` +
      `💰 Price range: **AED ${min.toLocaleString()} – AED ${max.toLocaleString()}**\n` +
      `📊 Average: **AED ${avg.toLocaleString()}**`;
  }
  
  return answer;
}

async function callLLM(systemPrompt: string, userMessage: string, history: { role: string; content: string }[]): Promise<string> {
  // 1. Try Groq
  if (groqClient) {
    try {
      const messages: any[] = [
        { role: 'system', content: systemPrompt },
        ...history.slice(-6).map(h => ({ role: h.role, content: h.content })),
        { role: 'user', content: userMessage },
      ];
      const res = await groqClient.chat.completions.create({
        model: groqModelName,
        messages,
        temperature: 0.55,
        max_tokens: 600,
      });
      const reply = res.choices[0]?.message?.content?.trim();
      if (reply) return reply;
    } catch (e: any) {
      console.warn('[LangGraph] Groq notice, checking Gemini fallback:', e.message);
    }
  }

  // 2. Try Gemini
  if (geminiClient) {
    try {
      const histText = history.slice(-6).map(h => `${h.role === 'user' ? 'Customer' : 'Assistant'}: ${h.content}`).join('\n\n');
      const res = await geminiClient.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: [
          { role: 'user', parts: [{ text: systemPrompt + (histText ? `\n\nRecent conversation:\n${histText}` : '') + `\n\nCustomer message: ${userMessage}` }] }
        ]
      });
      const reply = res.text?.trim();
      if (reply) return reply;
    } catch (e: any) {
      console.warn('[LangGraph] Gemini notice:', e.message);
    }
  }

  return '';
}

// ─── Contact Collection ──────────────────────────────────────────────────────
// Instructions & Operating Guide v2.0, Section 4 ("Contact details - how to ask")
// and Section 8 Step 6: ask for name, then mobile, then email — one item per
// message, only for slots the prospect has not already given.

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const MOBILE_RE = /(?:\+?\d[\d\s().-]{5,}\d)/;
const DECLINE_RE = /\b(no thanks?|i'?d rather not|prefer not|please don'?t|don'?t share|can'?t share|won'?t share|skip that|skip it|not now|privacy reasons?)\b/i;

function looksLikeMobile(value: string): boolean {
  const digits = (value.match(/\d/g) || []).length;
  return digits >= 7 && digits <= 15;
}

// Accept a short reply as a name only when it actually looks like one: 1-3
// tokens, each capitalised, and not conversational filler. Guessing wrong here
// would write junk into the CRM, which is worse than asking again.
const NAME_FILLER = new Set([
  'hi', 'hey', 'hello', 'thanks', 'thank', 'you', 'yes', 'no', 'sure', 'okay', 'ok',
  'bye', 'goodbye', 'morning', 'evening', 'afternoon', 'not', 'maybe', 'later',
  'welcome', 'there', 'name', 'is', 'my', 'and', 'the', 'fine', 'great', 'cool',
  'alright', 'please', 'investor', 'buyer', 'seller', 'renter', 'landlord', 'done',
]);

function cleanCandidateName(value: string): string | undefined {
  const cleaned = value.replace(/[.!?,;]+$/g, '').trim();
  if (cleaned.length < 3 || cleaned.length > 60) return undefined;
  if (!/^[A-Za-z][A-Za-z\s'.-]*$/.test(cleaned)) return undefined;
  if (/\d/.test(cleaned)) return undefined;
  const tokens = cleaned.split(/\s+/);
  if (tokens.length > 3) return undefined;
  if (!tokens.every(t => /^[A-Z][a-z'.-]*$/.test(t))) return undefined;
  if (tokens.some(t => NAME_FILLER.has(t.toLowerCase()))) return undefined;
  return cleaned;
}

// An explicit "my name is ..." is trusted even if the casing is unusual.
function cleanStatedName(value: string): string | undefined {
  const cleaned = value.replace(/[.!?,;]+$/g, '').trim();
  if (cleaned.length < 3 || cleaned.length > 60) return undefined;
  if (!/^[A-Za-z][A-Za-z\s'.-]*$/.test(cleaned)) return undefined;
  if (/\d/.test(cleaned)) return undefined;
  if (cleaned.split(/\s+/).some(t => NAME_FILLER.has(t.toLowerCase()))) return undefined;
  return cleaned;
}

// Wording per Section 5.5: a genuine re-ask must be phrased differently and
// carry context. This is the only re-ask the guide permits (Section 5.4).
const CONTACT_QUESTIONS: Record<'name' | 'mobile' | 'email', (recheck: boolean) => string> = {
  name: (recheck) => recheck
    ? `So that I can pass this on correctly, could you tell me your name again?`
    : `Before we go further — so the Lyka Realty team knows exactly who to follow up with, may I have your name?`,
  mobile: (recheck) => recheck
    ? `Thank you. So the team can call or WhatsApp you, what is the best mobile number to reach you on? That one looked a little incomplete.`
    : `Thank you. These details are only so the sales team can follow up properly. Could you share a mobile number where they can reach you, by call or WhatsApp?`,
  email: (recheck) => recheck
    ? `Thank you! That email address does not look complete — could you confirm it for the team?`
    : `Perfect. Lastly, may I have your email address too, so the team can send you the shortlisted properties?`,
};

// ─── Answer Extraction ───────────────────────────────────────────────────────
// The browser runs a regex extractor first (src/lib/agentic_engine.ts). Anything
// it misses — "within a month", "2 or 3 would work", "we need three" — used to
// leave the slot empty, so the agent asked the same question forever. This is the
// fallback: same regexes for free, then one LLM call for whatever is still
// missing. Only EMPTY slots are ever filled, and every value is validated.

const ENUM_FIELDS: Record<string, string[]> = {
  intent: ['Buy', 'Rent', 'Invest', 'Sell'],
  property_type: ['Apartment', 'Villa', 'Townhouse', 'Penthouse'],
  bedrooms: ['1', '2', '3', '4', '5', 'Studio'],
  ready_or_offplan: ['Ready', 'Off-plan'],
  financing: ['Cash', 'Mortgage'],
  furnishing: ['Furnished', 'Unfurnished'],
  investment_goal: ['Rental Yield', 'Capital Appreciation', 'Balance of Both'],
};

const MONEY_FIELDS = ['budget_max', 'rental_budget'];
const TEXT_FIELDS = ['timeline', 'move_in_date'];

/** Keep only values we recognise, so a hallucination can never enter the CRM. */
function sanitizeExtraction(raw: any): Record<string, any> {
  const out: Record<string, any> = {};
  if (!raw || typeof raw !== 'object') return out;

  for (const [field, allowed] of Object.entries(ENUM_FIELDS)) {
    const v = raw[field];
    if (typeof v !== 'string') continue;
    const match = allowed.find(a => a.toLowerCase() === v.trim().toLowerCase());
    if (match) out[field] = match;
  }

  for (const field of MONEY_FIELDS) {
    const n = Number(raw[field]);
    // 1 AED .. 500M AED — anything outside is a parse error, not a budget
    if (Number.isFinite(n) && n >= 1 && n <= 500_000_000) out[field] = Math.round(n);
  }

  for (const field of TEXT_FIELDS) {
    const v = raw[field];
    if (typeof v === 'string' && v.trim() && v.length <= 80) out[field] = v.trim();
  }

  if (Array.isArray(raw.preferred_communities)) {
    const comms = raw.preferred_communities
      .filter((c: any) => typeof c === 'string' && c.length <= 60)
      .slice(0, 3);
    if (comms.length) out.preferred_communities = comms;
  }

  if (typeof raw.full_name === 'string' && raw.full_name.trim()) {
    const n = cleanStatedName(raw.full_name);
    if (n) out.full_name = n;
  }
  if (typeof raw.mobile === 'string' && looksLikeMobile(raw.mobile)) {
    out.mobile = raw.mobile.trim().slice(0, 24);
  }
  if (typeof raw.email === 'string' && EMAIL_RE.test(raw.email)) {
    out.email = raw.email.trim().slice(0, 120);
  }

  return out;
}

async function callLLMJson(systemPrompt: string, userMessage: string, history: { role: string; content: string }[]): Promise<any | null> {
  const raw = await callLLM(systemPrompt, userMessage, history);
  if (!raw) return null;
  const braced = raw.match(/\{[\s\S]*\}/);
  if (!braced) return null;
  try {
    return JSON.parse(braced[0]);
  } catch {
    return null;
  }
}

const EXTRACTION_PROMPT = `You extract structured data from a real-estate prospect's reply.

Return ONLY a single JSON object. Use null for anything the prospect did NOT state.
Never guess, never infer, never invent a budget or a name.

JSON shape:
{
  "intent": "Buy"|"Rent"|"Invest"|"Sell"|null,
  "budget_max": number|null,
  "rental_budget": number|null,
  "preferred_communities": string[]|[],
  "property_type": "Apartment"|"Villa"|"Townhouse"|"Penthouse"|null,
  "bedrooms": "1"|"2"|"3"|"4"|"5"|"Studio"|null,
  "ready_or_offplan": "Ready"|"Off-plan"|null,
  "financing": "Cash"|"Mortgage"|null,
  "timeline": string|null,
  "furnishing": "Furnished"|"Unfurnished"|null,
  "move_in_date": string|null,
  "investment_goal": "Rental Yield"|"Capital Appreciation"|"Balance of Both"|null,
  "full_name": string|null,
  "mobile": string|null,
  "email": string|null
}

Rules:
- Convert written numbers: "three" -> "3", "a couple" -> "2".
- "2 or 3 would work" -> bedrooms "2".
- "within a month" -> timeline "within a month".
- Budgets in AED: "2.5 million" -> 2500000, "80 lakhs" -> its AED equivalent.
- Only put a full_name if the prospect clearly gave their own name.

Examples:
Prospect: "within a month"            -> {"timeline":"within a month"}
Prospect: "2 or 3 would work"         -> {"bedrooms":"2"}
Prospect: "we need three"             -> {"bedrooms":"3"}
Prospect: "rental income mainly"      -> {"investment_goal":"Rental Yield"}
Prospect: "somewhere quiet"           -> {"preferred_communities":[]}`;

/**
 * Fill any still-empty slots for this flow. Regex first (free), then one LLM
 * call. Only empty slots are touched, so this can never overwrite a value the
 * prospect already gave.
 */
async function fillMissingSlots(
  state: AgentState, profile: CustomerProfile, fields: string[]
): Promise<CustomerProfile> {
  const text = (state.userMessage || '').trim();
  const next: CustomerProfile = { ...profile };
  if (!text) return next;

  const missing = fields.filter(f => slotMissing(next, f));
  if (missing.length === 0) return next;

  // 1. Regex pass (identical logic to the browser extractor)
  try {
    const ex: any = extractEntitiesFromText(text, {} as any);
    for (const f of missing) {
      const v = ex[f];
      if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) continue;
      if (typeof v === 'number' && (!Number.isFinite(v) || v <= 0)) continue;
      (next as any)[f] = v;
    }
  } catch (e: any) {
    console.warn('[LangGraph] regex extraction failed:', e?.message);
  }

  // 2. LLM pass for whatever is still empty
  const stillMissing = fields.filter(f => slotMissing(next, f));
  if (stillMissing.length === 0 || (!groqClient && !geminiClient)) return next;

  const lastQuestion = [...(state.chatHistory || [])].reverse().find(h => h.role === 'assistant')?.content || '(none yet)';
  const parsed = await callLLMJson(
    `${EXTRACTION_PROMPT}\n\nThe agent just asked: "${lastQuestion}"\nThe prospect replied: "${text}"`,
    text,
    []
  );
  if (!parsed) return next;

  const safe = sanitizeExtraction(parsed);
  let filled = 0;
  for (const f of fields) {
    if (!slotMissing(next, f)) continue;      // never overwrite
    if (safe[f] === undefined) continue;
    (next as any)[f] = safe[f];
    filled++;
  }
  if (filled > 0) {
    console.log(`[LangGraph] LLM extraction filled: ${fields.filter(f => safe[f] !== undefined && slotMissing(next, f) === false).join(', ')}`);
  }
  return next;
}

// ─── Unsure Slots (Section 5.3)──────────────────────────────────────────────
// "Prospect says 'not sure', 'later' or skips the question → mark the slot
// unsure, do not ask again, and move on." Without this the qualification nodes
// re-ask the same question forever.

const UNSURE_RE = /\b(not sure|unsure|no idea|don'?t know|dont know|undecided|undecided yet|not decided|haven'?t decided|open to|flexible|anything works|surprise me|no preference|no strong preference|whatever|either is fine|you decide|your call|suggest something|not important|no rush|no hurry|not in a hurry|whenever|anytime|sometime|some time|not fixed|no fixed date|no date in mind|at the moment|for now)\b/i;

function isEmptySlot(value: unknown): boolean {
  if (value === null || value === undefined || value === false) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'string') return value.trim() === '';
  return false;
}

/** A slot still needs asking unless it is filled or was marked unsure. */
function slotMissing(profile: CustomerProfile, field: string): boolean {
  if (profile.unsure_slots?.includes(field)) return false;
  return isEmptySlot((profile as any)[field]);
}

/** The first slot in this flow that still needs an answer, if any. */
function nextMissingSlot(profile: CustomerProfile, fields: string[]): string | null {
  for (const f of fields) {
    if (slotMissing(profile, f)) return f;
  }
  return null;
}

/**
 * If the prospect answered the pending question with uncertainty, mark that slot
 * unsure and leave it to the caller to fall through to the next question.
 * Only one slot per message — the guide requires one question at a time.
 */
function markUncertainSlot(profile: CustomerProfile, fields: string[], userMessage: string): void {
  const text = (userMessage || '').trim();
  if (!text || !UNSURE_RE.test(text)) return;
  const pending = nextMissingSlot(profile, fields);
  if (pending && !profile.unsure_slots?.includes(pending)) {
    profile.unsure_slots = [...(profile.unsure_slots || []), pending];
  }
}

const BUY_SLOTS = ['budget_max', 'preferred_communities', 'property_type', 'bedrooms', 'ready_or_offplan', 'financing', 'timeline'];
const RENT_SLOTS = ['rental_budget', 'preferred_communities', 'property_type', 'bedrooms', 'furnishing', 'move_in_date'];
const INVEST_SLOTS = ['budget_max', 'investment_goal', 'preferred_communities', 'property_type', 'ready_or_offplan'];
const SELL_SLOTS = ['preferred_communities', 'property_type', 'budget_max'];

// ─── Graph Nodes ─────────────────────────────────────────────────────────────

async function nodeGreet(state: AgentState): Promise<Partial<AgentState>> {
  if (isPropertyQuery(state.userMessage)) {
    const propAnswer = queryPropertyDatabase(state.userMessage);
    const reply = `Hello, and welcome to Lyka Realty! 🏙️\n\n${propAnswer}\n\nTo help me tailor our listings to your specific journey — are you looking to **buy**, **rent**, **invest**, or **sell** a property today?`;
    return { reply, provider: 'LangGraph → Property DB & Greet', currentNode: 'classify_intent', ragContext: '' };
  }

  const ragCtx = getRagContext(state.userMessage);
  const systemPrompt = `You are Lyka, a warm and professional AI real estate concierge for Lyka Realty Dubai.
The customer has just reached out for the first time with: "${state.userMessage}"

CRITICAL INSTRUCTION — Follow this exact logic:
1. First, check if the customer's message is a QUESTION (e.g., "Where are you located?", "Who are you?", "What properties do you have?", etc.)
2. If YES — answer their question helpfully and accurately using the context below. Then, warmly greet them, briefly mention Lyka Realty's expertise (Dubai & Mumbai markets, 300+ clients), and smoothly ask if they are looking to **buy**, **rent**, **invest**, or **sell** a property.
3. If NO (just a "hi" or general greeting) — greet them genuinely, briefly mention Lyka Realty's expertise, and ask if they are looking to **buy**, **rent**, **invest**, or **sell**.

NEVER ignore a user's question. Always answer it first.
Keep your response conversational, warm, and under 120 words. No bullet points.

${ragCtx ? `KNOWLEDGE BASE CONTEXT:\n${ragCtx}\n` : ''}`;

  const reply = await callLLM(systemPrompt, state.userMessage, state.chatHistory)
    || `Hello and a very warm welcome to Lyka Realty! 🏙️ We're a premier Dubai-based real estate brokerage serving 300+ happy clients across Dubai and Mumbai.\n\nI'm Lyka, your personal AI property concierge. May I ask — are you looking to **buy**, **rent**, **invest**, or **sell** a property today?`;

  return { reply, provider: 'LangGraph → Greet Node', currentNode: 'greet', ragContext: ragCtx };
}

async function nodeClassifyIntent(state: AgentState): Promise<Partial<AgentState>> {
  const msg = state.userMessage.toLowerCase();
  let intent = state.profile.intent || '';

  if (!intent) {
    if (/\b(buy|purchase|buying|own|ownership|first home|end.?user)\b/.test(msg)) intent = 'Buy';
    else if (/\b(rent|renting|tenant|lease|monthly|short.?term)\b/.test(msg)) intent = 'Rent';
    else if (/\b(invest|investment|roi|yield|returns|portfolio|off.?plan|passive income)\b/.test(msg)) intent = 'Invest';
    else if (/\b(sell|selling|dispose|list my|put on market)\b/.test(msg)) intent = 'Sell';
  }

  const ragCtx = getRagContext(state.userMessage);
  const updatedProfile: CustomerProfile = { ...state.profile, intent: intent || undefined };

  if (!intent) {
    if (isPropertyQuery(state.userMessage)) {
      const propAnswer = queryPropertyDatabase(state.userMessage);
      const reply = `${propAnswer}\n\nTo help me guide you to the right properties from our collection — are you looking to **buy**, **rent**, **invest**, or **sell** a property?`;
      return { reply, provider: 'LangGraph → Property DB & Intent', profile: updatedProfile, currentNode: 'classify_intent', ragContext: ragCtx };
    }

    const generalAnswer = queryGeneralKnowledge(state.userMessage);
    if (generalAnswer) {
      const reply = `${generalAnswer}\n\nTo help guide your search — are you looking to **buy**, **rent**, **invest**, or **sell** a property?`;
      return { reply, provider: 'LangGraph → Knowledge & Intent', profile: updatedProfile, currentNode: 'classify_intent', ragContext: ragCtx };
    }

    const systemPrompt = `You are Lyka, a warm Lyka Realty AI assistant for Dubai & Mumbai properties.

The customer sent: "${state.userMessage}"
You could not clearly detect their primary intent (Buy/Rent/Invest/Sell).

CRITICAL INSTRUCTION — Follow this exact logic:
1. First, check if the customer's message is a QUESTION (e.g., "Where is your office?", "What services do you offer?", "Tell me about Dubai real estate", etc.)
2. If YES — answer their question helpfully and accurately using the context below. Then, smoothly ask if they are looking to **buy**, **rent**, **invest**, or **sell** a property.
3. If NO — politely clarify their intent by asking if they are looking to **buy**, **rent**, **invest**, or **sell**.

NEVER ignore a user's question. Always answer it first.
Do not list bullet points. Keep it under 100 words.

${ragCtx ? `KNOWLEDGE BASE:\n${ragCtx}` : ''}`;
    const reply = await callLLM(systemPrompt, state.userMessage, state.chatHistory)
      || `Thank you for reaching out! Just to make sure I find the perfect match for you — are you looking to **buy**, **rent**, **invest**, or are you thinking of **selling** a property?`;
    return { reply, provider: 'LangGraph → Intent Classifier', profile: updatedProfile, currentNode: 'classify_intent', ragContext: ragCtx };
  }

  // Intent detected — move to qualification
  const nextNode = intent === 'Buy' ? 'qualify_buy'
    : intent === 'Rent' ? 'qualify_rent'
    : intent === 'Invest' ? 'qualify_invest'
    : 'qualify_sell';

  return { profile: updatedProfile, currentNode: nextNode, ragContext: ragCtx, reply: '' };
}

async function nodeQualifyBuy(state: AgentState): Promise<Partial<AgentState>> {
  let p: CustomerProfile = await fillMissingSlots(state, state.profile, BUY_SLOTS);
  const ragCtx = getRagContext(state.userMessage);
  markUncertainSlot(p, BUY_SLOTS, state.userMessage);
  
  // Detect current slot being asked
  const currentSlot = getCurrentSlot(p, 'Buy');
  
  // Check for digression (user asking general question vs answering slot)
  const isProp = isPropertyQuery(state.userMessage);
  const digression = isProp || isDigression(state.userMessage, currentSlot);
  
  if (digression && currentSlot) {
    let answer = '';
    if (isProp) {
      answer = queryPropertyDatabase(state.userMessage);
    } else {
      const generalAnswer = queryGeneralKnowledge(state.userMessage);
      if (generalAnswer) {
        answer = generalAnswer;
      } else {
        // Use knowledge base for general questions
        const systemPrompt = `You are Lyka, Lyka Realty's AI property concierge. The customer asked a general question during our qualification flow.
      
Answer their question helpfully using the knowledge base below. Be concise and accurate.
Then, on a new line, SMOOTHLY transition back to the qualification by asking: "So, to continue — [current qualification question]"

Current missing slot: ${currentSlot}
Customer question: "${state.userMessage}"

${ragCtx ? `KNOWLEDGE BASE:\n${ragCtx}\n` : ''}`;
        answer = await callLLM(systemPrompt, state.userMessage, state.chatHistory) || '';
      }
    }
    
    const question = currentSlot === 'budget_max' 
      ? `What's your budget range for the purchase? For example, AED 1.5M – 3M (or in INR if you prefer).`
      : currentSlot === 'preferred_communities'
        ? `Great! Which Dubai community appeals to you most? Popular choices include Dubai Marina, Downtown, Palm Jumeirah, Business Bay, or Dubai Hills Estate. Any preferences?`
        : currentSlot === 'property_type'
          ? `Are you envisioning an apartment, a villa, a townhouse, or a penthouse?`
          : currentSlot === 'bedrooms'
            ? `How many bedrooms would suit you best — 1BR, 2BR, 3BR, or larger?`
            : currentSlot === 'ready_or_offplan'
              ? `Would you prefer a **ready** property (immediate move-in) or an **off-plan** project (flexible payment plans)?`
              : currentSlot === 'financing'
                ? `Will this be a cash purchase or are you considering UAE bank mortgage financing?`
                : `What's your ideal purchase timeline — within 30 days, 1–3 months, or later this year?`;
    
    const finalReply = `${answer}\n\nSo, to continue — ${question}`;
    
    return { reply: finalReply, provider: 'LangGraph → Buy Qualification (Digression)', profile: p, currentNode: 'qualify_buy', ragContext: ragCtx };
  }
  
  // Normal qualification flow
  let question = '';
  if (slotMissing(p, 'budget_max')) {
    question = `What's your budget range for the purchase? For example, AED 1.5M – 3M (or in INR if you prefer). This helps me shortlist the best communities for you.`;
  } else if (slotMissing(p, 'preferred_communities')) {
    question = `Great! Which Dubai community appeals to you most? Popular choices include Dubai Marina, Downtown, Palm Jumeirah, Business Bay, or Dubai Hills Estate. Any preferences, or shall I suggest based on your budget?`;
  } else if (slotMissing(p, 'property_type')) {
    question = `Are you envisioning an apartment, a villa, a townhouse, or a penthouse? This helps me tailor the exact listings.`;
  } else if (slotMissing(p, 'bedrooms')) {
    question = `How many bedrooms would suit you best — 1BR, 2BR, 3BR, or larger?`;
  } else if (slotMissing(p, 'ready_or_offplan')) {
    question = `Would you prefer a **ready** property (immediate move-in or rental income) or an **off-plan** project (flexible payment plans and potentially higher capital gains)?`;
  } else if (slotMissing(p, 'financing')) {
    question = `Will this be a cash purchase or are you considering UAE bank mortgage financing?`;
  } else if (slotMissing(p, 'timeline')) {
    question = `What's your ideal purchase timeline — within 30 days, 1–3 months, or later this year?`;
  } else {
    return { profile: p, currentNode: 'qualify_contact', ragContext: ragCtx, reply: '' };
  }

  const systemPrompt = `You are Lyka, Lyka Realty's warm AI property concierge for Dubai & Mumbai properties.

The customer wants to BUY a property. Profile collected so far:
${JSON.stringify(p, null, 2)}

The customer's latest message: "${state.userMessage}"

CRITICAL INSTRUCTION — Follow this exact logic:
1. First, check if the customer's message is a QUESTION or asks for specific information (e.g., "What is the price?", "How far is it from the metro?", "Tell me about Dubai Marina", "What is the process?", "How long does buying take?", "What fees are involved?", etc.)
2. If YES — answer their question helpfully and accurately using your knowledge of Dubai real estate and the knowledge base below. Then, on a new line, SMOOTHLY transition back to collecting the next missing piece of information by asking: "${question}"
3. If NO (they answered your previous question) — acknowledge their answer warmly in 1 sentence, then ask: "${question}"

NEVER ignore a user's question. Always answer it first before continuing the qualification.
Keep the total response conversational and under 120 words.

${ragCtx ? `KNOWLEDGE BASE:\n${ragCtx}\n` : ''}`;

  const reply = await callLLM(systemPrompt, state.userMessage, state.chatHistory) || question;
  return { reply, provider: 'LangGraph → Buy Qualification', profile: p, currentNode: 'qualify_buy', ragContext: ragCtx };
}

async function nodeQualifyRent(state: AgentState): Promise<Partial<AgentState>> {
  let p: CustomerProfile = await fillMissingSlots(state, state.profile, RENT_SLOTS);
  const ragCtx = getRagContext(state.userMessage);
  markUncertainSlot(p, RENT_SLOTS, state.userMessage);
  
  // Detect current slot being asked
  const currentSlot = getCurrentSlot(p, 'Rent');
  
  // Check for digression
  const isProp = isPropertyQuery(state.userMessage);
  const digression = isProp || isDigression(state.userMessage, currentSlot);
  
  if (digression && currentSlot) {
    let answer = '';
    if (isProp) {
      answer = queryPropertyDatabase(state.userMessage);
    } else {
      const generalAnswer = queryGeneralKnowledge(state.userMessage);
      if (generalAnswer) {
        answer = generalAnswer;
      } else {
        // Use knowledge base for general questions
        const systemPrompt = `You are Lyka, Lyka Realty's AI property concierge. The customer asked a general question during our rental qualification flow.
      
Answer their question helpfully using the knowledge base below. Be concise and accurate.
Then, on a new line, SMOOTHLY transition back to the qualification by asking the current rental question.

Current missing slot: ${currentSlot}
Customer question: "${state.userMessage}"

${ragCtx ? `KNOWLEDGE BASE:\n${ragCtx}\n` : ''}`;
        answer = await callLLM(systemPrompt, state.userMessage, state.chatHistory) || '';
      }
    }
    
    const question = currentSlot === 'rental_budget' 
      ? `What's your rental budget? For example, AED 80,000 – 130,000 per year, or a monthly amount — whatever is easier for you.`
      : currentSlot === 'preferred_communities'
        ? `Which area of Dubai are you thinking of living in? Dubai Marina, JLT, Business Bay, Downtown, or JVC are all popular with renters. Any preference?`
        : currentSlot === 'property_type'
          ? `Are you looking for an apartment, a villa, or a townhouse?`
          : currentSlot === 'bedrooms'
            ? `How many bedrooms do you need — studio, 1BR, 2BR, or more?`
            : currentSlot === 'furnishing'
              ? `Would you prefer a **furnished** apartment (ready to move in) or **unfurnished** (you bring your own furniture)?`
              : `When are you looking to move in? For example, this month, next month, or in 3 months?`;
    
    const finalReply = `${answer}\n\nSo, to continue — ${question}`;
    
    return { reply: finalReply, provider: 'LangGraph → Rent Qualification (Digression)', profile: p, currentNode: 'qualify_rent', ragContext: ragCtx };
  }
  
  // Normal qualification flow
  let question = '';
  if (slotMissing(p, 'rental_budget')) {
    question = `What's your rental budget? For example, AED 80,000 – 130,000 per year, or a monthly amount — whatever is easier for you.`;
  } else if (slotMissing(p, 'preferred_communities')) {
    question = `Which area of Dubai are you thinking of living in? Dubai Marina, JLT, Business Bay, Downtown, or JVC are all popular with renters. Any preference?`;
  } else if (slotMissing(p, 'property_type')) {
    question = `Are you looking for an apartment, a villa, or a townhouse?`;
  } else if (slotMissing(p, 'bedrooms')) {
    question = `How many bedrooms do you need — studio, 1BR, 2BR, or more?`;
  } else if (slotMissing(p, 'furnishing')) {
    question = `Would you prefer a **furnished** apartment (ready to move in) or **unfurnished** (you bring your own furniture)?`;
  } else if (slotMissing(p, 'move_in_date')) {
    question = `When are you looking to move in? For example, this month, next month, or in 3 months?`;
  } else {
    return { profile: p, currentNode: 'qualify_contact', ragContext: ragCtx, reply: '' };
  }

  const systemPrompt = `You are Lyka, Lyka Realty's warm AI property concierge for Dubai & Mumbai properties.

The customer wants to RENT a property. Profile collected so far:
${JSON.stringify(p, null, 2)}

The customer's latest message: "${state.userMessage}"

CRITICAL INSTRUCTION — Follow this exact logic:
1. First, check if the customer's message is a QUESTION or asks for specific information (e.g., "What is the rent like there?", "How far is it from the metro?", "Tell me about JLT", "Are pets allowed?", etc.)
2. If YES — answer their question helpfully and accurately using your knowledge of Dubai real estate and the knowledge base below. Then, on a new line, SMOOTHLY transition back to collecting the next missing piece of information by asking: "${question}"
3. If NO (they answered your previous question) — acknowledge their answer warmly in 1 sentence, then ask: "${question}"

NEVER ignore a user's question. Always answer it first before continuing the qualification.
Keep the total response conversational and under 120 words.

${ragCtx ? `KNOWLEDGE BASE:\n${ragCtx}\n` : ''}`;

  const reply = await callLLM(systemPrompt, state.userMessage, state.chatHistory) || question;
  return { reply, provider: 'LangGraph → Rent Qualification', profile: p, currentNode: 'qualify_rent', ragContext: ragCtx };
}

async function nodeQualifyInvest(state: AgentState): Promise<Partial<AgentState>> {
  let p: CustomerProfile = await fillMissingSlots(state, state.profile, INVEST_SLOTS);
  const ragCtx = getRagContext(state.userMessage);
  markUncertainSlot(p, INVEST_SLOTS, state.userMessage);
  
  // Detect current slot being asked
  const currentSlot = getCurrentSlot(p, 'Invest');
  
  // Check for digression
  const isProp = isPropertyQuery(state.userMessage);
  const digression = isProp || isDigression(state.userMessage, currentSlot);
  
  if (digression && currentSlot) {
    let answer = '';
    if (isProp) {
      answer = queryPropertyDatabase(state.userMessage);
    } else {
      const generalAnswer = queryGeneralKnowledge(state.userMessage);
      if (generalAnswer) {
        answer = generalAnswer;
      } else {
        // Use knowledge base for general questions
        const systemPrompt = `You are Lyka, Lyka Realty's AI property concierge. The customer asked a general question during our investment qualification flow.
      
Answer their question helpfully using the knowledge base below. Be concise and accurate.
Then, on a new line, SMOOTHLY transition back to the qualification by asking the current investment question.

Current missing slot: ${currentSlot}
Customer question: "${state.userMessage}"

${ragCtx ? `KNOWLEDGE BASE:\n${ragCtx}\n` : ''}`;
        answer = await callLLM(systemPrompt, state.userMessage, state.chatHistory) || '';
      }
    }
    
    const question = currentSlot === 'budget_max' 
      ? `What is your investment budget? (e.g. AED 1M – 3M, or equivalent in INR/USD)`
      : currentSlot === 'investment_goal'
        ? `Are you primarily targeting **rental yield** (steady monthly income) or **capital appreciation** (long-term value growth)? Or perhaps a balance of both?`
        : currentSlot === 'preferred_communities'
          ? `Which Dubai community are you interested in? Dubai Marina, Business Bay, and Dubai Creek Harbour are popular for investors right now. Any preference?`
          : currentSlot === 'property_type'
            ? `What type of investment property suits you — an apartment for holiday rentals, a villa, or a commercial unit?`
            : `Are you looking at **ready** properties (immediate rental income) or **off-plan** (lower entry price, developer payment plans)?`;
    
    const finalReply = `${answer}\n\nSo, to continue — ${question}`;
    
    return { reply: finalReply, provider: 'LangGraph → Invest Qualification (Digression)', profile: p, currentNode: 'qualify_invest', ragContext: ragCtx };
  }
  
  // Normal qualification flow
  let question = '';
  if (slotMissing(p, 'budget_max')) {
    question = `What is your investment budget? (e.g. AED 1M – 3M, or equivalent in INR/USD)`;
  } else if (slotMissing(p, 'investment_goal')) {
    question = `Are you primarily targeting **rental yield** (steady monthly income) or **capital appreciation** (long-term value growth)? Or perhaps a balance of both?`;
  } else if (slotMissing(p, 'preferred_communities')) {
    question = `Which Dubai community are you interested in? Dubai Marina, Business Bay, and Dubai Creek Harbour are popular for investors right now. Any preference?`;
  } else if (slotMissing(p, 'property_type')) {
    question = `What type of investment property suits you — an apartment for holiday rentals, a villa, or a commercial unit?`;
  } else if (slotMissing(p, 'ready_or_offplan')) {
    question = `Are you looking at **ready** properties (immediate rental income) or **off-plan** (lower entry price, developer payment plans)?`;
  } else {
    return { profile: p, currentNode: 'qualify_contact', ragContext: ragCtx, reply: '' };
  }

  const systemPrompt = `You are Lyka, Lyka Realty's warm AI property concierge for Dubai & Mumbai properties.

The customer wants to INVEST in property. Profile collected so far:
${JSON.stringify(p, null, 2)}

The customer's latest message: "${state.userMessage}"

CRITICAL INSTRUCTION — Follow this exact logic:
1. First, check if the customer's message is a QUESTION or asks for specific information (e.g., "What is the ROI?", "How are property taxes?", "Tell me about off-plan", etc.)
2. If YES — answer their question helpfully and accurately using your knowledge of Dubai real estate and the knowledge base below. Then, on a new line, SMOOTHLY transition back to collecting the next missing piece of information by asking: "${question}"
3. If NO (they answered your previous question) — acknowledge their answer warmly in 1 sentence, then ask: "${question}"

NEVER ignore a user's question. Always answer it first before continuing the qualification.
Keep the total response conversational and under 120 words.

${ragCtx ? `KNOWLEDGE BASE:\n${ragCtx}\n` : ''}`;

  const reply = await callLLM(systemPrompt, state.userMessage, state.chatHistory) || question;
  return { reply, provider: 'LangGraph → Invest Qualification', profile: p, currentNode: 'qualify_invest', ragContext: ragCtx };
}

async function nodeQualifySell(state: AgentState): Promise<Partial<AgentState>> {
  let p: CustomerProfile = await fillMissingSlots(state, state.profile, SELL_SLOTS);
  const ragCtx = getRagContext(state.userMessage);
  markUncertainSlot(p, SELL_SLOTS, state.userMessage);
  
  // Detect current slot being asked
  const currentSlot = getCurrentSlot(p, 'Sell');
  
  // Check for digression
  const isProp = isPropertyQuery(state.userMessage);
  const digression = isProp || isDigression(state.userMessage, currentSlot);
  
  if (digression && currentSlot) {
    let answer = '';
    if (isProp) {
      answer = queryPropertyDatabase(state.userMessage);
    } else {
      const generalAnswer = queryGeneralKnowledge(state.userMessage);
      if (generalAnswer) {
        answer = generalAnswer;
      } else {
        // Use knowledge base for general questions
        const systemPrompt = `You are Lyka, Lyka Realty's AI property concierge. The customer asked a general question during our selling qualification flow.
      
Answer their question helpfully using the knowledge base below. Be concise and accurate.
Then, on a new line, SMOOTHLY transition back to the qualification by asking the current selling question.

Current missing slot: ${currentSlot}
Customer question: "${state.userMessage}"

${ragCtx ? `KNOWLEDGE BASE:\n${ragCtx}\n` : ''}`;
      
        answer = await callLLM(systemPrompt, state.userMessage, state.chatHistory) || '';
      }
    }
    
    const question = currentSlot === 'preferred_communities' 
      ? `Of course! Could you tell me which community your property is located in? For example, Dubai Marina, Downtown, Palm Jumeirah, or Business Bay?`
      : currentSlot === 'property_type'
        ? `What type of property is it — an apartment, villa, townhouse, or penthouse?`
        : `Do you have a target asking price in mind, or would you like a **free market valuation** from our certified Lyka Realty valuers? We can arrange that at no cost to you.`;
    
    const finalReply = `${answer}\n\nSo, to continue — ${question}`;
    
    return { reply: finalReply, provider: 'LangGraph → Sell Qualification (Digression)', profile: p, currentNode: 'qualify_sell', ragContext: ragCtx };
  }
  
  // Normal qualification flow
  let question = '';
  if (slotMissing(p, 'preferred_communities')) {
    question = `Of course! Could you tell me which community your property is located in? For example, Dubai Marina, Downtown, Palm Jumeirah, or Business Bay?`;
  } else if (slotMissing(p, 'property_type')) {
    question = `What type of property is it — an apartment, villa, townhouse, or penthouse?`;
  } else if (slotMissing(p, 'budget_max') && !(p as any).asking_price) {
    question = `Do you have a target asking price in mind, or would you like a **free market valuation** from our certified Lyka Realty valuers? We can arrange that at no cost to you.`;
  } else {
    return { profile: p, currentNode: 'qualify_contact', ragContext: ragCtx, reply: '' };
  }

  const systemPrompt = `You are Lyka, Lyka Realty's warm AI property concierge for Dubai & Mumbai properties.

The customer wants to SELL their property. Profile collected so far:
${JSON.stringify(p, null, 2)}

The customer's latest message: "${state.userMessage}"

CRITICAL INSTRUCTION — Follow this exact logic:
1. First, check if the customer's message is a QUESTION or asks for specific information (e.g., "What are the fees?", "How long does it take?", "Do you handle valuation?", etc.)
2. If YES — answer their question helpfully and accurately using your knowledge of Dubai real estate and the knowledge base below. Then, on a new line, SMOOTHLY transition back to collecting the next missing piece of information by asking: "${question}"
3. If NO (they answered your previous question) — acknowledge their answer warmly in 1 sentence, then ask: "${question}"

NEVER ignore a user's question. Always answer it first before continuing the qualification.
Keep the total response conversational and under 120 words.

${ragCtx ? `KNOWLEDGE BASE:\n${ragCtx}\n` : ''}`;

  const reply = await callLLM(systemPrompt, state.userMessage, state.chatHistory) || question;
  return { reply, provider: 'LangGraph → Sell Qualification', profile: p, currentNode: 'qualify_sell', ragContext: ragCtx };
}

async function nodeQualifyContact(state: AgentState): Promise<Partial<AgentState>> {
  const p = state.profile;
  const ragCtx = getRagContext(state.userMessage);
  const text = (state.userMessage || '').trim();
  const profile: CustomerProfile = { ...p };

  // Capture whatever the prospect volunteered, so we never ask for it twice
  // (Section 5.2 — scan the whole message before asking).
  const foundEmail = text.match(EMAIL_RE)?.[0];
  const foundMobile = text.match(MOBILE_RE)?.[0];

  if (!profile.email && foundEmail) profile.email = foundEmail.trim();
  if (!profile.mobile && foundMobile && looksLikeMobile(foundMobile)) profile.mobile = foundMobile.trim();

  if (!profile.full_name) {
    const stated = text.match(/(?:my name is|i am|i'?m|this is|it'?s|myself)\s+([A-Za-z][A-Za-z\s'.-]{1,50})/i)?.[1];
    // A short reply made of capitalised words only is almost certainly the name.
    const bare = text.split(/\s+/).length <= 3 ? cleanCandidateName(text) : undefined;
    const candidate = (stated && cleanStatedName(stated)) || bare;
    if (candidate) profile.full_name = candidate;
  }

  // Declining contact details is a legitimate answer (Section 5.3): accept it,
  // record it, and carry on qualifying without them.
  const gaveNothing = !profile.full_name && !profile.mobile && !profile.email;
  if (gaveNothing && DECLINE_RE.test(text)) profile.contact_declined = true;

  // Section 13: email is a must-have for investors, optional for buyers/sellers.
  const emailRequired = profile.intent === 'Invest';

  let slot: 'name' | 'mobile' | 'email' | null = null;
  let recheck = false;

  if (!profile.contact_declined) {
    if (!profile.full_name) {
      slot = 'name';
      if (p.contact_pending === 'name' && text) recheck = true;
    } else if (!profile.mobile) {
      slot = 'mobile';
      if (p.contact_pending === 'mobile' && text) recheck = true;
    } else if (emailRequired && !profile.email) {
      slot = 'email';
      if (p.contact_pending === 'email' && text) recheck = true;
    }
  }

  // Re-ask at most once (Section 5.5), then treat the slot as unsure and move on.
  if (recheck && p.contact_recheck_asked) slot = null;

  if (!slot) {
    const next = profile.intent === 'Sell' ? 'sell_handoff' : 'search_properties';
    return { profile: { ...profile, contact_pending: undefined }, currentNode: next, reply: '', ragContext: ragCtx };
  }

  const question = CONTACT_QUESTIONS[slot](recheck);
  profile.contact_pending = slot;
  if (recheck) profile.contact_recheck_asked = true;

  const systemPrompt = `You are Lyka, Lyka Realty's warm AI property concierge for Dubai & Mumbai properties.

The customer wants to ${(p.intent || 'buy').toLowerCase()} a property. You are now collecting contact details.

Already collected:
${JSON.stringify({ name: profile.full_name, mobile: profile.mobile, email: profile.email }, null, 2)}

The customer's latest message: "${state.userMessage}"

CRITICAL INSTRUCTION — Follow this exact logic:
1. First, check if the customer's message is a QUESTION or asks for specific information (e.g., "Why do you need my number?", "What are the next steps?", "Is my data safe?", etc.)
2. If YES — answer their question helpfully and accurately. Then, on a new line, SMOOTHLY transition back to asking for the contact detail: "${question}"
3. If NO (they just answered or gave their details) — acknowledge it warmly, then ask: "${question}"

Rules:
- NEVER ignore a user's question. Always answer it first before continuing.
- Ask for exactly one item. Never stack questions.
- Explain briefly that these details are only so the Lyka Realty sales team can follow up.
- Do NOT ask for a password, bank/card details, an OTP, or any government ID number.
- If they decline, accept it politely without pressing.

${ragCtx ? `KNOWLEDGE BASE:\n${ragCtx}\n` : ''}
Keep it under 100 words.`;

  const reply = await callLLM(systemPrompt, text, state.chatHistory) || question;
  return { reply, provider: 'LangGraph → Contact Details', profile, currentNode: 'qualify_contact', ragContext: ragCtx };
}

// Sell handoff — reached once a seller's contact details are on file.
async function nodeSellHandoff(state: AgentState): Promise<Partial<AgentState>> {
  const p = state.profile;
  const ragCtx = getRagContext(state.userMessage);
  const systemPrompt = `You are Lyka, Lyka Realty's warm AI property concierge.
The customer has finished providing details to SELL their property: ${p.property_type || 'property'} in ${(p.preferred_communities || []).join(', ') || 'Dubai'}, target price around AED ${(p.budget_max || 0).toLocaleString()}.
Acknowledge this warmly, and state that you will connect them with a Lyka Realty valuation expert immediately to proceed. Do not ask any more questions.`;
  const reply = await callLLM(systemPrompt, state.userMessage, state.chatHistory)
    || `Thank you for sharing those details. I've noted that you're looking to sell your property. I will connect you with a Lyka Realty valuation expert immediately to discuss the next steps!`;
  return { reply, provider: 'LangGraph → Sell Complete', currentNode: 'sell_handoff', isComplete: true, ragContext: ragCtx };
}

async function nodeSearchProperties(state: AgentState): Promise<Partial<AgentState>> {
  const matched = searchProperties(state.profile);
  if (matched.length === 0) {
    // Instructions & Operating Guide v2.0 Section 7.2/7.3: zero verified
    // matches is "no match", never a reason to relax a stated criterion.
    return { matchedProperties: [], currentNode: 'no_match', reply: '' };
  }
  return { matchedProperties: matched, currentNode: 'present_results', reply: '' };
}

// Section 7.3 — no verified match. Never invent a listing; offer a Senior Advisor.
async function nodeNoMatch(state: AgentState): Promise<Partial<AgentState>> {
  const p = state.profile;
  const ragCtx = getRagContext(state.userMessage);

  const criteria = [
    p.target_city && p.target_city !== 'Both' ? p.target_city : undefined,
    p.preferred_communities && p.preferred_communities.length ? p.preferred_communities.join(' / ') : undefined,
    p.property_type,
    p.bedrooms ? `${normalizeBedrooms(p.bedrooms)} bedroom` : undefined,
    p.intent === 'Rent' && p.rental_budget ? `rental budget AED ${p.rental_budget.toLocaleString()}` : undefined,
    p.intent !== 'Rent' && p.budget_max ? `budget AED ${p.budget_max.toLocaleString()}` : undefined,
    p.ready_or_offplan,
  ].filter(Boolean).join(', ');

  const systemPrompt = `You are Lyka, Lyka Realty's AI property concierge.

The Lyka Realty verified database returned NO matching listings for this prospect's criteria: ${criteria || 'their stated requirements'}.

Follow these rules exactly (Instructions & Operating Guide v2.0, Section 7.3):
- Do NOT name, describe or suggest any property, community, price or availability. Never invent anything.
- Politely state there is no exact active match on the website right now.
- Immediately offer to connect them with a Lyka Realty Senior Advisor, and explain that Senior Advisors have access to private, off-market and secondary-market listings that are not shown online.
- Make NO promises about price, availability, timelines, or that an off-market property will be found.
- Warm, professional, 2-3 short sentences only.

${ragCtx ? `KNOWLEDGE BASE:\n${ragCtx}\n` : ''}`;

  const reply = await callLLM(systemPrompt, state.userMessage, state.chatHistory)
    || `Thanks for sharing that. I'm sorry, we don't have an exact active match for those criteria on our website right now. Would you like me to connect you with a Lyka Realty Senior Advisor? They have access to private, off-market and secondary-market listings that aren't shown online.`;

  return {
    reply,
    provider: 'LangGraph → No Match (Senior Advisor Escalation)',
    currentNode: 'no_match',
    isComplete: true,
    ragContext: ragCtx,
  };
}

async function nodePresentResults(state: AgentState): Promise<Partial<AgentState>> {
  const props = state.matchedProperties;
  const ragCtx = getRagContext(state.userMessage);
  const p = state.profile;

  let propContext = '';
  if (props.length > 0) {
    propContext = props.map((prop, i) => 
      `Property ${i + 1}: ${prop.title}\n` +
      `  Community: ${prop.community} | ${prop.property_type} | ${prop.bedrooms}BR | ${prop.size_sqft} sq ft\n` +
      `  Price: AED ${prop.price_aed.toLocaleString()}${prop.price_inr ? ` / INR ${(prop.price_inr/10000000).toFixed(1)} Cr` : ''}\n` +
      `  ROI: ${prop.expected_roi || 'N/A'} | Status: ${prop.status}\n` +
      `  Highlights: ${prop.amenities.slice(0, 3).join(', ')}`
    ).join('\n\n');
  }

  const systemPrompt = `You are Lyka, Lyka Realty's warm AI property concierge.
Based on the customer's requirements, you have found ${props.length} matching properties.
Customer profile summary: ${JSON.stringify(p, null, 2)}

${props.length > 0
  ? `Present these ${props.length} properties warmly and concisely. Highlight why each fits their needs.\n\nMATCHED PROPERTIES:\n${propContext}`
  : `No exact matches found. Warmly explain this, suggest broadening their criteria (e.g. budget, location), and offer to connect them with a Lyka Realty expert.`
}

${ragCtx ? `KNOWLEDGE BASE:\n${ragCtx}\n` : ''}
End by asking if they'd like to **book a viewing** or speak with a Lyka Realty advisor.
Be warm, professional, concise. Max 200 words.`;

  const reply = await callLLM(systemPrompt, state.userMessage, state.chatHistory)
    || (props.length > 0
      ? `Great news! Based on your requirements, I've found ${props.length} excellent matches for you. Our Lyka Realty advisor will reach out to arrange viewings at your convenience. Would you like to speak with them directly?`
      : `I wasn't able to find an exact match right now, but don't worry! Our Lyka Realty experts have access to off-market listings too. Shall I connect you with one of our senior advisors?`);

  return { reply, provider: 'LangGraph → Property Results', currentNode: 'present_results', isComplete: true, ragContext: ragCtx };
}

// ─── Route Logic ─────────────────────────────────────────────────────────────

function routeAfterClassify(state: AgentState): string {
  const node = state.currentNode;
  if (node === 'qualify_buy') return 'qualify_buy';
  if (node === 'qualify_rent') return 'qualify_rent';
  if (node === 'qualify_invest') return 'qualify_invest';
  if (node === 'qualify_sell') return 'qualify_sell';
  return END;
}

function routeAfterQualify(state: AgentState): string {
  if (state.currentNode === 'qualify_contact') return 'qualify_contact';
  if (state.currentNode === 'search_properties') return 'search_properties';
  if (state.reply) return END; // Question asked, wait for user
  return END;
}

// ─── Build the Graph ─────────────────────────────────────────────────────────

function buildLykaGraph() {
  const workflow: any = new StateGraph(AgentStateAnnotation);

  workflow.addNode('router', (state: AgentState) => state);
  workflow.addNode('greet', nodeGreet);
  workflow.addNode('classify_intent', nodeClassifyIntent);
  workflow.addNode('qualify_buy', nodeQualifyBuy);
  workflow.addNode('qualify_rent', nodeQualifyRent);
  workflow.addNode('qualify_invest', nodeQualifyInvest);
  workflow.addNode('qualify_sell', nodeQualifySell);
  workflow.addNode('qualify_contact', nodeQualifyContact);
  workflow.addNode('sell_handoff', nodeSellHandoff);
  workflow.addNode('search_properties', nodeSearchProperties);
  workflow.addNode('present_results', nodePresentResults);
  workflow.addNode('no_match', nodeNoMatch);

  workflow.setEntryPoint('router');

  workflow.addConditionalEdges('router', (state: AgentState) => state.currentNode || 'greet', {
    greet: 'greet',
    classify_intent: 'classify_intent',
    qualify_buy: 'qualify_buy',
    qualify_rent: 'qualify_rent',
    qualify_invest: 'qualify_invest',
    qualify_sell: 'qualify_sell',
    qualify_contact: 'qualify_contact',
    sell_handoff: 'sell_handoff',
    search_properties: 'search_properties',
    present_results: 'present_results',
    no_match: 'no_match',
    [END]: END,
  });

  workflow.addEdge('greet', END);

  workflow.addConditionalEdges('classify_intent', routeAfterClassify, {
    qualify_buy: 'qualify_buy',
    qualify_rent: 'qualify_rent',
    qualify_invest: 'qualify_invest',
    qualify_sell: 'qualify_sell',
    [END]: END,
  });

  workflow.addConditionalEdges('qualify_buy', routeAfterQualify, {
    qualify_contact: 'qualify_contact',
    search_properties: 'search_properties',
    [END]: END,
  });
  workflow.addConditionalEdges('qualify_rent', routeAfterQualify, {
    qualify_contact: 'qualify_contact',
    search_properties: 'search_properties',
    [END]: END,
  });
  workflow.addConditionalEdges('qualify_invest', routeAfterQualify, {
    qualify_contact: 'qualify_contact',
    search_properties: 'search_properties',
    [END]: END,
  });
  workflow.addConditionalEdges('qualify_sell', routeAfterQualify, {
    qualify_contact: 'qualify_contact',
    search_properties: 'search_properties',
    [END]: END,
  });

  // Contact collection either asks for a slot and waits, or finishes and hands
  // back to the property search / seller handoff.
  workflow.addConditionalEdges('qualify_contact', (state: AgentState) => {
    if (state.reply) return 'await_contact'; // a question was asked — wait for the reply
    return state.currentNode === 'sell_handoff' ? 'sell_handoff' : 'search_properties';
  }, {
    await_contact: END,
    search_properties: 'search_properties',
    sell_handoff: 'sell_handoff',
  });
  workflow.addEdge('sell_handoff', END);

  workflow.addConditionalEdges('search_properties', (state: AgentState) =>
    state.currentNode === 'no_match' ? 'no_match' : 'present_results', {
    present_results: 'present_results',
    no_match: 'no_match',
  });
  workflow.addEdge('present_results', END);
  workflow.addEdge('no_match', END);

  return workflow.compile();
}

let compiledGraph: any = null;
function getCompiledGraph() {
  if (!compiledGraph) {
    compiledGraph = buildLykaGraph();
  }
  return compiledGraph;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface LangGraphInput {
  userMessage: string;
  chatHistory: { role: string; content: string }[];
  profile: CustomerProfile;
  conversationStage: string; // greet | classify_intent | qualify_buy | qualify_rent | ...
}

export interface LangGraphOutput {
  reply: string;
  provider: string;
  updatedProfile: CustomerProfile;
  matchedProperties: PropertyRecord[];
  nextStage: string;
  ragContext: string;
}

export async function runLykaAgent(input: LangGraphInput): Promise<LangGraphOutput> {
  const graph = getCompiledGraph();

  // Determine the entry node based on conversation stage
  const startNode = determineStartNode(input.conversationStage, input.userMessage, input.profile);

  const initialState: AgentState = {
    userMessage: input.userMessage,
    chatHistory: input.chatHistory,
    reply: '',
    provider: 'LangGraph Agent',
    profile: input.profile,
    ragContext: '',
    matchedProperties: [],
    currentNode: startNode,
    isComplete: false,
  };

  const finalState = await graph.invoke(initialState);

  return {
    reply: finalState.reply || '',
    provider: finalState.provider || 'LangGraph Agent',
    updatedProfile: finalState.profile || input.profile,
    matchedProperties: finalState.matchedProperties || [],
    nextStage: finalState.currentNode || startNode,
    ragContext: finalState.ragContext || '',
  };
}

async function runQualifyNode(node: string, state: AgentState): Promise<Partial<AgentState>> {
  switch (node) {
    case 'qualify_buy':    return nodeQualifyBuy(state);
    case 'qualify_rent':   return nodeQualifyRent(state);
    case 'qualify_invest': return nodeQualifyInvest(state);
    case 'qualify_sell':   return nodeQualifySell(state);
    default:               return { reply: '', currentNode: node };
  }
}

function determineStartNode(stage: string, userMessage: string, profile: CustomerProfile): string {
  if (!stage || stage === 'greet' || stage === 'new') {
    const msg = userMessage.toLowerCase();
    // If they immediately mention intent, skip greeting
    if (/\b(buy|purchase|rent|invest|sell)\b/.test(msg)) return 'classify_intent';
    return 'greet';
  }
  // After a no-match turn, re-run the search so new criteria get re-checked
  // against the verified database instead of repeating the same escalation.
  if (stage === 'no_match') return 'search_properties';
  return stage;
}
