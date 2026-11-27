/**
 * Shared Gemini generateContent client with `.env` model priority and verified fallbacks.
 */

const DEPRECATED_OR_INVALID_GEMINI_MODELS = new Set([
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-1.5-turbo',
  'gemini-1.5-turbo-2',
  'gemini-2.0-flash',
  'gemini-2.5-flash',
]);

const CHAT_FALLBACK_MODELS = [
  'gemini-4-neon',
  'gemini-3.5-flash-lite',
  'gemini-3.5-flash',
  'gemini-4-hydrogen',
  'gemini-3.8-flash',
];

const STT_FALLBACK_MODELS = [
  'gemini-3.5-transcribe',
  'gemini-3.5-flash-lite',
  'gemini-4-neon',
  'gemini-4-hydrogen',
  'gemini-3.5-flash',
];

export const GEMINI_TTS_MODELS = [
  'gemini-3.8-flash-tts',
  'gemini-3.8-flash-lite-tts',
  'gemini-2.5-flash-preview-tts',
];

/** Builds an ordered, deduplicated list of Gemini chat models honoring `.env` configuration. */
export function buildGeminiChatCandidates(
  requestedModel?: string,
  configuredModel?: string
): string[] {
  const candidates: string[] = [];
  const pushValid = (m?: string) => {
    const clean = typeof m === 'string' ? m.trim() : '';
    if (!clean || DEPRECATED_OR_INVALID_GEMINI_MODELS.has(clean)) return;
    if (!candidates.includes(clean)) candidates.push(clean);
  };

  pushValid(configuredModel);
  pushValid(requestedModel);
  for (const fallback of CHAT_FALLBACK_MODELS) {
    pushValid(fallback);
  }
  return candidates;
}

/** Builds an ordered, deduplicated list of Gemini STT-capable models. */
export function buildGeminiSttCandidates(configuredModel?: string): string[] {
  const candidates: string[] = [];
  const pushValid = (m?: string) => {
    const clean = typeof m === 'string' ? m.trim() : '';
    if (!clean || DEPRECATED_OR_INVALID_GEMINI_MODELS.has(clean)) return;
    if (!candidates.includes(clean)) candidates.push(clean);
  };

  // Dedicated transcription & multimodal lite models respond fastest and avoid 429/timeout
  for (const m of STT_FALLBACK_MODELS) {
    pushValid(m);
  }
  pushValid(configuredModel);
  return candidates;
}

function modelSupportsThinkingBudget(model: string): boolean {
  return !/(flash-lite|transcribe)/i.test(model);
}

export interface GeminiUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface GeminiGenerateResult {
  ok: boolean;
  model: string;
  text: string;
  parts: Array<{ text?: string; inlineData?: { data?: string; mimeType?: string } }>;
  usage: GeminiUsage | null;
  status: number;
  lastError: string;
}

/**
 * Calls Gemini `:generateContent` across candidate models, passing the API key in headers
 * and automatically omitting `thinkingConfig` for models that reject it.
 */
export async function callGeminiGenerateContent(params: {
  apiKey: string;
  models: string[];
  contents: unknown[];
  systemInstruction?: string;
  generationConfig?: Record<string, unknown>;
  disableThinking?: boolean;
  logScope?: string;
}): Promise<GeminiGenerateResult> {
  const {
    apiKey,
    models,
    contents,
    systemInstruction,
    generationConfig = {},
    disableThinking = false,
    logScope = 'Gemini',
  } = params;

  let lastError = 'No Gemini models available.';
  let lastStatus = 502;

  for (const model of models) {
    const tryThinking = disableThinking && modelSupportsThinkingBudget(model);
    const attemptModes = tryThinking ? [true, false] : [false];

    for (const includeThinking of attemptModes) {
      const mergedConfig: Record<string, unknown> = { ...generationConfig };
      if (includeThinking) {
        mergedConfig.thinkingConfig = { thinkingBudget: 0 };
      } else {
        delete mergedConfig.thinkingConfig;
      }

      const payload: Record<string, unknown> = {
        contents,
        generationConfig: mergedConfig,
      };
      if (systemInstruction) {
        payload.systemInstruction = { parts: [{ text: systemInstruction }] };
      }

      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': apiKey,
            },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(7000),
          }
        );

        lastStatus = response.status;
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          lastError = data?.error?.message || `Gemini returned ${response.status}`;
          console.warn(`[${logScope}] Model ${model} failed (${response.status}):`, lastError);
          // Retry same model once without thinkingConfig if it rejected that argument
          if (response.status === 400 && includeThinking) {
            continue;
          }
          break;
        }

        const parts = (data?.candidates?.[0]?.content?.parts || []) as Array<{
          text?: string;
          inlineData?: { data?: string; mimeType?: string };
        }>;
        const text = parts.map((p) => p.text || '').join('').trim();
        const hasAudio = parts.some((p) => Boolean(p.inlineData?.data));
        const usage: GeminiUsage | null = data?.usageMetadata
          ? {
              prompt_tokens: data.usageMetadata.promptTokenCount || 0,
              completion_tokens: data.usageMetadata.candidatesTokenCount || 0,
              total_tokens: data.usageMetadata.totalTokenCount || 0,
            }
          : null;

        if (text || hasAudio) {
          return { ok: true, model, text, parts, usage, status: response.status, lastError: '' };
        }

        lastError = `${model} returned empty output.`;
        break;
      } catch (err: unknown) {
        lastError = err instanceof Error ? err.message : 'Network error';
        console.warn(`[${logScope}] Model ${model} exception:`, lastError);
        break;
      }
    }
  }

  return {
    ok: false,
    model: models[0] || '',
    text: '',
    parts: [],
    usage: null,
    status: lastStatus,
    lastError,
  };
}
