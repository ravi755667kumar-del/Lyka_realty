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

  // 4c. Strip all bracketed delivery and performance tags so TTS engines never read them aloud literally
  out = out.replace(
    /\[(?:excited|whispering|curious|reassuring|empathetic|calm|apologetic|confident|softly|serious|warm|happy|cheerful|joyful|bubbly|enthusiastic|understanding|explaining|sad|neutral|friendly)(?:[,\s]+(?:excited|whispering|curious|reassuring|empathetic|calm|apologetic|confident|softly|serious|warm|happy|cheerful|joyful|bubbly|enthusiastic|understanding|explaining|sad|neutral|friendly))*\]\s*/gi,
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
    /\b(?:passed away|died|death|demise|funeral|critical condition|cancer|hospitalized|accident|grief|tragedy|lost my (?:father|mother|husband|wife|son|daughter|brother|sister|parent|family))\b/i.test(lower) ||
    /\b(?:guzar gaye|dehaant|hospital me admit|tabiyat bahut kharab|chale gaye|bahut dukh|hospital-la admit|udambu mudiyala|erandhutaanga|irandhutaanga|thirundhittaanga)\b/i.test(lower)
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

  // 5. Excitement, Good News, Celebration or High Interest & Positive Engagement
  //    (AI responds with genuine excitement, attractive charm, and cheerful, welcoming girl voice)
  if (
    /\b(?:awesome|superb|fantastic|excellent|congratulations|congrats|got promoted|got a promotion|got a bonus|loan approved|booked|bought|dream home|so happy|wonderful|amazing|perfect|great news|good news|love it|really excited|nice|good|interested|sure|yes|yeah|happy|glad)\b/i.test(lower) ||
    /\b(?:bahut badiya|shandaar|kamaal|badhai|bahut khush|ekdum sahi|super|sema|arumai|sandhosham|romba nalla irukku|kandippa vaanganum|nalladhu|pidichurukku|super-aa irukku)\b/i.test(lower) ||
    /[🎉👏🥳❤️✨😊👍]/u.test(trimmed)
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
  /\b(?:naan|naa|neenga|neengal|ungalukku|unga|engalukku|enga|enaku|enakku|illai|illa|illanga|seri|seringa|sari|saringa|aama|aamam|aamaam|venum|vendam|venam|pothum|podhum|pannunga|pannalam|pannalaam|panren|pannuren|panniten|pesalam|pesalaam|pesunga|pesaren|pesuren|sollunga|solren|irukku|irukka|irukeenga|irundhu|irundha|romba|kandippa|vanakkam|kekudhaa|kekutha|nimisham|therinjikalam|vasadhiya|nandri|nanri|evlo|evvalavu|enna|eppo|eppadi|epdi|endha|indha|andha|inga|anga|vaanga|ponga|paakalam|paakalaam|paakuren|parkalam|parunga|paarunga|kudunga|kodunga|anuppunga|anupunga|konjam|puriyudhu|puriyala|puriyadhu|theriyum|theriyala|theriyadhu|vadagai|vaadagai|veedu|pakkathula|pakathula|appuram|apram|thaan|dhaan|kooda|naalai|naalaikku|innaiku|inniku)\b/i;
const HINDI_ROMAN_HINTS =
  /\b(?:haan|haanji|nahin|nahi|nai|nhi|hai|hain|hoon|hun|hoga|hogi|aap|aapka|aapki|aapke|aapko|mujhe|mujhko|humko|hume|hamara|hamari|mera|meri|kya|kyu|kyon|kaise|kahan|kaha|kitna|kitne|kitni|chahiye|chahie|chahta|chahti|batao|bataiye|batayiye|boliye|baat|karo|kijiye|karna|karunga|karungi|achha|accha|acha|theek|thik|badiya|badhiya|bilkul|zaroor|jaroor|zarur|khareedna|kharidna|bechna|kiraya|kiraye|makaan|bhi|abhi|pehle|zyada|jyada|yahan|wahan|bhejo|bhejiye|dikhao|dikhaiye|milega|milegi|mein|liye|wala|wali|wale|matlab|shukriya|namaste|namaskar|bhai|bhaiya|krupaya|kripya|samajh|samjha|samjhi)\b/i;

const TAMIL_CONVERSATION_TOKENS = new RegExp(TAMIL_ROMAN_HINTS.source, 'gi');
const TAMIL_CASE_SUFFIX_HINTS =
  /\b(?:[a-z]{3,}-(?:la|le|ku|kku|oda|laam|laa|ngala|thaan|dhaan)|(?:chennai|velachery|adyar|omr|ecr|tambaram|porur|guindy|flat|house|plot|villa|rent|budget|evening|morning|afternoon|area|side|road|floor|cash|loan|emi|month|week|day|time|call|visit|saturday|sunday|monday|tuesday|wednesday|thursday|friday|office|school|metro|bus)[-\s]+(?:la|kku|oda|laa))\b/gi;

const HINDI_CONVERSATION_TOKENS = new RegExp(HINDI_ROMAN_HINTS.source, 'gi');
const HINDI_CONTEXT_HINTS =
  /\b(?:(?:hindi|hinglish|ghar|flat|plot|house|villa|budget|rent|rate|price|chennai|velachery|omr|area|yahan|wahan|abhi|kal|aaj)\s+(?:mein|me|se|ke|ka|ki|ko|par|pe)|main\s+(?:dekh|le|khareed|bech|rent|kar|hoon|hun|chahta|chahti|baat|bol|bata)|kya\s+main|(?:haan|sir|madam|bhaiya|didi)\s+ji|ji\s+(?:haan|nahi|sir|madam|bataiye|boliye)|(?:theek|sahi)\s+hai|mere\s+(?:paas|liye|ko)|ke\s+paas|paisa|paise|rupaye|ghar|subah|shaam|dopahar|aur|lekin|toh|phir)\b/gi;

const ENGLISH_GRAMMAR_TOKENS = new Set([
  'i',
  'am',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'do',
  'does',
  'did',
  'can',
  'cannot',
  'could',
  'would',
  'should',
  'will',
  'have',
  'has',
  'had',
  'what',
  'where',
  'which',
  'when',
  'why',
  'how',
  'who',
  'whom',
  'whose',
  'the',
  'this',
  'that',
  'these',
  'those',
  'there',
  'here',
  'with',
  'without',
  'about',
  'from',
  'because',
  'currently',
  'actually',
  'basically',
  'my',
  'our',
  'your',
  'their',
  'me',
  'us',
  'them',
  'we',
  'you',
  'they',
  'looking',
  'searching',
  'want',
  'wanted',
  'need',
  'needed',
  'prefer',
  'interested',
  'planning',
  'tell',
  'explain',
  'share',
  'send',
  'know',
  'understand',
  'mean',
  'means',
  'trying',
  'sorry',
  'fine',
  'something',
  'anything',
  'everything',
  'nothing',
  'speak',
  'talking',
  'continue',
]);

function expandEnglishContractions(text: string): string {
  return text
    .toLowerCase()
    .replace(/\bi['’]m\b/g, 'i am')
    .replace(/\bi['’]ll\b/g, 'i will')
    .replace(/\bi['’]ve\b/g, 'i have')
    .replace(/\bi['’]d\b/g, 'i would')
    .replace(/\byou['’]re\b/g, 'you are')
    .replace(/\byou['’]ll\b/g, 'you will')
    .replace(/\bwe['’]re\b/g, 'we are')
    .replace(/\bwe['’]ll\b/g, 'we will')
    .replace(/\bthey['’]re\b/g, 'they are')
    .replace(/\bwhat['’]s\b/g, 'what is')
    .replace(/\bwhere['’]s\b/g, 'where is')
    .replace(/\bwho['’]s\b/g, 'who is')
    .replace(/\bthat['’]s\b/g, 'that is')
    .replace(/\bthere['’]s\b/g, 'there is')
    .replace(/\bit['’]s\b/g, 'it is')
    .replace(/\bdoesn['’]t\b/g, 'does not')
    .replace(/\bdon['’]t\b/g, 'do not')
    .replace(/\bdidn['’]t\b/g, 'did not')
    .replace(/\bcan['’]t\b/g, 'cannot')
    .replace(/\bcouldn['’]t\b/g, 'could not')
    .replace(/\bwouldn['’]t\b/g, 'would not')
    .replace(/\bshouldn['’]t\b/g, 'should not')
    .replace(/\bwon['’]t\b/g, 'will not')
    .replace(/\bhaven['’]t\b/g, 'have not')
    .replace(/\bhasn['’]t\b/g, 'has not');
}

function stripNegatedLanguageClauses(text: string, langTokenPattern: string): string {
  const expanded = expandEnglishContractions(text);
  const preNegated = new RegExp(
    `(?:^|[\\s,.;:!?])(?:not|no|do\\s+not|cannot|will\\s+not|never|avoid|stop|mat|nahi|nahin|vendam|venam|illa|illai|नहीं|मत|வேண்டாம்|வேணாம்|இல்ல|இல்லை)\\s+(?:to\\s+)?(?:speak\\s+|talk\\s+|use\\s+|in\\s+|with\\s+|speaking\\s+|talking\\s+|want\\s+|go\\s+with\\s+|start\\s+with\\s+)?(?:in\\s+)?(?:${langTokenPattern})(?=$|[\\s,.;:!?])`,
    'gi'
  );
  const postNegated = new RegExp(
    `(?:^|[\\s,.;:!?])(?:${langTokenPattern})(?:\\s+(?:me|mein|main|may|mai|la|il|in|with|to))?\\s*(?:nahi|nahin|mat|illa|illai|vendam|venam|avoid|stop|not|नहीं|मत|வேண்டாம்|வேணாம்|இல்ல|இல்லை)(?:\\s+(?:aati|aata|aatha|bolna|pesu))?(?=$|[\\s,.;:!?])`,
    'gi'
  );
  return expanded.replace(preNegated, ' ').replace(postNegated, ' ');
}

const EXPLICIT_COMMAND_VERBS =
  'speak|speaking|talk|talking|reply|respond|continue|switch|switching|change|shift|move|start|starting|go|want|prefer|use|try|explain|tell|telling|chat|converse|ask|say|said|bolo|boliye|bol|baat|batao|bataiye|bataye|karo|kijiye|pesu|pesunga|pese|pesalam|sollu|sollunga|बोलो|बोलिए|बोलें|बोलना|बात|बताओ|बताइए|स्पीक|टॉक|चाहिए|चाहता|चाहती|करना|करनी|स्विच|चेंज|பேசு|பேசுங்க|பேச|பேசணும்|பேசுவோம்|பேசலாம்|பேசலாமா|சொல்லு|சொல்லுங்க|டாக்|ஸ்பீக்|மாத்து|மாத்துங்க|வேண்டும்|வேணும்';

const EXPLICIT_POST_MODIFIERS =
  'only|please|pls|me\\b|mein\\b|main\\b|may\\b|mai\\b|la\\b|il\\b|se\\b|में|speak|talk|reply|start|want|prefer|use|bolo|boliye|bol|baat|batao|bataiye|bataye|karo|kijiye|karna|karni|chahiye|pesu|pesunga|sollu|sollunga|बोलो|बोलिए|बोलें|बोलना|बात|बताओ|बताइए|स्पीक|टॉक|करो|करनी|करना|चाहिए|चाहता|चाहती|பேசு|பேசுங்க|பேச|பேசணும்|பேசுவோம்|பேசலாம்|பேசலாமா|சொல்லு|சொல்லுங்க|டாக்|ஸ்பீக்|வேண்டும்|வேணும்|mode|medium';

function matchesExplicitLanguageRequest(
  normalized: string,
  tokens: string
): boolean {
  const safeText = stripNegatedLanguageClauses(normalized, tokens);
  const trimmedSafe = safeText.trim();
  if (!trimmedSafe) return false;

  const direct = new RegExp(
    `^(?:please\\s+)?(?:(?:in|with|to|into)\\s+)?(?:pure\\s+|full\\s+|complete\\s+|only\\s+)?(?:${tokens})(?:\\s+(?:only|please|pls|me|mein|main|may|mai|la|il|में))?$`,
    'i'
  );
  const command = new RegExp(
    `(?:${EXPLICIT_COMMAND_VERBS}).{0,35}(?:${tokens})|(?:${tokens}).{0,35}(?:${EXPLICIT_POST_MODIFIERS})|(?:^|\\s)(?:in|with|into|to|இன்)\\s+(?:only\\s+)?(?:${tokens})(?=\\s|$|[.,!?])`,
    'i'
  );
  return direct.test(trimmedSafe) || command.test(safeText);
}

export function detectExplicitLanguageSwitch(text: string): SpeechLanguage | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const normalized = trimmed.toLowerCase();

  const hindiTokens =
    '\\b(?:hindi|hindhi|hidni|indhi|indi(?!\\s+(?:flat|house|plot|area|price|budget|rate|bhk))|indie|hindee|hinde|heendi|hinglish)\\b|हिंदी|हिन्दी|ஹிந்தி|ஹிந்தில|இந்தில|ஹிந்தியில்|இந்தியில்|இந்தி(?!(?:\\s*(?:வீடு|பிளாட்|இடம்|ஏரியா|பட்ஜெட்|விலை|லட்சம்|கோடி|flat|house|plot|area|price|budget)))';
  if (matchesExplicitLanguageRequest(normalized, hindiTokens)) {
    return 'Hindi';
  }

  const englishTokens =
    '\\b(?:english|inglish)\\b|अंग्रेजी|अंग्रेज़ी|इंग्लिश|இங்கிலீஷ்|இங்கிலீஷ்ல|இங்லிஷ்|ஆங்கிலம்|ஆங்கிலத்தில்';
  if (matchesExplicitLanguageRequest(normalized, englishTokens)) {
    return 'English';
  }

  const tamilTokens = '\\btamil\\b(?!\\s*nadu)|\\btanglish\\b|तमिल|தமிழ்|தமிழ்ல|தமிழில்';
  if (matchesExplicitLanguageRequest(normalized, tamilTokens) || /தமிழில்/.test(stripNegatedLanguageClauses(normalized, tamilTokens))) {
    return 'Tamil-English';
  }

  return null;
}

export type LanguageDetectionReason =
  | 'explicit'
  | 'hindi-script'
  | 'tamil-script'
  | 'hindi-detected'
  | 'tamil-detected'
  | 'english-detected'
  | 'unchanged';

export interface ConversationLanguageDetection {
  language: SpeechLanguage;
  switched: boolean;
  reason: LanguageDetectionReason;
}

export function detectUserConversationLanguage(
  text: string,
  currentLanguage: SpeechLanguage | null = 'Tamil-English'
): ConversationLanguageDetection {
  const fallbackLanguage: SpeechLanguage = currentLanguage ?? 'Tamil-English';
  const trimmed = text.trim();
  if (!trimmed) {
    return { language: fallbackLanguage, switched: false, reason: 'unchanged' };
  }

  const explicit = detectExplicitLanguageSwitch(trimmed);
  if (explicit) {
    return {
      language: explicit,
      switched: explicit !== currentLanguage,
      reason: 'explicit',
    };
  }

  // Native Unicode script unambiguously identifies Hindi or Tamil.
  const hasDevanagari = /[\u0900-\u097F]/u.test(trimmed);
  const hasTamilScript = /[\u0B80-\u0BFF]/u.test(trimmed);
  if (hasDevanagari && !hasTamilScript) {
    return {
      language: 'Hindi',
      switched: currentLanguage !== 'Hindi',
      reason: 'hindi-script',
    };
  }
  if (hasTamilScript && !hasDevanagari) {
    return {
      language: 'Tamil-English',
      switched: currentLanguage !== 'Tamil-English',
      reason: 'tamil-script',
    };
  }

  const hindiMatches =
    (trimmed.match(HINDI_CONVERSATION_TOKENS)?.length ?? 0) +
    (trimmed.match(HINDI_CONTEXT_HINTS)?.length ?? 0);
  const tamilMatches =
    (trimmed.match(TAMIL_CONVERSATION_TOKENS)?.length ?? 0) +
    (trimmed.match(TAMIL_CASE_SUFFIX_HINTS)?.length ?? 0);

  // Code-mixed speech (Hinglish or Tanglish) stays in Hindi / Tamil-English rather than English.
  if (hindiMatches > 0 && hindiMatches >= tamilMatches) {
    return {
      language: 'Hindi',
      switched: currentLanguage !== 'Hindi',
      reason: 'hindi-detected',
    };
  }
  if (tamilMatches > 0) {
    return {
      language: 'Tamil-English',
      switched: currentLanguage !== 'Tamil-English',
      reason: 'tamil-detected',
    };
  }

  // Switch to pure English ONLY when complete English syntax/grammar is present
  // and zero Hindi/Tamil tokens exist (short neutral answers like "Velachery", "2 BHK",
  // "50 lakhs", "Yes", "Bank loan", "Tomorrow morning" keep the active language).
  const expanded = expandEnglishContractions(trimmed);
  const words = expanded.match(/[a-z]+/g) ?? [];
  let englishGrammarHits = 0;
  for (const word of words) {
    if (ENGLISH_GRAMMAR_TOKENS.has(word)) {
      englishGrammarHits += 1;
    }
  }

  if (englishGrammarHits >= 2 && words.length >= 3) {
    return {
      language: 'English',
      switched: currentLanguage !== 'English',
      reason: 'english-detected',
    };
  }

  return {
    language: fallbackLanguage,
    switched: false,
    reason: 'unchanged',
  };
}

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

  // 5. Excitement, Radiant Happiness & Cheerful Delivery:
  if (emotion === 'positive' || deliveryCue === 'excited' || deliveryCue === 'happy' || deliveryCue === 'cheerful' || deliveryCue === 'joyful') {
    return {
      pace: 1.12,
      loudness: 1.10,
      sarvamTemperature: 0.88,
      stability: 0.35,
      style: 0.42,
      similarityBoost: 0.85,
      geminiStyle: 'joyful, smiling, bubbly, attractive, and highly engaging voice with infectious happy energy',
    };
  }

  // 6. Thinking & Processing / Explaining Complex Details: articulate, measured, clear
  if (emotion === 'curious' || deliveryCue === 'explaining' || deliveryCue === 'serious') {
    return {
      pace: 1.05,
      loudness: 1.04,
      sarvamTemperature,
      stability: 0.55,
      style: 0.22,
      similarityBoost: 0.82,
      geminiStyle: 'confident, pleasant, clear, and engaging explanatory tone',
    };
  }

  // 7. Radiant Happiness, Attractive Charisma & Engaging Delivery (Default)
  return {
    pace: 1.10,
    loudness: 1.08,
    sarvamTemperature: 0.85,
    stability: 0.40,
    style: 0.35,
    similarityBoost: 0.85,
    geminiStyle: 'joyful, cheerful, attractive, enthusiastic, smiling voice with lively engaging cadence and radiant warmth',
  };
}

export function prepareSpeech(
  text: string,
  context: { language?: string; emotion?: SpeechEmotion } = {}
): PreparedSpeech {
  const language = resolveSpeechLanguage(text, context.language);
  const requestedEmotion = context.emotion || 'neutral';
  const deliveryCue = text.match(
    /\[([a-z\s,-]+)\]/i
  )?.[1]?.toLowerCase();

  let emotion: SpeechEmotion = requestedEmotion;
  if (emotion === 'neutral') {
    if (deliveryCue && /laughing|chuckle/i.test(deliveryCue)) {
      emotion = 'amused';
    } else if (deliveryCue && /excited|happy|cheerful|joyful|bubbly|enthusiastic/i.test(deliveryCue)) {
      emotion = 'positive';
    } else if (deliveryCue && /empathetic|apologetic/i.test(deliveryCue)) {
      emotion = 'empathetic';
    } else if (deliveryCue && /curious|explaining/i.test(deliveryCue)) {
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

export function normalizeConversationLanguage(language?: string): SpeechLanguage {
  const normalized = (language || '').toLowerCase();
  if (normalized.includes('hindi') || normalized.includes('hinglish') || normalized.startsWith('hi')) {
    return 'Hindi';
  }
  if (normalized.includes('english') && !normalized.includes('tamil')) {
    return 'English';
  }
  if (normalized.startsWith('en-')) {
    return 'English';
  }
  return 'Tamil-English';
}

export function resolveTtsEngineForLanguage(
  configuredEngine: string,
  language?: string,
  availability: { geminiAvailable?: boolean; openaiAvailable?: boolean } = {}
): string {
  const normalizedEngine = (configuredEngine || 'gemini').toLowerCase();
  const targetLang = normalizeConversationLanguage(language);

  // Groq Orpheus and Deepgram Aura are English-only models in our API routes.
  // Route Hindi / Tamil-English automatically to a multilingual voice so speech actually matches the language.
  if (targetLang !== 'English' && (normalizedEngine === 'groq' || normalizedEngine === 'deepgram')) {
    if (availability.geminiAvailable) return 'gemini';
    if (availability.openaiAvailable) return 'openai';
    return 'browser';
  }

  return normalizedEngine;
}

export function getKnowledgeLanguageDirective(language?: string): string {
  const target = normalizeConversationLanguage(language);
  if (target === 'Hindi') {
    return '\n\nCRITICAL TRANSLATION RULE: The property knowledge above may be written in English or Tanglish. You MUST convert ALL pricing, location, and feature facts completely into natural conversational Hindi (Devanagari script only, zero Tamil or Tanglish words).';
  }
  if (target === 'English') {
    return '\n\nCRITICAL LANGUAGE RULE: Some property notes above may contain Tanglish, Tamil, or Hindi phrasing. You MUST express ALL pricing, location, and feature facts 100% in complete, pure, natural English ONLY. NEVER copy or repeat any Tamil, Tanglish, or Hindi words.';
  }
  return '\n\nCRITICAL TRANSLATION RULE: Express all property facts clearly in natural spoken Tamil script (தமிழ்) using everyday English property terms where natural (2 BHK, 3 BHK, sq ft, Velachery, OMR, site visit), and ZERO Hindi words.';
}

export function getLanguageScopedStyleSection(language?: string): string {
  const target = normalizeConversationLanguage(language);

  if (target === 'English') {
    return `
### PURE ENGLISH VOICE-FIRST CONVERSATIONAL STYLE (MANDATORY):
You are speaking on a real phone call in 100% PURE, COMPLETE ENGLISH. Even if earlier turns in conversation history used another language, respond completely in fluent English now:
1. Natural acknowledgements (use sparingly): "Got it", "Sure", "I understand", "Of course", "Let me check that for you".
2. Phone-call pacing: Keep replies to 2-3 short, natural sentences. Acknowledge the customer's answer briefly, give the requested detail clearly, and end with one clear question.
3. Spoken numbers: Write prices naturally for voice ("55 lakhs", "around 1.2 crores", "20 percent").
4. Example reply: "Got it, thank you for sharing that. We have 2 BHK apartments in Velachery starting from 65 lakhs with covered parking. Would you like me to schedule a site visit this weekend?"
5. STRICT PURE-ENGLISH ISOLATION: Every single word must be complete, natural, fluent English. Never mix in any regional fillers, greetings, or honorifics from any other language.
6. Return ONLY the clean spoken dialogue to say next — no stage directions, no markdown bullets, and no brackets.`;
  }

  if (target === 'Hindi') {
    return `
### HINDI VOICE-FIRST CONVERSATIONAL STYLE (MANDATORY):
आप फ़ोन कॉल पर स्वाभाविक, आत्मीय और स्पष्ट हिंदी (देवनागरी लिपि) में बात कर रहे हैं:
1. छोटे और स्वाभाविक उत्तर दें: "जी बिल्कुल", "ठीक है", "जी हाँ", "समझ गया", "एक सेकंड सर, मैं चेक करके बताता हूँ।"
2. एक बार में 2 से 3 छोटे वाक्य बोलें, ग्राहक की बात दोहराए बिना आगे एक स्पष्ट सवाल पूछें।
3. वास्तविक प्रॉपर्टी शब्द ज़रूरत के अनुसार इस्तेमाल कर सकते हैं: 2 BHK, 3 BHK, RERA, EMI, WhatsApp, site visit, sq.ft.
4. उदाहरण: "जी बिल्कुल सर! हमारे पास वेलाचेरी में 2 BHK फ्लैट 65 लाख से उपलब्ध हैं। क्या आप इस शनिवार को साइट विज़िट देखना चाहेंगे?"
5. सख्त भाषा नियम: पूरी बातचीत केवल हिंदी में रखें और किसी भी अन्य क्षेत्रीय भाषा के शब्द न जोड़ें।
6. केवल बोलने योग्य साफ संवाद लिखें — बिना किसी ब्रैकेट या बुलेट पॉइंट के।`;
  }

  return `
### TAMIL VOICE-FIRST CONVERSATIONAL STYLE (MANDATORY):
நீங்கள் நேரடி தொலைபேசி அழைப்பில் இயல்பான, இனிமையான தமிழில் (தமிழ் எழுத்தில்) பேசுகிறீர்கள்:
1. இயல்பான பதில்கள்: "ஆம் சார்", "சரி சார்", "புரியுது சார்", "கண்டிப்பா சார்", "ஒரு நிமிஷம் சார், செக் பண்ணி சொல்றேன்."
2. சுருக்கமாகவும் தெளிவாகவும் பேசுங்கள்: 2 முதல் 3 குறுகிய வாக்கியங்களில் பதில் சொல்லி, கடைசியில் ஒரு முழுமையான கேள்வி கேளுங்கள்.
3. சொத்து சொற்கள் (2 BHK, 3 BHK, sq ft, Lakhs, Crores, Velachery, OMR, Tambaram, site visit, WhatsApp) தெளிவாகப் பயன்படுத்தலாம்.
4. உதாரணம்: "சூப்பர் சார்! வேளச்சேரியில் 2 BHK பிளாட் 72 Lakhs-க்கு ready-to-move-ஆ இருக்கு. இந்த சனிக்கிழமை site visit பார்க்கலாமா?"
5. STRICT LANGUAGE ISOLATION: Write and ask ONLY in natural spoken Tamil script (தமிழ்) with everyday property nouns — NEVER switch to Hindi or mix Hindi words!
6. Output ONLY what you speak aloud — plain natural text, zero brackets, zero bullet points.`;
}

const NEUTRAL_STT_WORDS = new Set([
  'yes',
  'yeah',
  'yep',
  'no',
  'nope',
  'ok',
  'okay',
  'thank',
  'you',
  'thanks',
  'hello',
  'hi',
  'hey',
  'sir',
  'madam',
  'maam',
  'mam',
  'please',
  'pls',
  'sure',
  'fine',
  'alright',
  'good',
  'morning',
  'afternoon',
  'evening',
  'bye',
  'goodbye',
]);

const NEUTRAL_PROPERTY_PHRASES = new Set([
  'ready to move',
  'under construction',
  'for self use',
  'self use',
  'for investment',
  'for rent',
  'to buy',
  'looking to buy',
  'want to buy',
  'want to rent',
]);

/**
 * Maps a raw STT engine language label or ISO code (e.g. "hindi", "hi", "ta-IN")
 * to the conversation's active SpeechLanguage, or null if unsupported/unknown.
 */
export function mapSttDetectedLanguageToConversationLanguage(
  sttLanguage?: string | null
): SpeechLanguage | null {
  const normalized = (sttLanguage || '').trim().toLowerCase();
  if (!normalized || normalized === 'auto') return null;

  if (normalized === 'hindi' || normalized === 'hi' || normalized.startsWith('hi-')) {
    return 'Hindi';
  }
  if (normalized === 'tamil' || normalized === 'ta' || normalized.startsWith('ta-')) {
    return 'Tamil-English';
  }
  if (normalized === 'english' || normalized === 'en' || normalized.startsWith('en-')) {
    return 'English';
  }
  return null;
}

/**
 * Resolves the active conversation language for a transcribed customer turn by
 * combining text/script/explicit-switch detection with cloud STT acoustic tags
 * (for example Whisper `verbose_json` detected `language`).
 */
export function resolveSttConversationLanguage(params: {
  transcript: string;
  sttDetectedLanguage?: string | null;
  currentLanguage: SpeechLanguage;
}): ConversationLanguageDetection {
  const { transcript, sttDetectedLanguage, currentLanguage } = params;
  const trimmed = (transcript || '').trim();
  const textResult = detectUserConversationLanguage(trimmed, currentLanguage);

  if (textResult.reason !== 'unchanged') {
    return textResult;
  }

  if (!trimmed) {
    return {
      language: currentLanguage,
      switched: false,
      reason: 'unchanged',
    };
  }

  const sttMapped = mapSttDetectedLanguageToConversationLanguage(sttDetectedLanguage);
  if (sttMapped === 'Hindi') {
    return {
      language: 'Hindi',
      switched: currentLanguage !== 'Hindi',
      reason: 'hindi-detected',
    };
  }

  if (sttMapped === 'Tamil-English') {
    return {
      language: 'Tamil-English',
      switched: currentLanguage !== 'Tamil-English',
      reason: 'tamil-detected',
    };
  }

  if (sttMapped === 'English') {
    const expanded = expandEnglishContractions(trimmed).toLowerCase();
    const normalizedPhrase = expanded.replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
    const words = normalizedPhrase.split(' ').filter(Boolean);
    const hasOnlyNeutralWords =
      words.length > 0 && words.every((word) => NEUTRAL_STT_WORDS.has(word));

    if (!hasOnlyNeutralWords && !NEUTRAL_PROPERTY_PHRASES.has(normalizedPhrase)) {
      let englishGrammarHits = 0;
      for (const word of words) {
        if (ENGLISH_GRAMMAR_TOKENS.has(word)) {
          englishGrammarHits += 1;
        }
      }

      // Require a genuine multi-word English sentence (>= 2 grammar words, >= 3 words)
      // so short 1-2 word fragments don't accidentally flip out of Tamil/Hindi.
      if (words.length >= 3 && englishGrammarHits >= 2) {
        return {
          language: 'English',
          switched: currentLanguage !== 'English',
          reason: 'english-detected',
        };
      }
    }
  }

  return {
    language: currentLanguage,
    switched: false,
    reason: 'unchanged',
  };
}

/**
 * Resolves the effective conversation language for server-side chat routes so an
 * explicit user language request (for example "talk in hindi") or a Hindi/Tamil/full-English turn
 * immediately promotes the active language even if client state held the old one.
 */
export function resolveServerConversationLanguage(
  requestedLanguage: string | null | undefined,
  messages: Array<{ role?: string; speaker?: string; content?: unknown; text?: string }> = []
): string {
  const normalizedRequested = (requestedLanguage || '').trim();
  const lastUserMessage = [...messages]
    .reverse()
    .find((m) => m.role === 'user' || m.speaker === 'Customer');
  const lastUserText =
    typeof lastUserMessage?.content === 'string'
      ? lastUserMessage.content
      : typeof lastUserMessage?.text === 'string'
        ? lastUserMessage.text
        : '';

  if (lastUserText) {
    const current = normalizeConversationLanguage(normalizedRequested);
    const detected = detectUserConversationLanguage(lastUserText, current);
    if (detected.reason !== 'unchanged') {
      return detected.language;
    }
  }

  return normalizedRequested;
}

/**
 * Returns an explicit override instruction when the latest customer turn caused
 * a mid-call language switch so prior turns in the previous language do not
 * pull the LLM back into Tanglish or trigger a language-refusal reply.
 */
export function getLanguageSwitchOverridePrompt(
  requestedLanguage: string | null | undefined,
  effectiveLanguage: string | null | undefined
): string {
  const effective = (effectiveLanguage || '').trim();
  const requested = (requestedLanguage || '').trim();
  if (!effective || effective === requested) {
    return '';
  }

  return `\n\nLANGUAGE SWITCH OVERRIDE (HIGHEST PRIORITY): The customer just requested to speak in ${effective}. Ignore the previous ${requested || 'earlier'} turns, NEVER apologize or say you only speak Tanglish, and reply immediately 100% in ${effective}.`;
}

/**
 * Computes the `language_code` sent to cloud STT routes. Before an explicit
 * customer language switch, Whisper/Deepgram/Gemini use `'auto'` so callers
 * starting in Tamil can switch spontaneously to Hindi or English; once explicitly
 * switched to Hindi or English, lock the cloud STT hint so transcripts write
 * accurately in Devanagari Hindi or clean English.
 */
export function resolveCloudSttLanguageParam(
  sttEngine: string,
  activeLanguage: SpeechLanguage | string,
  isExplicitlyLocked: boolean
): string {
  const normalized = normalizeConversationLanguage(activeLanguage);
  const voiceCode =
    normalized === 'Hindi' ? 'hi-IN' : normalized === 'English' ? 'en-IN' : 'ta-IN';

  if (sttEngine === 'sarvam') {
    return voiceCode;
  }

  if (isExplicitlyLocked) {
    if (normalized === 'Hindi') return 'hi-IN';
    if (normalized === 'English') return 'en-IN';
  }

  return 'auto';
}
