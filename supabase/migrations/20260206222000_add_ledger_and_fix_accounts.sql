-- 1. Fix Account Subtypes for System Accounts
UPDATE public.accounts
SET account_subtype = 'cash_in_hand'
WHERE name IN ('Cash in Hand', 'Cash in Drawer');

-- 2. Create Ledger Entries Table (Required by frontend)
CREATE TABLE IF NOT EXISTS public.ledger_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES public.accounts(id),
    reference_type TEXT NOT NULL, -- 'sale', 'expense', etc.
    reference_id UUID NOT NULL,
    description TEXT,
    debit DECIMAL(12,2) DEFAULT 0,
    credit DECIMAL(12,2) DEFAULT 0,
    balance DECIMAL(12,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create Indexes for Ledger Entries
CREATE INDEX IF NOT EXISTS idx_ledger_entries_account ON public.ledger_entries(account_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_ref ON public.ledger_entries(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_created_at ON public.ledger_entries(created_at DESC);

-- 4. Enable RLS on Ledger Entries
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;

-- 5. Add Policies for Ledger Entries
CREATE POLICY "Users can view ledger entries" ON public.ledger_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create ledger entries" ON public.ledger_entries FOR INSERT TO authenticated WITH CHECK (true);

-- 6. Also ensure Cheques account has correct subtype
UPDATE public.accounts
SET account_subtype = 'cheques'
WHERE name LIKE '%Cheque%';

-- If Cheque account doesn't exist, create it (optional, but good practice)
INSERT INTO public.accounts (name, account_type, account_subtype, current_balance, is_system, is_active)
SELECT 'Cheques in Hand', 'asset', 'cheques', 0, true, true
WHERE NOT EXISTS (SELECT 1 FROM public.accounts WHERE account_subtype = 'cheques');
