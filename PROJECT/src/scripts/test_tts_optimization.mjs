import fs from 'fs';
import dotenv from 'dotenv';

const env = dotenv.parse(fs.readFileSync('.env'));

async function testElevenSettings(modelId, stability, similarity, style) {
  const start = Date.now();
  const res = await fetch('https://api.elevenlabs.io/v1/text-to-speech/JBFqnCBsd6RMkjVDRZzb', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'xi-api-key': env.elevanlab_api_key },
    body: JSON.stringify({
      text: 'Hello Sir, our 2 B-H-K apartment in Velachery is 950 square feet, priced at 72 lakh rupees. Would you like to schedule a site visit this weekend?',
      model_id: modelId,
      voice_settings: {
        stability: stability,
        similarity_boost: similarity,
        style: style,
        use_speaker_boost: true
      }
    })
  });
  const elapsed = Date.now() - start;
  console.log(`ElevenLabs [${modelId}] stab:${stability} sim:${similarity} style:${style} -> Status: ${res.status}, Time: ${elapsed}ms`);
  if (res.ok) {
    const buf = await res.arrayBuffer();
    console.log(`  Audio size: ${buf.byteLength} bytes`);
    return Buffer.from(buf);
  } else {
    console.log('  Error:', await res.text());
  }
}

async function testMurfSettings(voiceId, style, pitch, rate) {
  const start = Date.now();
  const res = await fetch('https://api.murf.ai/v1/speech/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': env.murf_api },
    body: JSON.stringify({
      voiceId: voiceId,
      text: 'Hello Sir, our 2 B-H-K apartment in Velachery is 950 square feet, priced at 72 lakh rupees. Would you like to schedule a site visit this weekend?',
      modelVersion: 'GEN2',
      format: 'MP3',
      style: style,
      pitch: pitch,
      rate: rate
    })
  });
  const elapsed = Date.now() - start;
  console.log(`Murf AI [${voiceId}] style:${style} pitch:${pitch} rate:${rate} -> Status: ${res.status}, Time: ${elapsed}ms`);
  const data = await res.json();
  if (res.ok && data.audioFile) {
    console.log(`  Audio length: ${data.audioLengthInSeconds}s, warnings: ${data.warning || 'none'}`);
  } else {
    console.log('  Murf response:', data);
  }
}

async function testSarvamSettings(speaker, pace, loudness, langCode) {
  const start = Date.now();
  const res = await fetch('https://api.sarvam.ai/text-to-speech', {
    method: 'POST',
    headers: { 'api-subscription-key': env.SARVAM_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      target_language_code: langCode || 'en-IN',
      text: 'Hello Sir, our 2 B-H-K apartment in Velachery is 950 square feet, priced at 72 lakh rupees. Would you like to schedule a site visit this weekend?',
      speaker: speaker,
      model: 'bulbul:v3',
      pace: pace,
      loudness: loudness,
      enable_preprocessing: true
    })
  });
  const elapsed = Date.now() - start;
  console.log(`Sarvam Bulbul [${speaker}] pace:${pace} loudness:${loudness} -> Status: ${res.status}, Time: ${elapsed}ms`);
  const data = await res.json();
  if (res.ok && data.audios?.[0]) {
    const audioLen = Buffer.from(data.audios[0], 'base64').length;
    console.log(`  Audio size: ${audioLen} bytes`);
  } else {
    console.log('  Sarvam error:', data);
  }
}

async function main() {
  console.log('=== 1. Testing ElevenLabs Configurations ===');
  await testElevenSettings('eleven_multilingual_v2', 0.6, 0.8, 0.15);
  await testElevenSettings('eleven_turbo_v2_5', 0.55, 0.75, 0.1);

  console.log('\n=== 2. Testing Murf AI Configurations ===');
  await testMurfSettings('en-US-alina', 'Conversational', 0, 0);
  await testMurfSettings('en-US-alina', 'Conversational', -2, -3);

  console.log('\n=== 3. Testing Sarvam Bulbul Configurations ===');
  await testSarvamSettings('priya', 0.95, 1.1, 'en-IN');
  await testSarvamSettings('priya', 0.90, 1.0, 'en-IN');
}

main().catch(console.error);
