import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { PropertyItem } from '@/types';
import { invalidatePdfKnowledgeCache, getNeonClient } from '@/lib/neon';
import { requireAuthenticatedApi } from '@/lib/serverAuth';
import { supabaseAdmin, isSupabaseReady } from '@/lib/supabaseUserHistory';

const CUSTOM_PROPS_FILE = path.resolve(process.cwd(), 'datasets', 'custom_properties.json');

// Default verified Chennai properties from guide
const DEFAULT_VERIFIED_PROPERTIES: PropertyItem[] = [
  {
    id: 'P101',
    title: '2BHK Apartment in Velachery',
    propertyType: 'Apartment',
    bhk: '2 BHK',
    listingType: 'Buy',
    price: 'Rs. 72 Lakhs',
    size: '950 sq ft',
    location: 'Velachery, Chennai',
    nearbyLocation: 'Near Velachery MRTS station, Phoenix MarketCity, Grand Square Mall, 15 mins to OMR IT corridor',
    description: 'Ready to move, 2 car parking, lift, 24/7 security, CMDA & RERA approved. Partner bank loan assistance available from SBI, HDFC, and ICICI.',
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
    nearbyLocation: 'Opposite ELCOT SEZ, near Dollar Stop, Global Hospital, PSBB Millennium School, Metro Phase 2 corridor',
    description: 'Luxury high-rise with swimming pool, fully equipped gym, clubhouse, landscaped gardens, 100% power backup, CMDA approved.',
    possession: 'December 2026',
    nextStep: 'Does December 2026 possession match your timeline? Shall I send the brochure on WhatsApp?',
  },
  {
    id: 'P103',
    title: '3BHK Individual House in Tambaram',
    propertyType: 'Individual House',
    bhk: '3 BHK',
    listingType: 'Buy',
    price: 'Rs. 1.6 Crore',
    size: '1800 sq ft built-up (2400 sq ft land)',
    location: 'Tambaram East, Chennai',
    nearbyLocation: 'Near Tambaram Railway Station, MEPZ SEZ, Hindu Mission Hospital, Madras Christian College, GST Highway',
    description: 'East-facing independent villa with private terrace, covered car porch, sweet ground water borewell, CMDA & local approval.',
    possession: 'Ready to Move',
    nextStep: 'Would an East-facing individual house match your family preference? Would you like a walkthrough?',
  },
  {
    id: 'P104',
    title: 'DTCP Approved Residential Plot in Chengalpattu',
    propertyType: 'Plot',
    bhk: 'Plot',
    listingType: 'Plot',
    price: 'Rs. 18 Lakhs',
    size: '1200 sq ft (30 x 40)',
    location: 'Chengalpattu, GST Road, Chennai',
    nearbyLocation: 'Near GST National Highway, Mahindra World City, Chengalpattu Medical College, Chengalpattu Railway Junction',
    description: 'Clear Patta, DTCP and RERA approved gated layout with blacktop 30ft roads, avenue trees, street lights, 24/7 sweet potable water, immediate registration.',
    possession: 'Immediate Registration',
    nextStep: 'Are you looking for immediate villa construction or long-term investment appreciation?',
  },
  {
    id: 'P105',
    title: '1BHK Rental Apartment in Porur',
    propertyType: 'Apartment',
    bhk: '1 BHK',
    listingType: 'Rent',
    price: 'Rs. 14,000 / month',
    size: '550 sq ft',
    location: 'Porur, Chennai',
    nearbyLocation: 'Near DLF IT Park, L&T Infotech, Sri Ramachandra Medical College & Hospital, Porur Roundtana',
    description: 'Semi-furnished with modular kitchen, wardrobes, 24/7 water supply, 3 months security deposit, safe family-friendly gated community.',
    possession: 'Immediate Move-in',
    nextStep: 'When are you planning to shift? Do you work nearby in DLF or Porur?',
  },
  {
    id: 'P106',
    title: '2BHK Rental Apartment in Adyar',
    propertyType: 'Apartment',
    bhk: '2 BHK',
    listingType: 'Rent',
    price: 'Rs. 28,000 / month',
    size: '900 sq ft',
    location: 'Adyar, Chennai',
    nearbyLocation: 'Walkable to Elliot’s Beach Besant Nagar, near Theosophical Society, Gandhi Nagar, IIT Madras, Fortis Malar Hospital',
    description: 'Quiet green avenue, 2 bedrooms with attached bathrooms, balcony facing greenery, pets allowed, covered car parking, 11-month agreement.',
    possession: 'Immediate Move-in',
    nextStep: 'Would you like to inspect the apartment in Adyar this week?',
  },
];

