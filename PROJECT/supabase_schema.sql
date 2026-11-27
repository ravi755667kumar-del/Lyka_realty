-- ==============================================================================
-- Lyka Realty • Supabase Database Schema
-- Run this in your Supabase SQL Editor: https://app.supabase.com/project/_/sql
-- ==============================================================================

-- 1. Enable UUID Extension
create extension if not exists "uuid-ossp";

-- 2. Create 'leads' Table
create table if not exists public.leads (
  id text primary key,
  name text not null,
  phone text not null,
  consent boolean default true,
  blocked boolean default false,
  status text default 'PENDING',
  language text default 'English',
  outcome text default 'PENDING',
  last_call_id text,
  call_count integer default 0,
  call_time text,
  duration integer default 0,
  transcript text,
  summary text,
  buyer_or_investor text,
  budget text,
  location text,
  timeline text,
  next_action text,
  recording_reference text,
  vapi_call_id text,
  qa_history text,
  created_by text,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- Indexing for leads
create index if not exists idx_leads_status on public.leads(status);
create index if not exists idx_leads_outcome on public.leads(outcome);
create index if not exists idx_leads_phone on public.leads(phone);
create index if not exists idx_leads_created_at on public.leads(created_at desc);

-- 3. Create 'calls' Table
create table if not exists public.calls (
  id text primary key,
  customer_id text,
  name text,
  phone text,
  language text default 'English',
  status text,
  outcome text,
  started_at text,
  ended_at text,
  duration integer default 0,
  qualification jsonb default '{}'::jsonb,
  summary text,
  transcript text,
  recording_reference text,
  qa_history text,
  no_answer boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Indexing for calls
create index if not exists idx_calls_customer on public.calls(customer_id);
create index if not exists idx_calls_started_at on public.calls(started_at desc);

-- 4. Create 'campaigns' Table
create table if not exists public.campaigns (
  id text primary key default 'lyka_cold_call_mvp',
  name text default 'Lyka Realty Outbound Cold-Calling MVP',
  is_running boolean default false,
  active_lead_id text,
  active_lead_name text,
  active_lead_phone text,
  total_leads integer default 0,
  completed_calls integer default 0,
  hot_count integer default 0,
  warm_count integer default 0,
  cold_count integer default 0,
  opt_out_count integer default 0,
  no_answer_count integer default 0,
  agent_callback_count integer default 0,
  last_updated timestamp with time zone default timezone('utc'::text, now())
);

-- Seed initial campaign record
insert into public.campaigns (id, name, is_running)
values ('lyka_cold_call_mvp', 'Lyka Realty Outbound Cold-Calling MVP', false)
on conflict (id) do nothing;

-- 5. Row Level Security (RLS) Configuration
-- Enable RLS on all tables
alter table public.leads enable row level security;
alter table public.calls enable row level security;
alter table public.campaigns enable row level security;

-- Allow read & write access for authenticated users & anon (configured via API key)
create policy "Allow all operations for anon and authenticated on leads"
  on public.leads for all
  using (true)
  with check (true);

create policy "Allow all operations for anon and authenticated on calls"
  on public.calls for all
  using (true)
  with check (true);

create policy "Allow all operations for anon and authenticated on campaigns"
  on public.campaigns for all
  using (true)
  with check (true);

-- 6. Enable Realtime Replication
-- Allows live UI dashboard updates without manual refreshing
alter publication supabase_realtime add table public.leads;
alter publication supabase_realtime add table public.calls;
alter publication supabase_realtime add table public.campaigns;

-- 7. Create 'user_history' Table (Pure TEXT cumulative history grouped by Name and Mobile No)
create table if not exists public.user_history (
  id text primary key,
  name text not null,
  phone text not null,
  total_calls integer default 1,
  last_call_at timestamp with time zone default timezone('utc'::text, now()),
  history_text text not null,
  latest_transcript text,
  qa_pairs_text text,
  summary text,
  qualification_text text,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- Indexing for user_history (Fast lookups by phone and name)
create index if not exists idx_user_history_phone on public.user_history(phone);
create index if not exists idx_user_history_name_phone on public.user_history(name, phone);
create index if not exists idx_user_history_last_call_at on public.user_history(last_call_at desc);

-- RLS Configuration for user_history
alter table public.user_history enable row level security;

create policy "Allow all operations for anon and authenticated on user_history"
  on public.user_history for all
  using (true)
  with check (true);

alter publication supabase_realtime add table public.user_history;

-- 8. Create 'properties' Table (Real Estate Catalog & Inventory)
create table if not exists public.properties (
  id text primary key,
  title text not null,
  property_type text default 'Apartment',
  bhk text default '2 BHK',
  listing_type text default 'Buy',
  price text not null,
  size text default '',
  location text not null,
  nearby_location text default '',
  description text default '',
  possession text default 'Ready to Move',
  next_step text default '',
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- Indexing for properties
create index if not exists idx_properties_location on public.properties(location);
create index if not exists idx_properties_created_at on public.properties(created_at desc);

-- RLS Configuration for properties
alter table public.properties enable row level security;

create policy "Allow all operations for anon and authenticated on properties"
  on public.properties for all
  using (true)
  with check (true);

alter publication supabase_realtime add table public.properties;

-- Seed initial verified Chennai properties
insert into public.properties (id, title, property_type, bhk, listing_type, price, size, location, nearby_location, description, possession, next_step)
values
  ('P101', '2BHK Apartment in Velachery', 'Apartment', '2 BHK', 'Buy', 'Rs. 72 Lakhs', '950 sq ft', 'Velachery, Chennai', 'Near Velachery MRTS station, Phoenix MarketCity, Grand Square Mall, 15 mins to OMR IT corridor', 'Ready to move, 2 car parking, lift, 24/7 security, CMDA & RERA approved. Partner bank loan assistance available from SBI, HDFC, and ICICI.', 'Ready to Move', 'Would you like to schedule a site visit this Saturday or Sunday morning?'),
  ('P102', '3BHK Apartment in OMR Sholinganallur', 'Apartment', '3 BHK', 'Buy', 'Rs. 1.25 Crore', '1450 sq ft', 'OMR, Sholinganallur, Chennai', 'Opposite ELCOT SEZ, near Dollar Stop, Global Hospital, PSBB Millennium School, Metro Phase 2 corridor', 'Luxury high-rise with swimming pool, fully equipped gym, clubhouse, landscaped gardens, 100% power backup, CMDA approved.', 'December 2026', 'Does December 2026 possession match your timeline? Shall I send the brochure on WhatsApp?'),
  ('P103', '3BHK Individual House in Tambaram', 'Individual House', '3 BHK', 'Buy', 'Rs. 1.6 Crore', '1800 sq ft built-up (2400 sq ft land)', 'Tambaram East, Chennai', 'Near Tambaram Railway Station, MEPZ SEZ, Hindu Mission Hospital, Madras Christian College, GST Highway', 'East-facing independent villa with private terrace, covered car porch, sweet ground water borewell, CMDA & local approval.', 'Ready to Move', 'Would an East-facing individual house match your family preference? Would you like a walkthrough?'),
  ('P104', 'DTCP Approved Residential Plot in Chengalpattu', 'Plot', 'Plot', 'Plot', 'Rs. 18 Lakhs', '1200 sq ft (30 x 40)', 'Chengalpattu, GST Road, Chennai', 'Near GST National Highway, Mahindra World City, Chengalpattu Medical College, Chengalpattu Railway Junction', 'Clear Patta, DTCP and RERA approved gated layout with blacktop 30ft roads, avenue trees, street lights, 24/7 sweet potable water, immediate registration.', 'Immediate Registration', 'Are you looking for immediate villa construction or long-term investment appreciation?'),
  ('P105', '1BHK Rental Apartment in Porur', 'Apartment', '1 BHK', 'Rent', 'Rs. 14,000 / month', '550 sq ft', 'Porur, Chennai', 'Near DLF IT Park, L&T Infotech, Sri Ramachandra Medical College & Hospital, Porur Roundtana', 'Semi-furnished with modular kitchen, wardrobes, 24/7 water supply, 3 months security deposit, safe family-friendly gated community.', 'Immediate Move-in', 'When are you planning to shift? Do you work nearby in DLF or Porur?'),
  ('P106', '2BHK Rental Apartment in Adyar', 'Apartment', '2 BHK', 'Rent', 'Rs. 28,000 / month', '900 sq ft', 'Adyar, Chennai', 'Walkable to Elliot’s Beach Besant Nagar, near Theosophical Society, Gandhi Nagar, IIT Madras, Fortis Malar Hospital', 'Quiet green avenue, 2 bedrooms with attached bathrooms, balcony facing greenery, pets allowed, covered car parking, 11-month agreement.', 'Immediate Move-in', 'Would you like to inspect the apartment in Adyar this week?')
on conflict (id) do nothing;

-- 9. Storage Bucket for Voice Recordings
insert into storage.buckets (id, name, public)
values ('voice-recordings', 'voice-recordings', true)
on conflict (id) do update set public = true;

-- Storage Policies for voice-recordings
drop policy if exists "Public Access to voice-recordings" on storage.objects;
create policy "Public Access to voice-recordings"
  on storage.objects for select
  using ( bucket_id = 'voice-recordings' );

drop policy if exists "Allow uploads to voice-recordings" on storage.objects;
create policy "Allow uploads to voice-recordings"
  on storage.objects for insert
  with check ( bucket_id = 'voice-recordings' );

drop policy if exists "Allow updates to voice-recordings" on storage.objects;
create policy "Allow updates to voice-recordings"
  on storage.objects for update
  using ( bucket_id = 'voice-recordings' );

-- 10. Grant table & schema permissions to anon, authenticated, and service_role
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all routines in schema public to anon, authenticated, service_role;

alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on routines to anon, authenticated, service_role;
