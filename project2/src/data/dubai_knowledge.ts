import { LykaAgent } from '../types/crm';

export const LYKA_COMPANY_INFO = {
  name: 'Lyka Realty',
  headquarters: 'Office 1402, Marina Plaza, Dubai Marina, Dubai, UAE',
  website: 'https://lykarealty.ae',
  phone: '+971 4 456 7890',
  whatsapp: '+971 50 892 3410',
  email: 'concierge@lykarealty.ae',
  license_number: 'RERA ORN 28419',
  clients_served: '300+ clients across 42 nationalities',
  core_values: ['Local Market Mastery', 'Zero Fabricated Numbers', 'Transparent Negotiation', 'End-to-End Golden Visa & Mortgage Advisory'],
  core_services: [
    'Residential Property Buying & Selling',
    'Long-Term & Short-Term Leasing',
    'Property Investment & ROI Portfolio Strategy',
    'Off-Plan Exclusive Developer Allocations',
    'NRI & Overseas Investor Guidance',
    'Golden Visa Real Estate Certification (AED 2M+)'
  ]
};

export const LYKA_AGENTS: LykaAgent[] = [
  {
    id: 'agent-1',
    name: 'Tariq Al-Mansoor',
    role: 'Principal Luxury & Palm Jumeirah Specialist',
    phone: '+971 50 411 9021',
    email: 'tariq.m@lykarealty.ae',
    languages: ['English', 'Arabic'],
    communities: ['Palm Jumeirah', 'Dubai Islands', 'Downtown Dubai'],
    photo: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=300&q=80',
    active_leads: 14
  },
  {
    id: 'agent-2',
    name: 'Elena Rostova',
    role: 'Senior Investor Advisor & High-Yield Strategist',
    phone: '+971 52 833 4901',
    email: 'elena.r@lykarealty.ae',
    languages: ['English', 'Russian'],
    communities: ['Dubai Marina', 'JLT', 'Business Bay'],
    photo: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=300&q=80',
    active_leads: 19
  },
  {
    id: 'agent-3',
    name: 'Vikram Malhotra',
    role: 'NRI & Overseas Client Director',
    phone: '+971 55 921 7843',
    email: 'vikram.m@lykarealty.ae',
    languages: ['English', 'Hindi', 'Punjabi'],
    communities: ['Dubai Hills Estate', 'Arabian Ranches', 'Dubai Creek Harbour'],
    photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
    active_leads: 23
  },
  {
    id: 'agent-4',
    name: 'Sarah Jenkins',
    role: 'First-Time Buyer & Residential Leasing Lead',
    phone: '+971 58 340 1289',
    email: 'sarah.j@lykarealty.ae',
    languages: ['English', 'French'],
    communities: ['JVC', 'Dubai Marina', 'Downtown Dubai'],
    photo: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=300&q=80',
    active_leads: 11
  }
];

export const DUBAI_COMMUNITIES = [
  {
    name: 'Dubai Marina',
    vibe: 'High-energy waterfront living with yachts, promenade dining, and skyline views.',
    avg_price_sqft: 'AED 1,650 - 2,400',
    avg_rental_yield: '7.2% - 8.2%',
    ideal_for: 'Young professionals, short-term investors, holiday home seekers',
    metro_connected: true
  },
  {
    name: 'Downtown Dubai',
    vibe: 'The cultural and luxury heartbeat of the city surrounding Burj Khalifa and Dubai Mall.',
    avg_price_sqft: 'AED 2,300 - 3,900',
    avg_rental_yield: '6.5% - 7.5%',
    ideal_for: 'High-net-worth individuals, trophy asset investors, corporate executives',
    metro_connected: true
  },
  {
    name: 'Palm Jumeirah',
    vibe: 'World-renowned man-made archipelago offering private beachfront living and penthouses.',
    avg_price_sqft: 'AED 3,200 - 6,500',
    avg_rental_yield: '6.0% - 7.1%',
    ideal_for: 'Ultra-luxury buyers, celebrities, beachfront purists',
    metro_connected: false
  },
  {
    name: 'Business Bay',
    vibe: 'Central commercial and residential canal district immediately adjacent to Downtown.',
    avg_price_sqft: 'AED 1,800 - 2,600',
    avg_rental_yield: '7.8% - 8.8%',
    ideal_for: 'Capital appreciation investors, off-plan purchasers, financial professionals',
    metro_connected: true
  },
  {
    name: 'Dubai Hills Estate',
    vibe: 'Master-planned green haven with championship golf course, mega mall, and schools.',
    avg_price_sqft: 'AED 1,900 - 2,800',
    avg_rental_yield: '6.5% - 7.2%',
    ideal_for: 'Families, end-users, long-term capital preservation',
    metro_connected: false
  },
  {
    name: 'JVC (Jumeirah Village Circle)',
    vibe: 'Value-oriented, high-yield residential community with strong tenant demand.',
    avg_price_sqft: 'AED 1,050 - 1,450',
    avg_rental_yield: '8.2% - 9.4%',
    ideal_for: 'Yield-focused investors, entry-level buyers, budget renters',
    metro_connected: false
  },
  {
    name: 'Dubai Creek Harbour',
    vibe: 'Futuristic island-sanctuary with marina, island park, and stunning Downtown views.',
    avg_price_sqft: 'AED 1,900 - 2,700',
    avg_rental_yield: '7.0% - 8.0%',
    ideal_for: 'Off-plan investors, modern waterfront lifestyle seekers',
    metro_connected: false
  },
  {
    name: 'Arabian Ranches',
    vibe: 'Premier established villa community with tree-lined streets and equestrian vibe.',
    avg_price_sqft: 'AED 1,400 - 2,100',
    avg_rental_yield: '6.2% - 6.8%',
    ideal_for: 'Expat families, tranquil suburban living with gardens',
    metro_connected: false
  }
];

