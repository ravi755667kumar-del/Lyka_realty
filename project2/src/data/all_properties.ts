import { PropertyListing } from '../types/crm';
import { VERIFIED_DUBAI_PROPERTIES } from './dubai_properties';
import { VERIFIED_MUMBAI_PROPERTIES } from './mumbai_properties';

// Tag Dubai properties with city: 'Dubai' and calculate approx INR
export const ENRICHED_DUBAI_PROPERTIES: PropertyListing[] = VERIFIED_DUBAI_PROPERTIES.map(p => ({
  ...p,
  city: 'Dubai',
  price_inr: Math.round(p.price_aed * 22.8)
}));

export const ALL_VERIFIED_PROPERTIES: PropertyListing[] = [
  ...ENRICHED_DUBAI_PROPERTIES,
  ...VERIFIED_MUMBAI_PROPERTIES
];

export { VERIFIED_DUBAI_PROPERTIES, VERIFIED_MUMBAI_PROPERTIES };
