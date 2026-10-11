// Test script to verify agentic AI workflow with different question types
// Run with: npx tsx test_agentic_flow.ts

import { 
  createInitialLeadProfile, 
  extractEntitiesFromText,
  computeCompletenessAndMissing,
  generateNextAdaptiveQuestion,
  isGreetingMessage
} from './src/lib/agentic_engine.js';

import { deterministicVector, cosineSimilarity, isDigression, getCurrentSlot, getRagContext } from './langgraph_agent.js';

console.log('═══════════════════════════════════════════════════════════════');
console.log('🧪 AGENTIC AI WORKFLOW TEST SUITE');
console.log('═══════════════════════════════════════════════════════════════\n');

// ============================================================
// TEST 1: Greeting Detection
// ============================================================
console.log('📋 TEST 1: Greeting Detection');
const greetings = ['hi', 'hello', 'hey', 'good morning', 'salam', 'hi there'];
const nonGreetings = ['AED 2.5M', 'Dubai Marina', '2 bedroom', 'What is DLD?'];

for (const g of greetings) {
  console.log(`  "${g}" → ${isGreetingMessage(g) ? '✅ Greeting' : '❌ Not greeting'}`);
}
for (const ng of nonGreetings) {
  console.log(`  "${ng}" → ${isGreetingMessage(ng) ? '❌ False positive' : '✅ Not greeting'}`);
}
console.log('');

// ============================================================
// TEST 2: Entity Extraction
// ============================================================
console.log('📋 TEST 2: Entity Extraction');
const testMessages = [
  { msg: 'My budget is AED 2.5 million', intent: 'Buy' },
  { msg: 'I want to rent in Dubai Marina', intent: 'Rent' },
  { msg: 'Looking for 3 bedroom villa', intent: 'Buy' },
  { msg: 'Investment budget 3M AED for yield', intent: 'Invest' },
  { msg: 'Sell my apartment in Palm Jumeirah', intent: 'Sell' },
];

for (const { msg, intent } of testMessages) {
  const lead = createInitialLeadProfile();
  lead.intent = intent as any;
  const extracted = extractEntitiesFromText(msg, lead);
  console.log(`  "${msg}" (${intent})`);
  console.log(`    → Extracted: ${JSON.stringify(extracted)}`);
}
console.log('');

// ============================================================
// TEST 3: Adaptive Question Generation (Sequence Flow)
// ============================================================
console.log('📋 TEST 3: Adaptive Question Sequence (Buy Flow)');
let lead = createInitialLeadProfile();
lead.intent = 'Buy';

const buySequence = [
  { input: 'hi', expect: 'Role identification' },
  { input: 'I want to buy', expect: 'Budget' },
  { input: 'AED 2.5M', expect: 'Location' },
  { input: 'Dubai Marina', expect: 'Property Type' },
  { input: 'Apartment', expect: 'Bedrooms' },
  { input: '2 bedroom', expect: 'Ready/Off-plan' },
  { input: 'Ready', expect: 'Financing' },
  { input: 'Cash', expect: 'Timeline' },
];

for (const step of buySequence) {
  const { missing } = computeCompletenessAndMissing(lead);
  const { nextQuestion, intentCategory } = generateNextAdaptiveQuestion(lead, missing, step.input);
  console.log(`  Step: "${step.input}"`);
  console.log(`    Missing: ${missing.slice(0,3).join(', ')}`);
  console.log(`    Next: ${intentCategory} → "${nextQuestion.substring(0,60)}..."`);
  
  // Simulate extraction
  const extracted = extractEntitiesFromText(step.input, lead);
  Object.assign(lead, extracted);
  console.log('');
}

// ============================================================
// TEST 4: Digression Detection
// ============================================================
console.log('📋 TEST 4: Digression Detection (isDigression)');

const digressionTests = [
  // { message, currentSlot, expected, description }
  { message: 'AED 2.5 million', slot: 'budget_max', expected: false, desc: 'Valid budget answer' },
  { message: '2.5M', slot: 'budget_max', expected: false, desc: 'Short budget answer' },
  { message: 'Dubai Marina', slot: 'preferred_communities', expected: false, desc: 'Valid community answer' },
  { message: '2 bedroom', slot: 'bedrooms', expected: false, desc: 'Valid bedroom answer' },
  { message: 'Ready property', slot: 'ready_or_offplan', expected: false, desc: 'Valid ready/offplan answer' },
  { message: 'Cash purchase', slot: 'financing', expected: false, desc: 'Valid financing answer' },
  { message: 'What is the DLD fee?', slot: 'budget_max', expected: true, desc: 'Digression: DLD fee question' },
  { message: 'Tell me about Dubai Marina', slot: 'preferred_communities', expected: true, desc: 'Digression: Community info' },
  { message: 'How far from metro?', slot: 'bedrooms', expected: true, desc: 'Digression: Distance question' },
  { message: 'What are the fees?', slot: 'financing', expected: true, desc: 'Digression: Fees question' },
  { message: 'What is ROI?', slot: 'budget_max', expected: true, desc: 'Digression: ROI question' },
  { message: 'How long does buying take?', slot: 'timeline', expected: true, desc: 'Digression: Process question' },
];

