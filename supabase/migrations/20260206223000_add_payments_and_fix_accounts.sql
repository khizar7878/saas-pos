-- 1. Create Payments Table (Required by frontend)
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_number TEXT UNIQUE,
    from_account_id UUID REFERENCES public.accounts(id),
    to_account_id UUID REFERENCES public.accounts(id),
    amount DECIMAL(12,2) NOT NULL,
    payment_mode TEXT NOT NULL, -- 'cash', 'ibft', etc.
    reference_id UUID, -- sale_id, return_id, etc. (optional)
    created_by UUID REFERENCES auth.users(id),
    store_id UUID REFERENCES public.stores(id),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for payments
CREATE INDEX IF NOT EXISTS idx_payments_from ON public.payments(from_account_id);
CREATE INDEX IF NOT EXISTS idx_payments_to ON public.payments(to_account_id);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON public.payments(created_at DESC);

-- RLS for payments
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view payments" ON public.payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create payments" ON public.payments FOR INSERT TO authenticated WITH CHECK (true);

-- 2. Backfill account_subtype for existing customers (non-system accounts)
-- Anyone who is NOT a system account and has NULL subtype should be 'receivable' (Customer)
-- unless we want to distinguish suppliers. For now, assume simple POS customers.
UPDATE public.accounts
SET account_subtype = 'receivable'
WHERE is_system = false 
  AND account_subtype IS NULL;

-- 3. Ensure sequence exists for payment_number if used?
-- Frontend doesn't seem to generate payment_number in useSales.ts, but standard payments module might.
-- Let's check sequences. But for now, just table is needed.
