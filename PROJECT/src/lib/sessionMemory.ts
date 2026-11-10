import { SessionMemory } from '@/types';

// Common Chennai localities & keywords for location extraction
const CHENNAI_LOCALITIES = [
  'velachery',
  'omr',
  'sholinganallur',
  'tambaram',
  'porur',
  'adyar',
  'chengalpattu',
  'ecr',
  'akkarai',
  'medavakkam',
  'guindy',
  'perungudi',
  'thoraipakkam',
  'navalur',
  'siruseri',
  'anna nagar',
  't nagar',
  't. nagar',
  'besant nagar',
  'alwarpet',
  'pallavaram',
  'chromepet',
  'kelambakkam',
  'gst road',
  'mahindra world city',
  'mwc',
  'dlf',
];

/**
 * Extracts and updates session memory brain from customer dialogue turns.
 * Operates in O(N) over session messages, preserving previously confirmed facts.
 */
export function extractSessionMemory(
  messages: Array<{ role?: string; speaker?: string; content?: string; text?: string }>,
  existingMemory?: Partial<SessionMemory>
): SessionMemory {
  const memory: SessionMemory = {
    leadName: existingMemory?.leadName || '',
    preferredLanguage: existingMemory?.preferredLanguage || '',
    firstUserMessage: existingMemory?.firstUserMessage || '',
    purpose: existingMemory?.purpose || '',
    propertyType: existingMemory?.propertyType || '',
    bhk: existingMemory?.bhk || '',
    budget: existingMemory?.budget || '',
    location: existingMemory?.location || '',
    nearbyLandmarks: existingMemory?.nearbyLandmarks || '',
    timeline: existingMemory?.timeline || '',
    loanOrCash: existingMemory?.loanOrCash || '',
    mustHaves: existingMemory?.mustHaves || '',
    siteVisitPreference: existingMemory?.siteVisitPreference || '',
    callerSentiment: existingMemory?.callerSentiment || 'Interested',
    discussedProperties: existingMemory?.discussedProperties ? [...existingMemory.discussedProperties] : [],
    confirmedFacts: existingMemory?.confirmedFacts ? [...existingMemory.confirmedFacts] : [],
    lastUpdated: new Date().toISOString(),
  };

  // Only scan user/customer utterances for stated preferences to prevent echoing AI hallucinations
  const userUtterances = messages
    .filter((m) => m.role === 'user' || m.speaker === 'Customer')
    .map((m) => (typeof m.content === 'string' ? m.content : m.text || '').trim())
    .filter(Boolean);

  if (userUtterances.length > 0 && !memory.firstUserMessage) {
    memory.firstUserMessage = userUtterances[0];
  }

  for (const rawText of userUtterances) {
    const text = rawText.toLowerCase();

    // 1. BHK / Configuration extraction
    const bhkMatch = text.match(/\b([1-5])\s*(bhk|bed|bedroom|bedrooms)\b/i) || text.match(/\b(studio)\b/i);
    if (bhkMatch) {
      const bhkVal = bhkMatch[1] ? `${bhkMatch[1]} BHK` : 'Studio';
      if (!memory.bhk || memory.bhk !== bhkVal) {
        memory.bhk = bhkVal;
      }
    }

    // 2. Location & Nearby Landmark extraction
    for (const loc of CHENNAI_LOCALITIES) {
      if (text.includes(loc)) {
        const capitalizedLoc = loc
          .split(' ')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ');
        if (!memory.location.toLowerCase().includes(loc)) {
          memory.location = memory.location ? `${memory.location}, ${capitalizedLoc}` : capitalizedLoc;
        }
      }
    }

    // Nearby landmarks
    if (text.includes('metro') || text.includes('mrts')) {
      if (!memory.nearbyLandmarks?.toLowerCase().includes('metro')) {
        memory.nearbyLandmarks = memory.nearbyLandmarks ? `${memory.nearbyLandmarks}, Near Metro / MRTS` : 'Near Metro / MRTS';
      }
    }
    if (text.includes('beach') || text.includes('sea view') || text.includes('sea')) {
      if (!memory.nearbyLandmarks?.toLowerCase().includes('beach')) {
        memory.nearbyLandmarks = memory.nearbyLandmarks ? `${memory.nearbyLandmarks}, Near Beach` : 'Near Beach';
      }
    }
    if (text.includes('school') || text.includes('college')) {
      if (!memory.nearbyLandmarks?.toLowerCase().includes('school')) {
        memory.nearbyLandmarks = memory.nearbyLandmarks ? `${memory.nearbyLandmarks}, Near School/College` : 'Near School/College';
      }
    }
    if (text.includes('it park') || text.includes('sez') || text.includes('elcot') || text.includes('office')) {
      if (!memory.nearbyLandmarks?.toLowerCase().includes('it park')) {
        memory.nearbyLandmarks = memory.nearbyLandmarks ? `${memory.nearbyLandmarks}, Near IT Park / SEZ` : 'Near IT Park / SEZ';
      }
    }

    // 3. Purpose (Buy / Rent / Investment / Own Use)
    if (text.includes('rent') || text.includes('vaadagai') || text.includes('vadagai') || text.includes('lease')) {
      memory.purpose = 'Rental';
    } else if (text.includes('invest') || text.includes('rental yield') || text.includes('appreciation')) {
      memory.purpose = 'Investment';
    } else if (text.includes('own use') || text.includes('stay') || text.includes('family') || text.includes('vaanga') || text.includes('buy') || text.includes('purchase')) {
      if (memory.purpose !== 'Rental') {
        memory.purpose = 'Buy for Own Use';
      }
    }

    // 4. Property Type
    if (text.includes('villa') || text.includes('individual house') || text.includes('independent house')) {
      memory.propertyType = text.includes('villa') ? 'Villa' : 'Individual House';
    } else if (text.includes('plot') || text.includes('land') || text.includes('dtcp')) {
      memory.propertyType = 'Plot';
    } else if (text.includes('flat') || text.includes('apartment') || text.includes('gated community')) {
      memory.propertyType = 'Apartment';
    }

    // 5. Budget extraction
    // Regex for: 70 lakhs, 1.25 cr, 80l, 25k, etc.
    const budgetMatch =
      text.match(/\b(\d+(?:\.\d+)?)\s*(crore|crores|cr|lakh|lakhs|lacs|lac|l)\b/i) ||
      text.match(/\b(?:under|within|around|budget)\s*(?:of\s*)?(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d+)?)\s*(crore|cr|lakh|l)?\b/i) ||
      text.match(/\b(\d+)\s*k\s*(?:per\s*month|pm|rent)?\b/i);

    if (budgetMatch) {
      let bStr = '';
      if (budgetMatch[2]) {
        const unit = budgetMatch[2].toLowerCase().startsWith('c') ? 'Crore' : 'Lakhs';
        bStr = `Rs. ${budgetMatch[1]} ${unit}`;
      } else if (text.includes('rent') && budgetMatch[1]) {
        bStr = `Rs. ${budgetMatch[1]},000 / month`;
      } else {
        bStr = budgetMatch[0];
      }
      memory.budget = bStr;
    }

    // 6. Timeline / Possession
    if (text.includes('ready') || text.includes('immediate') || text.includes('udane') || text.includes('right now')) {
      memory.timeline = 'Ready to Move / Immediate';
    } else if (text.includes('2026') || text.includes('next year') || text.includes('few months')) {
      memory.timeline = 'Within 6-12 months / Dec 2026';
    }

    // 7. Financing / Payment Mode
    if (text.includes('loan') || text.includes('bank') || text.includes('sbi') || text.includes('hdfc') || text.includes('emi') || text.includes('mortgage')) {
      memory.loanOrCash = 'Bank Home Loan';
    } else if (text.includes('cash') || text.includes('own fund') || text.includes('self fund') || text.includes('direct payment')) {
      memory.loanOrCash = 'Self Funds / Cash';
    }

    // 8. Must-Haves
    const features: string[] = [];
    if (text.includes('parking') || text.includes('car park')) features.push('Car Parking');
    if (text.includes('lift') || text.includes('elevator')) features.push('Lift');
    if (text.includes('gym') || text.includes('clubhouse')) features.push('Gym/Clubhouse');
    if (text.includes('pool') || text.includes('swimming')) features.push('Swimming Pool');
    if (text.includes('cmda') || text.includes('rera') || text.includes('approval') || text.includes('approved')) features.push('CMDA/RERA Approved');
    if (text.includes('balcony')) features.push('Balcony');
    if (features.length > 0) {
      memory.mustHaves = features.join(', ');
    }

    // 9. Site Visit Preference
    if (
      text.includes('saturday') ||
      text.includes('sunday') ||
      text.includes('weekend') ||
      text.includes('nerla') ||
      text.includes('neril') ||
      text.includes('visit') ||
      text.includes('paakkanum') ||
      text.includes('morning') ||
      text.includes('evening')
    ) {
      if (text.includes('saturday')) memory.siteVisitPreference = 'Saturday';
      else if (text.includes('sunday')) memory.siteVisitPreference = 'Sunday';
      else if (text.includes('weekend')) memory.siteVisitPreference = 'This Weekend';
      else if (text.includes('visit') || text.includes('nerla') || text.includes('paakkanum')) {
        memory.siteVisitPreference = 'Site Visit Requested';
      }
    }
  }

  // 10. Synthesize confirmed facts bullet list
  const facts: string[] = [];
  if (memory.firstUserMessage) facts.push(`First customer message: "${memory.firstUserMessage}"`);
  if (memory.purpose) facts.push(`Purpose: ${memory.purpose}`);
  if (memory.propertyType) facts.push(`Type: ${memory.propertyType}`);
  if (memory.bhk) facts.push(`Configuration: ${memory.bhk}`);
  if (memory.location) facts.push(`Preferred Area: ${memory.location}`);
  if (memory.nearbyLandmarks) facts.push(`Nearby Landmarks: ${memory.nearbyLandmarks}`);
  if (memory.budget) facts.push(`Budget: ${memory.budget}`);
  if (memory.timeline) facts.push(`Move-in Timeline: ${memory.timeline}`);
  if (memory.loanOrCash) facts.push(`Financing: ${memory.loanOrCash}`);
  if (memory.mustHaves) facts.push(`Must-Haves: ${memory.mustHaves}`);
  if (memory.siteVisitPreference) facts.push(`Site Visit: ${memory.siteVisitPreference}`);

  memory.confirmedFacts = facts;
  return memory;
}

