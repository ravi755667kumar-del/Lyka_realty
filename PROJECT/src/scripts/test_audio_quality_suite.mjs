import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { refineForSpeech } from '../lib/speech.ts';

const env = dotenv.parse(fs.readFileSync('.env'));
const OUTPUT_DIR = path.resolve('test_audio_outputs');
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// ─── Test Suite Cases ────────────────────────────────────────────────────────
const TEST_CASES = [
  {
    id: 'case_1_greeting_en',
    category: '1. Short Greetings (English)',
    rawText: 'Hello Sir! This is Priya from Lyka Realty. Do you have two minutes to speak?',
    langCode: 'en-IN',
    engine: 'all',
  },
  {
    id: 'case_1_greeting_hi',
    category: '1. Short Greetings (Hindi)',
    rawText: 'जी नमस्ते सर! मैं लाइका रिएल्टी से प्रिया बात कर रही हूँ। क्या आप 2 मिनट बात कर सकते हैं?',
    langCode: 'hi-IN',
    engine: 'sarvam',
  },
  {
    id: 'case_1_greeting_ta',
    category: '1. Short Greetings (Tamil)',
    rawText: 'வணக்கம் சார்! நான் லைகா ரியாலிட்டில இருந்து பிரியா பேசுறேன். 2 நிமிஷம் பேசலாமா சார்?',
    langCode: 'ta-IN',
    engine: 'sarvam',
  },
  {
    id: 'case_2_long_explanation',
    category: '2. Long Explanations (Factual Real Estate)',
    rawText: 'Our 2BHK apartment in Velachery is 950 sq ft and priced at Rs. 72 Lakhs. It includes 2 car parkings, elevator access, and is ready to move in right now. Bank loan assistance is available through our partner banks (SBI, HDFC, and ICICI).',
    langCode: 'en-IN',
    engine: 'all',
  },
  {
    id: 'case_3_questions',
    category: '3. Questions & Follow-ups (Gentle Humility)',
    rawText: 'Certainly Sir, which area in Chennai are you looking for, and what would be your comfortable budget?',
    langCode: 'en-IN',
    engine: 'all',
  },
  {
    id: 'case_4_abbreviations_numbers',
    category: '4. Names, Numbers, Dates, Abbreviations',
    rawText: 'P102: 3BHK in OMR Sholinganallur, 1450 sq ft, Rs. 1.25 Crore, gym, swimming pool, CMDA approved, Dec 2026 possession.',
    langCode: 'en-IN',
    engine: 'all',
  },
  {
    id: 'case_4b_dtcp_plot',
    category: '4b. DTCP & GST Highway Abbreviations',
    rawText: 'P104: DTCP Plot in Chengalpattu, 1200 sq ft, Rs. 18 Lakhs, clear patta, near GST highway, gated community.',
    langCode: 'en-IN',
    engine: 'all',
  },
  {
    id: 'case_5_hindi_multilingual',
    category: '5. Hindi Multilingual Spoken Real Estate',
    rawText: 'जी सर, OMR Sholinganallur में 3 B-H-K फ्लैट 1.25 करोड़ रुपये में उपलब्ध है। क्या आप इस वीकेंड साइट विजिट देखना चाहेंगे?',
    langCode: 'hi-IN',
    engine: 'all',
  },
  {
    id: 'case_6_punctuation_intonation',
    category: '6. Punctuation, Micro-pauses & Respectful Tone',
    rawText: 'No problem at all Sir! I completely understand you are busy right now. We can connect whenever you are free. Have a wonderful day!',
    langCode: 'en-IN',
    engine: 'all',
  },
  {
    id: 'case_7_rental_breakdown',
    category: '7. Rental & Monthly Pricing Phrasing',
    rawText: 'P105: 1BHK Rental in Porur, 550 sq ft, Rs. 14,000 / month, deposit 3 months, near DLF IT Park.',
    langCode: 'en-IN',
    engine: 'all',
  },
];

