-- 011_tickets.sql
-- Beta ticket / bug tracker system

-- Tickets table
create table public.tickets (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  status      text not null default 'open'
                check (status in ('open', 'in_progress', 'resolved', 'closed')),
  priority    text not null default 'medium'
                check (priority in ('low', 'medium', 'high', 'critical')),
  source      text not null default 'user_report'
                check (source in ('user_report', 'activity', 'error', 'manual')),
  reporter_id uuid references public.profiles(id) on delete set null,
  message     text,
  page_url    text,
  user_agent  text,
  screen_size text,
  metadata    jsonb not null default '{}',
  notes       jsonb not null default '[]',
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Link errors and events to tickets
alter table public.error_logs
  add column ticket_id uuid references public.tickets(id) on delete set null;

alter table public.user_events
  add column ticket_id uuid references public.tickets(id) on delete set null;

-- Indexes
create index idx_tickets_status   on public.tickets(status);
create index idx_tickets_priority on public.tickets(priority);
create index idx_tickets_source   on public.tickets(source);
create index idx_tickets_reporter on public.tickets(reporter_id);
create index idx_tickets_created  on public.tickets(created_at desc);
create index idx_error_logs_ticket on public.error_logs(ticket_id);
create index idx_user_events_ticket on public.user_events(ticket_id);

-- RLS
alter table public.tickets enable row level security;

create policy "Users insert own reports"
  on public.tickets for insert
  with check (reporter_id = public.get_my_profile_id());

create policy "Admins manage tickets"
  on public.tickets for all
  using (public.is_admin());

create policy "Service manages tickets"
  on public.tickets for all
  using (true) with check (true);
