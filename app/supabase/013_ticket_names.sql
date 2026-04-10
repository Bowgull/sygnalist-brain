-- 013_ticket_names.sql
-- Add ticket_name column for permanent anime-N style identifiers

alter table public.tickets
  add column ticket_name text;

-- Create a unique index so names can't collide
create unique index idx_tickets_name on public.tickets(ticket_name);