// ─── Engine Callers ──────────────────────────────────────────────────────────

async function callElevenLabs(text, modelId = 'eleven_multilingual_v2') {
  const start = Date.now();
  const res = await fetch('https://api.elevenlabs.io/v1/text-to-speech/JBFqnCBsd6RMkjVDRZzb', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'xi-api-key': env.elevanlab_api_key },
    body: JSON.stringify({
      text: text,
      model_id: modelId,
      voice_settings: {
        stability: 0.6,
        similarity_boost: 0.8,
        style: 0.15,
        use_speaker_boost: true,
      },
    }),
  });
  const latency = Date.now() - start;
  if (!res.ok) {
    const err = await res.text();
    return { ok: false, error: err, latency };
  }
  const buf = Buffer.from(await res.arrayBuffer());
  return { ok: true, buffer: buf, size: buf.length, latency };
}

async function callMurf(text, style = 'Conversational') {
  const start = Date.now();
  const res = await fetch('https://api.murf.ai/v1/speech/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': env.murf_api },
    body: JSON.stringify({
      voiceId: 'en-US-alina',
      text: text,
      modelVersion: 'GEN2',
      format: 'MP3',
      style: style,
      rate: -2,
      pitch: 0,
    }),
  });
  const latency = Date.now() - start;
  const data = await res.json();
  if (!res.ok || !data.audioFile) {
    return { ok: false, error: JSON.stringify(data), latency };
  }
  // Download audio
  const audioRes = await fetch(data.audioFile);
  const buf = Buffer.from(await audioRes.arrayBuffer());
  return {
    ok: true,
    buffer: buf,
    size: buf.length,
    duration: data.audioLengthInSeconds,
    latency,
    url: data.audioFile,
  };
}

async function callSarvam(text, langCode = 'en-IN', speaker = 'priya') {
  const start = Date.now();
  const targetSpeaker =
    langCode === 'hi-IN' ? 'neha' : langCode === 'ta-IN' ? 'kavitha' : speaker;

  const res = await fetch('https://api.sarvam.ai/text-to-speech', {
    method: 'POST',
    headers: { 'api-subscription-key': env.SARVAM_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      target_language_code: langCode,
      text: text,
      speaker: targetSpeaker,
      model: 'bulbul:v3',
      pace: 0.95,
      loudness: 1.1,
      enable_preprocessing: true,
    }),
  });
  const latency = Date.now() - start;
  const data = await res.json();
  if (!res.ok || !data.audios?.[0]) {
    return { ok: false, error: JSON.stringify(data), latency };
  }
  const buf = Buffer.from(data.audios[0], 'base64');
  return { ok: true, buffer: buf, size: buf.length, latency, speaker: targetSpeaker };
}

// ─── Test Runner ─────────────────────────────────────────────────────────────

