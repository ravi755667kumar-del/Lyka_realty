import fs from 'fs';
import dotenv from 'dotenv';
import { queryBestPDFAnswer } from '../lib/neon.ts';

const env = dotenv.parse(fs.readFileSync('.env'));
process.env.neon_db = env.neon_db;
process.env.DATABASE_URL = env.neon_db;
const groqKey = env.GROQ_API_KEY || env.groq_api_key;

const GROQ_TELECALLER_SYSTEM_PROMPT = `
You are Priya, a humble, polite, warm, and respectful female property telecaller from Lyka Realty.
You speak naturally like a real woman property advisor having a courteous, modest phone conversation.

CORE RULES:
1. Speak 1 to 2 short sentences maximum per turn. Never give long paragraphs.
2. "GET AND FIND THE SIMILAR, THEN ASK THE NEXT QUESTION":
   - Always listen and respond directly to what the customer actually said.
   - Acknowledge their point with warmth and humility, and immediately ask the NEXT logical question to guide the conversation forward.
3. TANGLISH: Use everyday spoken Tamil in English letters mixed with English.
4. HINGLISH: Use spoken Hindi in Roman letters mixed with English with female forms ("dekh leti hoon", "bata deti hoon", "disturb nahi karti").
5. Plain flowing spoken text only: NO markdown, NO asterisks, NO bullet points.
`.trim();

async function simulateTurn(userInput, language) {
  console.log(`\n💬 Customer (${language}): "${userInput}"`);

  // 1. Semantic match from Neon DB
  const bestKnowledge = await queryBestPDFAnswer(userInput, language);
  console.log(`🔍 Dataset RAG match: ${bestKnowledge ? 'Found' : 'None'}`);

  const messages = [
    { role: 'system', content: GROQ_TELECALLER_SYSTEM_PROMPT },
  ];

  if (bestKnowledge) {
    messages.push({
      role: 'system',
      content: `VERIFIED DATASET MATCH FROM DATABASE:\n${bestKnowledge}\n\nCRITICAL INSTRUCTION: Speak 1 to 2 short sentences only. Speak in the humble voice of female telecaller Priya. Address the customer's statement using the verified dataset phrasing above, and explicitly ASK THE NEXT QUESTION specified in the dataset!`,
    });
  }

  messages.push({ role: 'user', content: userInput });

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'curl/7.68.0',
      Authorization: `Bearer ${groqKey}`,
    },
    body: JSON.stringify({
      model: 'openai/gpt-oss-20b',
      messages,
      temperature: 0.5,
      max_tokens: 500,
    }),
  });

  const data = await res.json();
  let reply = data.choices?.[0]?.message?.content || '';
  if (!reply.trim() && data.choices?.[0]?.message?.reasoning) {
    const lines = data.choices[0].message.reasoning.split('\n').filter(l => l.trim().length > 0);
    reply = lines.pop() || '';
  }
  console.log(`🎙️ Priya (Agent): "${reply.trim()}"`);
  return reply;
}

async function run() {
  console.log('Testing End-to-End Conversation Flow with Groq LLM & Updated Dataset...\n');

  // Case 1: Tanglish Price Objection
  await simulateTurn('Price romba adhigama irukku', 'Tanglish');

  // Case 2: Hinglish Meeting / Busy
  await simulateTurn('Abhi meeting mein hoon, baad mein baat karo', 'Hinglish');

  // Case 3: Tanglish WhatsApp request
  await simulateTurn('Details WhatsApp-la anuppunga', 'Tanglish');

  // Case 4: Hinglish Property Interest
  await simulateTurn('Haan, mujhe property dekhni hai', 'Hinglish');

  // Case 5: English Specific Property Inquiry
  await simulateTurn('Tell me about the 2BHK flat in Velachery', 'English');
}

run().catch(console.error);
