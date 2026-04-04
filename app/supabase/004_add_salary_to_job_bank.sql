-- Add salary column to global_job_bank
ALTER TABLE global_job_bank ADD COLUMN IF NOT EXISTS salary text;
