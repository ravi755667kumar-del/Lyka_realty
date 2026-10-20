import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: true });

// 1. Local OpenAI-compatible TTS server (e.g. Kokoro, Piper, OpenedAI-speech)
const OPENAI_TTS_BASE_URL = process.env.OPENAI_TTS_BASE_URL || 'http://localhost:5050/v1';
const OPENAI_TTS_API_KEY = process.env.OPENAI_TTS_API_KEY || 'unused';
const OPENAI_TTS_MODEL = process.env.OPENAI_TTS_MODEL || 'tts-1';
const OPENAI_TTS_VOICE = process.env.OPENAI_TTS_VOICE || 'nova';

// 2. Cartesia Sonic TTS
const CARTESIA_API_KEY = process.env.CARTESIA_API_KEY || 'sk_car_S3sw714jcTeRHPZSCDXbz7';
const CARTESIA_MODEL = process.env.CARTESIA_MODEL || 'sonic-3.6';
const CARTESIA_VOICE_ID = process.env.CARTESIA_VOICE_ID || 'db6b0ed5-d5d3-463d-ae85-518a07d3c2b4';

/**
 * Clean raw markdown and code snippets into natural speech-friendly text
 */
export function cleanTextForSpeech(rawText) {
  if (!rawText) return '';
  return rawText
    // Remove all HTML tags including <br>, <br/>, <div>, <span>
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/?[a-z0-9]+(?:\s+[^>]*>|>)/gi, ' ')
    // Replace markdown images: ![caption](url)
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, ' The diagram is displayed on your screen. ')
    // Replace fenced code blocks with a brief natural phrase
    .replace(/```mermaid[\s\S]*?```/gi, ' The flowchart diagram is displayed on your screen. ')
    .replace(/```[\s\S]*?```/g, ' The code example is shown on your screen. ')
    // Replace inline code formatting
    .replace(/`([^`]+)`/g, '$1')
    // Remove markdown bold and italic
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    // Remove markdown headers
    .replace(/#{1,6}\s+/g, '')
    // Replace markdown links with just the link text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove raw URLs
    .replace(/https?:\/\/\S+/g, '')
    // Replace HTML entities
    .replace(/&ge;/g, 'greater than or equal to')
    .replace(/&times;/g, 'times')
    .replace(/&rarr;/g, 'to')
    .replace(/&bull;/g, '')
    .replace(/&amp;/g, 'and')
    // Remove emojis that sound awkward when read aloud
    .replace(/[\u{1F300}-\u{1F6FF}|\u{1F900}-\u{1F9FF}|\u{2600}-\u{26FF}|\u{2700}-\u{27BF}]/gu, '')
    // Clean bullet points and symbols
    .replace(/[$_~>|•]/g, ' ')
    .replace(/[-*]\s+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// In-memory audio cache for frequent speech phrases
const audioCache = new Map();

function cacheResult(key, val) {
  if (audioCache.size > 100) {
    const firstKey = audioCache.keys().next().value;
    audioCache.delete(firstKey);
  }
  audioCache.set(key, val);
}

/**
 * Generate speech audio.
 * Priority 1: Local OpenAI-compatible TTS server (http://localhost:5050/v1/audio/speech, model="tts-1", voice="nova")
 * Priority 2: Cartesia Sonic 3.6 API
 */
export async function generateSpeechAudio({ text, voiceId, speed = 1.0 }) {
  const cleaned = cleanTextForSpeech(text);
  if (!cleaned) {
    throw new Error('No valid text provided for speech synthesis');
  }

  const transcript = cleaned.length > 1500 ? cleaned.substring(0, 1500) + '...' : cleaned;
  const cacheKey = `${voiceId || 'default'}_${speed}_${transcript}`;

  if (audioCache.has(cacheKey)) {
    return audioCache.get(cacheKey);
  }

  // -------------------------------------------------------------------------
  // Priority 1: Local OpenAI-Compatible TTS Server (port 5050)
  // -------------------------------------------------------------------------
  try {
    const localUrl = `${OPENAI_TTS_BASE_URL.replace(/\/+$/, '')}/audio/speech`;
    const openAiRes = await axios.post(
      localUrl,
      {
        model: OPENAI_TTS_MODEL,
        voice: voiceId || OPENAI_TTS_VOICE,
        input: transcript,
        response_format: 'mp3'
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_TTS_API_KEY}`,
          'Content-Type': 'application/json'
        },
        responseType: 'arraybuffer',
        timeout: 25000 // Allow sufficient time for neural voice synthesis
      }
    );

    if (openAiRes.status === 200 && openAiRes.data) {
      const buffer = Buffer.from(openAiRes.data);
      const result = {
        buffer,
        contentType: openAiRes.headers['content-type'] || 'audio/mpeg',
        engine: 'local_openai_tts'
      };
      cacheResult(cacheKey, result);
      console.log(`🎙️ Successfully synthesized speech via Local OpenAI TTS (${buffer.length} bytes, port 5050, voice: ${voiceId || OPENAI_TTS_VOICE})`);
      return result;
    }
  } catch (localErr) {
    console.warn(`Local OpenAI TTS server (${OPENAI_TTS_BASE_URL}) warning:`, localErr.message);
  }

  // -------------------------------------------------------------------------
  // Priority 2: Cartesia Sonic 3.6 TTS API
  // -------------------------------------------------------------------------
  if (CARTESIA_API_KEY && !CARTESIA_API_KEY.includes('your_')) {
    try {
      const payload = {
        model_id: CARTESIA_MODEL,
        transcript,
        voice: {
          mode: 'id',
          id: voiceId || CARTESIA_VOICE_ID
        },
        output_format: {
          container: 'wav',
          encoding: 'pcm_s16le',
          sample_rate: 44100
        },
        generation_config: {
          speed,
          volume: 1
        }
      };

      const response = await axios.post('https://api.cartesia.ai/tts/bytes', payload, {
        headers: {
          'X-API-Key': CARTESIA_API_KEY,
          'Cartesia-Version': '2024-06-10',
          'Content-Type': 'application/json'
        },
        responseType: 'arraybuffer',
        timeout: 15000
      });

      const buffer = Buffer.from(response.data);
      const result = {
        buffer,
        contentType: 'audio/wav',
        engine: 'cartesia_sonic'
      };
      cacheResult(cacheKey, result);
      console.log(`⚡ Synthesized speech via Cartesia Sonic (${CARTESIA_MODEL})`);
      return result;
    } catch (cartesiaErr) {
      if (cartesiaErr.response?.status === 402) {
        console.warn('⚠️ Cartesia API quota/credits exhausted (HTTP 402). Defaulting to Local OpenAI TTS or Browser Speech.');
      } else {
        console.warn('Cartesia TTS notice:', cartesiaErr.message);
      }
      return {
        fallback: true,
        reason: cartesiaErr.response?.status === 402 ? 'quota_exhausted' : cartesiaErr.message
      };
    }
  }

  return {
    fallback: true,
    reason: 'Local server on port 5050 is not yet started and Cartesia is unavailable'
  };
}