let passed = 0, failed = 0;
for (const { message, slot, expected, desc } of digressionTests) {
  const result = isDigression(message, slot);
  const status = result === expected ? '✅' : '❌';
  if (result === expected) passed++; else failed++;
  console.log(`  ${status} "${message}" (slot: ${slot}) → ${result ? 'DIGRESSION' : 'ANSWER'} | ${desc}`);
}
console.log(`  Passed: ${passed}/${digressionTests.length} | Failed: ${failed}\n`);

// ============================================================
// TEST 5: Current Slot Detection
// ============================================================
console.log('📋 TEST 5: Current Slot Detection (getCurrentSlot)');

const slotTests = [
  { lead: { intent: 'Buy' as const, budget_max: null }, expected: 'budget_max' },
  { lead: { intent: 'Buy' as const, budget_max: 2500000, preferred_communities: [] }, expected: 'preferred_communities' },
  { lead: { intent: 'Buy' as const, budget_max: 2500000, preferred_communities: ['Dubai Marina'], property_type: '' }, expected: 'property_type' },
  { lead: { intent: 'Rent' as const, rental_budget: null }, expected: 'rental_budget' },
  { lead: { intent: 'Rent' as const, rental_budget: 120000, preferred_communities: [] }, expected: 'preferred_communities' },
  { lead: { intent: 'Invest' as const, budget_max: null }, expected: 'budget_max' },
];

for (const { lead, expected } of slotTests) {
  const slot = getCurrentSlot(lead as any, lead.intent);
  const status = slot === expected ? '✅' : '❌';
  console.log(`  ${status} ${lead.intent}: ${slot} (expected: ${expected})`);
}
console.log('');

// ============================================================
// TEST 6: Completeness Scoring
// ============================================================
console.log('📋 TEST 6: Completeness Scoring');

const completenessTests = [
  { desc: 'Empty lead', lead: createInitialLeadProfile() },
  { desc: 'Budget only', lead: { ...createInitialLeadProfile(), intent: 'Buy', budget_max: 2500000 } },
  { desc: 'Budget + Location', lead: { ...createInitialLeadProfile(), intent: 'Buy', budget_max: 2500000, preferred_communities: ['Dubai Marina'] } },
  { desc: 'Budget + Location + Type', lead: { ...createInitialLeadProfile(), intent: 'Buy', budget_max: 2500000, preferred_communities: ['Dubai Marina'], property_type: 'Apartment' } },
  { desc: 'Near complete', lead: { ...createInitialLeadProfile(), intent: 'Buy', budget_max: 2500000, preferred_communities: ['Dubai Marina'], property_type: 'Apartment', bedrooms: '2', ready_or_offplan: 'Ready', financing: 'Cash', timeline: '3 months' } },
];

for (const { desc, lead } of completenessTests) {
  const { completeness, missing } = computeCompletenessAndMissing(lead);
  console.log(`  ${desc}: ${completeness}% complete | Missing: ${missing.length} (${missing.slice(0,2).join(', ')})`);
}
console.log('');

// ============================================================
// TEST 7: RAG Context Retrieval
// ============================================================
console.log('📋 TEST 7: RAG Context Retrieval');

const ragQueries = [
  'What is DLD fee?',
  'Dubai Marina rental yield',
  'Off-plan payment plan',
  'Golden visa property',
  'Property transfer fees',
];

for (const query of ragQueries) {
  const ctx = getRagContext(query);
  const hasContent = ctx.length > 0;
  console.log(`  "${query}" → ${hasContent ? '✅ Found context' : '❌ No context'}`);
  if (hasContent) {
    console.log(`    Preview: ${ctx.substring(0,80)}...`);
  }
}
console.log('');

console.log('═══════════════════════════════════════════════════════════════');
console.log('✅ ALL TESTS COMPLETED');
console.log('═══════════════════════════════════════════════════════════════');