/**
 * Builds the high-priority Session Memory Brain instruction block for LLMs
 */
export function formatMemoryBrainPrompt(memory: SessionMemory): string {
  const factsList = memory.confirmedFacts && memory.confirmedFacts.length > 0
    ? memory.confirmedFacts.map((f) => `• ${f}`).join('\n')
    : '• Conversation in progress — listening attentively to customer requirements.';

  const knownParts: string[] = [];
  if (memory.location) knownParts.push(`Location is ALREADY KNOWN: "${memory.location}"`);
  if (memory.bhk) knownParts.push(`BHK is ALREADY KNOWN: "${memory.bhk}"`);
  if (memory.budget) knownParts.push(`Budget is ALREADY KNOWN: "${memory.budget}"`);
  if (memory.purpose) knownParts.push(`Purpose is ALREADY KNOWN: "${memory.purpose}"`);
  if (memory.loanOrCash) knownParts.push(`Payment mode is ALREADY KNOWN: "${memory.loanOrCash}"`);
  if (memory.timeline) knownParts.push(`Timeline is ALREADY KNOWN: "${memory.timeline}"`);

  const antiRepetitionRule = knownParts.length > 0
    ? `NEVER RE-ASK THESE FACTS ALREADY ANSWERED BY CUSTOMER:\n${knownParts.map((k) => `❌ DO NOT ASK: ${k}`).join('\n')}`
    : 'Listen carefully to customer answers and remember them for subsequent turns.';

  return `
======================================================================
🧠 ACTIVE SESSION MEMORY BRAIN (Facts remembered from THIS call session):
${factsList}
======================================================================
STRICT SESSION MEMORY RULES:
1. ALWAYS REMEMBER FIRST & ALL MESSAGES: You hold full memory of the caller's very first message ("${memory.firstUserMessage || 'Initial enquiry'}") and every preference shared during this session.
2. ${antiRepetitionRule}
3. CONTEXTUAL FOLLOW-UPS: If the caller asks short questions like "What is the price?", "Is loan available?", or "Does it have parking?", answer directly regarding the property/area currently held in memory (${memory.location || 'Chennai verified listings'}).
4. ONE NEXT STEP: Now that you know their requirements, suggest the best verified property match and offer a site visit or WhatsApp brochure.
5. CONVERSATION REMINDER ON FINAL / CLOSING MESSAGE (MANDATORY):
   When the conversation reaches its final stage, site visit confirmation, or closing message, you MUST recap what was discussed during the session:
   - Remind them of their initial request (${memory.bhk || 'property'} in ${memory.location || 'Chennai'}), budget (${memory.budget || 'discussed'}), and their site visit/brochure plan.
   - Example (Tanglish): "[happy] Super! Namma inaikki pesina maadhiri ${memory.location || 'Chennai'}-la ${memory.bhk || '2BHK'} flat-ku ${memory.siteVisitPreference || 'site visit'} note panniten. WhatsApp-la verified brochure and details send panren Sir! Romba nandri, have a great day!"
   - Example (English): "[happy] Excellent! To recap our chat today: ${memory.bhk || 'home'} in ${memory.location || 'Chennai'} around ${memory.budget || 'your budget'} with ${memory.siteVisitPreference || 'site visit'} confirmed. I'll share the complete brochure on WhatsApp right away. Thank you, have a wonderful day!"
6. SITUATIONAL EMOTIONS ONLY (NOT ALWAYS HAPPY):
   - NEVER use [happy] or [excited] on every turn!
   - Use [excited] or [happy] ONLY when customer is enthusiastic, likes a property, or books a site visit.
   - Use [explaining] or [confident] for prices, sizes, BHK, loans, and legal approvals.
   - Use [understanding] or [calm] when customer is busy, driving, or asking questions.
   - Use [calm] or [apologetic] when customer declines or says "not interested".
======================================================================`.trim();
}

/**
 * Checks if a specific qualification attribute is already stored in memory
 */
export function isMemoryFactKnown(
  memory: SessionMemory | undefined,
  factType: 'budget' | 'location' | 'bhk' | 'purpose' | 'financing' | 'timeline'
): boolean {
  if (!memory) return false;
  switch (factType) {
    case 'budget':
      return Boolean(memory.budget && memory.budget.length > 2);
    case 'location':
      return Boolean(memory.location && memory.location.length > 2);
    case 'bhk':
      return Boolean(memory.bhk && memory.bhk.length > 0);
    case 'purpose':
      return Boolean(memory.purpose && memory.purpose.length > 0);
    case 'financing':
      return Boolean(memory.loanOrCash && memory.loanOrCash.length > 0);
    case 'timeline':
      return Boolean(memory.timeline && memory.timeline.length > 0);
    default:
      return false;
  }
}
