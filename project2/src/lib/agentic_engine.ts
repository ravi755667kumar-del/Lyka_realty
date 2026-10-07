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

  // Intent detection - detect role first per PDF with more robust matching
  const investKeywords = ['invest', 'investment', 'roi', 'yield', 'capital appreciation', 'buy and hold', 'rental income', 'passive income', 'golden visa', 'flip', 'flipping', 'developer project', 'off-plan'];
  const sellKeywords = ['sell', 'selling', 'list my property', 'list property', 'put on market', 'dispose', 'divest', 'estate sale', 'need to sell', 'want to sell'];
  const buyKeywords = ['buy', 'purchase', 'acquire', 'shopping for', 'looking to buy', 'want to buy', 'need to buy', 'first home', 'first-time buyer', 'end user', 'end-user', 'primary residence', 'vacation home', 'second home'];
  const rentKeywords = ['rent', 'lease', 'tenant', 'monthly', 'renting', 'looking to rent', 'want to rent', 'short-term rental', 'furnished rental', 'holiday let'];
  const otherKeywords = ['partner', 'collaboration', 'media', 'press', 'journalist', 'blogger', 'influencer', 'agent', 'broker', 'developer', 'supplier', 'service provider', 'contractor', 'maintenance', 'property management'];

  const hasInvest = investKeywords.some(kw => lower.includes(kw));
  const hasSell = sellKeywords.some(kw => lower.includes(kw));
  const hasBuy = buyKeywords.some(kw => lower.includes(kw));
  const hasRent = rentKeywords.some(kw => lower.includes(kw));
  const hasOther = otherKeywords.some(kw => lower.includes(kw));

  if (hasSell) {
    extracted.intent = 'Sell';
    extracted.customer_type = 'Seller';
  } else if (hasInvest) {
    extracted.intent = 'Invest';
    extracted.purpose = 'Investment';
    extracted.customer_type = 'Investor';
  } else if (hasRent) {
    extracted.intent = 'Rent';
    extracted.customer_type = 'Tenant/Renter';
  } else if (hasBuy) {
    extracted.intent = 'Buy';
    if (!currentLead.customer_type || currentLead.customer_type === 'Tenant/Renter') {
      extracted.customer_type = 'First-time buyer';
    }
  } else if (hasOther) {
    extracted.customer_type = 'Other stakeholder';
  }

  // Seller specific fields
  if (lower.includes('asking price') || lower.includes('ask price') || lower.includes('selling for')) {
    const priceMatch = text.match(/(?:asking price|ask price|selling for)\s*(?:aed|inr|rs|₹)?\s*([1-9]\d{5,8})/i);
    if (priceMatch && priceMatch[1]) {
      extracted.asking_price = parseInt(priceMatch[1], 10);
    }
  }

  // Current situation / motivation detection
  if (lower.includes('relocating') || lower.includes('moving abroad') || lower.includes('downsizing') || lower.includes('upgrading') || lower.includes('change of plans')) {
    extracted.current_situation = lower.includes('relocating') ? 'Relocating' 
      : lower.includes('moving abroad') ? 'Moving abroad'
      : lower.includes('downsizing') ? 'Downsizing'
      : lower.includes('upgrading') ? 'Upgrading'
      : 'Change of plans';
  }

  if (lower.includes('quick sale') || lower.includes('fast sale') || lower.includes('need to sell fast')) {
    extracted.motivation = 'Quick sale needed';
  } else if (lower.includes('max return') || lower.includes('maximum return') || lower.includes('best price') || lower.includes('highest price')) {
    extracted.motivation = 'Maximize return';
  } else if (lower.includes('estate clearance') || lower.includes('family decision') || lower.includes('inherited')) {
    extracted.motivation = 'Estate/inherited property';
  }

  // Other stakeholder fields
  if (lower.includes('inquiry') || lower.includes('question') || lower.includes('interested in')) {
    extracted.inquiry_reason = text;
  }

  if (lower.includes('help with') || lower.includes('looking to') || lower.includes('need help')) {
    extracted.how_can_help = text;
  }

  // Investor experience level
  if (lower.includes('first time investor') || lower.includes('beginner investor') || lower.includes('new to investing')) {
    extracted.experience_level = 'Beginner';
  } else if (lower.includes('experienced investor') || lower.includes('seasoned investor') || lower.includes('multiple properties')) {
    extracted.experience_level = 'Experienced';
  } else if (lower.includes('professional investor') || lower.includes('portfolio') || lower.includes('institutional')) {
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
    if (lower.includes(kw)) {
      if (!detectedCommunities.includes(info.name)) {
        detectedCommunities.push(info.name);
      }
      if (info.city === 'Mumbai') hasMumbai = true;
      if (info.city === 'Dubai') hasDubai = true;
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
    if (lower.includes(kw)) {
      extracted.property_type = type;
      break;
    }
  }

  // Bedrooms
  if (lower.includes('studio')) {
    extracted.bedrooms = 'Studio';
  } else {
    const bedMatch = text.match(/(\d+)\s*(?:br|bed|bedroom|bhk|beds|bedrooms)/i);
    if (bedMatch && bedMatch[1]) {
      extracted.bedrooms = bedMatch[1];
    } else if (lower.includes('one bed') || lower.includes('1 bed') || lower.includes('single bedroom')) {
      extracted.bedrooms = '1';
    } else if (lower.includes('two bed') || lower.includes('2 bed') || lower.includes('two bedroom')) {
      extracted.bedrooms = '2';
    } else if (lower.includes('three bed') || lower.includes('3 bed') || lower.includes('three bedroom')) {
      extracted.bedrooms = '3';
    } else if (lower.includes('four bed') || lower.includes('4 bed') || lower.includes('four bedroom')) {
      extracted.bedrooms = '4';
    }
  }

  // Ready vs Off-plan
  if (lower.includes('off-plan') || lower.includes('offplan') || lower.includes('off plan') || lower.includes('under construction') || lower.includes('payment plan') || lower.includes('developer') || lower.includes('launch')) {
    extracted.ready_or_offplan = 'Off-plan';
  } else if (lower.includes('ready') || lower.includes('immediate move') || lower.includes('vacant') || lower.includes('ready to move') || lower.includes('move-in ready') || lower.includes('completed') || lower.includes('handover')) {
    extracted.ready_or_offplan = 'Ready';
  }

  // Purpose
  if (lower.includes('own use') || lower.includes('myself') || lower.includes('family') || lower.includes('relocating') || lower.includes('primary home') || lower.includes('primary residence') || lower.includes('living in')) {
    extracted.purpose = 'Own use';
  } else if (lower.includes('investment') || lower.includes('rental income') || lower.includes('high roi') || lower.includes('capital growth') || lower.includes('rental yield') || lower.includes('for rent') || lower.includes('to let')) {
    extracted.purpose = 'Investment';
  }

  // Financing
  if (lower.includes('mortgage') || lower.includes('bank loan') || lower.includes('financing') || lower.includes('finance') || lower.includes('home loan') || lower.includes('property loan')) {
    extracted.financing = 'Mortgage';
  } else if (lower.includes('cash') || lower.includes('ready funds') || lower.includes('cash buyer') || lower.includes('cash purchase') || lower.includes('no loan')) {
    extracted.financing = 'Cash';
  }

  // Timeline
  if (lower.includes('immediately') || lower.includes('asap') || lower.includes('this month') || lower.includes('urgent')) {
    extracted.timeline = 'Immediate (within 1 month)';
  } else if (lower.includes('1-3 months') || lower.includes('couple of months')) {
    extracted.timeline = '1-3 months';
  } else if (lower.includes('end of year') || lower.includes('next year') || lower.includes('6 months')) {
    extracted.timeline = '3-6 months';
  }

  // Renter specific
  if (lower.includes('furnished') && !lower.includes('unfurnished')) {
    extracted.furnishing = 'Furnished';
  } else if (lower.includes('unfurnished')) {
    extracted.furnishing = 'Unfurnished';
  }

  // Human handoff detection
  if (
    lower.includes('human') || 
    lower.includes('talk to an agent') || 
    lower.includes('real person') || 
    lower.includes('call me') || 
    lower.includes('schedule a viewing') || 
    lower.includes('book viewing') || 
    lower.includes('negotiate') || 
    lower.includes('offer price')
  ) {
    extracted.human_handoff_required = true;
    extracted.handoff_reason = lower.includes('viewing') 
      ? 'Customer requested to schedule in-person viewing' 
      : lower.includes('negotiate')
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

  // If strict filtering yields zero matches, return closest top 3 listings to ensure customer is helped
  if (matched.length === 0) {
    matched = dataset.slice(0, 3);
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

export function generateNextAdaptiveQuestion(lead: LeadProfile, missing: string[], lastUserText?: string): { nextQuestion: string; rationale: string; intentCategory: string } {
  // If user said hi / hello / greeting
  if (lastUserText && isGreetingMessage(lastUserText)) {
    return {
      nextQuestion: `Hello, and welcome! Thanks for reaching out to Lyka Realty.\n\nWhat brings you to us today? Are you looking to invest, buy, sell, or something else?`,
      rationale: 'Customer sent a greeting. Responded with PDF-compliant opening: identify role first.',
      intentCategory: 'Role Identification'
    };
  }

  // If human handoff triggered
  if (lead.human_handoff_required) {
    return {
      nextQuestion: `I'll be delighted to connect you directly with our Lyka Realty senior property advisor, ${lead.assigned_agent}. Would you prefer a quick phone call or WhatsApp message, and what time works best for you?`,
      rationale: 'Customer requested human agent / viewing / negotiation; immediate CRM handoff initiated.',
      intentCategory: 'Human Handoff'
    };
  }

  // BUY flow: budget -> location -> property type -> bedrooms -> ready/off-plan -> purpose -> timeline
  if (lead.intent === 'Buy') {
    if (!lead.budget_max) {
      return {
        nextQuestion: lead.is_nri 
          ? `What price bracket or maximum budget in AED or INR (Crores) are you comfortable exploring? (For example, AED 1.5M - 3M / INR 3.5 Cr - 7 Cr)`
          : `What price bracket or maximum budget in AED are you comfortable exploring for your purchase? (For example, AED 1.5M - 2.5M, or AED 5M+)`,
        rationale: 'Budget determines accessible locations, property tiers, and ready vs off-plan inventory.',
        intentCategory: 'Budget Qualification'
      };
    }
    if (!lead.preferred_communities || lead.preferred_communities.length === 0) {
      return {
        nextQuestion: lead.target_city === 'Mumbai'
          ? `Which prime Mumbai localities do you prefer? (e.g. Worli, Bandra West, Juhu, BKC, or Powai)`
          : `Do you have preferred communities in mind? For Dubai: Dubai Marina, Downtown, Palm Jumeirah, or Dubai Hills Estate; or prime Mumbai corridors: Worli, Bandra, or Juhu?`,
        rationale: 'Location is the primary filtering parameter for verified listings.',
        intentCategory: 'Location Preference'
      };
    }
    if (!lead.property_type) {
      return {
        nextQuestion: `Are you envisioning an apartment, a townhouse, a standalone villa, or perhaps a luxury penthouse?`,
        rationale: 'Property type refines layout, service charge profile, and lifestyle suitability.',
        intentCategory: 'Property Type'
      };
    }
    if (!lead.bedrooms) {
      return {
        nextQuestion: `How many bedrooms would best accommodate you or your rental guests (e.g. 1BR, 2BR, 3BR+)?`,
        rationale: 'Bedrooms dictate unit size and rental yield dynamics.',
        intentCategory: 'Bedrooms'
      };
    }
    if (!lead.ready_or_offplan) {
      return {
        nextQuestion: `Would you prefer a ready property available for immediate move-in/rental, or an off-plan project with flexible developer payment plans?`,
        rationale: 'Determines whether client seeks immediate rental returns or construction capital appreciation.',
        intentCategory: 'Ready vs Off-Plan'
      };
    }
    if (!lead.financing) {
      return {
        nextQuestion: `Will this purchase be made via ready cash funds, or are you considering UAE bank mortgage financing?`,
        rationale: 'Mortgage requires pre-approval assessment; cash transactions proceed rapidly with title deed transfer.',
        intentCategory: 'Financing'
      };
    }
    if (!lead.timeline) {
      return {
        nextQuestion: `What is your ideal purchase timeframe (e.g. within 30 days, 1-3 months, or planning ahead for later this year)?`,
        rationale: 'Timeline establishes lead priority and scheduling readiness.',
        intentCategory: 'Timeline'
      };
    }
  }

  // RENT flow: rental budget -> location -> property type -> bedrooms -> furnishing -> move-in date
  if (lead.intent === 'Rent') {
    if (!lead.budget_max) {
      return {
        nextQuestion: `What is your targeted annual or monthly rental budget in AED? (For example, AED 100,000/yr or AED 15,000/month)`,
        rationale: 'Rental budget defines community tiers and cheque payment feasibility.',
        intentCategory: 'Rental Budget'
      };
    }
    if (!lead.preferred_communities || lead.preferred_communities.length === 0) {
      return {
        nextQuestion: `Which neighborhood in Dubai would you prefer to call home? (e.g. Dubai Marina, JLT, Business Bay, or Downtown)`,
        rationale: 'Location proximity to work and transport is crucial for renters.',
        intentCategory: 'Location'
      };
    }
    if (!lead.bedrooms) {
      return {
        nextQuestion: `How many bedrooms are you seeking, and do you prefer fully furnished or unfurnished?`,
        rationale: 'Furnishing status and bedroom count determine move-in readiness.',
        intentCategory: 'Bedrooms & Furnishing'
      };
    }
    if (!lead.timeline && !lead.move_in_date) {
      return {
        nextQuestion: `When would you like to move in, and how many cheques would you prefer to pay your lease with?`,
        rationale: 'Move-in date allows shortlisting currently vacant or expiring tenancy units.',
        intentCategory: 'Move-in Timeline'
      };
    }
  }

  // INVEST flow: investment budget -> objective -> location -> property type -> horizon -> ready/off-plan
  if (lead.intent === 'Invest') {
    if (!lead.budget_max) {
      return {
        nextQuestion: `What is your total capital allocation or investment budget in AED? (For example, AED 1M for high yield, or AED 2M+ for UAE Golden Visa eligibility)`,
        rationale: 'Investment bracket determines Golden Visa eligibility and portfolio yield strategy.',
        intentCategory: 'Investment Budget'
      };
    }
    if (!lead.purpose && !lead.investment_goal) {
      return {
        nextQuestion: `Is your primary objective maximizing annual rental yield (cash flow) or long-term capital appreciation before handover?`,
        rationale: 'Yield vs capital appreciation drives ready (e.g., JVC/Marina 8%+) vs off-plan (Creek Harbour/Islands).',
        intentCategory: 'Investment Goal'
      };
    }
    if (!lead.ready_or_offplan) {
      return {
        nextQuestion: `Do you prefer off-plan opportunities with 1% monthly or post-handover payment plans, or ready tenanted units generating immediate income?`,
        rationale: 'Cash flow timing preference determines asset class recommendation.',
        intentCategory: 'Asset Selection'
      };
    }
  }

  // Default recommendation presentation
  return {
    nextQuestion: `Based on your exact criteria, I have shortlisted matching verified listings from Lyka Realty's portfolio below. Would you like me to arrange an in-person viewing or connect you with ${lead.assigned_agent} for an exclusive walkthrough?`,
    rationale: 'All critical parameters gathered; transitioning lead to viewing / agent consultation.',
    intentCategory: 'Viewing & Shortlist'
  };
}
