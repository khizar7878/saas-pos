-- Add sale_adjustments column to daily_reconciliations
ALTER TABLE public.daily_reconciliations 
ADD COLUMN IF NOT EXISTS sale_adjustments numeric(12,2) DEFAULT 0;
