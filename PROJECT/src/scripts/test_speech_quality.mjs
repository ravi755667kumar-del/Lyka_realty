const WORD = 'A-Za-z\u0900-\u097F\u0B80-\u0BFF';

const SPOKEN_FORM_RULES = [
  // 1. Strip internal listing codes like P101: or P102:
  [/^[ \t]*[Pp]\s*(\d{3})\b\s*[:\-–]?\s*/gm, ''],
  [/\b[Pp]\s*(\d{3})\b\s*[:\-–]\s*/g, ''],

  // 2. Acronyms & Real Estate Terms
  [/\b(\d+)\s*bhk\b/gi, '$1 B-H-K'],
  [/\bbhk\b/gi, 'B-H-K'],
  [/\b(\d[\d,]*)\s*(?:sq\.?\s*ft\.?|sqft|sq\s*feet)\b/gi, '$1 square feet'],
  [/\bsq\.?\s*ft\.?\b/gi, 'square feet'],

  // Regulatory & Infrastructure
  [/\bcmda\s+approved\b/gi, 'C-M-D-A approved'],
  [/\bcmda\b/gi, 'C-M-D-A'],
  [/\bdtcp\s+approved\b/gi, 'D-T-C-P approved'],
  [/\bdtcp\b/gi, 'D-T-C-P'],
  [/\brera\b/gi, 'RERA'],
  [/\bmrts?\s+station\b/gi, 'M-R-T station'],
  [/\bmrts?\b/gi, 'M-R-T'],
  [/\bdlf\s+it\s+park\b/gi, 'D-L-F I-T Park'],
  [/\bdlf\b/gi, 'D-L-F'],
  [/\bit\s+park\b/gi, 'I-T Park'],
  [/\bgst\s+highway\b/gi, 'G-S-T highway'],

  // Banks & Finance
  [/\bsbi\b/gi, 'S-B-I'],
  [/\bhdfc\b/gi, 'H-D-F-C'],
  [/\bicici\b/gi, 'I-C-I-C-I'],
  [/\bcibil\b/gi, 'CIBIL'],

  // Dates & Working Hours
  [/\bdec\b\.?\s*(\d{4})/gi, 'December $1'],
  [/\bjan\b\.?\s*(\d{4})/gi, 'January $1'],
  [/\bmon\s*-\s*sat\b/gi, 'Monday to Saturday'],
  [/\bmon\s*-\s*fri\b/gi, 'Monday to Friday'],

  // Shorthand Latin & Units
  [new RegExp('\\be\\.?g\\.?(?=\\s|$|[,.;:)])', 'gi'), 'for example,'],
  [new RegExp('\\bi\\.?e\\.?(?=\\s|$|[,.;:)])', 'gi'), 'that is,'],
  [/(\d[\d,]*)\s*%/g, '$1 percent'],
  [/(\d[\d,]*)\s*\/\s*(?:per\s+)?months?\b/gi, '$1 per month'],
  [/(\d[\d,]*)\s*\/\s*mo\b/gi, '$1 per month'],
  [/(\d[\d,]*)\s*\/\s*-/g, '$1 rupees'],

  // Currency
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

  // Soften parentheses to natural conversational clause pauses
  [/\(([^)]+)\)/g, ', $1, '],

  // Polite human pauses
  [/\b(hello|hi|hey|vanakkam|namaste)\s+(sir|ma'?am|madam)\b(?!\s*[,.?!])/gi, '$1 $2, '],
  [/\b(certainly|sure|no problem|thank you|welcome)\s+(sir|ma'?am|madam)\b(?!\s*[,.?!])/gi, '$1 $2, '],

  // Ampersand
  [/\s*&\s*/g, ' and ']
];

function refineEnhanced(text) {
  let out = (text || '').trim();
  if (!out) return out;

  for (const [p, r] of SPOKEN_FORM_RULES) {
    out = out.replace(p, r);
  }
  out = out.replace(/\brupees\s+rupees\b/gi, 'rupees');
  out = out.replace(/\u2026|\.{3,}/g, ',');
  out = out.replace(/\.{2,}/g, '.');
  out = out.replace(/!{2,}/g, '!').replace(/\?{2,}/g, '?');
  out = out.replace(/\s*\n+\s*/g, ' ');
  out = out.replace(/\s+([,.!?;:])/g, '$1');
  out = out.replace(/([,.!?;:])(?=[A-Za-z\u0900-\u097F\u0B80-\u0BFF])/g, '$1 ');
  out = out.replace(/ {2,}/g, ' ').trim();
  if (out && /[A-Za-z0-9)]$/.test(out)) out += '.';
  return out;
}

const testCases = [
  'P101: 2BHK Apartment in Velachery, 950 sq ft, Rs. 72 Lakhs, ready to move, 2 car parking, lift, near MRT station.',
  'P102: 3BHK in OMR Sholinganallur, 1450 sq ft, Rs. 1.25 Crore, gym, swimming pool, CMDA approved, Dec 2026 possession.',
  'P104: DTCP Plot in Chengalpattu, 1200 sq ft, Rs. 18 Lakhs, clear patta, near GST highway, gated community.',
  'P105: 1BHK Rental in Porur, 550 sq ft, Rs. 14,000 / month, deposit 3 months, near DLF IT Park.',
  'We assist with bank loans through our partner banks (SBI, HDFC, and ICICI). Approval depends on your CIBIL score.',
  'Hello Sir! This is Priya from Lyka Realty. Do you have two minutes to speak?',
  'வணக்கம் சார்! நான் லைகா ரியாலிட்டில இருந்து பிரியா பேசுறேன். 2 நிமிஷம் பேசலாமா சார்?',
  'जी नमस्ते सर! क्या आप 2 B-H-K घर खरीदना चाहते हैं या 1 B-H-K रेंट पे?'
];

testCases.forEach((t, i) => {
  console.log(`Test #${i+1}:`);
  console.log('  Original:', t);
  console.log('  Enhanced:', refineEnhanced(t));
});
