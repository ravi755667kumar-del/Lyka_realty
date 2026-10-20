import { csvCell } from "../src/lib/csv.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import {
  analyze,
  buildListing,
  parseProperty,
  descriptions,
  quality,
  duplicates,
  generateDescriptions,
} from "../backend/listings.js";
const full = {
  property_reference: "SYNTHETIC-1",
  property_type: "Apartment",
  listing_purpose: "Sale",
  community: "Dubai Marina",
  bedrooms: 2,
  bathrooms: 2,
  size_sqft: 1250,
  price_aed: 1350000,
  currency: "AED",
  building_name: "Fictional Building",
  amenities: ["Parking"],
  availability_status: "Vacant",
  contact_name: "Synthetic Agent",
  contact_mobile: "+971500000000",
};
test("unknown fields remain unknown; draft is incomplete", () => {
  const p = buildListing({});
  assert.equal(p.price_aed, null);
  assert.equal(p.bedrooms, null);
  assert(p.missing_fields.includes("price_aed"));
  assert.equal(p.status, "Draft");
});
test("provided invalid numeric fields and unsupported values are rejected", () => {
  for (const x of [
    { price_aed: -1 },
    { price_aed: 0 },
    { size_sqft: 0 },
    { bedrooms: -2 },
    { bathrooms: 1.5 },
    { property_type: "Spaceship" },
    { status: "Anything" },
  ])
    assert.throws(() => parseProperty(x));
});
test("quality totals exactly 100 using documented rules", () => {
  const p = parseProperty({ ...full, ...descriptions(full) });
  const q = quality(p);
  assert.equal(q.score, 100);
  assert.equal(
    q.breakdown.reduce((s, b) => s + b.max, 0),
    100,
  );
  assert.deepEqual(q.missing, []);
});
test("source contradictions and unsupported claims block approval", () => {
  for (const extra of [
    { original_input: "2 bedrooms, 3 bedrooms" },
    { description: "Guaranteed 20% ROI" },
  ])
    assert.throws(() =>
      buildListing({
        ...full,
        ...descriptions(full),
        ...extra,
        status: "Approved",
      }),
    );
});
test("titles and descriptions contain only known fields", () => {
  const d = descriptions({
    property_type: "Apartment",
    community: "Dubai Marina",
    bedrooms: 2,
  });
  assert.equal(d.title, "2-Bedroom Apartment in Dubai Marina");
  assert(!/luxury|pool|ROI|guarantee/i.test(d.description));
  assert(d.description.includes("requires confirmation"));
});
test("duplicate reference and similar listing detection", () => {
  const p = buildListing(full);
  assert.equal(duplicates(parseProperty(full), [p])[0].exact, true);
  assert.equal(
    duplicates(parseProperty({ ...full, property_reference: "OTHER" }), [p])[0]
      .exact,
    false,
  );
  assert.equal(duplicates(parseProperty(full), [p], p.id).length, 0);
});
test("incomplete records cannot advance to review", () =>
  assert.throws(() => buildListing({ status: "Ready for Review" })));
test("AI errors and malformed outputs are rejected, valid normalized facts accepted", async () => {
  const oldKey = process.env.OPENAI_API_KEY,
    oldUrl = process.env.OPENAI_BASE_URL;
  let result: any = full;
  let status = 200;
  const stub = createServer((req, res) => {
    req.resume();
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify(
        status === 200
          ? {
              choices: [
                {
                  message: {
                    content:
                      typeof result === "string"
                        ? result
                        : JSON.stringify(result),
                  },
                },
              ],
            }
          : { error: { message: "Synthetic provider failure" } },
      ),
    );
  });
  await new Promise<void>((resolve) => stub.listen(0, "127.0.0.1", resolve));
  const port = (stub.address() as any).port;
  process.env.OPENAI_API_KEY = "synthetic-local-fixture";
  process.env.OPENAI_BASE_URL = `http://127.0.0.1:${port}/v1`;
  try {
    // The provider must return exactly the extraction contract, not arbitrary listing fields.
    result = {
      property_type: "Apartment",
      listing_purpose: "Sale",
      community: "Dubai Marina",
      building_name: null,
      bedrooms: 2,
      bathrooms: null,
      size_sqft: 1250,
      price_aed: 1350000,
      currency: "AED",
      amenities: ["Parking"],
      view: null,
      availability_status: "Vacant",
    };
    const p = await analyze("2 bedroom apartment, AED 1.35 million, 1250 sqft");
    assert.equal(p.price_aed, 1350000);
    assert.equal(p.bathrooms, null);
    assert(p.original_input.includes("1.35 million"));
    result = "{malformed";
    await assert.rejects(() => analyze("test"), /invalid property data/);
    result = { ...full, price_aed: -1 };
    await assert.rejects(() => analyze("test"), /invalid property data/);
    result = {
      title: "Guaranteed 100% returns",
      short_description: "Pool included",
      description: "Unverified",
    };
    await assert.rejects(
      () => generateDescriptions(full),
      /unsupported content/,
    );
    status = 500;
    await assert.rejects(() => analyze("test"), /AI analysis failed/);
    delete process.env.OPENAI_API_KEY;
    await assert.rejects(() => analyze("test"), /unavailable/);
  } finally {
    oldKey === undefined
      ? delete process.env.OPENAI_API_KEY
      : (process.env.OPENAI_API_KEY = oldKey);
    oldUrl === undefined
      ? delete process.env.OPENAI_BASE_URL
      : (process.env.OPENAI_BASE_URL = oldUrl);
    await new Promise<void>((resolve) => stub.close(() => resolve()));
  }
});

test("CSV output escapes quotes and disables spreadsheet formulas", () => {
  assert.equal(csvCell("=SUM(1,2)"), '"\'=SUM(1,2)"');
  assert.equal(csvCell('quoted \"text\"'), '\"quoted \"\"text\"\"\"');
});
