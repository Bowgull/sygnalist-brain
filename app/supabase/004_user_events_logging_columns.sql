-- Migration: Add request_id and success columns to user_events
-- These enable request correlation and success/failure distinction.

alter table public.user_events
  add column if not exists request_id text,
  add column if not exists success boolean default true;

create index if not exists idx_user_events_request_id
  on public.user_events (request_id)
  where request_id is not null;
