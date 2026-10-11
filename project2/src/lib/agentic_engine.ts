import { LeadProfile, AgenticDecision, PropertyListing, PropertyIntent, CustomerType } from '../types/crm';
import { ALL_VERIFIED_PROPERTIES, VERIFIED_DUBAI_PROPERTIES, VERIFIED_MUMBAI_PROPERTIES } from '../data/all_properties';
import { LYKA_AGENTS, DUBAI_COMMUNITIES } from '../data/dubai_knowledge';

export function createInitialLeadProfile(): LeadProfile {
  return {
    id: 'LEAD-' + Math.random().toString(36).substring(2, 9).toUpperCase(),
    full_name: '',
    phone: '',
    email: '',
    customer_type: '',
    intent: '',
    preferred_language: 'English',
    current_location: '',
    preferred_communities: [],
    budget_min: null,
    budget_max: null,
    property_type: '',
    bedrooms: null,
    ready_or_offplan: '',
    purpose: '',
    timeline: '',
    must_have_features: [],
    exclusions: [],
    financing: '',
    viewing_preference: '',
    lead_status: 'New',
    lead_priority: 'Medium',
    requirement_completeness: 0,
    engagement_level: 'High',
    human_handoff_required: false,
    assigned_agent: LYKA_AGENTS[0].name,
    next_action: 'Greet customer and identify role',
    follow_up_date: null,
    summary: 'Customer initiated inquiry on Lyka Realty assistant.',
    missing_fields: ['Role (Investor/Buyer/Seller/Other)', 'Contact information (name, phone, email)', 'Location/Geography', 'Property Type'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function extractEntitiesFromText(text: string, currentLead: LeadProfile): Partial<LeadProfile> {
  const lower = text.toLowerCase();
  const extracted: Partial<LeadProfile> = {};

  // Helper function for fuzzy string matching (Levenshtein distance)
  const levenshtein = (a: string, b: string): number => {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }
    return matrix[b.length][a.length];
  };

  const words = lower.replace(/[^\w\s]/gi, '').split(/\s+/);

  // Fuzzy tolerance must scale with word length. A flat distance of 2 lets
  // unrelated short words collide: lev("want","rent")=2 and
  // lev("already","ready")=2. Short words get distance 1, long ones keep 2.
  const toleranceFor = (phrase: string): number => (phrase.length <= 7 ? 1 : 2);

  // Helper to fuzzy match a list of phrases against the user's text
  const fuzzyIncludes = (phrases: string[], maxDistance = 2): boolean => {
    for (const phrase of phrases) {
      const pWords = phrase.split(' ');
      const tol = Math.min(maxDistance, toleranceFor(phrase));
      if (pWords.length === 1 && phrase.length > 3) {
        // Require a shared first letter so that same-length words which merely
        // look alike never match ("invest" vs "divest", "want" vs "rent").
        if (words.some(w => w.length > 3 && w[0] === phrase[0] && levenshtein(w, phrase) <= tol)) return true;
      } else if (pWords.length > 1) {
        for (let i = 0; i <= words.length - pWords.length; i++) {
          let matchCount = 0;
          for (let j = 0; j < pWords.length; j++) {
            const pWord = pWords[j];
            const wordTol = Math.min(maxDistance, toleranceFor(pWord));
            if (words[i+j].length > 3 && words[i+j][0] === pWord[0] && levenshtein(words[i+j], pWord) <= wordTol) matchCount++;
            else if (words[i+j] === pWord) matchCount++;
          }
          if (matchCount === pWords.length) return true;
        }
      } else {
        if (lower.includes(phrase)) return true; // fallback for short words
      }
    }
    return false;
  };

  // Intent detection - now fully fuzzy matched
  const investKeywords = ['invest', 'investment', 'roi', 'yield', 'capital appreciation', 'buy and hold', 'rental income', 'passive income', 'golden visa', 'flip', 'flipping', 'developer project', 'off-plan'];
  const sellKeywords = ['sell', 'selling', 'list my property', 'list property', 'put on market', 'dispose', 'divest', 'estate sale', 'need to sell', 'want to sell'];
  const buyKeywords = ['buy', 'purchase', 'acquire', 'shopping for', 'looking to buy', 'want to buy', 'need to buy', 'first home', 'first-time buyer', 'end user', 'end-user', 'primary residence', 'vacation home', 'second home'];
  const rentKeywords = ['rent', 'lease', 'tenant', 'monthly', 'renting', 'looking to rent', 'want to rent', 'short-term rental', 'furnished rental', 'holiday let'];
  const otherKeywords = ['partner', 'collaboration', 'media', 'press', 'journalist', 'blogger', 'influencer', 'agent', 'broker', 'developer', 'supplier', 'service provider', 'contractor', 'maintenance', 'property management'];

  // Order matters: an explicit Buy signal must be tested before Rent, otherwise
  // incidental words shared with rentKeywords ("monthly") steal the match.
  if (fuzzyIncludes(sellKeywords)) {
    extracted.intent = 'Sell';
    extracted.customer_type = 'Seller';
  } else if (fuzzyIncludes(investKeywords)) {
    extracted.intent = 'Invest';
    extracted.purpose = 'Investment';
    extracted.customer_type = 'Investor';
  } else if (fuzzyIncludes(buyKeywords)) {
    extracted.intent = 'Buy';
    if (!currentLead.customer_type || currentLead.customer_type === 'Tenant/Renter') {
      extracted.customer_type = 'First-time buyer';
    }
  } else if (fuzzyIncludes(rentKeywords)) {
    extracted.intent = 'Rent';
    extracted.customer_type = 'Tenant/Renter';
  } else if (fuzzyIncludes(otherKeywords)) {
    extracted.customer_type = 'Other stakeholder';
  }

  // Seller specific fields
  if (fuzzyIncludes(['asking price', 'ask price', 'selling for'])) {
    const priceMatch = text.match(/(?:asking price|ask price|selling for)\s*(?:aed|inr|rs|₹)?\s*([1-9]\d{5,8})/i);
    if (priceMatch && priceMatch[1]) {
      extracted.asking_price = parseInt(priceMatch[1], 10);
    }
  }

  // Current situation / motivation detection
  if (fuzzyIncludes(['relocating', 'moving abroad', 'downsizing', 'upgrading', 'change of plans'])) {
    extracted.current_situation = fuzzyIncludes(['relocating']) ? 'Relocating' 
      : fuzzyIncludes(['moving abroad']) ? 'Moving abroad'
      : fuzzyIncludes(['downsizing']) ? 'Downsizing'
      : fuzzyIncludes(['upgrading']) ? 'Upgrading'
      : 'Change of plans';
  }

  if (fuzzyIncludes(['quick sale', 'fast sale', 'need to sell fast'])) {
    extracted.motivation = 'Quick sale needed';
  } else if (fuzzyIncludes(['max return', 'maximum return', 'best price', 'highest price'])) {
    extracted.motivation = 'Maximize return';
  } else if (fuzzyIncludes(['estate clearance', 'family decision', 'inherited'])) {
    extracted.motivation = 'Estate/inherited property';
  }

  // Other stakeholder fields
  if (fuzzyIncludes(['inquiry', 'question', 'interested in'])) {
    extracted.inquiry_reason = text;
  }

  if (fuzzyIncludes(['help with', 'looking to', 'need help'])) {
    extracted.how_can_help = text;
  }

  // Investor experience level
  if (fuzzyIncludes(['first time investor', 'beginner investor', 'new to investing'])) {
    extracted.experience_level = 'Beginner';
  } else if (fuzzyIncludes(['experienced investor', 'seasoned investor', 'multiple properties'])) {
    extracted.experience_level = 'Experienced';
  } else if (fuzzyIncludes(['professional investor', 'portfolio', 'institutional'])) {
    extracted.experience_level = 'Professional';
  }

  // Name extraction - more patterns
  const namePatterns = [
    /(?:my name is|i am|this is|call me|name is|i'm|i’m)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
    /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)(?:\s+here)?$/,
    /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:calling|speaking)/i,
  ];
  for (const pattern of namePatterns) {
    const nameMatch = text.match(pattern);
    if (nameMatch && nameMatch[1] && nameMatch[1].length > 2 && !nameMatch[1].toLowerCase().includes('investor') && !nameMatch[1].toLowerCase().includes('buyer') && !nameMatch[1].toLowerCase().includes('seller')) {
      extracted.full_name = nameMatch[1].trim();
      break;
    }
  }

  // Phone extraction - more formats
  const phoneMatch = text.match(/(?:\+?\d{1,4}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,5}/);
  if (phoneMatch && phoneMatch[0].length >= 8 && !phoneMatch[0].includes('000000')) {
    extracted.phone = phoneMatch[0].trim();
  }

  // Email extraction
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (emailMatch && emailMatch[0]) {
    extracted.email = emailMatch[0].trim();
  }

  // Community & City detection
  const detectedCommunities: string[] = [...(currentLead.preferred_communities || [])];
  const communityKeywords: { [key: string]: { name: string; city: 'Dubai' | 'Mumbai' } } = {
    // Dubai Communities
    'marina': { name: 'Dubai Marina', city: 'Dubai' },
    'dubai marina': { name: 'Dubai Marina', city: 'Dubai' },
    'downtown': { name: 'Downtown Dubai', city: 'Dubai' },
    'downtown dubai': { name: 'Downtown Dubai', city: 'Dubai' },
    'palm': { name: 'Palm Jumeirah', city: 'Dubai' },
    'palm jumeirah': { name: 'Palm Jumeirah', city: 'Dubai' },
    'business bay': { name: 'Business Bay', city: 'Dubai' },
    'dubai hills': { name: 'Dubai Hills Estate', city: 'Dubai' },
    'hills estate': { name: 'Dubai Hills Estate', city: 'Dubai' },
    'jvc': { name: 'JVC', city: 'Dubai' },
    'jumeirah village': { name: 'JVC', city: 'Dubai' },
    'creek harbour': { name: 'Dubai Creek Harbour', city: 'Dubai' },
    'dubai creek': { name: 'Dubai Creek Harbour', city: 'Dubai' },
    'dubai islands': { name: 'Dubai Islands', city: 'Dubai' },
    'jlt': { name: 'JLT', city: 'Dubai' },
    'jumeirah lake towers': { name: 'JLT', city: 'Dubai' },
    'arabian ranches': { name: 'Arabian Ranches', city: 'Dubai' },
    'ranches': { name: 'Arabian Ranches', city: 'Dubai' },
    // Mumbai Communities
    'worli': { name: 'Worli', city: 'Mumbai' },
    'bandra': { name: 'Bandra West', city: 'Mumbai' },
    'juhu': { name: 'Juhu', city: 'Mumbai' },
    'powai': { name: 'Powai', city: 'Mumbai' },
    'lower parel': { name: 'Lower Parel / Mahalaxmi', city: 'Mumbai' },
    'mahalaxmi': { name: 'Lower Parel / Mahalaxmi', city: 'Mumbai' },
    'bkc': { name: 'BKC (Bandra Kurla Complex)', city: 'Mumbai' },
    'malabar hill': { name: 'Malabar Hill', city: 'Mumbai' },
    'andheri': { name: 'Andheri West', city: 'Mumbai' }
  };

  let hasMumbai = false;
  let hasDubai = false;

  for (const [kw, info] of Object.entries(communityKeywords)) {
    // 1. Strict match for multi-word communities (e.g. "business bay")
    if (lower.includes(kw)) {
      if (!detectedCommunities.includes(info.name)) detectedCommunities.push(info.name);
      if (info.city === 'Mumbai') hasMumbai = true;
      if (info.city === 'Dubai') hasDubai = true;
      continue;
    }

    // 2. Fuzzy match for typos
    const kwWords = kw.split(' ');
    
    // Single word keyword fuzzy match (e.g. 'marina', 'juhu')
    if (kwWords.length === 1 && kw.length > 3) {
      for (const word of words) {
        if (word.length > 3 && levenshtein(word, kw) <= 2) { 
          if (!detectedCommunities.includes(info.name)) detectedCommunities.push(info.name);
          if (info.city === 'Mumbai') hasMumbai = true;
          if (info.city === 'Dubai') hasDubai = true;
          break;
        }
      }
    } 
    // Multi-word keyword fuzzy match (e.g. 'business bay')
    else if (kwWords.length > 1) {
      for (let i = 0; i <= words.length - kwWords.length; i++) {
        let matchCount = 0;
        for (let j = 0; j < kwWords.length; j++) {
          if (words[i+j].length > 3 && levenshtein(words[i+j], kwWords[j]) <= 2) {
            matchCount++;
          } else if (words[i+j] === kwWords[j]) {
            matchCount++;
          }
        }
        if (matchCount === kwWords.length) {
          if (!detectedCommunities.includes(info.name)) detectedCommunities.push(info.name);
          if (info.city === 'Mumbai') hasMumbai = true;
          if (info.city === 'Dubai') hasDubai = true;
          break;
        }
      }
    }
  }

  if (lower.includes('mumbai') || lower.includes('bombay') || lower.includes('india') || lower.includes('nri')) {
    extracted.is_nri = true;
    extracted.customer_type = 'NRI/overseas buyer';
    if (!extracted.current_location) extracted.current_location = 'Mumbai, India';
    if (!hasDubai) hasMumbai = true;
  }

  if (hasMumbai && hasDubai) extracted.target_city = 'Both';
  else if (hasMumbai) extracted.target_city = 'Mumbai';
  else if (hasDubai) extracted.target_city = 'Dubai';

  if (detectedCommunities.length > 0) {
    extracted.preferred_communities = detectedCommunities;
  }

  // Budget detection - more robust with currency symbols, words, and commas
  const cleanText = text.replace(/,/g, ''); // Remove commas to simplify number matching
  const budgetCrores = cleanText.match(/(?:inr|rs\.?|₹)?\s*(\d+(?:\.\d+)?)\s*(?:cr|crore|crores)/i);
  const budgetLakhs = cleanText.match(/(?:inr|rs\.?|₹)?\s*(\d+)\s*(?:lakh|lakhs|lac|lacs|l)/i);
  const budgetMillions = cleanText.match(/(?:aed\s*)?(\d+(?:\.\d+)?)\s*(?:m|million|mn|mill)/i);
  const budgetThousands = cleanText.match(/(?:aed\s*)?(\d+)\s*(?:k|thousand|thou)/i);
  const budgetPlain = cleanText.match(/(?:aed|inr|budget|around|upto|approx|approximately)?\s*([1-9]\d{3,8})/i);
  const budgetWithTo = cleanText.match(/(?:aed|inr)?\s*([1-9]\d{3,8})\s*(?:to|-|–)\s*(?:aed|inr)?\s*([1-9]\d{3,8})/i);

  if (budgetWithTo && budgetWithTo[1] && budgetWithTo[2]) {
    extracted.budget_min = parseInt(budgetWithTo[1], 10);
    extracted.budget_max = parseInt(budgetWithTo[2], 10);
  } else if (budgetCrores && budgetCrores[1]) {
    const valInr = parseFloat(budgetCrores[1]) * 10000000;
    const valAed = Math.round(valInr / 22.8);
    extracted.budget_max = valAed;
    extracted.budget_min = Math.round(valAed * 0.75);
    extracted.budget_currency = 'INR';
  } else if (budgetLakhs && budgetLakhs[1]) {
    const valInr = parseFloat(budgetLakhs[1]) * 100000;
    const valAed = Math.round(valInr / 22.8);
    extracted.budget_max = valAed;
    extracted.budget_min = Math.round(valAed * 0.8);
    extracted.budget_currency = 'INR';
  } else if (budgetMillions && budgetMillions[1]) {
    const val = parseFloat(budgetMillions[1]) * 1000000;
    extracted.budget_max = val;
    extracted.budget_min = Math.round(val * 0.75);
    extracted.budget_currency = 'AED';
  } else if (budgetThousands && budgetThousands[1]) {
    const val = parseFloat(budgetThousands[1]) * 1000;
    extracted.budget_max = val;
    extracted.budget_min = Math.round(val * 0.8);
    extracted.budget_currency = 'AED';
  } else if (budgetPlain && budgetPlain[1]) {
    const val = parseInt(budgetPlain[1], 10);
    extracted.budget_max = val;
    extracted.budget_min = Math.round(val * 0.8);
  }

  if (extracted.budget_max && (!currentLead.intent || currentLead.intent === 'Rent' || extracted.intent === 'Rent')) {
    extracted.rental_budget = extracted.budget_max;
  }

  // Property type - more variations
  const propTypeMap: Record<string, string> = {
    'penthouse': 'Penthouse',
    'villa': 'Villa',
    'townhouse': 'Townhouse',
    'town house': 'Townhouse',
    'apartment': 'Apartment',
    'flat': 'Apartment',
    'condo': 'Apartment',
    'condominium': 'Apartment',
    'studio': 'Apartment',
    'loft': 'Apartment',
    'commercial': 'Commercial / Office',
    'office': 'Commercial / Office',
    'shop': 'Commercial / Office',
    'retail': 'Commercial / Office',
    'warehouse': 'Commercial / Office',
  };
  for (const [kw, type] of Object.entries(propTypeMap)) {
    if (fuzzyIncludes([kw])) {
      extracted.property_type = type;
      break;
    }
  }

  // Bedrooms
  if (fuzzyIncludes(['studio'])) {
    extracted.bedrooms = 'Studio';
  } else {
    const bedMatch = text.match(/(\d+)\s*(?:br|bed|bedroom|bhk|beds|bedrooms)/i);
    if (bedMatch && bedMatch[1]) {
      extracted.bedrooms = bedMatch[1];
    } else if (fuzzyIncludes(['one bed', '1 bed', 'single bedroom'])) {
      extracted.bedrooms = '1';
    } else if (fuzzyIncludes(['two bed', '2 bed', 'two bedroom'])) {
      extracted.bedrooms = '2';
    } else if (fuzzyIncludes(['three bed', '3 bed', 'three bedroom'])) {
      extracted.bedrooms = '3';
    } else if (fuzzyIncludes(['four bed', '4 bed', 'four bedroom'])) {
      extracted.bedrooms = '4';
    }
  }

  // Ready vs Off-plan
  if (fuzzyIncludes(['off-plan', 'offplan', 'off plan', 'under construction', 'payment plan', 'developer', 'launch'])) {
    extracted.ready_or_offplan = 'Off-plan';
  } else if (fuzzyIncludes(['ready', 'immediate move', 'vacant', 'ready to move', 'move-in ready', 'completed', 'handover'])) {
    extracted.ready_or_offplan = 'Ready';
  }

  // Purpose
  if (fuzzyIncludes(['own use', 'myself', 'family', 'relocating', 'primary home', 'primary residence', 'living in'])) {
    extracted.purpose = 'Own use';
  } else if (fuzzyIncludes(['investment', 'rental income', 'high roi', 'capital growth', 'rental yield', 'for rent', 'to let'])) {
    extracted.purpose = 'Investment';
  }

  // Financing
  if (fuzzyIncludes(['mortgage', 'bank loan', 'financing', 'finance', 'home loan', 'property loan'])) {
    extracted.financing = 'Mortgage';
  } else if (fuzzyIncludes(['cash', 'ready funds', 'cash buyer', 'cash purchase', 'no loan'])) {
    extracted.financing = 'Cash';
  }

  // Timeline & Move-in date
  if (fuzzyIncludes(['immediately', 'asap', 'this month', 'urgent', 'right now'])) {
    extracted.timeline = 'Immediate (within 1 month)';
    extracted.move_in_date = 'Immediate';
  } else if (fuzzyIncludes(['1-3 months', 'couple of months', 'next month'])) {
    extracted.timeline = '1-3 months';
    extracted.move_in_date = '1-3 months';
  } else if (fuzzyIncludes(['end of year', 'next year', '6 months'])) {
    extracted.timeline = '3-6 months';
    extracted.move_in_date = '3-6 months';
  }

  // Investment Goal
  if (fuzzyIncludes(['yield', 'rental yield', 'cash flow', 'steady income', 'monthly income', 'rent it out'])) {
    extracted.investment_goal = 'Rental Yield';
  } else if (fuzzyIncludes(['capital appreciation', 'capital growth', 'value growth', 'sell later', 'flip', 'flipping'])) {
    extracted.investment_goal = 'Capital Appreciation';
  } else if (fuzzyIncludes(['balance', 'both', 'yield and growth', 'yield and appreciation'])) {
    extracted.investment_goal = 'Balance of Both';
  }

  // Renter specific
  if (fuzzyIncludes(['furnished']) && !fuzzyIncludes(['unfurnished'])) {
    extracted.furnishing = 'Furnished';
  } else if (fuzzyIncludes(['unfurnished'])) {
    extracted.furnishing = 'Unfurnished';
  }

  // Human handoff detection
  if (
    fuzzyIncludes([
      'human',
      'talk to an agent',
      'real person',
      'call me',
      'schedule a viewing',
      'book viewing',
      'negotiate',
      'offer price'
    ])
  ) {
    extracted.human_handoff_required = true;
    extracted.handoff_reason = fuzzyIncludes(['viewing', 'schedule a viewing', 'book viewing']) 
      ? 'Customer requested to schedule in-person viewing' 
      : fuzzyIncludes(['negotiate', 'offer price'])
      ? 'Customer requested price negotiation guidance'
      : 'Customer requested human Lyka Realty agent handoff';
  }

  return extracted;
}

export function computeCompletenessAndMissing(lead: LeadProfile): { completeness: number; missing: string[] } {
  const missing: string[] = [];
  let score = 0;

  // Base checks
  if (lead.intent) score += 15; else missing.push('Property intent (Buy / Rent / Invest)');
  if (lead.budget_max) score += 20; else missing.push('Budget range (in AED)');
  if (lead.preferred_communities && lead.preferred_communities.length > 0) score += 20; else missing.push('Preferred Dubai community');
  if (lead.property_type) score += 15; else missing.push('Property type (Apartment / Villa / Townhouse)');
  if (lead.bedrooms) score += 10; else missing.push('Bedrooms needed');

  if (lead.intent === 'Buy') {
    if (lead.ready_or_offplan) score += 10; else missing.push('Ready vs Off-plan preference');
    if (lead.financing) score += 5; else missing.push('Financing mode (Cash or Mortgage)');
    if (lead.timeline) score += 5; else missing.push('Purchase timeline');
  } else if (lead.intent === 'Rent') {
    if (lead.furnishing) score += 10; else missing.push('Furnished vs Unfurnished');
    if (lead.timeline || lead.move_in_date) score += 10; else missing.push('Move-in date');
  } else if (lead.intent === 'Invest') {
    if (lead.ready_or_offplan) score += 5; else missing.push('Ready vs Off-plan preference');
    if (lead.purpose || lead.investment_goal) score += 10; else missing.push('Investment target (ROI or Capital growth)');
    if (lead.financing) score += 5; else missing.push('Cash or Mortgage');
  }

  // Contact info bonus
  if (lead.phone || lead.email) score = Math.min(100, score + 10);
  if (lead.full_name) score = Math.min(100, score + 5);

  const completeness = Math.min(100, Math.max(10, score));
  return { completeness, missing };
}

export function evaluateLeadStatusAndPriority(lead: LeadProfile, completeness: number): { status: LeadProfile['lead_status']; priority: LeadProfile['lead_priority'] } {
  let status: LeadProfile['lead_status'] = 'New';
  let priority: LeadProfile['lead_priority'] = 'Medium';

  if (lead.human_handoff_required) {
    status = 'Viewing';
    priority = 'Urgent';
  } else if (completeness >= 80) {
    status = 'Qualified';
    priority = (lead.budget_max && lead.budget_max >= 3000000) ? 'Urgent' : 'High';
  } else if (completeness >= 50) {
    status = 'Interested';
    priority = (lead.budget_max && lead.budget_max >= 2000000) ? 'High' : 'Medium';
  } else if (completeness >= 25) {
    status = 'Contacted';
    priority = 'Medium';
  }

  return { status, priority };
}

export function findMatchingProperties(lead: LeadProfile): PropertyListing[] {
  const dataset = lead.target_city === 'Mumbai'
    ? VERIFIED_MUMBAI_PROPERTIES
    : lead.target_city === 'Dubai'
    ? VERIFIED_DUBAI_PROPERTIES
    : ALL_VERIFIED_PROPERTIES;

  let matched = dataset.filter(prop => {
    // Check city if specified
    if (lead.target_city && lead.target_city !== 'Both') {
      if (prop.city && prop.city !== lead.target_city) return false;
    }

    // Check community match if specified
    if (lead.preferred_communities && lead.preferred_communities.length > 0) {
      const commMatch = lead.preferred_communities.some(c => 
        prop.community.toLowerCase().includes(c.toLowerCase()) || c.toLowerCase().includes(prop.community.toLowerCase())
      );
      if (!commMatch) return false;
    }

    // Check property type match if specified
    if (lead.property_type && prop.property_type) {
      if (lead.property_type.toLowerCase() !== prop.property_type.toLowerCase()) {
        return false;
      }
    }

    // Check bedrooms match if specified
    if (lead.bedrooms && prop.bedrooms) {
      if (lead.bedrooms !== prop.bedrooms && lead.bedrooms !== 'Studio') {
        const bedNum = parseInt(lead.bedrooms, 10);
        const propBedNum = parseInt(prop.bedrooms, 10);
        if (!isNaN(bedNum) && !isNaN(propBedNum) && Math.abs(bedNum - propBedNum) > 1) {
          return false;
        }
      }
    }

    // Check budget max if specified
    if (lead.budget_max) {
      if (lead.intent === 'Rent' && prop.rental_price_annual_aed) {
        if (prop.rental_price_annual_aed > lead.budget_max * 1.2) return false;
      } else {
        if (prop.price_aed > lead.budget_max * 1.15) return false;
      }
    }

    // Check ready vs off-plan
    if (lead.ready_or_offplan && lead.ready_or_offplan !== 'Both') {
      if (prop.status.toLowerCase() !== lead.ready_or_offplan.toLowerCase()) {
        return false;
      }
    }

    return true;
  });

  // If strict filtering yields zero matches, return empty array so LangGraph knows to offer human agent handoff
  if (matched.length === 0) {
    // Optionally trigger human handoff flag on the lead itself so UI updates
    lead.human_handoff_required = true;
    lead.handoff_reason = 'No exact property matches found in inventory for the requested location/criteria.';
  }

  return matched;
}

export function isGreetingMessage(text: string): boolean {
  const trimmed = text.trim().toLowerCase().replace(/[!.,?]/g, '');
  const greetings = [
    'hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening', 
    'hi there', 'hello there', 'salam', 'assalamu alaikum', 'hola', 'namaste',
    'hey there', 'greetings', 'hi lyka', 'hello lyka'
  ];
  return greetings.includes(trimmed) || (trimmed.startsWith('hi ') && trimmed.length < 12) || (trimmed.startsWith('hello ') && trimmed.length < 16) || (trimmed.startsWith('hey ') && trimmed.length < 14);
}

export function isPropertyQuery(text: string): boolean {
  if (!text) return false;
  const t = text.toLowerCase().trim();
  if (t.length < 3) return false;

  // Price queries (lowest, cheapest, low property, low perperty, min price, etc.)
  if (/\b(lowest|cheapest|minimum|min price|least price|low price|cheaper|most affordable|budget friendly)\b/i.test(t)) return true;
  if (/\blow\s*(perperty|property|propert|price|cost|rate|flat|apartment|unit|villa)?\b/i.test(t)) return true;
  if (/\b(highest|most expensive|maximum price|max price|costliest|top price|luxury)\s*(perperty|property|flat|apartment|unit|villa)?\b/i.test(t)) return true;
  if (/\b(average price|avg price|typical price|price range|rate of property|cost of property)\b/i.test(t)) return true;
  if (/\b(cheap|affordable|budget)\s*(perperty|property|flat|apartment|unit|villa|options)\b/i.test(t)) return true;
  
  // Inventory & count queries
  if (/\b(how many|count of|number of|list of|show me|give me|what are the)\s*(properties|listings|flats|apartments|villas|units)/i.test(t)) return true;
  if (/\b(database|inventory|available propert|listings in database)\b/i.test(t)) return true;

  // Amenity queries (swimming pool, swimming pole, gym, balcony, parking)
  if (/\b(swimming pool|swimming pole|pool|gym|fitness|balcony|parking)\b/i.test(t)) return true;

  // General property inquiries
  if (/\b(what property|which property|any property|tell me about property|details of property|property details)\b/i.test(t)) return true;
  if (/\b(properties in|flats in|apartments in|villas in)\s+(dubai|mumbai|marina|downtown|palm|jvc|jlt|business bay|hills|ranches|worli|bandra|juhu)/i.test(t)) return true;

  return false;
}

export function queryPropertyDatabase(query: string, customPool?: PropertyListing[]): string {
  const text = query.toLowerCase().trim();
  let pool = [...(customPool && customPool.length > 0 ? customPool : ALL_VERIFIED_PROPERTIES)];

  if (pool.length === 0) {
    return 'Our property database currently has no records matching your query.';
  }

  // Location / community matching
  const communityKeywords = [
    'dubai marina', 'marina', 'downtown dubai', 'downtown', 'palm jumeirah', 'palm',
    'business bay', 'dubai hills estate', 'dubai hills', 'jvc', 'jumeirah village',
    'jlt', 'creek harbour', 'dubai creek', 'arabian ranches', 'ranches', 'dubai islands',
    'mumbai', 'worli', 'bandra', 'juhu', 'bkc', 'powai', 'andheri', 'lower parel'
  ];

  let matchedCommunity = '';
  for (const c of communityKeywords) {
    if (text.includes(c)) {
      matchedCommunity = c;
      break;
    }
  }

  if (matchedCommunity) {
    const commLower = matchedCommunity.toLowerCase();
    const commSubset = pool.filter(p => p.community.toLowerCase().includes(commLower) || commLower.includes(p.community.toLowerCase()));
    if (commSubset.length > 0) pool = commSubset;
  }

  // Property type matching
  const types = ['apartment', 'villa', 'townhouse', 'penthouse', 'duplex', 'studio'];
  let matchedType = '';
  for (const t of types) {
    if (text.includes(t)) {
      matchedType = t;
      break;
    }
  }
  if (matchedType) {
    const typeSubset = pool.filter(p => p.property_type.toLowerCase() === matchedType);
    if (typeSubset.length > 0) pool = typeSubset;
  }

  // Bedrooms matching
  const bedMatch = text.match(/(\d+)\s*(bed|br|bedroom)/i) || text.match(/\b(studio)\b/i);
  let matchedBeds = '';
  if (bedMatch) {
    matchedBeds = bedMatch[1] || 'Studio';
    const bedSubset = pool.filter(p => p.bedrooms.toLowerCase() === matchedBeds.toLowerCase() || p.bedrooms.includes(matchedBeds));
    if (bedSubset.length > 0) pool = bedSubset;
  }

  // Amenity filtering if requested (e.g. pool, gym)
  const wantsPool = /\b(swimming pool|swimming pole|pool)\b/i.test(text);
  const wantsGym = /\b(gym|fitness)\b/i.test(text);

  let amenityFilterText = '';
  if (wantsPool) {
    const poolSubset = pool.filter(p => (p.amenities || []).some(a => /pool/i.test(a)) || (p.features || []).some(f => /pool/i.test(f)));
    if (poolSubset.length > 0) {
      pool = poolSubset;
      amenityFilterText += ' with Swimming Pool';
    }
  }
  if (wantsGym) {
    const gymSubset = pool.filter(p => (p.amenities || []).some(a => /gym/i.test(a)));
    if (gymSubset.length > 0) {
      pool = gymSubset;
      amenityFilterText += ' with Gym';
    }
  }

  if (pool.length === 0) {
    return `We currently do not have a listing matching "${query}" in our verified database. However, our portfolio updates weekly with new off-plan and secondary market allocations across Dubai!`;
  }

  const filterDesc = (matchedCommunity ? ` in ${matchedCommunity.toUpperCase()}` : '') +
                     (matchedType ? ` for ${matchedType}s` : '') +
                     (matchedBeds ? ` (${matchedBeds} BR)` : '') +
                     amenityFilterText;

  // 1. Lowest / Cheapest / Low perperty
  const isLowest = /\b(lowest|cheapest|min|minimum|least|affordable|budget)\b/i.test(text)
    || /\blow\s*(perperty|property|propert|price|cost|rate)?\b/i.test(text);

  if (isLowest) {
    const lowest = pool.reduce((min, p) => p.price_aed < min.price_aed ? p : min);
    const amenitiesStr = lowest.amenities && lowest.amenities.length > 0 ? lowest.amenities.slice(0, 5).join(', ') : 'High-spec finishes';
    const hasSwimmingPool = (lowest.amenities || []).some(a => /pool/i.test(a)) || (lowest.features || []).some(f => /pool/i.test(f));
    const hasGymFacility = (lowest.amenities || []).some(a => /gym/i.test(a));

    return `Here are the details for the **lowest-priced verified property**${filterDesc} from our database:\n\n` +
      `🏢 **Property:** ${lowest.title}\n` +
      `📍 **Location:** ${lowest.community} (${lowest.city || 'Dubai'})\n` +
      `💰 **Price:** **AED ${lowest.price_aed.toLocaleString()}** ${lowest.price_inr ? `(≈ ₹${(lowest.price_inr / 10000000).toFixed(2)} Cr)` : `(≈ ₹${((lowest.price_aed * 22.8) / 10000000).toFixed(2)} Cr)`}\n` +
      `🛏️ **Layout:** ${lowest.bedrooms} Bedroom (${lowest.property_type}) • ${lowest.size_sqft} sq ft\n` +
      `🏗️ **Developer & Status:** ${lowest.developer} (${lowest.status})\n` +
      (lowest.expected_roi ? `📈 **Expected Net Yield:** ${lowest.expected_roi}\n` : '') +
      (lowest.rental_price_annual_aed ? `🔑 **Est. Annual Rental:** AED ${lowest.rental_price_annual_aed.toLocaleString()}/yr\n` : '') +
      `🏊 **Swimming Pool:** ${hasSwimmingPool ? '✅ Yes, Swimming Pool available' : 'Available in master community'}\n` +
      `🏋️ **Fitness Gym:** ${hasGymFacility ? '✅ Yes, State-of-the-art Gym' : 'Available nearby'}\n` +
      `✨ **Key Amenities:** ${amenitiesStr}\n` +
      `📝 **Overview:** ${lowest.description}`;
  }

  // 2. Highest / Most Expensive
  const isHighest = /\b(highest|most expensive|maximum|max price|luxury|costliest|top price)\b/i.test(text);
  if (isHighest) {
    const highest = pool.reduce((max, p) => p.price_aed > max.price_aed ? p : max);
    const amenitiesStr = highest.amenities && highest.amenities.length > 0 ? highest.amenities.slice(0, 5).join(', ') : 'Ultra-luxury finishes';

    return `The **highest-priced luxury property**${filterDesc} in our verified database is:\n\n` +
      `🏢 **Property:** ${highest.title}\n` +
      `📍 **Location:** ${highest.community} (${highest.city || 'Dubai'})\n` +
      `💰 **Price:** **AED ${highest.price_aed.toLocaleString()}** ${highest.price_inr ? `(≈ ₹${(highest.price_inr / 10000000).toFixed(2)} Cr)` : ''}\n` +
      `🛏️ **Layout:** ${highest.bedrooms} Bedroom (${highest.property_type}) • ${highest.size_sqft} sq ft\n` +
      `🏗️ **Developer & Status:** ${highest.developer} (${highest.status})\n` +
      (highest.expected_roi ? `📈 **Expected Net Yield:** ${highest.expected_roi}\n` : '') +
      `✨ **Key Amenities:** ${amenitiesStr}\n` +
      `📝 **Overview:** ${highest.description}`;
  }

  // 3. Average / Price Range
  const isAverage = /\b(average|avg|typical|range|mean|price range|cost of)\b/i.test(text);
  if (isAverage) {
    const min = Math.min(...pool.map(p => p.price_aed));
    const max = Math.max(...pool.map(p => p.price_aed));
    const avg = Math.round(pool.reduce((sum, p) => sum + p.price_aed, 0) / pool.length);

    return `Here is the current **pricing overview** from our database${filterDesc}:\n\n` +
      `📊 **Number of verified listings:** ${pool.length}\n` +
      `💰 **Minimum Price:** AED ${min.toLocaleString()}\n` +
      `💎 **Maximum Price:** AED ${max.toLocaleString()}\n` +
      `📈 **Average Listing Price:** **AED ${avg.toLocaleString()}**`;
  }

  // 4. Specific amenity inquiry (swimming pool / gym)
  if (wantsPool || wantsGym) {
    const top3 = pool.slice(0, 3);
    return `Yes! We have **${pool.length} verified listings**${filterDesc} featuring premium facilities including Swimming Pool & Gym:\n\n` +
      top3.map((p, i) => `${i + 1}. **${p.title}** (${p.community}) — AED ${p.price_aed.toLocaleString()} (${p.bedrooms} BR, ${p.size_sqft} sqft, ${p.expected_roi || '7.5% ROI'})`).join('\n') +
      `\n\nAll these properties feature full access to swimming pools, fitness centers, and 24/7 concierge security.`;
  }

  // 5. Default: List / Show matching properties with details
  const topList = pool.sort((a, b) => a.price_aed - b.price_aed).slice(0, 3);
  return `Here are verified properties matching your query${filterDesc} from our database:\n\n` +
    topList.map((p, i) => 
      `**${i + 1}. ${p.title}**\n` +
      `📍 ${p.community} | 💰 AED ${p.price_aed.toLocaleString()} | 🛏️ ${p.bedrooms} BR (${p.size_sqft} sqft)\n` +
      `🏊 Amenities: ${(p.amenities || []).slice(0, 3).join(', ')} | 📈 Yield: ${p.expected_roi || '7.5% ROI'}`
    ).join('\n\n');
}

export function queryGeneralKnowledge(query: string): string | null {
  const text = query.toLowerCase();

  if (/\b(golden visa|2m visa|visa)\b/i.test(text)) {
    return `In the UAE, the **10-Year Golden Visa** is granted to property investors purchasing real estate valued at **AED 2,000,000 (AED 2 Million)** or above. Both ready properties and off-plan properties with approved developer payment plans qualify. Lyka Realty assists end-to-end with the DLD certification and visa issuance.`;
  }

  if (/\b(dld|fees|charges|commission|purchase cost|closing cost|transfer fee)\b/i.test(text)) {
    return `Here are the standard purchase costs for property in Dubai:\n` +
      `• **Dubai Land Department (DLD) Fee:** 4% of property purchase price (+ AED 580 admin fee)\n` +
      `• **Agency Commission:** 2% (+ 5% VAT)\n` +
      `• **Trustee Registration Fee:** AED 4,000 (+ 5% VAT)\n` +
      `• **Taxes:** 0% Capital Gains Tax and 0% Tax on Rental Income in the UAE!`;
  }

  if (/\b(foreign|foreigner|expat|nationality|can i buy|own|freehold)\b/i.test(text)) {
    return `Yes! Foreign nationals and non-residents of all nationalities can purchase and own 100% freehold property in Dubai's designated freehold zones (including Dubai Marina, Downtown, Palm Jumeirah, Business Bay, Dubai Hills Estate, JVC, and Dubai Creek Harbour) with full title deed ownership issued by the Dubai Land Department.`;
  }

  if (/\b(mortgage|loan|finance|financing|bank)\b/i.test(text)) {
    return `UAE banks provide attractive mortgage solutions for property buyers: UAE residents can typically finance up to **80% LTV** (Loan-to-Value), while non-residents and NRI investors can obtain mortgages up to **50%–60% LTV**. Interest rates generally range from 4.2% to 5.5% fixed.`;
  }

  if (/\b(roi|yield|returns|rental yield|income)\b/i.test(text)) {
    return `Dubai delivers among the world's highest net rental yields, averaging **6.5% to 9.4% net ROI** (e.g. JVC yields ~8.5%-9.4%, Dubai Marina ~7.8%, Business Bay ~8.2%). Best of all, all rental income in the UAE is 100% tax-free!`;
  }

  return null;
}

export function getNextQualificationQuestion(lead: LeadProfile): { question: string; rationale: string; intentCategory: string } {
  // If no intent yet
  if (!lead.intent) {
    return {
      question: `What brings you to Lyka Realty today? Are you looking to **buy**, **rent**, **invest**, or are you thinking of **selling** a property?`,
      rationale: 'Primary intent (Buy/Rent/Invest/Sell) needed to guide qualification.',
      intentCategory: 'Role Identification'
    };
  }

  if (lead.intent === 'Buy') {
    if (!lead.budget_max) {
      return {
        question: lead.is_nri 
          ? `What price bracket or maximum budget in AED or INR (Crores) are you comfortable exploring? (For example, AED 1.5M - 3M / INR 3.5 Cr - 7 Cr)`
          : `What price bracket or maximum budget in AED are you comfortable exploring for your purchase? (For example, AED 1.5M - 2.5M, or AED 5M+)`,
        rationale: 'Budget determines accessible locations, property tiers, and ready vs off-plan inventory.',
        intentCategory: 'Budget Qualification'
      };
    }
    if (!lead.preferred_communities || lead.preferred_communities.length === 0) {
      return {
        question: lead.target_city === 'Mumbai'
          ? `Which prime Mumbai localities do you prefer? (e.g. Worli, Bandra West, Juhu, BKC, or Powai)`
          : `Do you have preferred communities in mind? For Dubai: Dubai Marina, Downtown, Palm Jumeirah, or Dubai Hills Estate; or prime Mumbai corridors: Worli, Bandra, or Juhu?`,
        rationale: 'Location is the primary filtering parameter for verified listings.',
        intentCategory: 'Location Preference'
      };
    }
    if (!lead.property_type) {
      return {
        question: `Are you envisioning an apartment, a townhouse, a standalone villa, or perhaps a luxury penthouse?`,
        rationale: 'Property type refines layout, service charge profile, and lifestyle suitability.',
        intentCategory: 'Property Type'
      };
    }
    if (!lead.bedrooms) {
      return {
        question: `How many bedrooms would best accommodate you or your rental guests (e.g. 1BR, 2BR, 3BR+)?`,
        rationale: 'Bedrooms dictate unit size and rental yield dynamics.',
        intentCategory: 'Bedrooms'
      };
    }
    if (!lead.ready_or_offplan) {
      return {
        question: `Would you prefer a ready property available for immediate move-in/rental, or an off-plan project with flexible developer payment plans?`,
        rationale: 'Determines whether client seeks immediate rental returns or construction capital appreciation.',
        intentCategory: 'Ready vs Off-Plan'
      };
    }
    if (!lead.financing) {
      return {
        question: `Will this purchase be made via ready cash funds, or are you considering UAE bank mortgage financing?`,
        rationale: 'Mortgage requires pre-approval assessment; cash transactions proceed rapidly with title deed transfer.',
        intentCategory: 'Financing'
      };
    }
    if (!lead.timeline) {
      return {
        question: `What is your ideal purchase timeframe (e.g. within 30 days, 1-3 months, or planning ahead for later this year)?`,
        rationale: 'Timeline establishes lead priority and scheduling readiness.',
        intentCategory: 'Timeline'
      };
    }
  }

  if (lead.intent === 'Rent') {
    if (!lead.budget_max) {
      return {
        question: `What is your targeted annual or monthly rental budget in AED? (For example, AED 100,000/yr or AED 15,000/month)`,
        rationale: 'Rental budget defines community tiers and cheque payment feasibility.',
        intentCategory: 'Rental Budget'
      };
    }
    if (!lead.preferred_communities || lead.preferred_communities.length === 0) {
      return {
        question: `Which neighborhood in Dubai would you prefer to call home? (e.g. Dubai Marina, JLT, Business Bay, or Downtown)`,
        rationale: 'Location proximity to work and transport is crucial for renters.',
        intentCategory: 'Location'
      };
    }
    if (!lead.bedrooms) {
      return {
        question: `How many bedrooms are you seeking, and do you prefer fully furnished or unfurnished?`,
        rationale: 'Furnishing status and bedroom count determine move-in readiness.',
        intentCategory: 'Bedrooms & Furnishing'
      };
    }
    if (!lead.timeline && !lead.move_in_date) {
      return {
        question: `When would you like to move in, and how many cheques would you prefer to pay your lease with?`,
        rationale: 'Move-in date allows shortlisting currently vacant or expiring tenancy units.',
        intentCategory: 'Move-in Timeline'
      };
    }
  }

  if (lead.intent === 'Invest') {
    if (!lead.budget_max) {
      return {
        question: `What is your total capital allocation or investment budget in AED? (For example, AED 1M for high yield, or AED 2M+ for UAE Golden Visa eligibility)`,
        rationale: 'Investment bracket determines Golden Visa eligibility and portfolio yield strategy.',
        intentCategory: 'Investment Budget'
      };
    }
    if (!lead.purpose && !lead.investment_goal) {
      return {
        question: `Is your primary objective maximizing annual rental yield (cash flow) or long-term capital appreciation before handover?`,
        rationale: 'Yield vs capital appreciation drives ready (e.g., JVC/Marina 8%+) vs off-plan (Creek Harbour/Islands).',
        intentCategory: 'Investment Goal'
      };
    }
    if (!lead.ready_or_offplan) {
      return {
        question: `Do you prefer off-plan opportunities with 1% monthly or post-handover payment plans, or ready tenanted units generating immediate income?`,
        rationale: 'Cash flow timing preference determines asset class recommendation.',
        intentCategory: 'Asset Selection'
      };
    }
  }

  if (lead.intent === 'Sell') {
    return {
      question: `Where is your property located in Dubai or Mumbai, and what type of unit is it (e.g. 2BR in Marina, Villa in Ranches)? I can prepare an instant comparative market valuation for you.`,
      rationale: 'Property specifics needed to generate comparative valuation.',
      intentCategory: 'Seller Qualification'
    };
  }

  // Default recommendation presentation
  return {
    question: `Based on your exact criteria, I have shortlisted matching verified listings from Lyka Realty's portfolio below. Would you like me to arrange an in-person viewing or connect you with ${lead.assigned_agent} for an exclusive walkthrough?`,
    rationale: 'All critical parameters gathered; transitioning lead to viewing / agent consultation.',
    intentCategory: 'Viewing & Shortlist'
  };
}

export function generateNextAdaptiveQuestion(lead: LeadProfile, missing: string[], lastUserText?: string): { nextQuestion: string; rationale: string; intentCategory: string } {
  // 1. If user said hi / hello / greeting
  if (lastUserText && isGreetingMessage(lastUserText)) {
    return {
      nextQuestion: `Hello, and welcome! Thanks for reaching out to Lyka Realty.\n\nWhat brings you to us today? Are you looking to invest, buy, sell, or something else?`,
      rationale: 'Customer sent a greeting. Responded with opening: identify role first.',
      intentCategory: 'Role Identification'
    };
  }

  // 2. If human handoff triggered
  if (lead.human_handoff_required) {
    return {
      nextQuestion: `I'll be delighted to connect you directly with our Lyka Realty senior property advisor, ${lead.assigned_agent}. Would you prefer a quick phone call or WhatsApp message, and what time works best for you?`,
      rationale: 'Customer requested human agent / viewing / negotiation; immediate CRM handoff initiated.',
      intentCategory: 'Human Handoff'
    };
  }

  // 3. Determine next qualification question in sequence
  const { question: nextQualQuestion, rationale, intentCategory } = getNextQualificationQuestion(lead);

  // 4. If user asked a question (Property Database query OR Knowledge question)
  if (lastUserText) {
    if (isPropertyQuery(lastUserText)) {
      const propAnswer = queryPropertyDatabase(lastUserText);
      return {
        nextQuestion: `${propAnswer}\n\nSo, to continue finding the ideal property for you — ${nextQualQuestion}`,
        rationale: 'Answered property database query first with verified database records, then resumed qualification sequence.',
        intentCategory: 'Property Query + ' + intentCategory
      };
    }

    const generalAnswer = queryGeneralKnowledge(lastUserText);
    if (generalAnswer) {
      return {
        nextQuestion: `${generalAnswer}\n\nSo, to continue finding the ideal property for you — ${nextQualQuestion}`,
        rationale: 'Answered user general real estate question first, then resumed qualification sequence.',
        intentCategory: 'Knowledge Query + ' + intentCategory
      };
    }
  }

  // 5. Standard qualification sequence step
  return {
    nextQuestion: nextQualQuestion,
    rationale,
    intentCategory
  };
}