export const DUBAI_PURCHASE_FEES = {
  dld_fee: '4% of property purchase price (paid to Dubai Land Department)',
  dld_admin_fee: 'AED 580 for apartments/villas, AED 40 for land/off-plan',
  trustee_registration_fee: 'AED 4,000 + 5% VAT (for properties AED 500k+)',
  agency_commission: '2% + 5% VAT of purchase price',
  mortgage_registration_fee: '0.25% of loan amount + AED 290 admin fee',
  noc_fee_developer: 'AED 1,000 - 5,000 + VAT (paid to developer for No Objection Certificate)'
};

export const NRI_MUMBAI_DUBAI_CORRIDOR = {
  overview: 'Lyka Realty provides specialized advisory for NRIs and overseas clients investing from Mumbai and India into Dubai real estate, as well as managing prime cross-border portfolios in Mumbai (Worli, Bandra, Juhu, BKC, Powai).',
  comparison: [
    { metric: 'Rental Yield (Net)', dubai: '7.5% - 9.4% net yield', mumbai: '2.5% - 3.5% net yield' },
    { metric: 'Tax on Rental Income', dubai: '0% (Tax-Free in UAE)', mumbai: 'Up to 30% slab rate + TDS' },
    { metric: 'Capital Appreciation', dubai: 'High (Infrastructure, D33 economic agenda)', mumbai: 'High (Land scarcity in South/West Mumbai)' },
    { metric: 'Residency / Visa', dubai: '10-Year Golden Visa for AED 2M+ (~4.5 Cr INR)', mumbai: 'Citizenship / OCI' },
    { metric: 'Currency Stability', dubai: 'AED pegged to USD ($1 = AED 3.6725)', mumbai: 'INR fluctuating' },
    { metric: 'Foreign Remittance (LRS)', dubai: 'RBI permits $250,000 USD (~AED 918,000) per individual per financial year', mumbai: 'Direct INR domestic banking' }
  ],
  mumbai_prime_localities: ['Worli', 'Bandra West', 'Juhu', 'Lower Parel', 'BKC', 'Powai', 'Malabar Hill'],
  top_mumbai_developers: ['Lodha (Macrotech)', 'Oberoi Realty', 'Godrej Properties', 'Piramal Realty', 'Rustomjee', 'Kalpataru']
};

export const LYKA_CRM_SPECIFICATION_DOCUMENT = {
  title: 'Lyka Realty — Agentic AI CRM Information Requirements',
  summary: 'Official CRM/AI-agent specification defining information collection rules, investor/renter/buyer attributes, adaptive questioning, and human handoff protocols.',
  sections: [
    { number: 1, title: 'Lyka Realty Business Information', content: 'Dubai-based brokerage with 300+ clients across Dubai. Core services: Buying, renting, leasing, investment guidance for residential and commercial.' },
    { number: 2, title: 'Information to Collect from Every Customer', content: 'Full name, phone/WhatsApp, email, customer_type, intent, preferred_language, current_location, preferred_communities, budget_min/budget_max, property_type, bedrooms, ready_or_offplan, purpose, timeline, must_have_features, exclusions, financing, viewing_preference.' },
    { number: 3, title: 'Additional Information for Investors', content: 'Investment objective, investment horizon, target rental yield, capital appreciation priority, risk profile, ready vs off-plan, available budget, cash vs mortgage, preferred investment communities, local vs overseas/NRI.' },
    { number: 4, title: 'Additional Information for Renters', content: 'Rental budget (monthly/annual), move-in date, lease duration, furnishing, occupants, parking requirement, pet requirement, preferred communities.' },
    { number: 5, title: 'CRM Interaction Information', content: 'Lead ID, Interaction timestamp, Channel, Conversation summary, Requirements extracted, Information still missing, Customer intent confidence, Lead status, Assigned agent, Next action, Follow-up date.' },
    { number: 6, title: 'Lead Qualification Information', content: 'lead_status (New, Contacted, Interested, Qualified, Viewing, Negotiation, Converted, Lost), lead_priority (Low, Medium, High, Urgent), completeness %, engagement level, human_handoff_required.' },
    { number: 7, title: 'Information AI Should NOT Invent', content: 'Never invent property prices, availability, yields, developer claims, company policies, or transaction details.' },
    { number: 8, title: 'Knowledge Hierarchy', content: '1. Lyka Realty internal knowledge; 2. Lyka property inventory; 3. Approved Dubai/Mumbai data; 4. General LLM only when appropriate.' },
    { number: 9, title: 'Agentic AI Flow', content: 'Understand intent -> extract all info -> identify missing -> ask next relevant question -> update CRM in MongoDB/Firebase -> qualify lead -> recommend properties -> schedule follow-up / human handoff.' },
    { number: 10, title: 'Recommended CRM Collections', content: 'leads, interactions, followups, properties, communities, developers, agents, knowledge_base.' },
    { number: 11, title: 'Official Source', content: 'https://lykarealty.ae/ — Official Lyka Realty website.' }
  ]
};