function readCustomProperties(): PropertyItem[] {
  try {
    if (fs.existsSync(CUSTOM_PROPS_FILE)) {
      const raw = fs.readFileSync(CUSTOM_PROPS_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn('[Properties API] Error reading custom properties file:', err);
  }
  return [];
}

function writeCustomProperties(props: PropertyItem[]) {
  try {
    const dir = path.dirname(CUSTOM_PROPS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(CUSTOM_PROPS_FILE, JSON.stringify(props, null, 2), 'utf8');
  } catch (err) {
    console.error('[Properties API] Error writing custom properties file:', err);
  }
}

export async function GET(req: Request) {
  const auth = await requireAuthenticatedApi(req, { rateLimitBucket: 'properties' });
  if (!auth.ok) return auth.response;

  try {
    let supabaseProps: PropertyItem[] = [];
    if (isSupabaseReady && supabaseAdmin) {
      try {
        const { data, error } = await supabaseAdmin
          .from('properties')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && Array.isArray(data) && data.length > 0) {
          supabaseProps = data.map((r: any) => ({
            id: r.id,
            title: r.title,
            propertyType: r.property_type || 'Apartment',
            bhk: r.bhk || '2 BHK',
            listingType: r.listing_type || 'Buy',
            price: r.price,
            size: r.size || '',
            location: r.location,
            nearbyLocation: r.nearby_location || '',
            description: r.description || '',
            possession: r.possession || 'Ready to Move',
            nextStep: r.next_step || '',
            createdAt: r.created_at,
          }));
        }
      } catch (sbErr) {
        console.warn('[Properties API] Supabase properties fetch fallback:', sbErr);
      }
    }

    const custom = readCustomProperties();
    // Prefer Supabase properties when present, otherwise custom local
    const combinedCustom = supabaseProps.length > 0 ? supabaseProps : custom;
    // Prevent duplicate IDs when merging with default verified properties
    const customIds = new Set(combinedCustom.map((p) => p.id));
    const all = [...combinedCustom, ...DEFAULT_VERIFIED_PROPERTIES.filter((p) => !customIds.has(p.id))];

    return NextResponse.json({
      success: true,
      properties: all,
      customCount: combinedCustom.length,
      totalCount: all.length,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireAuthenticatedApi(req, { rateLimitBucket: 'properties' });
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const {
      title,
      propertyType = 'Apartment',
      bhk = '2 BHK',
      listingType = 'Buy',
      price,
      size = '',
      location,
      nearbyLocation = '',
      description = '',
      possession = 'Ready to Move',
      nextStep = '',
    } = body;

    if (!title || !title.trim()) {
      return NextResponse.json({ success: false, message: 'Property title is required.' }, { status: 400 });
    }
    if (!location || !location.trim()) {
      return NextResponse.json({ success: false, message: 'Location is required.' }, { status: 400 });
    }
    if (!price || !price.trim()) {
      return NextResponse.json({ success: false, message: 'Price is required.' }, { status: 400 });
    }

    const newProperty: PropertyItem = {
      id: `prop_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      title: title.trim(),
      propertyType: propertyType.trim(),
      bhk: bhk.trim(),
      listingType: listingType.trim(),
      price: price.trim(),
      size: size.trim(),
      location: location.trim(),
      nearbyLocation: nearbyLocation.trim(),
      description: description.trim() || `${bhk} ${propertyType} in ${location}. Excellent investment opportunity with prime amenities.`,
      possession: possession.trim(),
      nextStep: nextStep.trim() || `Would you like to schedule a site visit to ${title.trim()} this weekend?`,
      createdAt: new Date().toISOString(),
    };

    const currentList = readCustomProperties();
    currentList.unshift(newProperty);
    writeCustomProperties(currentList);

    // Save to Supabase DB if configured
    if (isSupabaseReady && supabaseAdmin) {
      try {
        await supabaseAdmin.from('properties').upsert({
          id: newProperty.id,
          title: newProperty.title,
          property_type: newProperty.propertyType,
          bhk: newProperty.bhk,
          listing_type: newProperty.listingType,
          price: newProperty.price,
          size: newProperty.size,
          location: newProperty.location,
          nearby_location: newProperty.nearbyLocation,
          description: newProperty.description,
          possession: newProperty.possession,
          next_step: newProperty.nextStep,
          created_at: newProperty.createdAt,
          updated_at: new Date().toISOString(),
        });
      } catch (sbErr) {
        console.warn('[Properties API] Supabase property insert note:', sbErr);
      }
    }

    // Invalidate in-memory knowledge cache so AI immediately queries this new property
    invalidatePdfKnowledgeCache();

    // Optionally sync into Neon DB pdf_knowledge table if configured
    const sql = getNeonClient();
    if (sql) {
      try {
        const fullContent = `Property: ${newProperty.title}
Location: ${newProperty.location}
Nearby Landmarks: ${newProperty.nearbyLocation}
Price: ${newProperty.price}
Configuration: ${newProperty.bhk}
Type: ${newProperty.propertyType}
Size: ${newProperty.size}
Possession: ${newProperty.possession}
Description: ${newProperty.description}`;

        await sql`
          INSERT INTO public.pdf_knowledge (
            id, document_source, language, category, title,
            scenario_trigger, agent_reply, next_step, keywords, raw_content
          ) VALUES (
            ${`custom_prop_${newProperty.id}`},
            'Lyka Realty Custom Inventory',
            'Tamil-English / English',
            ${`${newProperty.bhk} ${newProperty.propertyType}`},
            ${`${newProperty.title} (${newProperty.location})`},
            ${`${newProperty.title} / ${newProperty.location} / ${newProperty.nearbyLocation} / ${newProperty.bhk} / ${newProperty.price}`},
            ${`${newProperty.title} in ${newProperty.location}. Price: ${newProperty.price}. Nearby: ${newProperty.nearbyLocation}. Description: ${newProperty.description}.`},
            ${newProperty.nextStep},
            ${`${newProperty.title}, ${newProperty.location}, ${newProperty.nearbyLocation}, ${newProperty.bhk}, ${newProperty.price}`.toLowerCase()},
            ${fullContent}
          )
          ON CONFLICT (id) DO UPDATE SET
            title = EXCLUDED.title,
            agent_reply = EXCLUDED.agent_reply,
            next_step = EXCLUDED.next_step,
            raw_content = EXCLUDED.raw_content;
        `;
      } catch (dbErr) {
        console.warn('[Properties API] Background DB sync note:', dbErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Property added successfully and immediately accessible to AI Agent!',
      property: newProperty,
    });
  } catch (err: any) {
    console.error('[Properties API] Error adding property:', err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const auth = await requireAuthenticatedApi(req, { rateLimitBucket: 'properties' });
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, message: 'Property ID is required.' }, { status: 400 });
    }

    const currentList = readCustomProperties();
    const updated = currentList.filter((p) => p.id !== id);
    writeCustomProperties(updated);
    invalidatePdfKnowledgeCache();

    // Also remove from Supabase DB if configured
    if (isSupabaseReady && supabaseAdmin) {
      try {
        await supabaseAdmin.from('properties').delete().eq('id', id);
      } catch (sbErr) {
        console.warn('[Properties API] Supabase property delete note:', sbErr);
      }
    }

    // Also remove from Neon DB if present
    const sql = getNeonClient();
    if (sql) {
      try {
        await sql`DELETE FROM public.pdf_knowledge WHERE id = ${`custom_prop_${id}`};`;
      } catch (e) { /* ignore */ }
    }

    return NextResponse.json({ success: true, message: 'Property removed successfully.' });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
