-- 007_message_hub_v2.sql
-- Message Hub V2: conversation threading, outreach suggestions, reply polling

-- ============================================================
-- 1. Alter sent_messages — add threading columns
-- ============================================================

ALTER TABLE public.sent_messages
  ADD COLUMN IF NOT EXISTS smtp_message_id text,
  ADD COLUMN IF NOT EXISTS gmail_thread_id text,
  ADD COLUMN IF NOT EXISTS gmail_message_id text,
  ADD COLUMN IF NOT EXISTS recipient_email text;

CREATE INDEX IF NOT EXISTS idx_sent_msg_smtp_msg_id
  ON public.sent_messages(smtp_message_id);
CREATE INDEX IF NOT EXISTS idx_sent_msg_gmail_thread
  ON public.sent_messages(gmail_thread_id);

-- ============================================================
-- 2. Expand message_templates trigger_event constraint
-- ============================================================

ALTER TABLE public.message_templates
  DROP CONSTRAINT IF EXISTS message_templates_trigger_event_check;

ALTER TABLE public.message_templates
  ADD CONSTRAINT message_templates_trigger_event_check
  CHECK (trigger_event IS NULL OR trigger_event IN (
    'interview_reached',
    'offer_reached',
    'inactive_checkin',
    'welcome',
    'weekly_digest'
  ));

-- Update existing templates to use new trigger_event values
UPDATE public.message_templates
SET trigger_event = 'inactive_checkin'
WHERE name = 'Inactive Check-in' AND trigger_event IS NULL;

UPDATE public.message_templates
SET trigger_event = 'welcome'
WHERE name = 'Welcome' AND trigger_event IS NULL;

-- ============================================================
-- 3. New table: received_messages
-- ============================================================

CREATE TABLE IF NOT EXISTS public.received_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gmail_message_id text UNIQUE NOT NULL,
  gmail_thread_id text NOT NULL,
  from_email text NOT NULL,
  from_name text,
  subject text,
  body_text text,
  body_html text,
  received_at timestamptz NOT NULL,
  in_reply_to text,
  client_id uuid REFERENCES public.profiles(id),
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.received_messages ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_recv_msg_thread ON public.received_messages(gmail_thread_id);
CREATE INDEX IF NOT EXISTS idx_recv_msg_from ON public.received_messages(from_email);
CREATE INDEX IF NOT EXISTS idx_recv_msg_client ON public.received_messages(client_id);
CREATE INDEX IF NOT EXISTS idx_recv_msg_received ON public.received_messages(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_recv_msg_in_reply ON public.received_messages(in_reply_to);
CREATE INDEX IF NOT EXISTS idx_recv_msg_unread ON public.received_messages(is_read) WHERE NOT is_read;

CREATE POLICY "Admins manage received messages"
  ON public.received_messages FOR ALL
  USING (public.is_admin());

-- ============================================================
-- 4. New table: outreach_suggestions
-- ============================================================

CREATE TABLE IF NOT EXISTS public.outreach_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.profiles(id),
  trigger_event text NOT NULL CHECK (trigger_event IN (
    'interview_reached', 'offer_reached', 'inactive_checkin', 'welcome', 'weekly_digest'
  )),
  template_id uuid REFERENCES public.message_templates(id),
  tracker_entry_id uuid REFERENCES public.tracker_entries(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'dismissed')),
  context_snapshot jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz
);

ALTER TABLE public.outreach_suggestions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_outreach_status ON public.outreach_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_outreach_client ON public.outreach_suggestions(client_id);
CREATE INDEX IF NOT EXISTS idx_outreach_trigger ON public.outreach_suggestions(trigger_event);
CREATE INDEX IF NOT EXISTS idx_outreach_created ON public.outreach_suggestions(created_at DESC);

-- Prevent duplicate pending suggestions for the same client+trigger+entry
CREATE UNIQUE INDEX IF NOT EXISTS idx_outreach_dedup
  ON public.outreach_suggestions(client_id, trigger_event, COALESCE(tracker_entry_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE status = 'pending';

CREATE POLICY "Admins manage outreach suggestions"
  ON public.outreach_suggestions FOR ALL
  USING (public.is_admin());

-- ============================================================
-- 5. New table: gmail_poll_state (singleton)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.gmail_poll_state (
  id text PRIMARY KEY DEFAULT 'singleton',
  last_polled_at timestamptz,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.gmail_poll_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage poll state"
  ON public.gmail_poll_state FOR ALL
  USING (public.is_admin());

INSERT INTO public.gmail_poll_state (id, last_polled_at)
VALUES ('singleton', null)
ON CONFLICT (id) DO NOTHING;
