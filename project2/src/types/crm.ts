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

export type PropertyStatus = 'Ready' | 'Off-plan' | 'Both' | 'Available' | 'Booked';

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
  preferred_community?: string;
  budget_min: number | null;
  budget_max: number | null;
  budget_max_aed?: number | null;
  property_type: PropertyType | string;
  bedrooms: string | null;
  ready_or_offplan: PropertyStatus | string;
  purpose: string;
  timeline: string;
  move_in_timeline?: string;
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
  listing_date?: string;
  available_date?: string;
  expiry_date?: string;
  amenities: string[];
  image_url: string;
  description: string;
  features: string[];
  coordinates?: { lat: number; lng: number };
  contact_name?: string;
  agent_name?: string;
  contact_mobile?: string;
  bathrooms?: string;
  furnished?: string;
  is_booked?: boolean;
  assigned_to?: string;
  assigned_phone?: string;
  assigned_email?: string;
  assigned_id_card?: string;
  assigned_id_type?: string;
  assignment_verified?: boolean;
  assigned_at?: string;
  booked_by_name?: string;
  booked_by_phone?: string;
  booked_by_id_card?: string;
  booked_at?: string;
  booking_amount_aed?: number;
  booking_notes?: string;
  booking_id?: string;
  // Admin Verification Details
  admin_verified?: boolean;
  admin_verification_name?: string;
  admin_verification_mobile?: string;
  admin_verification_id_card?: string;
  admin_verification_id_type?: 'Emirates ID' | 'Aadhaar Card' | 'Passport / Govt ID' | 'Corporate Admin ID' | string;
  admin_verification_date?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface BookedPropertyRecord {
  id: string; // Booking Reference BK-xxxxxx
  property_id: string;
  property_title: string;
  community: string;
  city?: string;
  bedrooms: string;
  price_aed: number;
  property_type?: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  customer_id_card?: string;
  customer_id_type?: string;
  assigned_to?: string;
  assigned_phone?: string;
  assigned_id_card?: string;
  assignment_verified?: boolean;
  booking_amount_aed?: number;
  booked_at: string;
  notes?: string;
  status: 'Booked' | 'Cancelled' | 'Completed';
  lead_id?: string;
  intent?: string;
  target_city?: string;
  budget_max_aed?: number;
  move_in_timeline?: string;
  assigned_agent?: string;
  booking_type?: string;
  updatedAt?: string;
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
  id?: string;
  lead_id?: string;
  section_number?: number;
  title?: string;
  document_name?: string;
  text_content: string;
  vector: number[];
  dimensions: number;
  vector_sum?: number;
  model: string;
  storage?: string;
  metadata?: {
    customer_name?: string;
    intent?: string;
    budget_max?: number | null;
    communities?: string[];
    [key: string]: any;
  };
  createdAt: string;
}

export type FirebaseVectorEmbeddingRecord = MongoEmbeddingRecord;

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

export interface UserProfileData {
  uid: string;
  Name: string;
  Age?: number;
  Email_id: string;
  auth_provider: string;
  phone?: string;
  Phone_number?: string;
  talk_to_agent_requested?: boolean;
  talk_to_agent_time?: string;
  talk_to_agent_reason?: string;
  talk_to_agent_phone?: string;
  createdAt?: string;
  last_login?: string;
  login_history?: string[];
  User_chat?: Record<string, any>;
}

export interface LoginEvent {
  id: string;
  userId: string;
  email: string;
  fullName: string;
  authProvider: string;
  timestamp: string;
  age?: number | null;
}

export interface PortalCredential {
  id: string;
  email: string;
  password?: string;
  role: 'admin' | 'property_manager' | 'sales_manager';
  name?: string;
  phone?: string;
  otp_code?: string;
  otp_created_at?: string;
  updatedAt?: string;
}

export interface DuplicatePropertyPair {
  id: string;
  primaryProperty: PropertyListing;
  duplicateProperties: PropertyListing[];
  confidence: number;
  reason: string;
  matchType: 'exact_title' | 'community_specs' | 'rera_id' | 'image_match';
}

export interface PropertyRequirementIssue {
  field: string;
  label: string;
  severity: 'critical' | 'warning' | 'info';
  description: string;
}

export interface PropertyRequirementAudit {
  property: PropertyListing;
  completenessScore: number;
  criticalIssues: PropertyRequirementIssue[];
  warningIssues: PropertyRequirementIssue[];
  infoIssues: PropertyRequirementIssue[];
  status: 'action_required' | 'incomplete' | 'sales_ready';
}

export interface FavoritePropertyRecord {
  id: string; // fav_{userId || guestId}_{propertyId}
  property_id: string;
  property_title: string;
  property_community: string;
  property_city?: string;
  property_price_aed: number;
  property_price_inr?: number;
  property_bedrooms?: number | string;
  property_type?: string;
  property_image_url?: string;
  property_developer?: string;
  user_id: string;
  user_name: string;
  user_email: string;
  user_phone?: string;
  is_guest: boolean;
  saved_at: string;
  status: 'active' | 'removed';
  updatedAt?: string;
}
