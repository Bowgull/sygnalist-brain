-- ============================================================================
-- SYGNALIST DATABASE SCHEMA v1.0
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ============================================================================

-- Enable required extensions
create extension if not exists "uuid-ossp";

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Profiles (migrated from Admin_Profiles sheet)
create table public.profiles (
  id uuid primary key default uuid_generate_v4(),
  auth_user_id uuid unique references auth.users(id) on delete cascade,
  profile_id text unique not null,
  display_name text not null,
  email text,
  role text not null default 'client' check (role in ('admin', 'coach', 'client')),
  status text not null default 'active' check (status in ('active', 'inactive_soft_locked')),
  status_reason text default '',

  -- Work preferences
  accept_remote boolean default true,
  accept_hybrid boolean default false,
  accept_onsite boolean default false,
  remote_region_scope text default 'remote_global',
  preferred_countries text[] default '{}',
  preferred_cities text[] default '{}',
  preferred_locations text[] default '{}',
  current_city text default '',
  distance_range_km integer default 999,
  salary_min integer default 0,

  -- Filters
  banned_keywords text[] default '{}',
  disqualifying_seniority text[] default '{}',
  allow_sales_heavy boolean default true,
  allow_phone_heavy boolean default true,
  allow_weekend_work boolean default true,
  allow_shift_work boolean default true,
  location_blacklist text[] default '{}',

  -- Skills
  skill_keywords_plus text[] default '{}',
  skill_keywords_minus text[] default '{}',
  skill_profile_text text default '',
  top_skills text[] default '{}',
  signature_stories text[] default '{}',

  -- Role tracks and lane controls (JSON)
  role_tracks jsonb default '[]',
  lane_controls jsonb default '{}',
  search_terms_override jsonb default null,

  -- Metadata
  last_fetch_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Inbox jobs (scored, enriched jobs ready for user)
create table public.inbox_jobs (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  score integer not null default 0,
  tier text not null default 'C' check (tier in ('S', 'A', 'B', 'C', 'F', 'X')),
  company text not null,
  title text not null,
  url text,
  source text,
  location text,
  role_type text,
  lane_label text,
  category text,
  job_summary text,
  why_fit text,
  salary text,
  salary_source text,
  salary_below_min boolean default false,
  match_hits integer default 0,
  added_at timestamptz default now()
);

-- Tracker entries (jobs user is actively pursuing)
create table public.tracker_entries (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  company text not null,
  title text not null,
  url text,
  source text,
  location text,
  role_type text,
  lane_label text,
  category text,
  job_summary text,
  why_fit text,
  salary text,
  good_fit text default '',
  good_fit_updated_at timestamptz,
  notes text default '',
  status text not null default 'Prospect',
  stage_changed_at timestamptz default now(),
  date_applied text default '',
  added_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Dismissed jobs (never resurface)
create table public.dismissed_jobs (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  url text,
  company text,
  title text,
  dismissed_at timestamptz default now(),
  unique(profile_id, url)
);

-- ============================================================================
-- JOB BANK TABLES
-- ============================================================================

-- Global Job Bank (shared pool across all profiles)
create table public.global_job_bank (
  id uuid primary key default uuid_generate_v4(),
  url text unique,
  company text,
  title text,
  source text,
  location text,
  work_mode text,
  job_family text,
  description_snippet text,
  job_summary text,
  why_fit text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Role Bank (curated jobs per profile)
create table public.role_bank (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  url text,
  company text,
  title text,
  source text,
  location text,
  work_mode text,
  job_family text,
  description_snippet text,
  job_summary text,
  why_fit text,
  created_at timestamptz default now(),
  unique(profile_id, url)
);

-- Jobs Inbox (email ingest staging)
create table public.jobs_inbox (
  id uuid primary key default uuid_generate_v4(),
  job_id text unique,
  email_received_at timestamptz,
  title text,
  company text,
  url text,
  source text,
  location text,
  work_mode text,
  job_family text,
  description_snippet text,
  job_summary text,
  why_fit text,
  enrichment_status text default 'NEW' check (enrichment_status in ('NEW', 'OUTLIER', 'ENRICHED', 'IN_GLOBAL')),
  missing_fields text,
  role_id text,
  promoted_at timestamptz,
  notes text,
  role_bank_id uuid,
  created_at timestamptz default now()
);

-- Lane Role Bank (role taxonomy)
create table public.lane_role_bank (
  id uuid primary key default uuid_generate_v4(),
  lane_key text not null,
  role_name text not null,
  aliases text[] default '{}',
  is_active boolean default true,
  status text default 'active' check (status in ('active', 'pending', 'merged', 'hidden')),
  role_slug text,
  source text default 'manual',
  merged_into_id uuid references public.lane_role_bank(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enrichment cache (shared AI results by job URL)
create table public.enrichment_cache (
  id uuid primary key default uuid_generate_v4(),
  url text unique not null,
  job_summary text,
  raw_response jsonb,
  model text,
  created_at timestamptz default now(),
  expires_at timestamptz default (now() + interval '7 days')
);

-- ============================================================================
-- MESSAGE HUB TABLES
-- ============================================================================

create table public.message_templates (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  subject text not null,
  body text not null,
  ai_prompt_hint text,
  trigger_event text check (trigger_event in (null, 'interview_reached', 'weekly_digest', 'offer_reached')),
  is_system boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.sent_messages (
  id uuid primary key default uuid_generate_v4(),
  coach_id uuid not null references public.profiles(id),
  client_id uuid not null references public.profiles(id),
  template_id uuid references public.message_templates(id),
  subject text not null,
  body text not null,
  trigger_event text,
  tracker_entry_id uuid references public.tracker_entries(id),
  sent_at timestamptz default now()
);

-- ============================================================================
-- EVENT TRACKING & LOGGING TABLES
-- ============================================================================

-- User events (every user action)
create table public.user_events (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

-- Job fetch logs
create table public.job_fetch_logs (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid references public.profiles(id) on delete set null,
  batch_id text,
  source_name text not null,
  search_term text,
  jobs_returned integer default 0,
  jobs_after_dedupe integer,
  jobs_scored integer,
  jobs_enriched integer,
  success boolean default true,
  error_message text,
  duration_ms integer,
  request_id text,
  created_at timestamptz default now()
);

-- Error logs
create table public.error_logs (
  id uuid primary key default uuid_generate_v4(),
  severity text not null default 'error' check (severity in ('info', 'warning', 'error', 'critical')),
  source_system text not null,
  message text not null,
  stack_trace text,
  user_id uuid references public.profiles(id) on delete set null,
  request_id text,
  metadata jsonb default '{}',
  resolved boolean default false,
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

-- Email logs
create table public.email_logs (
  id uuid primary key default uuid_generate_v4(),
  recipient_email text not null,
  recipient_id uuid references public.profiles(id) on delete set null,
  email_type text not null,
  subject text,
  success boolean default true,
  error_message text,
  template_id uuid references public.message_templates(id),
  created_at timestamptz default now()
);

-- Resume parse logs
create table public.resume_parse_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  file_name text,
  file_size integer,
  success boolean default true,
  error_message text,
  openai_response_time_ms integer,
  model text,
  created_at timestamptz default now()
);

-- System health snapshots (every 5 minutes via pg_cron)
create table public.system_health_snapshots (
  id uuid primary key default uuid_generate_v4(),
  statuses jsonb not null,
  created_at timestamptz default now()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Profiles
create index idx_profiles_auth_user on public.profiles(auth_user_id);
create index idx_profiles_profile_id on public.profiles(profile_id);
create index idx_profiles_role on public.profiles(role);
create index idx_profiles_status on public.profiles(status);

-- Inbox
create index idx_inbox_profile on public.inbox_jobs(profile_id);
create index idx_inbox_tier on public.inbox_jobs(tier);
create index idx_inbox_score on public.inbox_jobs(score desc);
create index idx_inbox_added on public.inbox_jobs(added_at desc);

-- Tracker
create index idx_tracker_profile on public.tracker_entries(profile_id);
create index idx_tracker_status on public.tracker_entries(status);
create index idx_tracker_added on public.tracker_entries(added_at desc);

-- Dismissed
create index idx_dismissed_profile on public.dismissed_jobs(profile_id);

-- Global Job Bank
create index idx_gjb_url on public.global_job_bank(url);

-- Enrichment cache
create index idx_enrich_cache_url on public.enrichment_cache(url);
create index idx_enrich_cache_expires on public.enrichment_cache(expires_at);

-- User events
create index idx_user_events_user on public.user_events(user_id);
create index idx_user_events_type on public.user_events(event_type);
create index idx_user_events_created on public.user_events(created_at desc);

-- Fetch logs
create index idx_fetch_logs_profile on public.job_fetch_logs(profile_id);
create index idx_fetch_logs_source on public.job_fetch_logs(source_name);
create index idx_fetch_logs_created on public.job_fetch_logs(created_at desc);
create index idx_fetch_logs_request on public.job_fetch_logs(request_id);

-- Error logs
create index idx_error_logs_severity on public.error_logs(severity);
create index idx_error_logs_source on public.error_logs(source_system);
create index idx_error_logs_resolved on public.error_logs(resolved);
create index idx_error_logs_created on public.error_logs(created_at desc);
create index idx_error_logs_user on public.error_logs(user_id);
create index idx_error_logs_request on public.error_logs(request_id);

-- Email logs
create index idx_email_logs_recipient on public.email_logs(recipient_id);
create index idx_email_logs_created on public.email_logs(created_at desc);

-- Resume logs
create index idx_resume_logs_user on public.resume_parse_logs(user_id);
create index idx_resume_logs_created on public.resume_parse_logs(created_at desc);

-- Health snapshots
create index idx_health_created on public.system_health_snapshots(created_at desc);

-- Sent messages
create index idx_sent_msg_coach on public.sent_messages(coach_id);
create index idx_sent_msg_client on public.sent_messages(client_id);
create index idx_sent_msg_sent on public.sent_messages(sent_at desc);
