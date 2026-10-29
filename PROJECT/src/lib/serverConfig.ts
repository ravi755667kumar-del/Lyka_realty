import fs from 'fs';
import path from 'path';

const VAPI_CONFIG_FILE = path.resolve(process.cwd(), 'vapi-config.local.json');
const SARVAM_CONFIG_FILE = path.resolve(process.cwd(), 'sarvam-config.local.json');
const GROQ_CONFIG_FILE = path.resolve(process.cwd(), 'groq-config.local.json');

// ─── Vapi Config ─────────────────────────────────────────────────────────────
export function getVapiSettings() {
  let fileConfig: any = {};
  if (fs.existsSync(VAPI_CONFIG_FILE)) {
    try {
      fileConfig = JSON.parse(fs.readFileSync(VAPI_CONFIG_FILE, 'utf8'));
    } catch (e) {
      // ignore
    }
  }
  return {
    apiKey: fileConfig.apiKey || process.env.VAPI_API_KEY || '',
    phoneNumberId: fileConfig.phoneNumberId || process.env.VAPI_PHONE_NUMBER_ID || '',
    assistantId: fileConfig.assistantId || process.env.VAPI_ASSISTANT_ID || '',
  };
}

export function saveVapiSettings(settings: {
  apiKey?: string;
  phoneNumberId?: string;
  assistantId?: string;
}) {
  const current = getVapiSettings();
  const updated = {
    apiKey: settings.apiKey !== undefined ? settings.apiKey : current.apiKey,
    phoneNumberId: settings.phoneNumberId !== undefined ? settings.phoneNumberId : current.phoneNumberId,
    assistantId: settings.assistantId !== undefined ? settings.assistantId : current.assistantId,
  };
  fs.writeFileSync(VAPI_CONFIG_FILE, JSON.stringify(updated, null, 2), 'utf8');
  return updated;
}

// ─── Sarvam Config ───────────────────────────────────────────────────────────
export function getSarvamSettings() {
  let fileConfig: any = {};
  if (fs.existsSync(SARVAM_CONFIG_FILE)) {
    try {
      fileConfig = JSON.parse(fs.readFileSync(SARVAM_CONFIG_FILE, 'utf8'));
    } catch (e) {
      // ignore
    }
  }
  return {
    apiKey: fileConfig.apiKey || process.env.SARVAM_API_KEY || '',
  };
}

export function saveSarvamSettings(settings: { apiKey?: string }) {
  const current = getSarvamSettings();
  const updated = {
    apiKey: settings.apiKey !== undefined ? settings.apiKey : current.apiKey,
  };
  fs.writeFileSync(SARVAM_CONFIG_FILE, JSON.stringify(updated, null, 2), 'utf8');
  return updated;
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
    apiKey: fileConfig.apiKey || process.env.GROQ_API_KEY || '',
  };
}

export function saveGroqSettings(settings: { apiKey?: string }) {
  const current = getGroqSettings();
  const updated = {
    apiKey: settings.apiKey !== undefined ? settings.apiKey : current.apiKey,
  };
  fs.writeFileSync(GROQ_CONFIG_FILE, JSON.stringify(updated, null, 2), 'utf8');
  return updated;
}
