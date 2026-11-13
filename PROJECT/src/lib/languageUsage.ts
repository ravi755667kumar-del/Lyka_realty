import { CallRecord, Lead } from '../types';

export interface UserHistoryEntryLike {
  id?: string;
  name?: string;
  phone?: string;
  history_text?: string;
  latest_transcript?: string;
  qa_pairs_text?: string;
  summary?: string;
  qualification_text?: string;
  last_call_at?: string;
  total_calls?: number;
}

export interface UserLanguageUsageSummary {
  phoneKey: string;
  phone: string;
  name: string;
  languages: string[];
  latestLanguage: string;
  totalCalls: number;
  lastUsedAt?: string;
  latestOutcome?: string;
  summary?: string;
  qualificationText?: string;
  historyText?: string;
  qaPairsText?: string;
}

export function getLanguageBadgeClasses(language: string): string {
  const lower = language.toLowerCase();
  if (lower.includes('hindi')) {
    return 'bg-orange-500/15 text-orange-300 border-orange-500/30';
  }
  if (lower.includes('tamil') || lower.includes('tanglish')) {
    return 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30';
  }
  if (lower.includes('english')) {
    return 'bg-blue-500/15 text-blue-300 border-blue-500/30';
  }
  return 'bg-purple-500/15 text-purple-300 border-purple-500/30';
}

function normalizePhoneGroupingKey(phone?: string | null, name?: string | null): string {
  const rawPhone = (phone || '').trim();
  const digits = rawPhone.replace(/[^0-9]/g, '');
  if (digits.length >= 7) {
    return digits.slice(-10);
  }
  if (rawPhone) {
    return rawPhone.toLowerCase();
  }
  const cleanName = (name || '').trim().toLowerCase();
  return cleanName ? `name:${cleanName}` : '';
}

export function normalizeLanguageLabel(raw?: string | null): string {
  const val = (raw || '').trim();
  if (!val) return '';

  const lower = val.toLowerCase();
  if (lower === 'hi' || lower === 'hi-in' || lower === 'hindi' || lower === 'hinglish') {
    return 'Hindi';
  }
  if (
    lower === 'ta' ||
    lower === 'ta-in' ||
    lower === 'tamil' ||
    lower === 'tanglish' ||
    lower === 'tamil-english' ||
    lower === 'tamil english'
  ) {
    return 'Tamil-English';
  }
  if (lower === 'en' || lower === 'en-in' || lower === 'en-us' || lower === 'english') {
    return 'English';
  }

  return val;
}

export function appendUsedLanguage(history: string[], nextLang?: string | null): string[] {
  const normalized = normalizeLanguageLabel(nextLang);
  if (!normalized) return history;
  if (history.length > 0 && history[history.length - 1] === normalized) {
    return history;
  }
  return [...history, normalized];
}

export function formatCallLanguagesLabel(usedLanguages: string[], fallback?: string): string {
  const uniqueOrdered: string[] = [];
  for (const item of usedLanguages) {
    const normalized = normalizeLanguageLabel(item);
    if (normalized && !uniqueOrdered.includes(normalized)) {
      uniqueOrdered.push(normalized);
    }
  }
  if (uniqueOrdered.length > 0) {
    return uniqueOrdered.join(' -> ');
  }
  return normalizeLanguageLabel(fallback) || 'English';
}

export function splitLanguagesLabel(label?: string | null): string[] {
  const raw = (label || '').trim();
  if (!raw) return [];

  const parts = raw
    .split(/\s*(?:->|→|,|\/|\+)\s*/g)
    .map((part) => normalizeLanguageLabel(part))
    .filter(Boolean);

  const unique: string[] = [];
  for (const p of parts) {
    if (!unique.includes(p)) unique.push(p);
  }
  return unique;
}

export function extractLanguagesFromUserHistoryText(historyText?: string | null): string[] {
  if (!historyText) return [];
  const found: string[] = [];
  const regex = /Language:\s*([^\n\r|]+)/gi;
  let match: RegExpExecArray | null = null;
  while ((match = regex.exec(historyText)) !== null) {
    const parsed = splitLanguagesLabel(match[1]);
    for (const lang of parsed) {
      if (!found.includes(lang)) {
        found.push(lang);
      }
    }
  }
  return found;
}

function addUniqueLanguages(target: string[], additions: string[]): void {
  for (const lang of additions) {
    if (lang && !target.includes(lang)) {
      target.push(lang);
    }
  }
}

function getTimeMs(iso?: string): number {
  if (!iso) return 0;
  const ts = new Date(iso).getTime();
  return Number.isFinite(ts) ? ts : 0;
}

