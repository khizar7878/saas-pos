-- Add account_subtype column to accounts table
-- This is used by the frontend to distinguish between different types of accounts (e.g. receivable, payable)
ALTER TABLE public.accounts
ADD COLUMN IF NOT EXISTS account_subtype TEXT;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_accounts_subtype ON public.accounts(account_subtype);
