-- Add missing customer details columns to accounts table
ALTER TABLE public.accounts
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS credit_limit DECIMAL(12,2) DEFAULT 0;

-- Add index for phone as it might be used for lookups
CREATE INDEX IF NOT EXISTS idx_accounts_phone ON public.accounts(phone);
