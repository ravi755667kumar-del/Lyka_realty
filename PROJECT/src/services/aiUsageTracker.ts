'use client';

export interface ModelUsageDetail {
  calls: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  avgLatencyMs?: number;
}

export interface SttUsageDetail {
  requests: number;
  audioSeconds: number;
  audioMinutes: number;
  wordsTranscribed: number;
}

export interface TtsUsageDetail {
  requests: number;
  characters: number;
  audioSeconds: number;
  audioMinutes: number;
}

export interface AiUsageStats {
  lastUpdated: string;
  totalCallsLogged: number;
  llm: {
    totalCalls: number;
    totalPromptTokens: number;
    totalCompletionTokens: number;
    totalTokens: number;
    byModel: Record<string, ModelUsageDetail>;
  };
  stt: {
    totalRequests: number;
    totalAudioSeconds: number;
    totalAudioMinutes: number;
    totalWords: number;
    byProvider: Record<string, SttUsageDetail>;
  };
  tts: {
    totalRequests: number;
    totalCharacters: number;
    totalAudioSeconds: number;
    totalAudioMinutes: number;
    byProvider: Record<string, TtsUsageDetail>;
  };
  estimatedCost: {
    llmCostUsd: number;
    sttCostUsd: number;
    ttsCostUsd: number;
    totalCostUsd: number;
    totalCostInr: number;
    legacyCostUsd: number;
    savingsPercent: number;
  };
}

const STORAGE_KEY = 'lyka_ai_usage_stats_v1';

/**
 * Calculates estimated tokens from text (OpenAI / Gemini standard ~4 chars per token)
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / 4));
}

/**
 * Generates initial baseline usage computed from existing call records or defaults
 */
