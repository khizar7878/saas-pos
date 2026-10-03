-- Add opening_balance column to accounts table
-- This allows tracking the initial balance separate from current_balance
ALTER TABLE public.accounts
ADD COLUMN IF NOT EXISTS opening_balance DECIMAL(12,2) DEFAULT 0;
