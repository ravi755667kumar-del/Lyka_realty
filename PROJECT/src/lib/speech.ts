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

export const SARVAM_V3_SPEAKERS = [
  'aditya', 'ritu', 'ashutosh', 'priya', 'neha', 'rahul', 'pooja', 'rohan',
  'simran', 'kavya', 'amit', 'dev', 'ishita', 'shreya', 'ratan', 'varun',
  'manan', 'sumit', 'roopa', 'kabir', 'aayan', 'shubh', 'advait', 'anand',
  'tanya', 'tarun', 'sunny', 'mani', 'gokul', 'vijay', 'shruti', 'suhani',
  'mohit', 'kavitha', 'rehan', 'soham', 'rupali',
] as const;

export type SarvamV3Speaker = (typeof SARVAM_V3_SPEAKERS)[number];

export function isSarvamV3Speaker(value: unknown): value is SarvamV3Speaker {
  return typeof value === 'string' && (SARVAM_V3_SPEAKERS as readonly string[]).includes(value);
}

const FEMALE_SARVAM_SPEAKERS = new Set(['priya', 'neha', 'pooja', 'simran', 'kavya', 'ishita', 'shreya', 'ritu', 'roopa', 'shruti', 'suhani', 'tanya', 'kavitha', 'rupali']);
const MALE_SARVAM_SPEAKERS = new Set(['aditya', 'ashutosh', 'rahul', 'rohan', 'amit', 'dev', 'ratan', 'varun', 'manan', 'sumit', 'kabir', 'aayan', 'shubh', 'advait', 'anand', 'tarun', 'sunny', 'mani', 'gokul', 'vijay', 'mohit', 'rehan', 'soham']);

export function getSarvamSpeaker(
  language: string | null,
  gender: 'female' | 'male',
  preferredVoice?: string
): SarvamV3Speaker {
  const preferredSpeakers = gender === 'male' ? MALE_SARVAM_SPEAKERS : FEMALE_SARVAM_SPEAKERS;

  const isTamil =
    language === 'Tamil-English' ||
    language === 'ta-IN' ||
    (typeof language === 'string' &&
      (language.toLowerCase().includes('tamil') || language.toLowerCase().includes('tanglish')));

  // 1. If user or config provided a preferred speaker matching the persona gender:
  if (isSarvamV3Speaker(preferredVoice) && preferredSpeakers.has(preferredVoice)) {
    // If Tamil/Tanglish and the voice is the generic North Indian default ('shreya' or 'ashutosh'),
    // upgrade to authentic native Tamil speaker for natural accent & cadence.
    if (isTamil && (preferredVoice === 'shreya' || preferredVoice === 'ashutosh')) {
      return gender === 'male' ? 'gokul' : 'kavitha';
    }
    return preferredVoice;
  }

  // 2. High-quality consistent voice for each persona and language:
  if (gender === 'female') {
    // 'kavitha' is Sarvam AI's authentic South Indian / Tamil female voice.
    // 'shreya' is the expressive Hindi / Indian English female voice.
    return isTamil ? 'kavitha' : 'shreya';
  }
  // 'gokul' is Sarvam AI's native Tamil male voice.
  // 'ashutosh' is the confident Hindi / Indian English male voice.
  return isTamil ? 'gokul' : 'ashutosh';
}

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

/** Acronyms that must keep their caps (spoken letter-by-letter or well-known standards). */
const KEEP_CAPS_ACRONYMS = new Set(['ICICI', 'HDFC', 'CIBIL', 'DTCP', 'CMDA', 'RERA', 'OMR', 'GST', 'DLF']);

