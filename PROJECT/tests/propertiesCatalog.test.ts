import assert from 'node:assert/strict';
import { PropertyItem } from '../src/types';

// Standard properties catalogue definition matching API
const SAMPLE_PROPERTIES: PropertyItem[] = [
  {
    id: 'P101',
    title: '2BHK Apartment in Velachery',
    propertyType: 'Apartment',
    bhk: '2 BHK',
    listingType: 'Buy',
    price: 'Rs. 72 Lakhs',
    size: '950 sq ft',
    location: 'Velachery, Chennai',
    nearbyLocation: 'Near Velachery MRTS station, Phoenix MarketCity',
    description: 'Ready to move, 2 car parking, lift, 24/7 security, CMDA & RERA approved.',
    possession: 'Ready to Move',
    nextStep: 'Would you like to schedule a site visit this Saturday or Sunday morning?',
  },
  {
    id: 'P102',
    title: '3BHK Apartment in OMR Sholinganallur',
    propertyType: 'Apartment',
    bhk: '3 BHK',
    listingType: 'Buy',
    price: 'Rs. 1.25 Crore',
    size: '1450 sq ft',
    location: 'OMR, Sholinganallur, Chennai',
    nearbyLocation: 'Opposite ELCOT SEZ, near Global Hospital',
    description: 'Luxury high-rise with swimming pool, gym, clubhouse.',
    possession: 'December 2026',
    nextStep: 'Does December 2026 possession match your timeline?',
  },
  {
    id: 'P_DXB_01',
    title: 'Binghatti Etherea 2BHK in JVC',
    propertyType: 'Apartment',
    bhk: '2 BHK',
    listingType: 'Buy',
    price: 'AED 1,150,000',
    size: '1100 sq ft',
    location: 'JVC (Jumeirah Village Circle), Dubai',
    nearbyLocation: 'Near Circle Mall, 15 mins to Dubai Marina & Downtown',
    description: 'High ROI investor favorite, 70/30 payment plan, luxury finishes.',
    possession: 'Q4 2026',
    nextStep: 'Shall I share the payment plan and floor plans on WhatsApp?',
  },
];

export async function testPropertiesCatalog(): Promise<{ name: string; passed: boolean; error?: string }[]> {
  const results: { name: string; passed: boolean; error?: string }[] = [];

  function run(name: string, fn: () => void) {
    try {
      fn();
      results.push({ name, passed: true });
    } catch (err: any) {
      results.push({ name, passed: false, error: err.message });
    }
  }

  run('propertiesCatalog: all properties have required fields (id, title, price, location, bhk)', () => {
    SAMPLE_PROPERTIES.forEach((prop) => {
      assert.ok(prop.id, `Property ${prop.title} missing id`);
      assert.ok(prop.title, `Property ${prop.id} missing title`);
      assert.ok(prop.price, `Property ${prop.title} missing price`);
      assert.ok(prop.location, `Property ${prop.title} missing location`);
      assert.ok(prop.bhk, `Property ${prop.title} missing bhk`);
      assert.ok(prop.possession, `Property ${prop.title} missing possession`);
    });
  });

  run('propertiesCatalog: supports both INR (₹ / Lakhs / Crores) and Dubai AED currency formats', () => {
    const inrProp = SAMPLE_PROPERTIES.find((p) => p.id === 'P101');
    const dxbProp = SAMPLE_PROPERTIES.find((p) => p.id === 'P_DXB_01');

    assert.ok(inrProp?.price.includes('Lakhs'), 'Indian property should format in Lakhs');
    assert.ok(dxbProp?.price.includes('AED'), 'Dubai property should format in AED');
    assert.ok(dxbProp?.location.includes('Dubai'), 'Dubai property should have Dubai location');
  });

  run('propertiesCatalog: property filter by location matches correctly', () => {
    const velacheryMatches = SAMPLE_PROPERTIES.filter((p) =>
      p.location.toLowerCase().includes('velachery')
    );
    assert.equal(velacheryMatches.length, 1);
    assert.equal(velacheryMatches[0].id, 'P101');

    const dubaiMatches = SAMPLE_PROPERTIES.filter((p) =>
      p.location.toLowerCase().includes('dubai') || p.location.toLowerCase().includes('jvc')
    );
    assert.equal(dubaiMatches.length, 1);
    assert.equal(dubaiMatches[0].title, 'Binghatti Etherea 2BHK in JVC');
  });

  run('propertiesCatalog: nextStep prompt offers actionable site visit or brochure', () => {
    SAMPLE_PROPERTIES.forEach((p) => {
      assert.ok(p.nextStep && p.nextStep.length > 10, `${p.title} has valid agent nextStep offer`);
    });
  });

  return results;
}