async function runTestSuite() {
  console.log('========================================================================');
  console.log('       LYKA REALTY AI VOICE AGENT SPEECH QUALITY TEST SUITE             ');
  console.log('========================================================================\n');

  const results = [];

  for (const tc of TEST_CASES) {
    console.log(`\n▶ [${tc.category}] (${tc.id})`);
    console.log(`  Raw Text:     "${tc.rawText}"`);
    const refined = refineForSpeech(tc.rawText);
    console.log(`  Speech Text:  "${refined}"`);

    // Verify Pronunciation Improvements
    const codeRemoved = !refined.includes('P101:') && !refined.includes('P102:') && !refined.includes('P104:') && !refined.includes('P105:');
    const acronymsExpanded = !refined.includes('sq ft') && !refined.includes('CMDA') && !refined.includes('DTCP');
    console.log(`  ✓ DB Codes Stripped:       ${codeRemoved ? 'YES' : 'NO'}`);
    console.log(`  ✓ Acronyms Pronounceable:  ${acronymsExpanded ? 'YES' : 'N/A'}`);

    const tcResult = {
      id: tc.id,
      category: tc.category,
      rawText: tc.rawText,
      refinedText: refined,
      engines: {},
    };

    // 1. ElevenLabs Test
    if (tc.engine === 'all' || tc.engine === 'elevenlabs') {
      try {
        const elRes = await callElevenLabs(refined);
        if (elRes.ok) {
          const filePath = path.join(OUTPUT_DIR, `${tc.id}_elevenlabs.mp3`);
          fs.writeFileSync(filePath, elRes.buffer);
          console.log(`  [ElevenLabs]   Latency: ${elRes.latency}ms | Size: ${elRes.size}B -> Saved: ${path.basename(filePath)}`);
          tcResult.engines.elevenlabs = { status: 'PASS', latency: elRes.latency, size: elRes.size, file: filePath };
        } else {
          console.log(`  [ElevenLabs]   FAILED: ${elRes.error}`);
          tcResult.engines.elevenlabs = { status: 'FAIL', error: elRes.error };
        }
      } catch (e) {
        console.log(`  [ElevenLabs]   EXCEPTION: ${e.message}`);
        tcResult.engines.elevenlabs = { status: 'ERROR', error: e.message };
      }
    }

    // 2. Sarvam Bulbul Test
    if (tc.engine === 'all' || tc.engine === 'sarvam') {
      try {
        const sarRes = await callSarvam(refined, tc.langCode);
        if (sarRes.ok) {
          const filePath = path.join(OUTPUT_DIR, `${tc.id}_sarvam.wav`);
          fs.writeFileSync(filePath, sarRes.buffer);
          console.log(`  [Sarvam AI]    Latency: ${sarRes.latency}ms | Size: ${sarRes.size}B | Speaker: ${sarRes.speaker} -> Saved: ${path.basename(filePath)}`);
          tcResult.engines.sarvam = { status: 'PASS', latency: sarRes.latency, size: sarRes.size, file: filePath };
        } else {
          console.log(`  [Sarvam AI]    FAILED: ${sarRes.error}`);
          tcResult.engines.sarvam = { status: 'FAIL', error: sarRes.error };
        }
      } catch (e) {
        console.log(`  [Sarvam AI]    EXCEPTION: ${e.message}`);
        tcResult.engines.sarvam = { status: 'ERROR', error: e.message };
      }
    }

    // 3. Murf AI Test (only for English or supported languages)
    if ((tc.engine === 'all' || tc.engine === 'murf') && tc.langCode === 'en-IN') {
      try {
        const murfRes = await callMurf(refined);
        if (murfRes.ok) {
          const filePath = path.join(OUTPUT_DIR, `${tc.id}_murf.mp3`);
          fs.writeFileSync(filePath, murfRes.buffer);
          console.log(`  [Murf AI]      Latency: ${murfRes.latency}ms | Size: ${murfRes.size}B | Dur: ${murfRes.duration}s -> Saved: ${path.basename(filePath)}`);
          tcResult.engines.murf = { status: 'PASS', latency: murfRes.latency, size: murfRes.size, duration: murfRes.duration, file: filePath };
        } else {
          console.log(`  [Murf AI]      FAILED: ${murfRes.error}`);
          tcResult.engines.murf = { status: 'FAIL', error: murfRes.error };
        }
      } catch (e) {
        console.log(`  [Murf AI]      EXCEPTION: ${e.message}`);
        tcResult.engines.murf = { status: 'ERROR', error: e.message };
      }
    }

    results.push(tcResult);
  }

  // Summary Report
  console.log('\n========================================================================');
  console.log('                          TEST SUITE SUMMARY                             ');
  console.log('========================================================================');
  console.log(`Total Cases Tested: ${results.length}`);
  console.log(`Generated Audio Files in: ${OUTPUT_DIR}`);
  console.log('========================================================================\n');

  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'test_results.json'),
    JSON.stringify(results, null, 2),
    'utf8'
  );
}

runTestSuite().catch(console.error);
