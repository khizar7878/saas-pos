-- Create store_settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.store_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_name TEXT DEFAULT 'AK Retail POS',
    address TEXT,
    phone TEXT,
    email TEXT,
    website TEXT,
    tax_rate DECIMAL(5,2) DEFAULT 0,
    currency_symbol TEXT DEFAULT 'Rs.',
    logo_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Add RLS
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access" ON public.store_settings FOR SELECT USING (true);
CREATE POLICY "Allow authenticated update" ON public.store_settings FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert" ON public.store_settings FOR INSERT TO authenticated WITH CHECK (true);

-- Insert default settings if empty
INSERT INTO public.store_settings (store_name)
SELECT 'Abr-e-Karam Fabrics'
WHERE NOT EXISTS (SELECT 1 FROM public.store_settings);
