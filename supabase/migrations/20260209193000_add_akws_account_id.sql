-- Add akws_account_id to accounts table to link back to master
ALTER TABLE public.accounts 
ADD COLUMN IF NOT EXISTS akws_account_id UUID;
