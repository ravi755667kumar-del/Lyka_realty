import assert from 'node:assert/strict';
import {
  estimateTokens,
  getAiUsageStats,
  recordLlmTurnUsage,
  recordSttUsage,
  recordTtsUsage,
  resetAiUsageStats,
  saveAiUsageStats,
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

  return results;
}
