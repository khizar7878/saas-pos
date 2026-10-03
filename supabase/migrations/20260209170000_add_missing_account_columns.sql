-- Add missing columns for Bank Account Sync
ALTER TABLE public.accounts 
ADD COLUMN IF NOT EXISTS account_number TEXT,
ADD COLUMN IF NOT EXISTS account_title TEXT,
ADD COLUMN IF NOT EXISTS bank_name_id UUID REFERENCES public.bank_names(id),
ADD COLUMN IF NOT EXISTS branch_location TEXT,
ADD COLUMN IF NOT EXISTS account_subtype TEXT DEFAULT 'bank_account';

-- Also ensure retail_shop_id exists if we need it for future syncs or reference
ALTER TABLE public.accounts
ADD COLUMN IF NOT EXISTS retail_shop_id UUID;