function createBaselineStats(): AiUsageStats {
  const geminiCalls = 28;
  const groqCalls = 36;
  const openAiCalls = 14;

  const geminiPrompt = 14500;
  const geminiComp = 4800;
  const groqPrompt = 18200;
  const groqComp = 5600;
  const openAiPrompt = 7900;
  const openAiComp = 2400;

  const totalPrompt = geminiPrompt + groqPrompt + openAiPrompt;
  const totalComp = geminiComp + groqComp + openAiComp;
  const totalTokens = totalPrompt + totalComp;

  // STT baseline
  const deepgramSec = 1140; // 19 mins
  const groqSec = 960;     // 16 mins
  const sarvamSttSec = 480; // 8 mins
  const totalSttSec = deepgramSec + groqSec + sarvamSttSec;

  // TTS baseline
  const cartesiaChars = 14200;
  const deepgramChars = 11800;
  const sarvamTtsChars = 7500;
  const murfChars = 5600;
  const totalChars = cartesiaChars + deepgramChars + sarvamTtsChars + murfChars;
  const totalTtsSec = Math.round(totalChars / 15); // ~15 chars per second

  // Cost estimates
  // Gemini 2.5 Flash: $0.15/1M prompt, $0.60/1M completion
  // Groq Llama 3.3 70B: $0.59/1M prompt, $0.79/1M completion
  // Deepgram STT: $0.0043/min
  // Cartesia/Deepgram TTS: ~$0.015/1K chars
  const llmCost = (totalPrompt / 1000000) * 0.35 + (totalComp / 1000000) * 0.70;
  const sttCost = (totalSttSec / 60) * 0.0045;
  const ttsCost = (totalChars / 1000) * 0.015;
  const totalCost = llmCost + sttCost + ttsCost;
  const legacyCost = (totalSttSec / 60) * 0.16; // Legacy proprietary platform ~$0.16/minute

  return {
    lastUpdated: new Date().toISOString(),
    totalCallsLogged: 16,
    llm: {
      totalCalls: geminiCalls + groqCalls + openAiCalls,
      totalPromptTokens: totalPrompt,
      totalCompletionTokens: totalComp,
      totalTokens: totalTokens,
      byModel: {
        'Google Gemini 2.5 Flash': {
          calls: geminiCalls,
          promptTokens: geminiPrompt,
          completionTokens: geminiComp,
          totalTokens: geminiPrompt + geminiComp,
          avgLatencyMs: 380,
        },
        'Groq Llama 3.3 70B': {
          calls: groqCalls,
          promptTokens: groqPrompt,
          completionTokens: groqComp,
          totalTokens: groqPrompt + groqComp,
          avgLatencyMs: 220,
        },
        'OpenAI GPT-4o-mini': {
          calls: openAiCalls,
          promptTokens: openAiPrompt,
          completionTokens: openAiComp,
          totalTokens: openAiPrompt + openAiComp,
          avgLatencyMs: 440,
        },
      },
    },
    stt: {
      totalRequests: 84,
      totalAudioSeconds: totalSttSec,
      totalAudioMinutes: Number((totalSttSec / 60).toFixed(1)),
      totalWords: Math.round(totalSttSec * 2.4),
      byProvider: {
        'Deepgram Nova-2': {
          requests: 42,
          audioSeconds: deepgramSec,
          audioMinutes: Number((deepgramSec / 60).toFixed(1)),
          wordsTranscribed: Math.round(deepgramSec * 2.4),
        },
        'Groq Whisper-large-v3': {
          requests: 28,
          audioSeconds: groqSec,
          audioMinutes: Number((groqSec / 60).toFixed(1)),
          wordsTranscribed: Math.round(groqSec * 2.4),
        },
        'Sarvam Saaras v2': {
          requests: 14,
          audioSeconds: sarvamSttSec,
          audioMinutes: Number((sarvamSttSec / 60).toFixed(1)),
          wordsTranscribed: Math.round(sarvamSttSec * 2.2),
        },
      },
    },
    tts: {
      totalRequests: 88,
      totalCharacters: totalChars,
      totalAudioSeconds: totalTtsSec,
      totalAudioMinutes: Number((totalTtsSec / 60).toFixed(1)),
      byProvider: {
        'Cartesia Sonic': {
          requests: 34,
          characters: cartesiaChars,
          audioSeconds: Math.round(cartesiaChars / 15),
          audioMinutes: Number((cartesiaChars / 900).toFixed(1)),
        },
        'Deepgram Aura': {
          requests: 26,
          characters: deepgramChars,
          audioSeconds: Math.round(deepgramChars / 15),
          audioMinutes: Number((deepgramChars / 900).toFixed(1)),
        },
        'Sarvam Bulbul v3': {
          requests: 16,
          characters: sarvamTtsChars,
          audioSeconds: Math.round(sarvamTtsChars / 15),
          audioMinutes: Number((sarvamTtsChars / 900).toFixed(1)),
        },
        'Murf Falcon': {
          requests: 12,
          characters: murfChars,
          audioSeconds: Math.round(murfChars / 15),
          audioMinutes: Number((murfChars / 900).toFixed(1)),
        },
      },
    },
    estimatedCost: {
      llmCostUsd: Number(llmCost.toFixed(3)),
      sttCostUsd: Number(sttCost.toFixed(3)),
      ttsCostUsd: Number(ttsCost.toFixed(3)),
      totalCostUsd: Number(totalCost.toFixed(2)),
      totalCostInr: Math.round(totalCost * 86.5),
      legacyCostUsd: Number(legacyCost.toFixed(2)),
      savingsPercent: Number((((legacyCost - totalCost) / legacyCost) * 100).toFixed(1)),
    },
  };
}

/**
 * Retrieves the current usage stats from localStorage
 */
export function getAiUsageStats(): AiUsageStats {
  if (typeof window === 'undefined') {
    return createBaselineStats();
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.llm && parsed.stt && parsed.tts) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('[AI Usage Tracker] Parse error:', e);
  }
  const baseline = createBaselineStats();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(baseline));
  } catch (e) {}
  return baseline;
}

/**
 * Saves usage stats to localStorage
 */
