-- 012_tickets_remove_closed.sql
-- Simplify ticket statuses to 3: open, in_progress, resolved

-- Move any 'closed' tickets to 'resolved'
UPDATE public.tickets SET status = 'resolved' WHERE status = 'closed';

-- Replace the check constraint
ALTER TABLE public.tickets DROP CONSTRAINT tickets_status_check;
ALTER TABLE public.tickets ADD CONSTRAINT tickets_status_check
  CHECK (status IN ('open', 'in_progress', 'resolved'));
