// Lightweight, deterministic text refinement for text-to-speech.
//
// Runs just before every TTS call (Sarvam or browser SpeechSynthesis):
//  - strips non-speakable artifacts (markdown, emojis, SSML tags, stage directions),
//  - converts written shorthand into the way people actually say it
//    (prices, percentages, slashes, abbreviations),
//  - normalises punctuation so the engine can place natural pauses and
//    falling/rising intonation,
//  - collapses immediately repeated sentences so politeness never sounds mechanical.
//
// Pure string transforms — no model calls, no network, no added latency.
// Meaning, names, numbers and facts are preserved; the caller keeps the
// original text for display/transcripts while only the spoken version changes.
// Idempotent: refineForSpeech(refineForSpeech(x)) === refineForSpeech(x).
// Uses no lookbehind so the module parses even in older mobile browsers.

const WORD = 'A-Za-z\u0900-\u097F\u0B80-\u0BFF'; // Latin + Devanagari + Tamil letters

/** Emoji, symbol and pictograph characters that TTS engines read aloud awkwardly. */
const EMOJI_PATTERN = new RegExp(
  '[' +
    '\\u{1F000}-\\u{1FAFF}' + // emoji and symbol planes (flags, hands, buildings…)
    '\\u{2190}-\\u{21FF}' + // arrows
    '\\u{2300}-\\u{23FF}' + // misc technical (⌚ ⏰ ⏳)
    '\\u{25A0}-\\u{25FF}' + // geometric shapes (● ▶)
    '\\u{2B00}-\\u{2BFF}' + // arrows, stars
    '\\u{FE00}-\\u{FE0F}' + // variation selectors
    '\\u{200D}' + // zero-width joiner
    '\\u{20E3}' + // combining keycap
    '\\u{00A9}\\u{00AE}\\u{2122}' + // (c) (r) (tm)
    ']|[' +
    '\\u{2600}-\\u{27BF}' + // misc symbols + dingbats
    ']',
  'gu'
);

/** SSML / speech-markup tags that must never be read aloud. */
const SSML_TAG_PATTERN = /<\/?(?:speak|break|prosody|say-as|phoneme|voice|emphasis|sub|lang|s|p)\b[^>]*>/gi;

/** Written shorthand → spoken form. Order matters. */
const SPOKEN_FORM_RULES: Array<[RegExp, string]> = [
  // e.g. / i.e. — engines spell the letters out. Trailing delimiter stops words like "egg".
  [new RegExp('\\be\\.?g\\.?(?=\\s|$|[,.;:)])', 'gi'), 'for example,'],
  [new RegExp('\\bi\\.?e\\.?(?=\\s|$|[,.;:)])', 'gi'), 'that is,'],

  // % and per-unit slashes — BEFORE currency rules, which insert "rupees"
  // between the number and the slash ("Rs. 14,000 / month" case)
  [/(\d[\d,]*)\s*%/g, '$1 percent'],
  [/(\d[\d,]*)\s*\/\s*(?:per\s+)?months?\b/gi, '$1 per month'],
  [/(\d[\d,]*)\s*\/\s*mo\b/gi, '$1 per month'],
  [/(\d[\d,]*)\s*\/\s*-/g, '$1 rupees'],

  // ₹ + optional unit → "72 lakh rupees" style spoken order
  [/₹\s*(\d[\d,]*(?:\.\d+)?)(\s*(?:lakhs?|crores?|cr|k))?/gi, '$1$2 rupees'],
  // leftover ₹ without a number after it (pathological) — drop silently
  [/₹/g, ''],

  // Rs. / INR + number → "... rupees"
  [/\b(?:rs\.?|inr)\s*(\d[\d,]*(?:\.\d+)?)(\s*(?:lakhs?|crores?|cr|k))?/gi, '$1$2 rupees'],

  // Shorthand units people don't spell aloud: "1.25 Cr" → "1.25 crore", "72L" → "72 lakh", "14k" → "14 thousand"
  [/\b(\d[\d,]*(?:\.\d+)?)\s*cr\b/gi, '$1 crore'],
  [/\b(\d[\d,]*(?:\.\d+)?)\s*l\b/gi, '$1 lakh'],
  [/\b(\d[\d,]*(?:\.\d+)?)\s*k\b/gi, '$1 thousand'],

  // Ampersand
  [/\s*&\s*/g, ' and '],
];

/** Fix punctuation spacing: none before, one space after letters (Latin, Devanagari, Tamil).
 *  Digits are excluded so decimals ("1.25") and thousand separators ("14,000") survive. */
