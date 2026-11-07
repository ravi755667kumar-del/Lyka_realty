import fs from 'fs';
import dotenv from 'dotenv';
import { queryBestPDFAnswer } from '../lib/neon.ts';

const env = dotenv.parse(fs.readFileSync('.env'));
process.env.neon_db = env.neon_db;
process.env.GROQ_API_KEY = env.GROQ_API_KEY || env.groq_api_key;

const testCases = [
  {
    name: '1. Tanglish - Driving (Updated PDF Situation 34)',
    lang: 'Tanglish',
    question: 'Naan drive pannittu irukken',
    expectedKeywords: ['safe', 'drive', 'apram']
  },
  {
    name: '2. Tanglish - Discount Inquiry (Updated PDF Situation 22)',
    lang: 'Tanglish',
    question: 'Discount kudupeengalaa?',
    expectedKeywords: ['offers', 'confirm', 'listing']
  },
  {
    name: '3. Tanglish - Comparing Builders (Updated PDF Situation 31)',
    lang: 'Tanglish',
    question: 'Vera builder kooda compare panren',
    expectedKeywords: ['compare', 'location', 'price']
  },
  {
    name: '4. Tanglish - Are You Robot / AI? (Updated PDF Situation 41)',
    lang: 'Tanglish',
    question: 'Neenga robot-aa pesareenga?',
    expectedKeywords: ['virtual assistant', 'real person']
  },
  {
    name: '5. Tanglish - Price Too High (Updated PDF Situation 20)',
    lang: 'Tanglish',
    question: 'Price romba adhigama irukku',
    expectedKeywords: ['budget', 'puriyudhu']
  },
  {
    name: '6. Tanglish - WhatsApp Details Request (Updated PDF Situation 10)',
    lang: 'Tanglish',
    question: 'Details WhatsApp-la anuppunga',
    expectedKeywords: ['whatsapp', 'number', 'details']
  },
  {
    name: '7. Hinglish - Meeting / Busy',
    lang: 'Hinglish',
    question: 'Abhi meeting mein hoon, baad mein baat karo',
    expectedKeywords: ['disturb nahi', 'convenient', 'shaam']
  },
  {
    name: '8. English/Bilingual - Velachery 2BHK Listing',
    lang: 'English',
    question: 'Tell me about the 2BHK flat in Velachery',
    expectedKeywords: ['72', 'velachery', 'site visit']
  }
];

async function runTests() {
  console.log('================================================================');
  console.log('🤖 VERIFYING UPDATED 50-SCENARIO TANGLISH & MULTILINGUAL RAG');
  console.log('================================================================\n');

  let passed = 0;

  for (const tc of testCases) {
    console.log(`Testing: ${tc.name}`);
    console.log(`User Input: "${tc.question}" (Language: ${tc.lang})`);

    try {
      const match = await queryBestPDFAnswer(tc.question, tc.lang);
      if (!match) {
        console.log('❌ FAIL: No matching scenario found in Neon DB!\n');
        continue;
      }

      console.log('✅ Matched Knowledge Context:');
      console.log(match.split('\n').map(l => '   ' + l).join('\n'));

      const hasNextQ = match.includes('NEXT QUESTION TO ASK:');
      const lower = match.toLowerCase();
      const hasKeyword = tc.expectedKeywords.some(kw => lower.includes(kw.toLowerCase()));

      if (hasNextQ && hasKeyword) {
        console.log('🎉 PASS: Found similar dataset scenario & extracted next question!\n');
        passed++;
      } else {
        console.log(`⚠️ PARTIAL: hasNextQ=${hasNextQ}, hasKeyword=${hasKeyword}\n`);
      }
    } catch (err) {
      console.error('❌ ERROR:', err.message, '\n');
    }
  }

  console.log('================================================================');
  console.log(`Summary: ${passed} of ${testCases.length} scenarios passed.`);
  console.log('================================================================');
}

runTests().catch(err => {
  console.error('Test run error:', err);
});
