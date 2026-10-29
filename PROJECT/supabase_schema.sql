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
