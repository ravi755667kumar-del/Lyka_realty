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
let pdfKnowledgeChunks: PdfKnowledgeChunk[] = [];
let allProperties: PropertyRecord[] = [];

export function injectDependencies(opts: {
  groq: Groq | null;
  gemini?: any | null;
  pdfChunks: PdfKnowledgeChunk[];
  properties: PropertyRecord[];
}) {
  groqClient = opts.groq;
  geminiClient = opts.gemini || null;
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

function getRagContext(userMessage: string): string {
  if (pdfKnowledgeChunks.length === 0) return '';
  const qVec = deterministicVector(userMessage);
  const scored = pdfKnowledgeChunks
    .map(c => ({ ...c, score: cosineSimilarity(qVec, c.vector) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  return scored.map(c => `📋 ${c.title}:\n${c.text_content}`).join('\n\n');
}

function searchProperties(profile: CustomerProfile, limit = 3): PropertyRecord[] {
  let pool = [...allProperties];

  // Filter by city preference
  if (profile.target_city && profile.target_city !== 'Both') {
    const cityLower = profile.target_city.toLowerCase();
    pool = pool.filter(p => (p.city || 'Dubai').toLowerCase() === cityLower);
  }

  // Filter by community
  if (profile.preferred_communities && profile.preferred_communities.length > 0) {
    const comms = profile.preferred_communities.map(c => c.toLowerCase());
    const byComm = pool.filter(p => comms.some(c => p.community.toLowerCase().includes(c)));
    if (byComm.length > 0) pool = byComm;
  }

  // Filter by budget
  if (profile.intent === 'Rent' && profile.rental_budget) {
    pool = pool.filter(p => p.rental_price_annual_aed && p.rental_price_annual_aed <= profile.rental_budget! * 1.3);
  } else if (profile.budget_max) {
    pool = pool.filter(p => p.price_aed <= profile.budget_max! * 1.2);
  }

  // Filter by bedrooms
  if (profile.bedrooms) {
    const br = String(profile.bedrooms);
    const byBed = pool.filter(p => p.bedrooms === br);
    if (byBed.length > 0) pool = byBed;
  }

  // Filter by property type
  if (profile.property_type) {
    const byType = pool.filter(p => p.property_type.toLowerCase() === profile.property_type!.toLowerCase());
    if (byType.length > 0) pool = byType;
  }

  // Filter by ready/offplan
  if (profile.ready_or_offplan === 'Ready') {
    pool = pool.filter(p => p.status === 'Ready');
  } else if (profile.ready_or_offplan === 'Off-plan') {
    pool = pool.filter(p => p.status === 'Off-plan');
  }

  return pool.slice(0, limit);
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
        model: 'llama-3.3-70b-versatile',
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

// ─── Graph Nodes ─────────────────────────────────────────────────────────────

async function nodeGreet(state: AgentState): Promise<Partial<AgentState>> {
  const ragCtx = getRagContext(state.userMessage);
  const systemPrompt = `You are Lyka, a warm and professional AI real estate concierge for Lyka Realty Dubai.
The customer has just reached out for the first time.
Your job: greet them genuinely, briefly mention Lyka Realty's expertise (Dubai & Mumbai markets, 300+ clients), 
then ask ONE polite question: what are they looking to do? (Buy / Rent / Invest / Sell)

${ragCtx ? `KNOWLEDGE BASE CONTEXT:\n${ragCtx}\n` : ''}
Keep your response conversational, warm, and under 80 words. No bullet points.`;

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
    const systemPrompt = `You are Lyka, a warm Lyka Realty AI assistant.
The customer sent: "${state.userMessage}"
You could not clearly detect their intent (Buy/Rent/Invest/Sell).
Politely clarify with ONE natural question. Do not list bullet points. Keep it under 60 words.
${ragCtx ? `CONTEXT:\n${ragCtx}` : ''}`;
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
  const p = state.profile;
  const ragCtx = getRagContext(state.userMessage);
  let question = '';

  if (!p.budget_max) {
    question = `What's your budget range for the purchase? For example, AED 1.5M – 3M (or in INR if you prefer). This helps me shortlist the best communities for you.`;
  } else if (!p.preferred_communities || p.preferred_communities.length === 0) {
    question = `Great! Which Dubai community appeals to you most? Popular choices include Dubai Marina, Downtown, Palm Jumeirah, Business Bay, or Dubai Hills Estate. Any preferences, or shall I suggest based on your budget?`;
  } else if (!p.property_type) {
    question = `Are you envisioning an apartment, a villa, a townhouse, or a penthouse? This helps me tailor the exact listings.`;
  } else if (!p.bedrooms) {
    question = `How many bedrooms would suit you best — 1BR, 2BR, 3BR, or larger?`;
  } else if (!p.ready_or_offplan) {
    question = `Would you prefer a **ready** property (immediate move-in or rental income) or an **off-plan** project (flexible payment plans and potentially higher capital gains)?`;
  } else if (!p.financing) {
    question = `Will this be a cash purchase or are you considering UAE bank mortgage financing?`;
  } else if (!p.timeline) {
    question = `What's your ideal purchase timeline — within 30 days, 1–3 months, or later this year?`;
  } else {
    // All info collected — trigger property search
    return { currentNode: 'search_properties', ragContext: ragCtx, reply: '' };
  }

  const systemPrompt = `You are Lyka, Lyka Realty's warm AI property concierge.
The customer wants to BUY a property. You have collected this so far:
${JSON.stringify(p, null, 2)}

Ask ONLY this one question naturally and politely (don't list alternatives as bullet points, weave them into a sentence):
"${question}"

${ragCtx ? `KNOWLEDGE BASE:\n${ragCtx}\n` : ''}
Keep your response under 80 words, warm, and conversational.`;

  const reply = await callLLM(systemPrompt, state.userMessage, state.chatHistory) || question;
  return { reply, provider: 'LangGraph → Buy Qualification', currentNode: 'qualify_buy', ragContext: ragCtx };
}

async function nodeQualifyRent(state: AgentState): Promise<Partial<AgentState>> {
  const p = state.profile;
  const ragCtx = getRagContext(state.userMessage);
  let question = '';

  if (!p.rental_budget) {
    question = `What's your rental budget? For example, AED 80,000 – 130,000 per year, or a monthly amount — whatever is easier for you.`;
  } else if (!p.preferred_communities || p.preferred_communities.length === 0) {
    question = `Which area of Dubai are you thinking of living in? Dubai Marina, JLT, Business Bay, Downtown, or JVC are all popular with renters. Any preference?`;
  } else if (!p.property_type) {
    question = `Are you looking for an apartment, a villa, or a townhouse?`;
  } else if (!p.bedrooms) {
    question = `How many bedrooms do you need — studio, 1BR, 2BR, or more?`;
  } else if (!p.furnishing) {
    question = `Would you prefer a **furnished** apartment (ready to move in) or **unfurnished** (you bring your own furniture)?`;
  } else if (!p.move_in_date) {
    question = `When are you looking to move in? For example, this month, next month, or in 3 months?`;
  } else {
    return { currentNode: 'search_properties', ragContext: ragCtx, reply: '' };
  }

  const systemPrompt = `You are Lyka, Lyka Realty's warm AI property concierge.
The customer wants to RENT a property. You have collected this so far:
${JSON.stringify(p, null, 2)}

Ask ONLY this one question naturally and conversationally:
"${question}"

${ragCtx ? `KNOWLEDGE BASE:\n${ragCtx}\n` : ''}
Keep your response under 80 words. Be warm and helpful.`;

  const reply = await callLLM(systemPrompt, state.userMessage, state.chatHistory) || question;
  return { reply, provider: 'LangGraph → Rent Qualification', currentNode: 'qualify_rent', ragContext: ragCtx };
}

async function nodeQualifyInvest(state: AgentState): Promise<Partial<AgentState>> {
  const p = state.profile;
  const ragCtx = getRagContext(state.userMessage);
  let question = '';

  if (!p.budget_max) {
    question = `What is your investment budget? (e.g. AED 1M – 3M, or equivalent in INR/USD)`;
  } else if (!p.investment_goal) {
    question = `Are you primarily targeting **rental yield** (steady monthly income) or **capital appreciation** (long-term value growth)? Or perhaps a balance of both?`;
  } else if (!p.preferred_communities || p.preferred_communities.length === 0) {
    question = `Which Dubai community are you interested in? Dubai Marina, Business Bay, and Dubai Creek Harbour are popular for investors right now. Any preference?`;
  } else if (!p.property_type) {
    question = `What type of investment property suits you — an apartment for holiday rentals, a villa, or a commercial unit?`;
  } else if (!p.ready_or_offplan) {
    question = `Are you looking at **ready** properties (immediate rental income) or **off-plan** (lower entry price, developer payment plans)?`;
  } else {
    return { currentNode: 'search_properties', ragContext: ragCtx, reply: '' };
  }

  const systemPrompt = `You are Lyka, Lyka Realty's warm AI property concierge.
The customer wants to INVEST in property. You have collected this so far:
${JSON.stringify(p, null, 2)}

Ask ONLY this one question naturally:
"${question}"

${ragCtx ? `KNOWLEDGE BASE:\n${ragCtx}\n` : ''}
Keep your response under 80 words. Be warm, professional, and concise.`;

  const reply = await callLLM(systemPrompt, state.userMessage, state.chatHistory) || question;
  return { reply, provider: 'LangGraph → Invest Qualification', currentNode: 'qualify_invest', ragContext: ragCtx };
}

async function nodeQualifySell(state: AgentState): Promise<Partial<AgentState>> {
  const p = state.profile;
  const ragCtx = getRagContext(state.userMessage);
  let question = '';

  if (!p.preferred_communities || p.preferred_communities.length === 0) {
    question = `Of course! Could you tell me which community your property is located in? For example, Dubai Marina, Downtown, Palm Jumeirah, or Business Bay?`;
  } else if (!p.property_type) {
    question = `What type of property is it — an apartment, villa, townhouse, or penthouse?`;
  } else {
    question = `Do you have a target asking price in mind, or would you like a **free market valuation** from our certified Lyka Realty valuers? We can arrange that at no cost to you.`;
  }

  const systemPrompt = `You are Lyka, Lyka Realty's warm AI property concierge.
The customer wants to SELL their property. You have collected this so far:
${JSON.stringify(p, null, 2)}

Ask ONLY this one question naturally:
"${question}"

${ragCtx ? `KNOWLEDGE BASE:\n${ragCtx}\n` : ''}
Keep your response under 80 words. Be warm and helpful.`;

  const reply = await callLLM(systemPrompt, state.userMessage, state.chatHistory) || question;
  return { reply, provider: 'LangGraph → Sell Qualification', currentNode: 'qualify_sell', ragContext: ragCtx };
}

async function nodeSearchProperties(state: AgentState): Promise<Partial<AgentState>> {
  const matched = searchProperties(state.profile);
  return { matchedProperties: matched, currentNode: 'present_results', reply: '' };
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
  if (state.currentNode === 'search_properties') return 'search_properties';
  if (state.reply) return END; // Question asked, wait for user
  return END;
}

// ─── Build the Graph ─────────────────────────────────────────────────────────

function buildLykaGraph() {
  const workflow = new StateGraph(AgentStateAnnotation);

  workflow.addNode('router', (state) => state);
  workflow.addNode('greet', nodeGreet);
  workflow.addNode('classify_intent', nodeClassifyIntent);
  workflow.addNode('qualify_buy', nodeQualifyBuy);
  workflow.addNode('qualify_rent', nodeQualifyRent);
  workflow.addNode('qualify_invest', nodeQualifyInvest);
  workflow.addNode('qualify_sell', nodeQualifySell);
  workflow.addNode('search_properties', nodeSearchProperties);
  workflow.addNode('present_results', nodePresentResults);

  workflow.setEntryPoint('router');

  workflow.addConditionalEdges('router', (state: AgentState) => state.currentNode || 'greet', {
    greet: 'greet',
    classify_intent: 'classify_intent',
    qualify_buy: 'qualify_buy',
    qualify_rent: 'qualify_rent',
    qualify_invest: 'qualify_invest',
    qualify_sell: 'qualify_sell',
    search_properties: 'search_properties',
    present_results: 'present_results',
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
    search_properties: 'search_properties',
    [END]: END,
  });
  workflow.addConditionalEdges('qualify_rent', routeAfterQualify, {
    search_properties: 'search_properties',
    [END]: END,
  });
  workflow.addConditionalEdges('qualify_invest', routeAfterQualify, {
    search_properties: 'search_properties',
    [END]: END,
  });
  workflow.addConditionalEdges('qualify_sell', routeAfterQualify, {
    search_properties: 'search_properties',
    [END]: END,
  });

  workflow.addEdge('search_properties', 'present_results');
  workflow.addEdge('present_results', END);

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
  return stage;
}
