-- Migration: Add Day Grouping and Routine Weekly Off Days
-- Date: 2026-10-03

-- 1. Add weekly_off_days to store_settings
ALTER TABLE public.store_settings 
ADD COLUMN IF NOT EXISTS weekly_off_days text[] DEFAULT ARRAY['friday']::text[];

-- Update existing store_settings row if weekly_off_days is null
UPDATE public.store_settings 
SET weekly_off_days = ARRAY['friday']::text[] 
WHERE weekly_off_days IS NULL;

-- 2. Add Day Grouping columns to daily_reconciliations
ALTER TABLE public.daily_reconciliations
ADD COLUMN IF NOT EXISTS is_grouped boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS start_date date,
ADD COLUMN IF NOT EXISTS end_date date,
ADD COLUMN IF NOT EXISTS grouped_dates date[] DEFAULT '{}'::date[];

-- For existing single-day records, populate start_date and end_date if null
UPDATE public.daily_reconciliations
SET 
    start_date = COALESCE(start_date, reconciliation_date),
    end_date = COALESCE(end_date, reconciliation_date),
    grouped_dates = CASE 
        WHEN grouped_dates IS NULL OR array_length(grouped_dates, 1) IS NULL 
        THEN ARRAY[reconciliation_date] 
        ELSE grouped_dates 
    END
WHERE start_date IS NULL OR end_date IS NULL;

-- 3. Create indexes for high-speed multi-day query lookups
CREATE INDEX IF NOT EXISTS idx_daily_reconciliations_grouped_dates 
ON public.daily_reconciliations USING gin (grouped_dates);

CREATE INDEX IF NOT EXISTS idx_daily_reconciliations_date_range 
ON public.daily_reconciliations (start_date, end_date);
