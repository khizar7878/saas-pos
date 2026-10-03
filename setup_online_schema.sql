-- =============================================
-- AK-ONLINE E-COMMERCE SCHEMA MIGRATION FOR RETAIL POS
-- Run on Supabase Instance: lhalnbpcaphhszjliavr
-- =============================================

-- 1. Extend products table with online metadata
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS online_title TEXT,
ADD COLUMN IF NOT EXISTS online_description TEXT,
ADD COLUMN IF NOT EXISTS meters_per_suit DECIMAL(10,2) DEFAULT 4.0,
ADD COLUMN IF NOT EXISTS price_per_suit DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS fabric_type TEXT DEFAULT 'Cotton', -- Cotton, Boski, Wash & Wear, Karandi, Linen, Wool, Silk, Latha
ADD COLUMN IF NOT EXISTS season TEXT DEFAULT 'All Season',   -- Summer, Winter, All Season, Festive
ADD COLUMN IF NOT EXISTS pana_inches INTEGER DEFAULT 54,     -- Fabric Width (e.g. 54", 58", 36")
ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_new_arrival BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS is_bestseller BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS images TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS video_url TEXT;

-- 2. Create online_orders table
CREATE TABLE IF NOT EXISTS public.online_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number TEXT UNIQUE NOT NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    customer_email TEXT,
    shipping_address TEXT NOT NULL,
    city TEXT NOT NULL,
    postal_code TEXT,
    notes TEXT,
    
    subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
    shipping_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
    total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    
    payment_method TEXT NOT NULL DEFAULT 'ibft',
    payment_status TEXT NOT NULL DEFAULT 'pending_verification', -- 'pending_verification', 'verified', 'rejected'
    payment_proof_url TEXT,
    
    order_status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'
    
    pos_sale_id UUID REFERENCES public.sales(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create online_order_items table
CREATE TABLE IF NOT EXISTS public.online_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES public.online_orders(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES public.products(id) NOT NULL,
    
    suits_quantity INTEGER NOT NULL DEFAULT 1,
    meters_per_suit DECIMAL(10,2) NOT NULL DEFAULT 4.0,
    total_meters DECIMAL(10,2) NOT NULL,
    
    price_per_suit DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(12,2) NOT NULL,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create sequence generator for Online Orders
ALTER TABLE public.sequences ADD COLUMN IF NOT EXISTS prefix TEXT;

INSERT INTO public.sequences (id, prefix, current_value) 
VALUES ('online_order', 'AK-ONLINE-', 1000)
ON CONFLICT (id) DO NOTHING;

-- 5. Row Level Security Policies for Anonymous Storefront Access
ALTER TABLE public.online_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.online_order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon insert online_orders" ON public.online_orders;
CREATE POLICY "Allow anon insert online_orders" ON public.online_orders 
FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon insert online_order_items" ON public.online_order_items;
CREATE POLICY "Allow anon insert online_order_items" ON public.online_order_items 
FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon select online_orders" ON public.online_orders;
CREATE POLICY "Allow anon select online_orders" ON public.online_orders 
FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Allow anon update online_orders" ON public.online_orders;
CREATE POLICY "Allow anon update online_orders" ON public.online_orders 
FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon select online_order_items" ON public.online_order_items;
CREATE POLICY "Allow anon select online_order_items" ON public.online_order_items 
FOR SELECT TO anon, authenticated USING (true);

-- Enable public read on products and categories for storefront
DROP POLICY IF EXISTS "Allow anon select products online" ON public.products;
CREATE POLICY "Allow anon select products online" ON public.products 
FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Allow anon select categories online" ON public.product_categories;
CREATE POLICY "Allow anon select categories online" ON public.product_categories 
FOR SELECT TO anon, authenticated USING (true);

-- Storage bucket for online-store-media
INSERT INTO storage.buckets (id, name, public) 
VALUES ('online-store-media', 'online-store-media', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Allow public read online-store-media" ON storage.objects;
CREATE POLICY "Allow public read online-store-media" ON storage.objects 
FOR SELECT TO public USING (bucket_id = 'online-store-media');

DROP POLICY IF EXISTS "Allow authenticated insert online-store-media" ON storage.objects;
CREATE POLICY "Allow authenticated insert online-store-media" ON storage.objects 
FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'online-store-media');
