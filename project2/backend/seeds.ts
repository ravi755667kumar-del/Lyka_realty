import { ALL_VERIFIED_PROPERTIES } from "../src/data/all_properties.js";
import { buildListing, descriptions } from "./listings.js";
export function demoListings() {
  const inputs = ALL_VERIFIED_PROPERTIES.map((p) => ({
    id: p.id,
    title: `Demo: ${p.title}`,
    property_reference: "DEMO-" + p.id,
    community: p.community,
    city: p.city,
    property_type: p.property_type,
    bedrooms: p.bedrooms === "Studio" ? 0 : parseInt(p.bedrooms),
    bathrooms: 2,
    size_sqft: p.size_sqft,
    price_aed: p.price_aed,
    listing_purpose: "Sale",
    status: "Approved",
    availability_status: "Available",
    contact_name: "Demo agent",
    contact_mobile: "+971500000000",
    image_url: p.image_url,
    amenities: p.amenities,
    developer: p.developer,
    is_demo_data: true,
  }));
  for (let i = 1; i <= 4; i++)
    inputs.push({
      ...inputs[i],
      id: `DEMO-EXTRA-${i}`,
      property_reference: `DEMO-EXTRA-${i}`,
      title: `Demo apartment ${i}`,
      building_name: `Fictional Building ${i}`,
    } as any);
  return inputs.map((input) =>
    buildListing({
      ...input,
      ...descriptions(input),
      title: input.title,
      original_input:
        "Fictional demonstration record. Not an actual property offer.",
    }),
  );
}
