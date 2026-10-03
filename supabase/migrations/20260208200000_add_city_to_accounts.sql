-- Add city column to accounts table
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS city TEXT;
