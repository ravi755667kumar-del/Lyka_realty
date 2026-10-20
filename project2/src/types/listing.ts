export const LISTING_STATUSES = [
  "Draft",
  "Needs Information",
  "Ready for Review",
  "Approved",
  "Published",
] as const;
export const AVAILABILITY = [
  "Unknown",
  "Available",
  "Vacant",
  "Occupied",
  "Reserved",
  "Booked",
  "Sold",
  "Rented",
  "Unavailable",
] as const;
export interface Listing {
  id: string;
  property_reference: string;
  title: string;
  short_description: string;
  description: string;
  original_input: string;
  property_type: string | null;
  listing_purpose: string | null;
  community: string | null;
  city: string;
  building_name: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  size_sqft: number | null;
  price_aed: number | null;
  currency: string;
  amenities: string[];
  features: string[];
  view: string | null;
  status: (typeof LISTING_STATUSES)[number];
  availability_status: (typeof AVAILABILITY)[number];
  contact_name: string;
  contact_mobile: string;
  image_url: string;
  developer: string;
  is_demo_data: boolean;
  is_booked: boolean;
  quality_score: number;
  warnings: string[];
  missing_fields: string[];
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}
export interface Quality {
  score: number;
  breakdown: { label: string; points: number; max: number }[];
  missing: string[];
  warnings: string[];
}
