-- Remove STRN and NTN columns from store_settings
ALTER TABLE public.store_settings 
DROP COLUMN IF EXISTS strn,
DROP COLUMN IF EXISTS ntn;
