-- =============================================
-- ONLINE CUSTOMERS TABLE & RELATIONS
-- =============================================

CREATE TABLE IF NOT EXISTS public.online_customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID UNIQUE,
    full_name TEXT NOT NULL,
    phone TEXT UNIQUE NOT NULL,
    email TEXT,
    password_hash TEXT,
    default_address TEXT,
    city TEXT,
    postal_code TEXT,
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure password_hash column exists
ALTER TABLE public.online_customers 
ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Ensure UNIQUE constraints exist on phone and email
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'online_customers_email_key') THEN
        ALTER TABLE public.online_customers ADD CONSTRAINT online_customers_email_key UNIQUE (email);
    END IF;
END $$;

-- Enable RLS and public policies
ALTER TABLE public.online_customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon select on online_customers" ON public.online_customers;
CREATE POLICY "Allow anon select on online_customers"
ON public.online_customers FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Allow anon insert on online_customers" ON public.online_customers;
CREATE POLICY "Allow anon insert on online_customers"
ON public.online_customers FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon update on online_customers" ON public.online_customers;
CREATE POLICY "Allow anon update on online_customers"
ON public.online_customers FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated all on online_customers" ON public.online_customers;
CREATE POLICY "Allow authenticated all on online_customers"
ON public.online_customers FOR ALL TO authenticated USING (true) WITH CHECK (true);
