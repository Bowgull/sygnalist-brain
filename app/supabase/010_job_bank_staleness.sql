-- 010: Add staleness tracking to global_job_bank
-- Jobs age through: active -> stale (14 days) -> archived (admin) -> purged (30 days after stale_at)

ALTER TABLE public.global_job_bank
  ADD COLUMN stale_status text NOT NULL DEFAULT 'active'
    CHECK (stale_status IN ('active', 'stale', 'archived')),
  ADD COLUMN stale_at timestamptz;

CREATE INDEX idx_gjb_stale_status ON public.global_job_bank(stale_status);
CREATE INDEX idx_gjb_updated_at ON public.global_job_bank(updated_at);