export function aggregateUserLanguagesByPhone(params: {
  calls?: CallRecord[];
  leads?: Lead[];
  userHistories?: UserHistoryEntryLike[];
}): UserLanguageUsageSummary[] {
  const { calls = [], leads = [], userHistories = [] } = params;

  interface Bucket {
    phoneKey: string;
    phone: string;
    name: string;
    languages: string[];
    latestLanguage: string;
    latestTs: number;
    lastUsedAt?: string;
    callIds: Set<string>;
    maxRecordedCalls: number;
    latestOutcome?: string;
    summary?: string;
    qualificationText?: string;
    historyText?: string;
    qaPairsText?: string;
  }

  const buckets = new Map<string, Bucket>();

  const ensureBucket = (phone?: string, name?: string): Bucket | null => {
    const key = normalizePhoneGroupingKey(phone, name);
    if (!key) return null;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        phoneKey: key,
        phone: (phone || '').trim(),
        name: (name || '').trim(),
        languages: [],
        latestLanguage: '',
        latestTs: 0,
        callIds: new Set<string>(),
        maxRecordedCalls: 0,
      };
      buckets.set(key, bucket);
    } else {
      if (!bucket.phone && phone?.trim()) bucket.phone = phone.trim();
      if ((!bucket.name || bucket.name === 'Anonymous User') && name?.trim()) {
        bucket.name = name.trim();
      }
    }
    return bucket;
  };

  // 1. Add completed call records (newest timestamps update latestLanguage)
  for (const call of calls) {
    const bucket = ensureBucket(call.phone, call.name);
    if (!bucket) continue;
    if (call.id) bucket.callIds.add(call.id);
    bucket.maxRecordedCalls = Math.max(bucket.maxRecordedCalls, 1);

    const parsedLangs = splitLanguagesLabel(call.language);
    addUniqueLanguages(bucket.languages, parsedLangs);

    const ts = getTimeMs(call.startedAt || call.endedAt);
    if (ts >= bucket.latestTs) {
      bucket.latestTs = ts;
      bucket.lastUsedAt = call.startedAt || call.endedAt || bucket.lastUsedAt;
      if (parsedLangs.length > 0) {
        bucket.latestLanguage = parsedLangs[parsedLangs.length - 1];
      }
      if (call.outcome) bucket.latestOutcome = call.outcome;
      if (call.summary) bucket.summary = call.summary;
    } else {
      if (!bucket.latestOutcome && call.outcome) bucket.latestOutcome = call.outcome;
      if (!bucket.summary && call.summary) bucket.summary = call.summary;
    }
  }

  // 2. Merge /api/user-history entries (preserves multi-session historical languages & text logs)
  for (const hist of userHistories) {
    const bucket = ensureBucket(hist.phone, hist.name);
    if (!bucket) continue;
    if (typeof hist.total_calls === 'number' && hist.total_calls > 0) {
      bucket.maxRecordedCalls = Math.max(bucket.maxRecordedCalls, hist.total_calls);
    }
    if (hist.history_text && !bucket.historyText) bucket.historyText = hist.history_text;
    if (hist.qa_pairs_text && !bucket.qaPairsText) bucket.qaPairsText = hist.qa_pairs_text;
    if (hist.qualification_text && !bucket.qualificationText) {
      bucket.qualificationText = hist.qualification_text;
    }
    if (hist.summary && !bucket.summary) bucket.summary = hist.summary;

    const parsedLangs = extractLanguagesFromUserHistoryText(hist.history_text);
    addUniqueLanguages(bucket.languages, parsedLangs);

    const ts = getTimeMs(hist.last_call_at);
    if (ts >= bucket.latestTs && parsedLangs.length > 0) {
      bucket.latestTs = ts;
      bucket.lastUsedAt = hist.last_call_at || bucket.lastUsedAt;
      bucket.latestLanguage = parsedLangs[parsedLangs.length - 1];
    }
  }

  // 3. Merge Lead records (catches leads with saved language or offline calls)
  for (const lead of leads) {
    const hasActivity =
      (lead.callCount && lead.callCount > 0) ||
      Boolean(lead.transcript) ||
      Boolean(lead.lastCallId) ||
      Boolean(lead.language);
    if (!hasActivity) continue;

    const bucket = ensureBucket(lead.phone, lead.name);
    if (!bucket) continue;
    if (lead.lastCallId) bucket.callIds.add(lead.lastCallId);
    if (typeof lead.callCount === 'number' && lead.callCount > 0) {
      bucket.maxRecordedCalls = Math.max(bucket.maxRecordedCalls, lead.callCount);
    }
    if (!bucket.latestOutcome && lead.outcome) bucket.latestOutcome = lead.outcome;
    if (!bucket.summary && lead.summary) bucket.summary = lead.summary;

    const parsedLangs = splitLanguagesLabel(lead.language);
    addUniqueLanguages(bucket.languages, parsedLangs);

    const leadTime = lead.callTime || lead.updatedAt || lead.createdAt;
    const ts = getTimeMs(leadTime);
    if (ts >= bucket.latestTs && parsedLangs.length > 0) {
      bucket.latestTs = ts;
      bucket.lastUsedAt = leadTime || bucket.lastUsedAt;
      bucket.latestLanguage = parsedLangs[parsedLangs.length - 1];
    }
  }

  const results: UserLanguageUsageSummary[] = [];
  for (const bucket of buckets.values()) {
    if (bucket.languages.length === 0) continue;
    results.push({
      phoneKey: bucket.phoneKey,
      phone: bucket.phone || 'No Phone',
      name: bucket.name || 'Customer',
      languages: bucket.languages,
      latestLanguage: bucket.latestLanguage || bucket.languages[bucket.languages.length - 1],
      totalCalls: Math.max(bucket.callIds.size, bucket.maxRecordedCalls, 1),
      lastUsedAt: bucket.lastUsedAt,
      latestOutcome: bucket.latestOutcome,
      summary: bucket.summary,
      qualificationText: bucket.qualificationText,
      historyText: bucket.historyText,
      qaPairsText: bucket.qaPairsText,
    });
  }

  results.sort((a, b) => getTimeMs(b.lastUsedAt) - getTimeMs(a.lastUsedAt));
  return results;
}
