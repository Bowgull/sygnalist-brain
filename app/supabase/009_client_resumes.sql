-- ============================================================================
-- CLIENT RESUMES TABLE + STORAGE BUCKET
-- Run this in Supabase SQL Editor before deploying
-- ============================================================================

-- Client resumes with parsed data and storage references
create table if not exists public.client_resumes (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  file_path text,              -- Supabase Storage path (null for pasted text)
  file_name text not null,
  file_size integer default 0,
  parsed_data jsonb,           -- Full ParsedResume JSON from AI parse
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  applied_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists idx_client_resumes_profile on public.client_resumes(profile_id);
create index if not exists idx_client_resumes_created on public.client_resumes(created_at desc);

-- Create private storage bucket for resume files
insert into storage.buckets (id, name, public)
values ('resumes', 'resumes', false)
on conflict (id) do nothing;
