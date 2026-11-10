export type LeadStatus =
  | 'Pending'
  | 'Calling'
  | 'Completed'
  | 'No Answer'
  | 'PENDING'
  | 'CALLING'
  | 'COMPLETED'
  | 'FAILED';

export type LeadOutcome = 
  | 'HOT' 
  | 'WARM' 
  | 'COLD' 
  | 'OPT-OUT' 
  | 'NO_ANSWER' 
  | 'AGENT_CALLBACK' 
  | 'PENDING';

export interface LeadQAItem {
  id?: string;
  stepNumber?: number;
  stepTitle?: string;
  question: string;
  answer: string;
  extractedKey?: string;
  extractedValue?: string;
  isCustomerQuestion?: boolean;
  timestamp?: string;
}

export interface Lead {
  id: string;
  name: string;
  phone: string;
  consent: boolean;
  blocked: boolean;
  status: LeadStatus | string;
  language?: string;
  outcome?: LeadOutcome;
  lastCallId?: string;
  callCount?: number;
  callTime?: string;
  duration?: number;
  transcript?: string;
  summary?: string;
  buyerOrInvestor?: 'buyer' | 'investor' | 'both' | 'unspecified';
  budget?: string;
  location?: string;
  timeline?: string;
  nextAction?: string;
  recordingReference?: string;
  vapiCallId?: string;
  qaHistory?: LeadQAItem[];
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CallRecord {
  id?: string;
  customerId: string;
  name: string;
  phone: string;
  language: string;
  status: string;
  outcome: string;
  startedAt: string;
  endedAt: string;
  duration: number;
  qualification: {
    interested: string;
    buyerOrInvestor: string;
    budget?: string;
    location?: string;
    timeline?: string;
  };
  summary?: string;
  transcript?: string;
  recordingReference?: string;
  qaHistory?: LeadQAItem[];
  noAnswer?: boolean;
}

export interface CampaignState {
  id: string;
  name: string;
  isRunning: boolean;
  activeLeadId?: string | null;
  activeLeadName?: string | null;
  activeLeadPhone?: string | null;
  totalLeads: number;
  completedCalls: number;
  hotCount: number;
  warmCount: number;
  coldCount: number;
  optOutCount: number;
  noAnswerCount: number;
  agentCallbackCount: number;
  lastUpdated?: string;
}

export interface PropertyItem {
  id: string;
  title: string;
  propertyType: 'Apartment' | 'Villa' | 'Individual House' | 'Plot' | 'Commercial' | string;
  bhk?: string;
  listingType: 'Buy' | 'Rent' | 'Plot' | string;
  price: string;
  size?: string;
  location: string;
  nearbyLocation: string; // Landmarks, metro, schools, hospitals, distance
  description: string;    // Detailed amenities, approvals, facing, parking
  possession?: string;    // e.g. "Ready to Move" or "Dec 2026"
  nextStep?: string;      // Question agent asks customer, e.g. "Site visit arrange pannalaama?"
  createdAt?: string;
}

export interface KnowledgeDoc {
  id: string;
  title: string;
  category: string;
  content: string;
  createdAt: string;
}

export interface GeminiConfig {
  apiKeyConfigured: boolean;
  voice?: string;
}

export interface GroqConfig {
  apiKeyConfigured: boolean;
  voice?: string;
}

export interface OpenAIConfig {
  apiKeyConfigured: boolean;
  keyPreview?: string;
  ttsModel?: string;
  sttModel?: string;
  chatModel?: string;
  voice?: string;
}

export interface SessionMemory {
  leadName?: string;
  preferredLanguage?: string;   // 'English' | 'Tamil-English' | 'Hindi'
  firstUserMessage?: string;    // Verbatim first customer statement/enquiry
  purpose?: string;             // 'Buy' | 'Rent' | 'Investment' | 'Own Use'
  propertyType?: string;        // 'Apartment' | 'Villa' | 'Individual House' | 'Plot' | 'Commercial'
  bhk?: string;                 // '1 BHK' | '2 BHK' | '3 BHK' | '4 BHK'
  budget?: string;              // e.g. 'Rs. 72 Lakhs', 'Under 80L'
  location?: string;            // 'Velachery', 'OMR', 'Tambaram', etc.
  nearbyLandmarks?: string;     // 'Near MRTS', 'Near beach', 'Near ELCOT SEZ'
  timeline?: string;            // 'Ready to Move', 'Immediate', 'Dec 2026'
  loanOrCash?: string;          // 'Home Loan / Bank Loan', 'Self-funded / Cash'
  mustHaves?: string;           // 'Car parking, lift, CMDA approved'
  siteVisitPreference?: string; // 'Saturday 11 AM', 'This weekend'
  callerSentiment?: string;     // 'Interested', 'In a hurry', 'Comparing prices'
  discussedProperties?: string[]; // ['P101 - 2BHK Apartment (Velachery)']
  confirmedFacts?: string[];    // Bullet points of user statements
  lastUpdated?: string;
}
