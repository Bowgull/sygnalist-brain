-- ============================================================================
-- 006: Add review workflow columns to jobs_inbox
-- Repurpose jobs_inbox as the Gmail ingest review queue
-- ============================================================================

-- Review status for approval workflow
ALTER TABLE public.jobs_inbox
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'pending'
    CHECK (review_status IN ('pending', 'approved', 'rejected'));

-- Lane assignment (set during approval, maps to lane_role_bank.lane_key)
ALTER TABLE public.jobs_inbox
  ADD COLUMN IF NOT EXISTS lane_key text;

-- When and by whom the review was done
ALTER TABLE public.jobs_inbox
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

ALTER TABLE public.jobs_inbox
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES public.profiles(id);

-- Gmail message ID for traceability
ALTER TABLE public.jobs_inbox
  ADD COLUMN IF NOT EXISTS gmail_message_id text;

-- Expand enrichment_status to include APPROVED
ALTER TABLE public.jobs_inbox DROP CONSTRAINT IF EXISTS jobs_inbox_enrichment_status_check;
ALTER TABLE public.jobs_inbox ADD CONSTRAINT jobs_inbox_enrichment_status_check
  CHECK (enrichment_status IN ('NEW', 'OUTLIER', 'ENRICHED', 'IN_GLOBAL', 'APPROVED'));

-- Indexes for review queue queries
CREATE INDEX IF NOT EXISTS idx_jobs_inbox_review ON public.jobs_inbox(review_status);
CREATE INDEX IF NOT EXISTS idx_jobs_inbox_url ON public.jobs_inbox(url);
CREATE INDEX IF NOT EXISTS idx_jobs_inbox_created ON public.jobs_inbox(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_inbox_gmail_msg ON public.jobs_inbox(gmail_message_id);
