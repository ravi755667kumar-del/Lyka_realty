import assert from 'node:assert/strict';
import {
  aggregateUserLanguagesByPhone,
  appendUsedLanguage,
  extractLanguagesFromUserHistoryText,
  formatCallLanguagesLabel,
  getLanguageBadgeClasses,
  normalizeLanguageLabel,
  splitLanguagesLabel,
} from '../src/lib/languageUsage';
import { CallRecord, Lead } from '../src/types';

export async function testLanguageUsage(): Promise<{ name: string; passed: boolean; error?: string }[]> {
  const results: { name: string; passed: boolean; error?: string }[] = [];

  function run(name: string, fn: () => void) {
    try {
      fn();
      results.push({ name, passed: true });
    } catch (err: any) {
      results.push({ name, passed: false, error: err.message });
    }
  }

  run('appendUsedLanguage & formatCallLanguagesLabel: records single and mid-call switched languages cleanly', () => {
    let used: string[] = [];
    used = appendUsedLanguage(used, 'Tamil-English');
    used = appendUsedLanguage(used, 'Tamil-English');
    assert.deepEqual(used, ['Tamil-English']);
    assert.equal(formatCallLanguagesLabel(used), 'Tamil-English');

    used = appendUsedLanguage(used, 'Hindi');
    assert.deepEqual(used, ['Tamil-English', 'Hindi']);
    assert.equal(formatCallLanguagesLabel(used), 'Tamil-English -> Hindi');
  });

  run('normalizeLanguageLabel & splitLanguagesLabel: normalizes aliases and progression separators', () => {
    assert.equal(normalizeLanguageLabel('hi'), 'Hindi');
    assert.equal(normalizeLanguageLabel('tanglish'), 'Tamil-English');
    assert.equal(normalizeLanguageLabel('en-IN'), 'English');

    assert.deepEqual(splitLanguagesLabel('Tamil-English -> Hindi'), ['Tamil-English', 'Hindi']);
    assert.deepEqual(splitLanguagesLabel('Hindi → English, Hindi'), ['Hindi', 'English']);
  });

  run('extractLanguagesFromUserHistoryText: extracts unique languages across stored session logs', () => {
    const historyText = [
      'CALL SESSION #1 - 2026-11-10T10:00:00Z',
      'Duration: 45s | Status: Completed | Outcome: WARM | Language: Tamil-English',
      'CALL SESSION #2 - 2026-11-12T09:00:00Z',
      'Duration: 70s | Status: Completed | Outcome: HOT | Language: Tamil-English -> Hindi',
    ].join('\n');

    assert.deepEqual(extractLanguagesFromUserHistoryText(historyText), ['Tamil-English', 'Hindi']);
  });

  run('aggregateUserLanguagesByPhone: groups mobile numbers across calls, userHistories, and leads without duplicates', () => {
    const calls: CallRecord[] = [
      {
        id: 'call_1',
        customerId: 'lead_1',
        name: 'Ravi Kumar',
        phone: '+91 98401 23456',
        language: 'Tamil-English -> Hindi',
        status: 'Completed',
        outcome: 'HOT',
        startedAt: '2026-11-12T10:00:00.000Z',
        endedAt: '2026-11-12T10:02:00.000Z',
        duration: 120,
        qualification: { interested: 'Yes', buyerOrInvestor: 'buyer' },
      },
      {
        id: 'call_2',
        customerId: 'lead_2',
        name: 'Priya Sharma',
        phone: '9876543210',
        language: 'English',
        status: 'Completed',
        outcome: 'WARM',
        startedAt: '2026-11-11T09:00:00.000Z',
        endedAt: '2026-11-11T09:01:00.000Z',
        duration: 60,
        qualification: { interested: 'Yes', buyerOrInvestor: 'investor' },
      },
    ];

    const userHistories = [
      {
        name: 'Priya Sharma',
        phone: '+91 98765 43210',
        total_calls: 2,
        last_call_at: '2026-11-12T12:00:00.000Z',
        history_text: 'Duration: 60s | Status: Completed | Outcome: WARM | Language: Hindi',
        summary: 'Interested in 2BHK',
        qualification_text: 'Location: Velachery',
        qa_pairs_text: '1. Q: Budget? A: 75L',
      },
    ];

    const leads: Lead[] = [
      {
        id: 'lead_3',
        name: 'Karthik',
        phone: '+91 91234 56789',
        consent: true,
        blocked: false,
        status: 'Completed',
        language: 'Tamil-English',
        callCount: 1,
        callTime: '2026-11-10T08:00:00.000Z',
      },
    ];

    const summary = aggregateUserLanguagesByPhone({ calls, leads, userHistories });
    assert.equal(summary.length, 3);

    // Most recent first: Priya (+91 98765 43210 merged with 9876543210 at 12:00Z), then Ravi (10:00Z), then Karthik
    assert.equal(summary[0].name, 'Priya Sharma');
    assert.deepEqual(summary[0].languages, ['English', 'Hindi']);
    assert.equal(summary[0].totalCalls, 2);
    assert.equal(summary[0].latestOutcome, 'WARM');
    assert.equal(summary[0].summary, 'Interested in 2BHK');
    assert.equal(summary[0].qualificationText, 'Location: Velachery');
    assert.equal(summary[0].qaPairsText, '1. Q: Budget? A: 75L');
    assert.match(summary[0].historyText || '', /Language: Hindi/);
    assert.match(getLanguageBadgeClasses('Hindi'), /orange/);

    assert.equal(summary[1].phone, '+91 98401 23456');
    assert.deepEqual(summary[1].languages, ['Tamil-English', 'Hindi']);
    assert.equal(summary[1].latestLanguage, 'Hindi');

    assert.equal(summary[2].phone, '+91 91234 56789');
    assert.deepEqual(summary[2].languages, ['Tamil-English']);
  });

  return results;
}
