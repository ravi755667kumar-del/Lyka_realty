import fs from 'fs';
import path from 'path';

const GROQ_CONFIG_FILE = path.resolve(process.cwd(), 'groq-config.local.json');
const GEMINI_CONFIG_FILE = path.resolve(process.cwd(), 'gemini-config.local.json');

function readDotEnvValue(key: string): string {
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      const lines = content.split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
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

function getEnvValue(key: string): string {
  // In local dev, read .env on disk first so manual .env edits take effect without stale process.env
  if (process.env.NODE_ENV !== 'production') {
    const fromFile = readDotEnvValue(key);
    if (fromFile) return fromFile;
  }
  if (process.env[key]) return process.env[key]!;
  return readDotEnvValue(key);
}

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
    apiKey: fileConfig.apiKey || getEnvValue('GROQ_API_KEY') || '',
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
    apiKey:
      fileConfig.apiKey ||
      getEnvValue('GEMINI_API_KEY') ||
      getEnvValue('GOOGLE_API_KEY') ||
      '',
    voice: fileConfig.voice || 'Kore',
    model:
      fileConfig.model ||
      getEnvValue('gemini_model') ||
      getEnvValue('GEMINI_MODEL') ||
      'gemini-4-neon',
  };
}

export function saveGeminiSettings(settings: { apiKey?: string; voice?: string; model?: string }) {
  const current = getGeminiSettings();
  const updated = {
    apiKey: settings.apiKey !== undefined ? settings.apiKey : current.apiKey,
    voice: settings.voice !== undefined ? settings.voice : current.voice,
    model: settings.model !== undefined ? settings.model : current.model,
  };
  fs.writeFileSync(GEMINI_CONFIG_FILE, JSON.stringify(updated, null, 2), 'utf8');
  return updated;
}

// ─── Speechify Config ────────────────────────────────────────────────────────
const SPEECHIFY_CONFIG_FILE = path.resolve(process.cwd(), 'speechify-config.local.json');

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

// ─── Twilio Config ───────────────────────────────────────────────────────────
const TWILIO_CONFIG_FILE = path.resolve(process.cwd(), 'twilio-config.local.json');

export function getTwilioSettings() {
  let fileConfig: any = {};
  if (fs.existsSync(TWILIO_CONFIG_FILE)) {
    try {
      fileConfig = JSON.parse(fs.readFileSync(TWILIO_CONFIG_FILE, 'utf8'));
    } catch (e) {
      // ignore
    }
  }
  return {
    accountSid:
      fileConfig.accountSid ||
      process.env.TWILIO_ACCOUNT_SID ||
      getEnvValue('TWILIO_ACCOUNT_SID') ||
      '',
    authToken:
      fileConfig.authToken ||
      process.env.TWILIO_AUTH_TOKEN ||
      getEnvValue('TWILIO_AUTH_TOKEN') ||
      '',
    phoneNumber:
      fileConfig.phoneNumber ||
      process.env.TWILIO_PHONE_NUMBER ||
      getEnvValue('TWILIO_PHONE_NUMBER') ||
      '',
  };
}

export function saveTwilioSettings(settings: {
  accountSid?: string;
  authToken?: string;
  phoneNumber?: string;
}) {
  const current = getTwilioSettings();
  const updated = {
    accountSid: settings.accountSid !== undefined ? settings.accountSid.trim() : current.accountSid,
    authToken: settings.authToken !== undefined ? settings.authToken.trim() : current.authToken,
    phoneNumber: settings.phoneNumber !== undefined ? settings.phoneNumber.trim() : current.phoneNumber,
  };
  fs.writeFileSync(TWILIO_CONFIG_FILE, JSON.stringify(updated, null, 2), 'utf8');
  return updated;
}
