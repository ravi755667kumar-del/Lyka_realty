import fs from 'fs';
import path from 'path';

const GROQ_CONFIG_FILE = path.resolve(process.cwd(), 'groq-config.local.json');
const GEMINI_CONFIG_FILE = path.resolve(process.cwd(), 'gemini-config.local.json');

// ─── Groq Config ─────────────────────────────────────────────────────────────
export function getGroqSettings() {
  let fileConfig: any = {};
  if (fs.existsSync(GROQ_CONFIG_FILE)) {
    try {
      fileConfig = JSON.parse(fs.readFileSync(GROQ_CONFIG_FILE, 'utf8'));
    } catch (e) {
      // ignore
    }
  }
  return {
    apiKey: fileConfig.apiKey || process.env.GROQ_API_KEY || '',
    voice: fileConfig.voice || 'autumn',
  };
}

export function saveGroqSettings(settings: { apiKey?: string; voice?: string }) {
  const current = getGroqSettings();
  const updated = {
    apiKey: settings.apiKey !== undefined ? settings.apiKey : current.apiKey,
    voice: settings.voice !== undefined ? settings.voice : current.voice,
  };
  fs.writeFileSync(GROQ_CONFIG_FILE, JSON.stringify(updated, null, 2), 'utf8');
  return updated;
}

// ─── Gemini Config ───────────────────────────────────────────────────────────
export function getGeminiSettings() {
  let fileConfig: any = {};
  if (fs.existsSync(GEMINI_CONFIG_FILE)) {
    try {
      fileConfig = JSON.parse(fs.readFileSync(GEMINI_CONFIG_FILE, 'utf8'));
    } catch (e) {
      // ignore
    }
  }
  return {
    apiKey: fileConfig.apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '',
    voice: fileConfig.voice || 'Kore',
  };
}

export function saveGeminiSettings(settings: { apiKey?: string; voice?: string }) {
  const current = getGeminiSettings();
  const updated = {
    apiKey: settings.apiKey !== undefined ? settings.apiKey : current.apiKey,
    voice: settings.voice !== undefined ? settings.voice : current.voice,
  };
  fs.writeFileSync(GEMINI_CONFIG_FILE, JSON.stringify(updated, null, 2), 'utf8');
  return updated;
}

// ─── Speechify Config ────────────────────────────────────────────────────────
const SPEECHIFY_CONFIG_FILE = path.resolve(process.cwd(), 'speechify-config.local.json');

function getEnvValue(key: string): string {
  if (process.env[key]) return process.env[key]!;
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      const lines = content.split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx !== -1) {
          const k = trimmed.slice(0, eqIdx).trim();
          const val = trimmed.slice(eqIdx + 1).trim();
          if (k.toLowerCase() === key.toLowerCase()) {
            return val.replace(/^['"]|['"]$/g, '');
          }
        }
      }
    }
  } catch (e) {
    // ignore
  }
  return '';
}

export function getSpeechifySettings() {
  let fileConfig: any = {};
  if (fs.existsSync(SPEECHIFY_CONFIG_FILE)) {
    try {
      fileConfig = JSON.parse(fs.readFileSync(SPEECHIFY_CONFIG_FILE, 'utf8'));
    } catch (e) {
      // ignore
    }
  }
  return {
    apiKey:
      fileConfig.apiKey ||
      process.env.SPEECHIFY_API_KEY ||
      process.env.speechify_api ||
      getEnvValue('speechify_api') ||
      getEnvValue('SPEECHIFY_API_KEY') ||
      '',
    voice: fileConfig.voice || 'abirami', // Native Tamil / Indian female voice
    model: fileConfig.model || 'simba-3.5',
  };
}

export function saveSpeechifySettings(settings: { apiKey?: string; voice?: string; model?: string }) {
  const current = getSpeechifySettings();
  const updated = {
    apiKey: settings.apiKey !== undefined ? settings.apiKey : current.apiKey,
    voice: settings.voice !== undefined ? settings.voice : current.voice,
    model: settings.model !== undefined ? settings.model : current.model,
  };
  fs.writeFileSync(SPEECHIFY_CONFIG_FILE, JSON.stringify(updated, null, 2), 'utf8');
  return updated;
}

// ─── OpenAI Config ───────────────────────────────────────────────────────────
const OPENAI_CONFIG_FILE = path.resolve(process.cwd(), 'openai-config.local.json');

export function getOpenAISettings() {
  let fileConfig: any = {};
  if (fs.existsSync(OPENAI_CONFIG_FILE)) {
    try {
      fileConfig = JSON.parse(fs.readFileSync(OPENAI_CONFIG_FILE, 'utf8'));
    } catch (e) {
      // ignore
    }
  }
  return {
    apiKey:
      fileConfig.apiKey ||
      process.env.OPENAI_API_KEY ||
      process.env.openai_key ||
      getEnvValue('openai_key') ||
      getEnvValue('OPENAI_API_KEY') ||
      '',
    ttsModel: fileConfig.ttsModel || 'tts-1',
    sttModel: fileConfig.sttModel || 'whisper-1',
    chatModel: fileConfig.chatModel || 'gpt-4o-mini',
    voice: fileConfig.voice || 'nova', // 'nova', 'shimmer', 'coral' for female; 'onyx', 'echo', 'ash' for male
  };
}

export function saveOpenAISettings(settings: {
  apiKey?: string;
  ttsModel?: string;
  sttModel?: string;
  chatModel?: string;
  voice?: string;
}) {
  const current = getOpenAISettings();
  const updated = {
    apiKey: settings.apiKey !== undefined ? settings.apiKey : current.apiKey,
    ttsModel: settings.ttsModel !== undefined ? settings.ttsModel : current.ttsModel,
    sttModel: settings.sttModel !== undefined ? settings.sttModel : current.sttModel,
    chatModel: settings.chatModel !== undefined ? settings.chatModel : current.chatModel,
    voice: settings.voice !== undefined ? settings.voice : current.voice,
  };
  fs.writeFileSync(OPENAI_CONFIG_FILE, JSON.stringify(updated, null, 2), 'utf8');
  return updated;
}
