-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- Run after 001_schema.sql
-- ============================================================================

-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.inbox_jobs enable row level security;
alter table public.tracker_entries enable row level security;
alter table public.dismissed_jobs enable row level security;
alter table public.global_job_bank enable row level security;
alter table public.role_bank enable row level security;
alter table public.jobs_inbox enable row level security;
alter table public.lane_role_bank enable row level security;
alter table public.enrichment_cache enable row level security;
alter table public.message_templates enable row level security;
alter table public.sent_messages enable row level security;
alter table public.user_events enable row level security;
alter table public.job_fetch_logs enable row level security;
alter table public.error_logs enable row level security;
alter table public.email_logs enable row level security;
alter table public.resume_parse_logs enable row level security;
alter table public.system_health_snapshots enable row level security;

-- ============================================================================
-- HELPER: Get current user's profile
-- ============================================================================
create or replace function public.get_my_profile_id()
returns uuid
language sql
stable
security definer
as $$
  select id from public.profiles where auth_user_id = auth.uid() limit 1;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
as $$
  select exists(
    select 1 from public.profiles
    where auth_user_id = auth.uid() and role in ('admin', 'coach')
  );
$$;

-- ============================================================================
-- PROFILES
-- ============================================================================
-- Clients see only their own profile
create policy "Users can view own profile"
  on public.profiles for select
  using (auth_user_id = auth.uid());

-- Admins see all profiles
create policy "Admins can view all profiles"
  on public.profiles for select
  using (public.is_admin());

-- Admins can insert profiles (creating clients)
create policy "Admins can create profiles"
  on public.profiles for insert
  with check (public.is_admin());

-- Admins can update any profile
create policy "Admins can update profiles"
  on public.profiles for update
  using (public.is_admin());

-- Users can update their own non-role fields
create policy "Users can update own profile"
  on public.profiles for update
  using (auth_user_id = auth.uid());

-- ============================================================================
-- INBOX JOBS
-- ============================================================================
create policy "Users see own inbox"
  on public.inbox_jobs for select
  using (profile_id = public.get_my_profile_id());

create policy "Admins see all inbox"
  on public.inbox_jobs for select
  using (public.is_admin());

create policy "Service can manage inbox"
  on public.inbox_jobs for all
  using (true)
  with check (true);

-- ============================================================================
-- TRACKER ENTRIES
-- ============================================================================
create policy "Users see own tracker"
  on public.tracker_entries for select
  using (profile_id = public.get_my_profile_id());

create policy "Users can insert own tracker"
  on public.tracker_entries for insert
  with check (profile_id = public.get_my_profile_id());

create policy "Users can update own tracker"
  on public.tracker_entries for update
  using (profile_id = public.get_my_profile_id());

create policy "Users can delete own tracker"
  on public.tracker_entries for delete
  using (profile_id = public.get_my_profile_id());

create policy "Admins manage all tracker"
  on public.tracker_entries for all
  using (public.is_admin());

-- ============================================================================
-- DISMISSED JOBS
-- ============================================================================
create policy "Users manage own dismissed"
  on public.dismissed_jobs for all
  using (profile_id = public.get_my_profile_id());

create policy "Admins see all dismissed"
  on public.dismissed_jobs for select
  using (public.is_admin());

-- ============================================================================
-- GLOBAL JOB BANK (read: all authenticated, write: admin/service only)
-- ============================================================================
create policy "Authenticated users can read job bank"
  on public.global_job_bank for select
  using (auth.uid() is not null);

create policy "Admins manage job bank"
  on public.global_job_bank for all
  using (public.is_admin());

-- ============================================================================
-- ROLE BANK
-- ============================================================================
create policy "Users see own role bank"
  on public.role_bank for select
  using (profile_id = public.get_my_profile_id());

create policy "Admins manage all role bank"
  on public.role_bank for all
  using (public.is_admin());

-- ============================================================================
-- JOBS INBOX (email ingest — admin only)
-- ============================================================================
create policy "Admins manage jobs inbox"
  on public.jobs_inbox for all
  using (public.is_admin());

-- ============================================================================
-- LANE ROLE BANK (read: all authenticated, write: admin only)
-- ============================================================================
create policy "Authenticated users can read lane bank"
  on public.lane_role_bank for select
  using (auth.uid() is not null);

create policy "Admins manage lane bank"
  on public.lane_role_bank for all
  using (public.is_admin());

-- ============================================================================
-- ENRICHMENT CACHE (read: all authenticated, write: service only)
-- ============================================================================
create policy "Authenticated users can read cache"
  on public.enrichment_cache for select
  using (auth.uid() is not null);

create policy "Service manages cache"
  on public.enrichment_cache for all
  using (true);

-- ============================================================================
-- MESSAGE TEMPLATES (read: admin, write: admin)
-- ============================================================================
create policy "Admins manage templates"
  on public.message_templates for all
  using (public.is_admin());

-- ============================================================================
-- SENT MESSAGES
-- ============================================================================
create policy "Admins see all sent messages"
  on public.sent_messages for all
  using (public.is_admin());

-- ============================================================================
-- LOGGING & ANALYTICS TABLES (admin read, service write)
-- ============================================================================

-- User events: users can insert their own, admins read all
create policy "Users can insert own events"
  on public.user_events for insert
  with check (user_id = public.get_my_profile_id());

create policy "Admins read all events"
  on public.user_events for select
  using (public.is_admin());

-- Fetch logs: admin read only (service inserts via service role key)
create policy "Admins read fetch logs"
  on public.job_fetch_logs for select
  using (public.is_admin());

create policy "Service manages fetch logs"
  on public.job_fetch_logs for insert
  with check (true);

-- Error logs: admin full access
create policy "Admins manage error logs"
  on public.error_logs for all
  using (public.is_admin());

create policy "Service inserts error logs"
  on public.error_logs for insert
  with check (true);

-- Email logs: admin read
create policy "Admins read email logs"
  on public.email_logs for select
  using (public.is_admin());

create policy "Service manages email logs"
  on public.email_logs for insert
  with check (true);

-- Resume parse logs: admin read, user sees own
create policy "Users see own resume logs"
  on public.resume_parse_logs for select
  using (user_id = public.get_my_profile_id());

create policy "Admins read all resume logs"
  on public.resume_parse_logs for select
  using (public.is_admin());

create policy "Service manages resume logs"
  on public.resume_parse_logs for insert
  with check (true);

-- Health snapshots: admin read
create policy "Admins read health snapshots"
  on public.system_health_snapshots for select
  using (public.is_admin());

create policy "Service manages health snapshots"
  on public.system_health_snapshots for insert
  with check (true);