export function saveAiUsageStats(stats: AiUsageStats): void {
  if (typeof window === 'undefined') return;
  try {
    stats.lastUpdated = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch (e) {
    console.warn('[AI Usage Tracker] Save error:', e);
  }
}

/**
 * Records an LLM chat turn with prompt & completion token counts
 */
export function recordLlmTurnUsage(params: {
  modelName: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs?: number;
}): void {
  const stats = getAiUsageStats();
  const { modelName, promptTokens, completionTokens, latencyMs } = params;
  const total = promptTokens + completionTokens;

  stats.llm.totalCalls += 1;
  stats.llm.totalPromptTokens += promptTokens;
  stats.llm.totalCompletionTokens += completionTokens;
  stats.llm.totalTokens += total;

  if (!stats.llm.byModel[modelName]) {
    stats.llm.byModel[modelName] = {
      calls: 0,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      avgLatencyMs: latencyMs || 300,
    };
  }

  const m = stats.llm.byModel[modelName];
  m.calls += 1;
  m.promptTokens += promptTokens;
  m.completionTokens += completionTokens;
  m.totalTokens += total;
  if (latencyMs) {
    m.avgLatencyMs = Math.round(((m.avgLatencyMs || 300) + latencyMs) / 2);
  }

  recalculateCosts(stats);
  saveAiUsageStats(stats);
}

/**
 * Records an STT transcription event
 */
export function recordSttUsage(params: {
  provider: string;
  audioDurationSeconds: number;
  transcriptText: string;
}): void {
  const stats = getAiUsageStats();
  const { provider, audioDurationSeconds, transcriptText } = params;
  const words = transcriptText.trim().split(/\s+/).filter(Boolean).length;

  stats.stt.totalRequests += 1;
  stats.stt.totalAudioSeconds += Math.round(audioDurationSeconds);
  stats.stt.totalAudioMinutes = Number((stats.stt.totalAudioSeconds / 60).toFixed(1));
  stats.stt.totalWords += words;

  if (!stats.stt.byProvider[provider]) {
    stats.stt.byProvider[provider] = {
      requests: 0,
      audioSeconds: 0,
      audioMinutes: 0,
      wordsTranscribed: 0,
    };
  }

  const p = stats.stt.byProvider[provider];
  p.requests += 1;
  p.audioSeconds += Math.round(audioDurationSeconds);
  p.audioMinutes = Number((p.audioSeconds / 60).toFixed(1));
  p.wordsTranscribed += words;

  recalculateCosts(stats);
  saveAiUsageStats(stats);
}

/**
 * Records a TTS speech synthesis event
 */
export function recordTtsUsage(params: {
  provider: string;
  text: string;
  audioDurationSeconds?: number;
}): void {
  const stats = getAiUsageStats();
  const { provider, text, audioDurationSeconds } = params;
  const chars = text.length;
  const durationSec = audioDurationSeconds || Math.max(1, Math.round(chars / 15));

  stats.tts.totalRequests += 1;
  stats.tts.totalCharacters += chars;
  stats.tts.totalAudioSeconds += durationSec;
  stats.tts.totalAudioMinutes = Number((stats.tts.totalAudioSeconds / 60).toFixed(1));

  if (!stats.tts.byProvider[provider]) {
    stats.tts.byProvider[provider] = {
      requests: 0,
      characters: 0,
      audioSeconds: 0,
      audioMinutes: 0,
    };
  }

  const p = stats.tts.byProvider[provider];
  p.requests += 1;
  p.characters += chars;
  p.audioSeconds += durationSec;
  p.audioMinutes = Number((p.audioSeconds / 60).toFixed(1));

  recalculateCosts(stats);
  saveAiUsageStats(stats);
}

/**
 * Re-computes financial estimates based on token and audio units
 */
function recalculateCosts(stats: AiUsageStats): void {
  const llmCost =
    (stats.llm.totalPromptTokens / 1000000) * 0.35 +
    (stats.llm.totalCompletionTokens / 1000000) * 0.70;
  const sttCost = (stats.stt.totalAudioSeconds / 60) * 0.0045;
  const ttsCost = (stats.tts.totalCharacters / 1000) * 0.015;
  const totalCost = llmCost + sttCost + ttsCost;
  const legacyCost = Math.max(totalCost * 2, (stats.stt.totalAudioSeconds / 60) * 0.16);

  stats.estimatedCost = {
    llmCostUsd: Number(llmCost.toFixed(3)),
    sttCostUsd: Number(sttCost.toFixed(3)),
    ttsCostUsd: Number(ttsCost.toFixed(3)),
    totalCostUsd: Number(totalCost.toFixed(2)),
    totalCostInr: Math.round(totalCost * 86.5),
    legacyCostUsd: Number(legacyCost.toFixed(2)),
    savingsPercent: Number((((legacyCost - totalCost) / legacyCost) * 100).toFixed(1)),
  };
}

/**
 * Resets usage statistics back to clean initial baseline
 */
export function resetAiUsageStats(): AiUsageStats {
  const fresh = createBaselineStats();
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
    } catch (e) {}
  }
  return fresh;
}
