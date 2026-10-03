-- CHEQUES TRACKING MIGRATION
-- Run this in Supabase SQL Editor to enable individual cheque tracking
-- Cheques are received as whole units and must be spent as whole units

-- =============================================
-- 1. CHEQUE STATUS ENUM
-- =============================================
DO $$ BEGIN
    CREATE TYPE public.cheque_status AS ENUM ('available', 'deposited', 'cleared', 'bounced', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- =============================================
-- 2. CHEQUES TABLE
-- Stores individual cheques received from customers
-- =============================================
CREATE TABLE IF NOT EXISTS public.cheques (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cheque_number TEXT NOT NULL,
    bank_name_id UUID REFERENCES public.bank_names(id),
    bank_name TEXT NOT NULL, -- Denormalized for quick access
    amount DECIMAL(15,2) NOT NULL,
    cheque_date DATE NOT NULL,
    status cheque_status DEFAULT 'available' NOT NULL,
    
    -- Source tracking (where the cheque came from)
    received_from_account_id UUID REFERENCES public.accounts(id),
    received_via TEXT, -- 'sale' or 'payment'
    source_sale_id UUID REFERENCES public.sales(id),
    source_payment_id UUID REFERENCES public.payments(id),
    
    -- Usage tracking (where the cheque was spent)
    used_for_payment_id UUID REFERENCES public.payments(id),
    used_at TIMESTAMPTZ,
    
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 3. INDEXES
-- =============================================
CREATE INDEX IF NOT EXISTS idx_cheques_status ON public.cheques(status);
CREATE INDEX IF NOT EXISTS idx_cheques_bank_name ON public.cheques(bank_name);
CREATE INDEX IF NOT EXISTS idx_cheques_cheque_date ON public.cheques(cheque_date);

-- =============================================
-- 4. ENABLE RLS
-- =============================================
ALTER TABLE public.cheques ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 5. RLS POLICIES
-- =============================================
DROP POLICY IF EXISTS "Allow authenticated users to view cheques" ON public.cheques;
CREATE POLICY "Allow authenticated users to view cheques"
    ON public.cheques FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Allow authenticated users to insert cheques" ON public.cheques;
CREATE POLICY "Allow authenticated users to insert cheques"
    ON public.cheques FOR INSERT
    TO authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated users to update cheques" ON public.cheques;
CREATE POLICY "Allow authenticated users to update cheques"
    ON public.cheques FOR UPDATE
    TO authenticated
    USING (true);

-- =============================================
-- 6. UPDATED_AT TRIGGER
-- =============================================
DROP TRIGGER IF EXISTS update_cheques_updated_at ON public.cheques;
CREATE TRIGGER update_cheques_updated_at 
    BEFORE UPDATE ON public.cheques
    FOR EACH ROW 
    EXECUTE FUNCTION public.update_updated_at();

-- =============================================
-- 7. REFRESH SCHEMA CACHE
-- =============================================
NOTIFY pgrst, 'reload schema';
