import assert from 'node:assert/strict';
import {
  estimateTokens,
  getAiUsageStats,
  recordLlmTurnUsage,
  recordSttUsage,
  recordTtsUsage,
  resetAiUsageStats,
  saveAiUsageStats,
  calculateQuotaRemaining,
  getModelTokenQuota,
  getSttMinutesQuota,
  getTtsCharsQuota,
  getAiQuotaConfig,
  saveAiQuotaConfig,
  resetAiQuotaConfig,
  DEFAULT_AI_QUOTAS,
} from '../src/services/aiUsageTracker';

// Mock localStorage for Node test environment
const mockStorage: Record<string, string> = {};
(global as any).window = {};
(global as any).localStorage = {
  getItem: (key: string) => mockStorage[key] || null,
  setItem: (key: string, val: string) => {
    mockStorage[key] = val;
  },
  removeItem: (key: string) => {
    delete mockStorage[key];
  },
  clear: () => {
    for (const k in mockStorage) delete mockStorage[k];
  },
};

export async function testAiUsageTracker(): Promise<{ name: string; passed: boolean; error?: string }[]> {
  const results: { name: string; passed: boolean; error?: string }[] = [];

  function run(name: string, fn: () => void) {
    try {
      fn();
      results.push({ name, passed: true });
    } catch (err: any) {
      results.push({ name, passed: false, error: err.message });
    }
  }

  // Test 1: estimateTokens
  run('estimateTokens: returns 0 for empty or whitespace strings', () => {
    assert.equal(estimateTokens(''), 0);
    assert.equal(estimateTokens(null as any), 0);
  });

  run('estimateTokens: estimates ~4 characters per token correctly', () => {
    assert.equal(estimateTokens('abcd'), 1);
    assert.equal(estimateTokens('12345678'), 2);
    const text = 'Hello, this is Priya calling from Lyka Realty regarding your property interest.';
    const tokens = estimateTokens(text);
    assert.ok(tokens >= 18 && tokens <= 22, `Expected ~20 tokens, got ${tokens}`);
  });

  // Test 2: getAiUsageStats baseline
  run('getAiUsageStats: returns complete baseline structure with LLM, STT, TTS, and costs', () => {
    localStorage.clear();
    const stats = getAiUsageStats();
    assert.ok(stats.llm.totalTokens > 0, 'Total tokens should be > 0');
    assert.ok(stats.llm.totalPromptTokens > 0, 'Prompt tokens should be > 0');
    assert.ok(stats.llm.totalCompletionTokens > 0, 'Completion tokens should be > 0');
    assert.ok(stats.stt.totalAudioMinutes > 0, 'STT audio minutes should be > 0');
    assert.ok(stats.tts.totalCharacters > 0, 'TTS characters should be > 0');
    assert.ok(stats.estimatedCost.savingsPercent > 80, 'Savings percent should be > 80%');
    assert.ok(stats.llm.byModel['Google Gemini 2.5 Flash'], 'Gemini model should exist');
    assert.ok(stats.llm.byModel['Groq Llama 3.3 70B'], 'Groq model should exist');
    assert.ok(stats.llm.byModel['OpenAI GPT-4o-mini'], 'OpenAI model should exist');
  });

  // Test 3: recordLlmTurnUsage
  run('recordLlmTurnUsage: increments calls, prompt, completion, and total tokens', () => {
    localStorage.clear();
    const before = getAiUsageStats();
    const initialTokens = before.llm.totalTokens;
    const initialCalls = before.llm.totalCalls;

    recordLlmTurnUsage({
      modelName: 'Google Gemini 2.5 Flash',
      promptTokens: 120,
      completionTokens: 35,
      latencyMs: 280,
    });

    const after = getAiUsageStats();
    assert.equal(after.llm.totalCalls, initialCalls + 1);
    assert.equal(after.llm.totalTokens, initialTokens + 155);
    assert.equal(after.llm.totalPromptTokens, before.llm.totalPromptTokens + 120);
    assert.equal(after.llm.totalCompletionTokens, before.llm.totalCompletionTokens + 35);
  });

  // Test 4: recordSttUsage
  run('recordSttUsage: tracks customer voice turns, audio seconds, and words', () => {
    localStorage.clear();
    const before = getAiUsageStats();
    const initialSecs = before.stt.totalAudioSeconds;
    const initialReqs = before.stt.totalRequests;

    recordSttUsage({
      provider: 'Deepgram Nova-2',
      audioDurationSeconds: 15,
      transcriptText: 'Yes I am interested in a two bedroom flat in Velachery',
    });

    const after = getAiUsageStats();
    assert.equal(after.stt.totalRequests, initialReqs + 1);
    assert.equal(after.stt.totalAudioSeconds, initialSecs + 15);
    assert.ok(after.stt.totalWords > before.stt.totalWords);
    assert.ok(after.stt.byProvider['Deepgram Nova-2'].audioSeconds >= 15);
  });

  // Test 5: recordTtsUsage
  run('recordTtsUsage: tracks synthesized speech characters and audio duration', () => {
    localStorage.clear();
    const before = getAiUsageStats();
    const initialChars = before.tts.totalCharacters;
    const initialReqs = before.tts.totalRequests;

    const speechText = 'Vanakkam! We have verified ready to move 2BHK apartments in Velachery.';
    recordTtsUsage({
      provider: 'Cartesia Sonic',
      text: speechText,
      audioDurationSeconds: 4,
    });

    const after = getAiUsageStats();
    assert.equal(after.tts.totalRequests, initialReqs + 1);
    assert.equal(after.tts.totalCharacters, initialChars + speechText.length);
    assert.equal(after.tts.totalAudioSeconds, before.tts.totalAudioSeconds + 4);
  });

  // Test 6: resetAiUsageStats
  run('resetAiUsageStats: resets back to initial baseline accurately', () => {
    recordLlmTurnUsage({
      modelName: 'Groq Llama 3.3 70B',
      promptTokens: 5000,
      completionTokens: 1000,
    });
    const modified = getAiUsageStats();
    assert.ok(modified.llm.totalTokens > 0);

    const resetStats = resetAiUsageStats();
    assert.ok(resetStats.llm.totalCalls > 0);
    assert.ok(resetStats.estimatedCost.savingsPercent > 80);
  });

  // Test 7: calculateQuotaRemaining
  run('calculateQuotaRemaining: computes total, used, remaining, percentages and health status', () => {
    // 50% used
    const res1 = calculateQuotaRemaining(500000, 1000000);
    assert.equal(res1.totalQuota, 1000000);
    assert.equal(res1.used, 500000);
    assert.equal(res1.remaining, 500000);
    assert.equal(res1.percentUsed, 50);
    assert.equal(res1.percentRemaining, 50);
    assert.equal(res1.status, 'healthy');

    // 80% used -> warning (20% remaining)
    const res2 = calculateQuotaRemaining(800000, 1000000);
    assert.equal(res2.remaining, 200000);
    assert.equal(res2.percentRemaining, 20);
    assert.equal(res2.status, 'warning');

    // 95% used -> critical (5% remaining)
    const res3 = calculateQuotaRemaining(950000, 1000000);
    assert.equal(res3.remaining, 50000);
    assert.equal(res3.percentRemaining, 5);
    assert.equal(res3.status, 'critical');

    // Edge cases: 0 used or over quota
    const resZero = calculateQuotaRemaining(0, 500000);
    assert.equal(resZero.remaining, 500000);
    assert.equal(resZero.percentRemaining, 100);

    const resOver = calculateQuotaRemaining(1200000, 1000000);
    assert.equal(resOver.remaining, 0);
    assert.equal(resOver.percentUsed, 100);
    assert.equal(resOver.percentRemaining, 0);
    assert.equal(resOver.status, 'critical');
  });

  // Test 8: Quota config persistence & resolution
  run('getAiQuotaConfig & saveAiQuotaConfig: saves and retrieves customized quotas', () => {
    resetAiQuotaConfig();
    const initialConfig = getAiQuotaConfig();
    assert.equal(initialConfig.monthlyTokenQuota, DEFAULT_AI_QUOTAS.monthlyTokenQuota);
    assert.equal(initialConfig.monthlyAudioMinutesQuota, 120);

    // Save custom quota
    saveAiQuotaConfig({
      ...initialConfig,
      monthlyTokenQuota: 2000000,
      monthlyAudioMinutesQuota: 300,
    });

    const updatedConfig = getAiQuotaConfig();
    assert.equal(updatedConfig.monthlyTokenQuota, 2000000);
    assert.equal(updatedConfig.monthlyAudioMinutesQuota, 300);

    // Model & provider quota resolution
    const geminiQuota = getModelTokenQuota('Google Gemini 2.5 Flash', updatedConfig);
    assert.ok(geminiQuota > 0);
    const sttQuota = getSttMinutesQuota('Deepgram Nova-2', updatedConfig);
    assert.ok(sttQuota > 0);
    const ttsQuota = getTtsCharsQuota('Cartesia Sonic', updatedConfig);
    assert.ok(ttsQuota > 0);

    // Reset back
    resetAiQuotaConfig();
    const finalConfig = getAiQuotaConfig();
    assert.equal(finalConfig.monthlyTokenQuota, DEFAULT_AI_QUOTAS.monthlyTokenQuota);
  });

  return results;
}
