import fs from 'fs';
import dotenv from 'dotenv';
import { neon, neonConfig } from '@neondatabase/serverless';
import { customNeonFetch } from '../lib/neonFetch.mjs';

neonConfig.fetchFunction = customNeonFetch;

const env = dotenv.parse(fs.readFileSync('.env'));
const connStr = env.neon_db;

if (!connStr) {
  console.error('neon_db connection string is missing from .env');
  process.exit(1);
}

const sql = neon(connStr);

async function main() {
  console.log('1. Connecting to Neon DB & creating/updating schema...');
  await sql`
    CREATE TABLE IF NOT EXISTS public.pdf_knowledge (
      id TEXT PRIMARY KEY,
      document_source TEXT NOT NULL,
      language TEXT NOT NULL,
      category TEXT,
      title TEXT NOT NULL,
      scenario_trigger TEXT,
      agent_reply TEXT NOT NULL,
      next_step TEXT,
      keywords TEXT,
      raw_content TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `;

  // Ensure next_step column exists if table was created previously without it
  await sql`
    ALTER TABLE public.pdf_knowledge ADD COLUMN IF NOT EXISTS next_step TEXT;
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_pdf_knowledge_lang ON public.pdf_knowledge(language);
  `;

  console.log('2. Loading extracted PDF scenarios & pages...');
  const scenarios = JSON.parse(fs.readFileSync('datasets/extracted_pdf_scenarios.json', 'utf8'));
  const pages = JSON.parse(fs.readFileSync('datasets/extracted_pdf_pages.json', 'utf8'));
  console.log(`Loaded ${scenarios.length} structured scenarios and ${pages.length} pages.`);

  console.log('3. Seeding 41 Structured Dialogue Scenarios into Neon DB...');
  let count = 0;
  for (const s of scenarios) {
    const id = `scenario_${s.id}`;
    await sql`
      INSERT INTO public.pdf_knowledge (
        id, document_source, language, category, title,
        scenario_trigger, agent_reply, next_step, keywords, raw_content
      ) VALUES (
        ${id}, ${s.language + '_Guide.pdf'}, ${s.language}, ${s.category},
        ${s.title}, ${s.trigger}, ${s.agent_reply}, ${s.next_step},
        ${s.keywords}, ${s.trigger + ' -> ' + s.agent_reply + ' [Next: ' + s.next_step + ']'}
      )
      ON CONFLICT (id) DO UPDATE SET
        document_source = EXCLUDED.document_source,
        language = EXCLUDED.language,
        category = EXCLUDED.category,
        title = EXCLUDED.title,
        scenario_trigger = EXCLUDED.scenario_trigger,
        agent_reply = EXCLUDED.agent_reply,
        next_step = EXCLUDED.next_step,
        keywords = EXCLUDED.keywords,
        raw_content = EXCLUDED.raw_content;
    `;
    count++;
  }

  console.log('4. Seeding 16 Extracted PDF Full Pages into Neon DB...');
  for (const p of pages) {
    const id = `page_${p.source.replace(/[^a-zA-Z0-9]/g, '_')}_p${p.page}`;
    const title = `${p.source} - Page ${p.page} (${p.language})`;
    const keywords = `${p.language.toLowerCase()}, scenario, page, guide, rules, positive, negative, objection, flow`;

    await sql`
      INSERT INTO public.pdf_knowledge (
        id, document_source, language, category, title,
        scenario_trigger, agent_reply, next_step, keywords, raw_content
      ) VALUES (
        ${id}, ${p.source}, ${p.language}, ${p.category},
        ${title}, 'Page knowledge & conversational guide',
        ${p.content.slice(0, 800)}, 'Follow conversational flow outlined in this scenario page.',
        ${keywords}, ${p.content}
      )
      ON CONFLICT (id) DO UPDATE SET
        document_source = EXCLUDED.document_source,
        language = EXCLUDED.language,
        category = EXCLUDED.category,
        title = EXCLUDED.title,
        scenario_trigger = EXCLUDED.scenario_trigger,
        agent_reply = EXCLUDED.agent_reply,
        next_step = EXCLUDED.next_step,
        keywords = EXCLUDED.keywords,
        raw_content = EXCLUDED.raw_content;
    `;
    count++;
  }

  console.log('5. Seeding Property Knowledge Base (P101-P106) with Next-Question guidance...');
  const listings = [
    {
      id: 'pdf_listing_p101',
      code: 'P101',
      title: '2BHK Apartment in Velachery',
      language: 'Tamil-English',
      category: '2 BHK Buy',
      trigger: 'Velachery 2BHK flat purchase inquiry / ready to move apartment',
      reply: '2 B-H-K in Velachery, 950 square feet, 72 lakh rupees, ready to move, 2 car parkings, lift, near MRT station. Partner bank loans available from S-B-I, H-D-F-C, and I-C-I-C-I.',
      next_step: 'Ask if they would like to arrange a site visit this weekend (Saturday or Sunday morning).',
      keywords: 'velachery, 2bhk, apartment, flat, 72 lakhs, 950 sq ft, ready to move, car parking, mrt',
      raw: 'P101: 2BHK in Velachery, 950 sq ft, Rs. 72 Lakhs, ready to move, 2 car parking, lift, near MRT station. Partner bank loans available from SBI, HDFC, ICICI.'
    },
    {
      id: 'pdf_listing_p102',
      code: 'P102',
      title: '3BHK Apartment in OMR Sholinganallur',
      language: 'Tamil-English',
      category: '3 BHK Buy',
      trigger: 'OMR Sholinganallur 3BHK flat inquiry / luxury apartment',
      reply: '3 B-H-K in OMR Sholinganallur, 1450 square feet, 1.25 crore rupees, gym, swimming pool, C-M-D-A approved, December 2026 possession.',
      next_step: 'Ask if December 2026 possession fits their timeline, and offer a model flat visit.',
      keywords: 'omr, sholinganallur, 3bhk, 1.25 crore, gym, pool, cmda, it corridor',
      raw: 'P102: 3BHK in OMR Sholinganallur, 1450 sq ft, Rs. 1.25 Crore, gym, swimming pool, CMDA approved, Dec 2026 possession.'
    },
    {
      id: 'pdf_listing_p103',
      code: 'P103',
      title: 'Individual House in Tambaram',
      language: 'Tamil-English',
      category: 'Individual House Buy',
      trigger: 'Tambaram villa or individual house inquiry / independent house',
      reply: 'Individual House in Tambaram, 1800 square feet, 1.6 crore rupees, East facing, 3 bedrooms, new construction with private terrace.',
      next_step: 'Ask if East facing individual house matches their family preference, and invite for a direct walkthrough.',
      keywords: 'tambaram, individual house, villa, 3 bedrooms, 1.6 crore, east facing, terrace',
      raw: 'P103: Individual House in Tambaram, 1800 sq ft, Rs. 1.6 Crore, East facing, 3 bedrooms, new construction.'
    },
    {
      id: 'pdf_listing_p104',
      code: 'P104',
      title: 'DTCP Approved Plot in Chengalpattu',
      language: 'Tamil-English',
      category: 'Plot / Land Buy',
      trigger: 'Chengalpattu residential plot or land inquiry / investment plot',
      reply: 'D-T-C-P Plot in Chengalpattu, 1200 square feet, 18 lakh rupees, clear patta, near G-S-T highway, gated community with sweet ground water.',
      next_step: 'Ask if they are planning immediate construction or looking for long-term investment appreciation.',
      keywords: 'chengalpattu, plot, land, dtcp, patta, 18 lakhs, 1200 sq ft, investment, gst highway',
      raw: 'P104: DTCP Plot in Chengalpattu, 1200 sq ft, Rs. 18 Lakhs, clear patta, near highway, gated community, loan available.'
    },
    {
      id: 'pdf_listing_p105',
      code: 'P105',
      title: '1BHK Rental Apartment in Porur',
      language: 'Tamil-English',
      category: '1 BHK Rent',
      trigger: 'Porur 1BHK rent inquiry / rental flat near DLF IT park',
      reply: '1 B-H-K Rent in Porur, 550 square feet, 14,000 rupees per month, deposit 3 months, near D-L-F I-T Park and Ramachandra Hospital.',
      next_step: 'Ask when they plan to shift and if they work nearby in DLF or Porur.',
      keywords: 'porur, rent, rental, 1bhk, 14000, 14k, dlf, ramachandra, it park',
      raw: 'P105: 1BHK Rent in Porur, 550 sq ft, Rs. 14,000 / month, deposit 3 months, near DLF IT Park.'
    },
    {
      id: 'pdf_listing_p106',
      code: 'P106',
      title: '2BHK Rental Apartment in Adyar',
      language: 'Tamil-English',
      category: '2 BHK Rent',
      trigger: 'Adyar 2BHK rent inquiry / family rental apartment',
      reply: '2 B-H-K Rent in Adyar, 900 square feet, 28,000 rupees per month, family only, pets allowed, quiet green avenue near beach.',
      next_step: 'Ask about their move-in date and if they would like to inspect the apartment this week.',
      keywords: 'adyar, rent, rental, 2bhk, 28000, 28k, family, pets allowed',
      raw: 'P106: 2BHK Rent in Adyar, 900 sq ft, Rs. 28,000 / month, family only, pets allowed.'
    }
  ];

  for (const item of listings) {
    await sql`
      INSERT INTO public.pdf_knowledge (
        id, document_source, language, category, title,
        scenario_trigger, agent_reply, next_step, keywords, raw_content
      ) VALUES (
        ${item.id}, 'Verified_Property_Listings.pdf', ${item.language}, ${item.category},
        ${item.title}, ${item.trigger}, ${item.reply}, ${item.next_step}, ${item.keywords}, ${item.raw}
      )
      ON CONFLICT (id) DO UPDATE SET
        document_source = EXCLUDED.document_source,
        language = EXCLUDED.language,
        category = EXCLUDED.category,
        title = EXCLUDED.title,
        scenario_trigger = EXCLUDED.scenario_trigger,
        agent_reply = EXCLUDED.agent_reply,
        next_step = EXCLUDED.next_step,
        keywords = EXCLUDED.keywords,
        raw_content = EXCLUDED.raw_content;
    `;
    count++;
  }

  // Check total in Neon DB
  const total = await sql`SELECT COUNT(*)::int as count FROM public.pdf_knowledge;`;
  console.log(`\n🎉 SUCCESS! Database updated with new dataset!`);
  console.log(`Total active records in Neon DB pdf_knowledge table: ${total[0].count}`);
}

main().catch(err => {
  console.error('Seeding error:', err);
  process.exit(1);
});
