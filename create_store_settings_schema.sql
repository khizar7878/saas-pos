-- =============================================
-- ONLINE STORE SETTINGS SAFE MIGRATION
-- =============================================

-- 1. Create table if it does not exist yet
CREATE TABLE IF NOT EXISTS public.store_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_name TEXT DEFAULT 'Abr e Karam Fabrics',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Safely add columns if store_settings table already exists from POS
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS store_tagline TEXT DEFAULT 'Quality Fabrics for Everyone';
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS support_phone TEXT DEFAULT '03228515152';
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS support_whatsapp TEXT DEFAULT '03228515152';
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS support_email TEXT DEFAULT 'contact@abrekaram.com';
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS outlet_address TEXT DEFAULT 'Cloth Market, Faisalabad';
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS outlet_city TEXT DEFAULT 'Faisalabad';

-- Delivery & Shipping Settings
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS delivery_charge NUMERIC(10, 2) DEFAULT 250.00;
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS free_shipping_min_amount NUMERIC(10, 2) DEFAULT 5000.00;
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS estimated_delivery_days TEXT DEFAULT '2 - 4 Working Days';

-- Bank Details for Direct IBFT
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS bank_name TEXT DEFAULT 'Meezan Bank Limited';
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS account_title TEXT DEFAULT 'Abr e Karam Fabrics';
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS account_number TEXT DEFAULT '01010102938475';
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS iban_number TEXT DEFAULT 'PK36MEZN0001010102938475';
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS payment_instructions TEXT DEFAULT 'Please transfer the total order amount via IBFT/EasyPaisa/JazzCash and attach the payment proof screenshot or reference ID during checkout.';

-- Announcement Banner & Social Links
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS announcement_text TEXT DEFAULT '✨ Free Shipping on All Orders Above Rs. 5,000 Across Pakistan!';
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS is_announcement_active BOOLEAN DEFAULT TRUE;
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS facebook_url TEXT DEFAULT '';
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS instagram_url TEXT DEFAULT '';

-- 3. Seed initial row if table is empty
INSERT INTO public.store_settings (
    store_name,
    store_tagline,
    support_phone,
    support_whatsapp,
    support_email,
    outlet_address,
    outlet_city,
    delivery_charge,
    free_shipping_min_amount,
    estimated_delivery_days,
    bank_name,
    account_title,
    account_number,
    iban_number,
    payment_instructions,
    announcement_text,
    is_announcement_active
)
SELECT 
    'Abr e Karam Fabrics',
    'Quality Fabrics for Everyone',
    '03228515152',
    '03228515152',
    'contact@abrekaram.com',
    'Cloth Market, Faisalabad',
    'Faisalabad',
    250.00,
    5000.00,
    '2 - 4 Working Days',
    'Meezan Bank Limited',
    'Abr e Karam Fabrics',
    '01010102938475',
    'PK36MEZN0001010102938475',
    'Please transfer the total order amount via IBFT/EasyPaisa/JazzCash and attach the payment proof screenshot or reference ID during checkout.',
    '✨ Free Shipping on All Orders Above Rs. 5,000 Across Pakistan!',
    TRUE
WHERE NOT EXISTS (SELECT 1 FROM public.store_settings);

-- 4. Enable RLS and public policies
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon select on store_settings" ON public.store_settings;
CREATE POLICY "Allow anon select on store_settings"
ON public.store_settings FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Allow anon update on store_settings" ON public.store_settings;
CREATE POLICY "Allow anon update on store_settings"
ON public.store_settings FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon insert on store_settings" ON public.store_settings;
CREATE POLICY "Allow anon insert on store_settings"
ON public.store_settings FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated all on store_settings" ON public.store_settings;
CREATE POLICY "Allow authenticated all on store_settings"
ON public.store_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
