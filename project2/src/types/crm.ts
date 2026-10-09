export type CustomerType = 
  | 'First-time buyer'
  | 'NRI/overseas buyer'
  | 'Investor'
  | 'Luxury buyer'
  | 'End-user / Family'
  | 'Tenant/Renter'
  | 'Commercial client'
  | 'Seller'
  | 'Other stakeholder';

export type PropertyIntent = 
  | 'Buy'
  | 'Rent'
  | 'Invest'
  | 'Sell'
  | 'Lease'
  | 'Commercial';

export type PropertyType = 
  | 'Apartment'
  | 'Villa'
  | 'Townhouse'
  | 'Penthouse'
  | 'Commercial / Office';

export type PropertyStatus = 'Ready' | 'Off-plan' | 'Both';

export type LeadStatus = 
  | 'New'
  | 'Contacted'
  | 'Interested'
  | 'Qualified'
  | 'Viewing'
  | 'Negotiation'
  | 'Converted'
  | 'Follow-up'
  | 'Lost';

export type LeadPriority = 'Low' | 'Medium' | 'High' | 'Urgent';

export interface LeadProfile {
  id: string;
  user_id?: string;
  full_name: string;
  phone: string;
  email: string;
  customer_type: CustomerType | string;
  intent: PropertyIntent | string;
  preferred_language: string;
  current_location: string;
  target_city?: 'Dubai' | 'Mumbai' | 'Both';
  is_nri?: boolean;
  budget_currency?: 'AED' | 'INR' | 'USD';
  preferred_communities: string[];
  budget_min: number | null;
  budget_max: number | null;
  property_type: PropertyType | string;
  bedrooms: string | null;
  ready_or_offplan: PropertyStatus | string;
  purpose: string;
  timeline: string;
  must_have_features: string[];
  exclusions: string[];
  financing: string;
  viewing_preference: string;

  // Seller specific
  asking_price?: number | null;
  current_situation?: string;
  motivation?: string;

  // Other stakeholder specific
  inquiry_reason?: string;
  how_can_help?: string;

  // Investor specific
  investment_goal?: string;
  investment_horizon?: string;
  target_return?: string;
  capital_appreciation_priority?: string;
  risk_profile?: string;
  investment_property_status?: string;
  investment_budget?: number | null;
  investment_areas?: string[];
  experience_level?: string;

  // Renter specific
  rental_budget?: number | null;
  move_in_date?: string;
  lease_duration?: string;
  furnishing?: string;
  occupants?: number | null;
  parking_required?: boolean | null;
  pet_requirement?: string;

  // CRM & Qualification
  lead_status: LeadStatus;
  lead_priority: LeadPriority;
  requirement_completeness: number; // 0 to 100
  engagement_level: 'Low' | 'Medium' | 'High';
  human_handoff_required: boolean;
  handoff_reason?: string;
  /** Set when the prospect declines to share contact details (PDF Section 5.3). */
  contact_declined?: boolean;
  /** Which contact slot the agent asked for last, used to detect unusable replies. */
  contact_pending?: 'name' | 'mobile' | 'email';
  contact_recheck_asked?: boolean;
  /**
   * Qualification slots the prospect could not answer ("not sure", "open to
   * suggestions"). Per PDF Section 5.3 these are marked unsure, never re-asked,
   * and excluded from property filters.
   */
  unsure_slots?: string[];
  assigned_agent: string;
  next_action: string;
  follow_up_date: string | null;
  summary: string;
  missing_fields: string[];
  numerical_embedding_id?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  lead_id: string;
  role: 'user' | 'assistant' | 'agent' | 'system';
  content: string;
  timestamp: string;
  provider?: string;
  extracted_data?: Partial<LeadProfile>;
  agentic_decision?: AgenticDecision;
  recommended_properties?: PropertyListing[];
}

export interface AgenticDecision {
  intent_detected: string;
  confidence: number;
  extracted_fields: Record<string, any>;
  still_missing_fields: string[];
  next_question_intent: string;
  rationale: string;
  qualify_score: number;
  handoff_suggested: boolean;
  suggested_action: string;
}

export interface PropertyListing {
  id: string;
  title: string;
  city?: 'Dubai' | 'Mumbai';
  community: string;
  property_type: PropertyType | string;
  bedrooms: string;
  price_aed: number;
  price_inr?: number;
  rental_price_annual_aed?: number;
  rental_price_annual_inr?: number;
  status: PropertyStatus;
  developer: string;
  rera_id?: string;
  size_sqft: number;
  expected_roi?: string;
  handover_date?: string;
  payment_plan?: string;
  amenities: string[];
  image_url: string;
  description: string;
  features: string[];
  coordinates?: { lat: number; lng: number };
}

export interface FollowUpTask {
  id: string;
  lead_id: string;
  customer_name: string;
  reason: string;
  date: string;
  assigned_agent: string;
  action: string;
  status: 'Pending' | 'Completed' | 'Rescheduled';
  priority: 'Low' | 'Medium' | 'High';
  createdAt: string;
}

export interface LykaAgent {
  id: string;
  name: string;
  role: string;
  phone: string;
  email: string;
  languages: string[];
  communities: string[];
  photo: string;
  active_leads: number;
}

export interface MongoEmbeddingRecord {
  _id?: string;
  lead_id?: string;
  text_content: string;
  vector: number[];
  dimensions: number;
  model: string;
  storage?: string;
  metadata: {
    customer_name?: string;
    intent?: string;
    budget_max?: number | null;
    communities?: string[];
  };
  createdAt: string;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}
