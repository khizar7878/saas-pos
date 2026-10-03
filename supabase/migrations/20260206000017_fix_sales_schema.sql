-- Add missing columns to sales table
ALTER TABLE public.sales
ADD COLUMN IF NOT EXISTS amount_received DECIMAL(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS change_amount DECIMAL(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount_percent DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'completed',
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS deposit_account_id UUID REFERENCES public.accounts(id),
ADD COLUMN IF NOT EXISTS cheque_number TEXT,
ADD COLUMN IF NOT EXISTS cheque_bank TEXT,
ADD COLUMN IF NOT EXISTS cheque_date DATE;

-- Handle discount column migration (rename if exists and discount_amount is empty)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'sales' AND column_name = 'discount') THEN
        -- Verify if we should prefer the old column
        -- For now, just keep both or rely on the new one. 
        -- Let's enable the new code to work.
        NULL;
    END IF;
END $$;
