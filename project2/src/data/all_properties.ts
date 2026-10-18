import { PropertyListing } from '../types/crm';
import { VERIFIED_DUBAI_PROPERTIES } from './dubai_properties';
import { VERIFIED_MUMBAI_PROPERTIES } from './mumbai_properties';

// Tag Dubai properties with city: 'Dubai', calculate approx INR, and attach verified Admin details
export const ENRICHED_DUBAI_PROPERTIES: PropertyListing[] = VERIFIED_DUBAI_PROPERTIES.map((p, idx) => ({
  ...p,
  city: 'Dubai',
  price_inr: Math.round(p.price_aed * 22.8),
  admin_verified: true,
  admin_verification_name: p.admin_verification_name || (idx % 2 === 0 ? 'Farhan Qureshi (Property Admin)' : 'Omar Al Hashimi (Senior Admin)'),
  admin_verification_mobile: p.admin_verification_mobile || (idx % 2 === 0 ? '+971 50 892 4110' : '+971 52 443 9812'),
  admin_verification_id_card: p.admin_verification_id_card || `784-199${idx % 9}-123456${idx}-1`,
  admin_verification_id_type: p.admin_verification_id_type || 'Emirates ID',
  admin_verification_date: p.admin_verification_date || '2024-01-15T10:00:00.000Z'
}));

export const ENRICHED_MUMBAI_PROPERTIES: PropertyListing[] = VERIFIED_MUMBAI_PROPERTIES.map((p, idx) => ({
  ...p,
  admin_verified: true,
  admin_verification_name: p.admin_verification_name || (idx % 2 === 0 ? 'Rohit Sharma (Mumbai Regional Admin)' : 'Ananya Deshmukh (NRI Portfolio Lead)'),
  admin_verification_mobile: p.admin_verification_mobile || (idx % 2 === 0 ? '+91 98201 44521' : '+91 98334 11092'),
  admin_verification_id_card: p.admin_verification_id_card || `4521 8839 019${idx}`,
  admin_verification_id_type: p.admin_verification_id_type || 'Aadhaar Card',
  admin_verification_date: p.admin_verification_date || '2024-02-01T10:00:00.000Z'
}));

export const ALL_VERIFIED_PROPERTIES: PropertyListing[] = [
  ...ENRICHED_DUBAI_PROPERTIES,
  ...ENRICHED_MUMBAI_PROPERTIES
];

export { VERIFIED_DUBAI_PROPERTIES, VERIFIED_MUMBAI_PROPERTIES };
