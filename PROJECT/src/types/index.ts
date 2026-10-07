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
    budget: string;
    location: string;
    timeline: string;
  };
  summary: string;
  transcript: string;
  noAnswer: boolean;
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

export interface KnowledgeDoc {
  id: string;
  title: string;
  category: string;
  content: string;
  createdAt: string;
}

export interface VapiConfig {
  apiKeyConfigured: boolean;
  phoneNumberIdConfigured: boolean;
  assistantIdConfigured: boolean;
  phoneNumberId?: string;
  assistantId?: string;
  hasCustomKey?: boolean;
}

export interface SarvamConfig {
  apiKeyConfigured: boolean;
}

export interface GroqConfig {
  apiKeyConfigured: boolean;
}

export type SarvamVoice =
  | 'shreya'   // Female - News/Authoritative
  | 'ishita'   // Female - Entertainment/Dynamic
  | 'pavithra' // Female - Warm/Conversational
  | 'manisha'  // Female - Calm/Professional
  | 'arjun'    // Male   - Confident
  | 'anand';   // Male   - Friendly