function normalisePunctuationSpacing(text: string): string {
  return text
    .replace(/\s+([,.!?;:])/g, '$1')
    .replace(new RegExp(`([,.!?;:])(?=[${WORD}])`, 'g'), '$1 ')
    .replace(/ {2,}/g, ' ');
}

/** Collapse immediately repeated sentences ("Thank you. Thank you." → "Thank you."). */
function removeRepeatedSentences(text: string): string {
  // Sentence body = any char that is not a terminator, plus terminators that
  // sit inside a number ("1.25", "14,000") which must never end a sentence.
  // A sentence only ends at [.!?]+ followed by whitespace or end of text.
  const body = `(?:[^.!?]|[.!?](?=\\d))*`;
  const sentences = text.match(new RegExp(`${body}[.!?]+(?=\\s|$)|${body}`, 'g')) || [text];
  const kept: string[] = [];
  let previousKey = '';
  for (const raw of sentences) {
    const sentence = raw.trim();
    if (!sentence) continue;
    const key = sentence.toLowerCase().replace(new RegExp(`[^${WORD}0-9]`, 'g'), '');
    if (key && key === previousKey) continue;
    if (key) previousKey = key;
    kept.push(sentence);
  }
  return kept.join(' ');
}

/** Acronyms that must keep their caps (spoken letter-by-letter, e.g. "I-C-I-C-I"). */
const KEEP_CAPS_ACRONYMS = new Set(['ICICI']);

/** Capitalise long ALL-CAPS words (engines shout them); short acronyms like BHK, OMR, PAN stay. */
function softenShoutyCaps(text: string): string {
  return text.replace(new RegExp(`\\b[A-Z]{5,}\\b`, 'g'), (word) =>
    KEEP_CAPS_ACRONYMS.has(word) ? word : word.charAt(0) + word.slice(1).toLowerCase()
  );
}

/**
 * Refine text for natural, humble spoken delivery.
 * Returns a speech-ready string; never returns empty for non-empty input.
 */
export function refineForSpeech(text: string): string {
  const original = (text || '').trim();
  if (!original) return original;

  let out = original;

  // 1. Markdown links → keep only the label
  out = out.replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1');

  // 2. Markdown emphasis, code, strikethrough → keep inner words
  //    (asterisk pairs must wrap letters so math like 2*3*4 survives)
  out = out
    .replace(/\*\*(.+?)\*\*/gs, '$1')
    .replace(/__(.+?)__/gs, '$1')
    .replace(/~~(.+?)~~/gs, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(new RegExp(`\\*([^*\\n]*[${WORD}][^*\\n]*)\\*`, 'g'), '$1')
    .replace(new RegExp(`(^|\\s)_([^_\\n]*[${WORD}][^_\\n]*)_(?=\\s|$|[,.;:!?])`, 'g'), '$1$2');

  // 3. Headings, bullets, quotes, horizontal rules → plain sentences
  out = out
    .replace(/^[ \t]*#{1,6}[ \t]+/gm, '')
    .replace(/^[ \t]*(?:[-*•]|\d+\.)[ \t]+/gm, '')
    .replace(/^[ \t]*>[ \t]?/gm, '')
    .replace(/^[ \t]*([-=_*][ \t]*){3,}$/gm, '');

  // 4. Stage directions and annotations in square brackets: [pause], [Note: …]
  out = out.replace(/\[[^\]\n]*\]/g, ' ');

  // 5. SSML tags and emojis
  out = out.replace(SSML_TAG_PATTERN, ' ');
  out = out.replace(EMOJI_PATTERN, '');

  // 6. Written shorthand → spoken forms
  for (const [pattern, replacement] of SPOKEN_FORM_RULES) {
    out = out.replace(pattern, replacement);
  }
  out = out.replace(/\brupees\s+rupees\b/gi, 'rupees');

  // 7. Pauses: ellipses → comma; stray double dots → single period
  out = out.replace(/\u2026|\.{3,}/g, ',');
  out = out.replace(/\.{2,}/g, '.');

  // 8. Gentle punctuation: collapse excited runs so it never sounds aggressive
  out = out
    .replace(/!{2,}/g, '!')
    .replace(/\?{2,}/g, '?')
    .replace(/([?!])[?!]+/g, '$1');

  // 9. Flow: join lines, calm shouting, tidy spacing
  out = out.replace(/\s*\n+\s*/g, ' ');
  out = softenShoutyCaps(out);
  out = normalisePunctuationSpacing(out);

  // 10. Never repeat the same sentence back-to-back
  out = removeRepeatedSentences(out);

  // 11. Terminal punctuation → falling intonation on completed statements
  out = out.trim().replace(/[,\s]+$/, '');
  if (out && new RegExp(`[${WORD}0-9)]$`).test(out)) {
    out += '.';
  }

  return out.trim() || original;
}
