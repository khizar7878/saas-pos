-- =============================================
-- PRODUCT VARIANTS (COLOR SWATCHES) SCHEMA
-- =============================================

CREATE TABLE IF NOT EXISTS public.product_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    color_name TEXT NOT NULL,
    color_hex TEXT NOT NULL DEFAULT '#295975',
    variant_image_url TEXT, -- Optional variant image
    is_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS and public policies
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon select on product_variants" ON public.product_variants;
CREATE POLICY "Allow anon select on product_variants"
ON public.product_variants FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Allow anon insert on product_variants" ON public.product_variants;
CREATE POLICY "Allow anon insert on product_variants"
ON public.product_variants FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon update on product_variants" ON public.product_variants;
CREATE POLICY "Allow anon update on product_variants"
ON public.product_variants FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon delete on product_variants" ON public.product_variants;
CREATE POLICY "Allow anon delete on product_variants"
ON public.product_variants FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated all on product_variants" ON public.product_variants;
CREATE POLICY "Allow authenticated all on product_variants"
ON public.product_variants FOR ALL TO authenticated USING (true) WITH CHECK (true);