/** Written shorthand → spoken form. Order matters. */
const SPOKEN_FORM_RULES: Array<[RegExp, string]> = [
  // 1. Strip internal listing codes and property tags like "P101:", "P102 -", etc.
  [/^[ \t]*[Pp]\s*(\d{3})\b\s*[:\-–]?\s*/gm, ''],
  [/\b[Pp]\s*(\d{3})\b\s*[:\-–]\s*/g, ''],

  // 2. Real estate size & configurations
  [/\b(\d+)\s*bhk\b/gi, '$1 B-H-K'],
  [/\bbhk\b/gi, 'B-H-K'],
  [/\b(\d[\d,]*)\s*(?:sq\.?\s*ft\.?|sqft|sq\s*feet)\b/gi, '$1 square feet'],
  [/\bsq\.?\s*ft\.?\b/gi, 'square feet'],

  // 3. Infrastructure & Regulatory bodies (prevent awkward mispronunciations like "cumda" or "duh-tcp")
  [/\bcmda\s+approved\b/gi, 'C-M-D-A approved'],
  [/\bcmda\b/gi, 'C-M-D-A'],
  [/\bdtcp\s+approved\b/gi, 'D-T-C-P approved'],
  [/\bdtcp\b/gi, 'D-T-C-P'],
  [/\brera\s+approved\b/gi, 'RERA approved'],
  [/\brera\b/gi, 'RERA'],
  [/\bmrts?\s+station\b/gi, 'M-R-T station'],
  [/\bmrts?\b/gi, 'M-R-T'],
  [/\bdlf\s+it\s+park\b/gi, 'D-L-F I-T Park'],
  [/\bdlf\b/gi, 'D-L-F'],
  [/\bit\s+park\b/gi, 'I-T Park'],
  [/\bgst\s+highway\b/gi, 'G-S-T highway'],

  // 4. Banks & Financial institutions
  [/\bsbi\b/gi, 'S-B-I'],
  [/\bhdfc\b/gi, 'H-D-F-C'],
  [/\bicici\b/gi, 'I-C-I-C-I'],
  [/\bcibil\b/gi, 'CIBIL'],

  // 4b. Everyday telecaller abbreviations — spoken letter-by-letter like a real person
  [/\bemi\b/gi, 'E-M-I'],
  [/\botp\b/gi, 'O-T-P'],
  [/\bcctv\b/gi, 'C-C-T-V'],
  [/\batm\b/gi, 'A-T-M'],
  [/\bpin\b/gi, 'P-I-N'],
  [/\bpan\b/gi, 'P-A-N'],
  [/\bkyc\b/gi, 'K-Y-C'],
  [/\bgps\b/gi, 'G-P-S'],
  [/\bno\.\s*(\d)/gi, 'number $1'],
  [/\bnos\.\b/gi, 'numbers'],
  [/\bvs\.?\b/gi, 'versus'],
  [/\bapprox\.?\b/gi, 'approximately'],
  [/\b2\s*(?:mins?|minutes?)\b/gi, 'two minutes'],
  [/\b1\s*(?:min|minute)\b/gi, 'one minute'],
  [/\bmins\b\.?/gi, 'minutes'],
  [/\bhrs\b/gi, 'hours'],
  [/\b(\d+)\s*[x×]\s*(\d+)\b/g, '$1 by $2'],

  // 5. Dates, Months & Days
  [/\bjan\b\.?\s*(\d{4})/gi, 'January $1'],
  [/\bfeb\b\.?\s*(\d{4})/gi, 'February $1'],
  [/\bmar\b\.?\s*(\d{4})/gi, 'March $1'],
  [/\bapr\b\.?\s*(\d{4})/gi, 'April $1'],
  [/\baug\b\.?\s*(\d{4})/gi, 'August $1'],
  [/\bsep\b\.?\s*(\d{4})/gi, 'September $1'],
  [/\boct\b\.?\s*(\d{4})/gi, 'October $1'],
  [/\bnov\b\.?\s*(\d{4})/gi, 'November $1'],
  [/\bdec\b\.?\s*(\d{4})/gi, 'December $1'],
  [/\bmon\s*-\s*sat\b/gi, 'Monday to Saturday'],
  [/\bmon\s*-\s*fri\b/gi, 'Monday to Friday'],

  // 6. Common abbreviations
  [new RegExp('\\be\\.?g\\.?(?=\\s|$|[,.;:)])', 'gi'), 'for example,'],
  [new RegExp('\\bi\\.?e\\.?(?=\\s|$|[,.;:)])', 'gi'), 'that is,'],

  // 7. Percentages & Slashing
  [/(\d[\d,]*)\s*%/g, '$1 percent'],
  [/(\d[\d,]*)\s*\/\s*(?:per\s+)?months?\b/gi, '$1 per month'],
  [/(\d[\d,]*)\s*\/\s*mo\b/gi, '$1 per month'],
  [/(\d[\d,]*)\s*\/\s*-/g, '$1 rupees'],

  // 8. Currency (clean, conversational Indian spoken numbers)
  [/₹\s*(\d[\d,]*(?:\.\d+)?)\s*(?:lakhs?|lacs?)\b/gi, '$1 lakh rupees'],
  [/₹\s*(\d[\d,]*(?:\.\d+)?)\s*crores?\b/gi, '$1 crore rupees'],
  [/₹\s*(\d[\d,]*(?:\.\d+)?)\s*cr\b/gi, '$1 crore rupees'],
  [/₹\s*(\d[\d,]*(?:\.\d+)?)/g, '$1 rupees'],
  [/₹/g, ''],

  [/\b(?:rs\.?|inr)\s*(\d[\d,]*(?:\.\d+)?)\s*(?:lakhs?|lacs?)\b/gi, '$1 lakh rupees'],
  [/\b(?:rs\.?|inr)\s*(\d[\d,]*(?:\.\d+)?)\s*crores?\b/gi, '$1 crore rupees'],
  [/\b(?:rs\.?|inr)\s*(\d[\d,]*(?:\.\d+)?)\s*cr\b/gi, '$1 crore rupees'],
  [/\b(?:rs\.?|inr)\s*(\d[\d,]*(?:\.\d+)?)/gi, '$1 rupees'],

  [/\b(\d[\d,]*(?:\.\d+)?)\s*(?:lakhs?|lacs?)\s*rupees\b/gi, '$1 lakh rupees'],
  [/\b(\d[\d,]*(?:\.\d+)?)\s*crores?\s*rupees\b/gi, '$1 crore rupees'],
  [/\b(\d[\d,]*(?:\.\d+)?)\s*cr\b/gi, '$1 crore'],
  [/\b(\d[\d,]*(?:\.\d+)?)\s*l\b/gi, '$1 lakh'],
  [/\b(\d[\d,]*(?:\.\d+)?)\s*k\b/gi, '$1 thousand'],

  // 9. Soften parentheses to natural conversational clause pauses
  [/\(([^)]+)\)/g, ', $1, '],

  // 10. Em dashes and long dashes → natural spoken breath pause
  [/\s*[—–]\s*/g, ', '],

  // 11. Polite human breath pauses between greetings/courtesies and titles ("Vanakkam, Sir", "Romba nandri, Sir")
  [/\b(hello|hi|hey|vanakkam|namaste)\s+(sir|ma'?am|madam)\b/gi, '$1, $2'],
  [/\b(certainly|sure|no problem|thank you|welcome|romba nandri|bahut shukriya|kandippa|bilkul)\s+(sir|ma'?am|madam)\b/gi, '$1, $2'],

  // 12. Gentle breath pause before sentence-closing honorifics ("...irukkum, Sir?")
  [new RegExp(`([${WORD}])\\s+(sir|ma'?am|madam)(?=[.?!]|$)`, 'gi'), '$1, $2'],

  // 13. Ampersand
  [/\s*&\s*/g, ' and '],

  // 14. Chat shorthand → the way a person actually says it
  [/\bpl[sz]\b/gi, 'please'],
  [/\btmrw\b/gi, 'tomorrow'],
  [/\b(bcoz|bcz|coz|cuz)\b/gi, 'because'],
  [/\basap\b/gi, 'as soon as possible'],
  [/\btq\b/gi, 'thank you'],
  [/\bok\b/gi, 'okay'],

  // 15. Polite South Indian telecaller colloquial refinement
  [/\b(\w+)-lendhu\b/gi, '$1-la irundhu'],
  [/\blendhu\b/gi, 'la irundhu'],
  [/\bpesuren\b/gi, 'pesaren'],
  [/\bpesalam[\-–]a\b/gi, 'pesalaama'],
  [/\birukkum[\-–]a\b/gi, 'irukkuma'],
  [/\bkekudhu[\-–]a\b/gi, 'kekudhaa'],
  [/\bkekudha\b/gi, 'kekudhaa'],
  [/\btheriyuma\b/gi, 'theriyumaa'],

  // 16. Hindi voice agent alternative cleanup (avoid reading "raha slash rahi" aloud)
  [/\braha\/rahi\b/gi, 'raha'],
  [/\bkarta\/karti\b/gi, 'karta'],
  [/\brahunga\/rahungi\b/gi, 'rahunga'],
  [/\bdeta\/deti\b/gi, 'deta'],
  [/\bsakta\/sakti\b/gi, 'sakta'],
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

function joinSpeechLines(text: string): string {
  return text
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .reduce((spoken, line) => {
      if (!spoken) return line;
      if (/[.!?]$/.test(spoken)) return `${spoken} ${line}`;
      return `${spoken.replace(/[,;:]\s*$/, '')}. ${line}`;
    }, '');
}

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

  // 4a. Lyka Realty Voice Expression Tags: convert [laughing] to subtle spoken laughter ("Ha ha, ")
  // Per Rule 1 & 6: "Use subtle laughter such as 'Ha ha' when appropriate... Ensure laughter sounds natural."
  out = out.replace(/\[laughing\]\s*/gi, 'Ha ha, ');
  out = out.replace(/(?:Ha ha,\s*){2,}/gi, 'Ha ha, ');

  // 4b. Turn [break] into a natural pause comma without stray leading whitespace
  out = out.replace(/[.!?]*\s*\[break\]\s*/gi, ', ');

  // 4c. Strip all other bracketed delivery and performance tags so TTS engines never read them aloud literally
  out = out.replace(
    /\[(excited|whispering|curious|reassuring|empathetic|calm|apologetic|confident|softly|serious|warm|happy|understanding|explaining|sad|neutral|cheerful)\]\s*/gi,
    ''
  );

  // 4d. Any remaining stage directions and annotations in square brackets
  out = out.replace(/\[[^\]\n]*\]/g, ' ');

  // 4d. Transcript speaker labels that must never be read aloud ("AI:", "Priya:", "Customer:")
  out = out.replace(/^(?:ai|agent|assistant|telecaller|customer|priya|karthik)\s*:\s*/gim, '');

  // 4c. Curly quotes are read awkwardly by most engines — drop doubles, soften singles
  out = out.replace(/[“”]/g, '').replace(/[‘’]/g, "'");

  // 4d. A trailing colon introduces a list like a machine — a person just pauses (",").
  //     Protect clock times ("9:30") while converting clause colons.
  out = out
    .replace(/(\d):(\d)/g, '$1$2')
    .replace(/:(?=\s|$)/g, ',')
    .replace(/(\d)(\d)/g, '$1:$2');

  // 5. SSML tags and emojis
  out = out.replace(SSML_TAG_PATTERN, ' ');
  out = out.replace(EMOJI_PATTERN, '');

  // 6. Written shorthand → spoken forms
  for (const [pattern, replacement] of SPOKEN_FORM_RULES) {
    out = out.replace(pattern, replacement);
  }
  out = out.replace(/\brupees\s+rupees\b/gi, 'rupees');
  out = out.replace(/,\s*\./g, '.');
  out = out.replace(/,\s*,/g, ',');

  // 7. Pauses: ellipses → comma; stray double dots → single period
  out = out.replace(/\u2026|\.{3,}/g, ',');
  out = out.replace(/\.{2,}/g, '.');

  // 8. Gentle punctuation: collapse excited runs so it never sounds aggressive
  out = out
    .replace(/!{2,}/g, '!')
    .replace(/\?{2,}/g, '?')
    .replace(/([?!])[?!]+/g, '$1')
    .replace(/,([?!])/g, '$1');

  // 9. Give separate written lines a spoken pause before calming shouting and spacing.
  out = joinSpeechLines(out);
  out = softenShoutyCaps(out);
  out = normalisePunctuationSpacing(out);

  // 10. Never repeat the same sentence back-to-back
  out = removeRepeatedSentences(out);

  // 11. Terminal punctuation → natural intonation on completed statements or questions
  out = out.trim().replace(/[,\s]+$/, '');
  if (out && new RegExp(`[${WORD}0-9)]$`).test(out)) {
    if (/^(?:what|where|who|which|how|why|can you|could you|would you|do you|is there|are there)\b/i.test(out)) {
      out += '?';
    } else {
      out += '.';
    }
  }

  return out.trim() || original;
}

export type SpeechEmotion =
  | 'sad'
  | 'refusal'
  | 'angry'
  | 'positive'
  | 'neutral'
  | 'amused'
  | 'curious'
  | 'empathetic';

/**
 * Real-time Customer Emotion Detection.
 * Primary Rule: LISTEN → UNDERSTAND THE EMOTION → SELECT THE APPROPRIATE TONE → RESPOND NATURALLY.
 * Handles English, Tamil / Tanglish, and Hindi / Hinglish conversational cues.
 */
export function detectCustomerEmotion(text: string): SpeechEmotion {
  if (!text || typeof text !== 'string') return 'neutral';
  const trimmed = text.trim();
  if (trimmed.length < 2) return 'neutral';
  const lower = trimmed.toLowerCase();

  // 1. Sadness, Grief, Illness, Medical Emergencies or Personal Tragedy
  //    (Must be gentle, empathetic, respectful; never cheerful or laughing)
  if (
    /\b(?:passed away|died|death|demise|funeral|hospital|sick|illness|critical|cancer|accident|grief|tragedy|depressed|unfortunate|lost my (?:job|father|mother|husband|wife|son|daughter|brother|sister|parent|family)|heavy loss|financial crisis|bad news)\b/i.test(lower) ||
    /\b(?:guzar gaye|dehaant|hospital me|tabiyat kharab|beemar|nuksan|chale gaye|bahut dukh|kashtama irukku|udambu sari illa|hospital-la|erandhutaanga|irandhutaanga|thirundhittaanga|periya loss)\b/i.test(lower)
  ) {
    return 'sad';
  }

  // 2. Anger, Irritation, Fraud Claims, Complaints or Frustration
  //    (Must be de-escalating, calm, polite, apologetic if needed; never defensive)
  if (
    /\b(?:cheat|cheating|scam|fraud|worst|terrible|horrible|useless|idiot|stupid|shut up|waste of time|irritated|annoyed|harassing|harassment|bad service|complaint|consumer court|file a case|sue you|rubbish|nonsense)\b/i.test(lower) ||
    /\b(?:bakwas|chutiya|fraud ho|dimag kharab|chup raho|gussa|bekar|eppovum call panreenga|tholla pannadheenga|irritate panreenga|mooditu iru|waste)\b/i.test(lower)
  ) {
    return 'angry';
  }

  // 3. Clear Refusal, Opt-Out, or Busy/Driving
  //    (Must accept politely and immediately without arguing or re-pitching)
  if (
    /\b(?:not interested|no interest|dont call|don't call|do not call|stop calling|remove my number|busy right now|in a meeting|driving|call later|call tomorrow|not now|no need|dont disturb|don't disturb)\b/i.test(lower) ||
    /\b(?:interest nahi|zaroorat nahi|call mat karo|busy hoon|driving kar raha|meeting me hoon|baad me|interest illa|venam|theva illa|call pannadheenga|busy-aa irukken|vandi ottren|driving la|aprom pesuren)\b/i.test(lower)
  ) {
    return 'refusal';
  }

  // 4. Natural Laughter, Amusement, Jokes or Humour
  //    (AI responds with subtle laughter "Ha ha" and cheerful warmth)
  if (
    /\b(?:haha|hahaha|hahah|hehe|hehehe|lol|lmao|rofl|funny|hilarious|just kidding|are you joking|you're funny|you are funny|good joke|sema joke|sirikadha|comedy pandreengala|mazaak kar rahe ho)\b/i.test(lower) ||
    /[😂🤣😆]/u.test(trimmed)
  ) {
    return 'amused';
  }

  // 5. Excitement, Good News, Celebration or High Interest
  //    (AI responds with genuine excitement and enthusiastic, welcoming girl voice)
  if (
    /\b(?:awesome|superb|fantastic|excellent|congratulations|congrats|got promoted|got a promotion|got a bonus|loan approved|booked|bought|dream home|so happy|wonderful|amazing|perfect|great news|good news|love it|really excited)\b/i.test(lower) ||
    /\b(?:bahut badiya|shandaar|kamaal|badhai|bahut khush|ekdum sahi|super|sema|arumai|sandhosham|romba nalla irukku|kandippa vaanganum)\b/i.test(lower) ||
    /[🎉👏🥳❤️]/u.test(trimmed)
  ) {
    return 'positive';
  }

  // 6. Curiosity, Complex Questions, Calculation or Exploration
  //    (AI uses natural thinking pause: "Hmm, let me check that for you right now.", "Okay, I understand.")
  if (
    /\b(?:can you explain|how does that work|what is the difference|break down|breakdown|calculate|how much emi|what are the legal|details of|tell me more about|confused about|clarify|pros and cons)\b/i.test(lower) ||
    /\b(?:samjhaiye|kya farak hai|kaise hoga|kitna kharcha|details batao|vilakkama sollunga|enna vidhyasam|eppadi calculate panradhu|details sollunga)\b/i.test(lower)
  ) {
    return 'curious';
  }

  return 'neutral';
}

export type SpeechLanguage = 'English' | 'Hindi' | 'Tamil-English';
export type SpeechProvider = 'gemini' | 'groq' | 'browser';

export interface SpeechDelivery {
  pace: number;
  loudness: number;
  sarvamTemperature: number;
  stability: number;
  style: number;
  similarityBoost: number;
  geminiStyle: string;
}

export interface PreparedSpeech {
  text: string;
  language: SpeechLanguage;
  languageCode: 'en-IN' | 'hi-IN' | 'ta-IN';
  isCodeMixed: boolean;
  emotion: SpeechEmotion;
  delivery: SpeechDelivery;
}

const TAMIL_ROMAN_HINTS =
  /\b(?:naan|neenga|ungalukku|illai|illa|seri|sari|venum|pannunga|pannalaam|pesalaam|pesaren|pesuren|irukku|irundhu|romba|kandippa|vanakkam|kekudhaa|nimisham|therinjikalam|vasadhiya|nandri)\b/i;
const HINDI_ROMAN_HINTS = /\b(?:haan|nahin|nahi|hai|hoon|aap|mujhe|chahiye|baat|kya|achha|theek)\b/i;

function resolveSpeechLanguage(text: string, requestedLanguage?: string): SpeechLanguage {
  const requested = (requestedLanguage || '').toLowerCase();
  if (requested.includes('tamil') || requested.includes('tanglish') || requested.startsWith('ta-')) {
    return 'Tamil-English';
  }
  if (requested.includes('hindi') || requested.includes('hinglish') || requested.startsWith('hi-')) {
    return 'Hindi';
  }
  if (requested.includes('english') || requested.startsWith('en-')) return 'English';
  if (/[\u0B80-\u0BFF]/u.test(text) || TAMIL_ROMAN_HINTS.test(text)) return 'Tamil-English';
  if (/[\u0900-\u097F]/u.test(text) || HINDI_ROMAN_HINTS.test(text)) return 'Hindi';
  return 'English';
}

export function getSpeechDelivery(
  emotion: SpeechEmotion = 'neutral',
  deliveryCue?: string
): SpeechDelivery {
  // Energetic, expressive telecaller temperature for Sarvam bulbul:v3
  // When customer is sad, angry or refusing, acoustic delivery stays calm (0.55) regardless of cues.
  const sarvamTemperature =
    emotion === 'sad' || emotion === 'angry' || emotion === 'refusal'
      ? 0.55
      : /^(?:calm|empathetic|understanding|reassuring|apologetic|softly|serious)$/.test(deliveryCue || '')
        ? 0.65
        : deliveryCue === 'warm'
          ? 0.78
          : deliveryCue === 'laughing' || emotion === 'amused'
            ? 0.85
            : emotion === 'positive' || deliveryCue === 'excited' || deliveryCue === 'happy'
              ? 0.82
              : emotion === 'curious' || deliveryCue === 'explaining'
                ? 0.72
                : 0.78;

  // 1. Sadness & Empathy: gentle, softer, respectful pace, calm temperature
  if (emotion === 'sad' || emotion === 'empathetic' || deliveryCue === 'softly') {
    return {
      pace: 0.98,
      loudness: 0.95,
      sarvamTemperature,
      stability: 0.72,
      style: 0.08,
      similarityBoost: 0.85,
      geminiStyle: 'gentle, empathetic, respectful, and comforting voice with thoughtful pauses',
    };
  }

  // 2. Angry / Irritated Customer: steady, de-escalating, calm tone
  if (emotion === 'angry' || deliveryCue === 'apologetic' || deliveryCue === 'reassuring') {
    return {
      pace: 1.0,
      loudness: 0.98,
      sarvamTemperature,
      stability: 0.70,
      style: 0.10,
      similarityBoost: 0.85,
      geminiStyle: 'calm, patient, reassuring, respectful, and de-escalating delivery',
    };
  }

  // 3. Customer Declined or Busy: respectful, concise, unhurried
  if (emotion === 'refusal') {
    return {
      pace: 1.02,
      loudness: 1.0,
      sarvamTemperature,
      stability: 0.65,
      style: 0.12,
      similarityBoost: 0.82,
      geminiStyle: 'polite, concise, respectful, and understanding tone',
    };
  }

  // 4. Natural Laughter / Amused: lively, bright, subtle smile in voice
  if (emotion === 'amused' || deliveryCue === 'laughing') {
    return {
      pace: 1.10,
      loudness: 1.05,
      sarvamTemperature,
      stability: 0.48,
      style: 0.28,
      similarityBoost: 0.80,
      geminiStyle: 'lighthearted, warm, smiling tone with natural subtle chuckle',
    };
  }

  // 5. Excitement & Happiness: energetic, cheerful, welcoming girl telecaller
  if (emotion === 'positive' || deliveryCue === 'excited' || deliveryCue === 'happy') {
    return {
      pace: 1.12,
      loudness: 1.08,
      sarvamTemperature,
      stability: 0.45,
      style: 0.30,
      similarityBoost: 0.82,
      geminiStyle: 'warm and naturally upbeat conversational delivery, without exaggeration',
    };
  }

  // 6. Thinking & Processing / Explaining Complex Details: articulate, measured, clear
  if (emotion === 'curious' || deliveryCue === 'explaining' || deliveryCue === 'serious') {
    return {
      pace: 1.04,
      loudness: 1.02,
      sarvamTemperature,
      stability: 0.58,
      style: 0.18,
      similarityBoost: 0.82,
      geminiStyle: 'confident, clear, thoughtful, and professional explanatory tone',
    };
  }

  // 7. Confident Professional / Warm Greeting (Default)
  return {
    pace: 1.08,
    loudness: 1.05,
    sarvamTemperature,
    stability: 0.50,
    style: 0.22,
    similarityBoost: 0.82,
    geminiStyle: 'warm, clear, natural conversational delivery',
  };
}

export function prepareSpeech(
  text: string,
  context: { language?: string; emotion?: SpeechEmotion } = {}
): PreparedSpeech {
  const language = resolveSpeechLanguage(text, context.language);
  const requestedEmotion = context.emotion || 'neutral';
  const deliveryCue = text.match(
    /\[(warm|calm|empathetic|understanding|reassuring|apologetic|softly|serious|excited|happy|laughing|whispering|curious|explaining)\]/i
  )?.[1]?.toLowerCase();

  let emotion: SpeechEmotion = requestedEmotion;
  if (emotion === 'neutral') {
    if (deliveryCue === 'laughing' || /\[laughing\]/i.test(text)) {
      emotion = 'amused';
    } else if (deliveryCue === 'excited' || deliveryCue === 'happy' || /\[(?:excited|happy)\]/i.test(text)) {
      emotion = 'positive';
    } else if (deliveryCue === 'empathetic' || deliveryCue === 'apologetic' || /\[(?:empathetic|apologetic)\]/i.test(text)) {
      emotion = 'empathetic';
    } else if (deliveryCue === 'curious' || deliveryCue === 'explaining' || /\[(?:curious|explaining)\]/i.test(text)) {
      emotion = 'curious';
    }
  }
  const hasLatin = /[A-Za-z]/.test(text);
  const hasHindiScript = /[\u0900-\u097F]/u.test(text);
  const hasTamilScript = /[\u0B80-\u0BFF]/u.test(text);
  const hasEnglishWords = /\b(?:a|an|and|can|for|in|is|it|please|the|to|we|you)\b/i.test(text);
  const isTamilLanguage =
    language === 'Tamil-English' ||
    hasTamilScript ||
    (typeof context.language === 'string' &&
      (context.language.toLowerCase().includes('tamil') ||
        context.language.toLowerCase().includes('tanglish') ||
        context.language.startsWith('ta')));
  const isHindiLanguage =
    language === 'Hindi' ||
    hasHindiScript ||
    (typeof context.language === 'string' &&
      (context.language.toLowerCase().includes('hindi') ||
        context.language.toLowerCase().includes('hinglish') ||
        context.language.startsWith('hi')));

  // For Sarvam Bulbul v3 / Indian TTS:
  // - If text is Tamil or code-mixed Tanglish -> 'ta-IN' (primary Indic language per Sarvam docs)
  // - If text is Hindi or Hinglish -> 'hi-IN'
  // - If English -> 'en-IN'
  let languageCode: 'en-IN' | 'hi-IN' | 'ta-IN' = 'en-IN';
  if (isTamilLanguage) {
    languageCode = 'ta-IN';
  } else if (isHindiLanguage) {
    languageCode = 'hi-IN';
  } else {
    languageCode = 'en-IN';
  }

  return {
    text: refineForSpeech(text),
    language,
    languageCode,
    isCodeMixed: language === 'Tamil-English'
      ? (hasTamilScript && hasLatin) || (TAMIL_ROMAN_HINTS.test(text) && hasEnglishWords)
      : language === 'Hindi'
      ? (hasHindiScript && hasLatin) || (HINDI_ROMAN_HINTS.test(text) && hasEnglishWords)
      : false,
    emotion,
    delivery: getSpeechDelivery(emotion, deliveryCue),
  };
}

export function getSarvamTtsParameters(
  delivery: SpeechDelivery,
  overrides: { pace?: unknown; temperature?: unknown } = {}
): { pace: number; temperature: number } {
  const clamp = (value: unknown, fallback: number, min: number, max: number) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
    return Math.min(max, Math.max(min, value));
  };

  return {
    pace: clamp(overrides.pace, delivery.pace, 0.5, 2),
    temperature: clamp(overrides.temperature, delivery.sarvamTemperature, 0.01, 1),
  };
}

export function selectSpeechProvider(
  language: SpeechLanguage,
  available: { gemini?: boolean; groq?: boolean }
): SpeechProvider {
  if (language === 'English' && available.groq) return 'groq';
  if (available.gemini) return 'gemini';
  if (available.groq) return 'groq';
  return 'browser';
}

export function getDefaultTtsForBrain(
  brain: 'groq' | 'gemini' | 'rules'
): 'groq' | 'gemini' | 'browser' {
  if (brain === 'groq') return 'groq';
  if (brain === 'gemini') return 'gemini';
  return 'browser';
}
