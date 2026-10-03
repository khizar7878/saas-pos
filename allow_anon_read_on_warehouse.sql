-- Run this query on your WAREHOUSE database (nmxxgoxbntlpjjwvvxvz)
-- to allow the Retail POS app to read parent products and variations.

-- 1. Policies for warehouse_products
ALTER TABLE public.warehouse_products ENABLE ROW LEVEL SECURITY; -- Just in case

CREATE POLICY "Allow anonymous select on warehouse_products"
ON public.warehouse_products FOR SELECT
TO anon, authenticated
USING (is_active = true);

-- 2. Policies for warehouse_product_variations
ALTER TABLE public.warehouse_product_variations ENABLE ROW LEVEL SECURITY; -- Just in case

CREATE POLICY "Allow anonymous select on warehouse_product_variations"
ON public.warehouse_product_variations FOR SELECT
TO anon, authenticated
USING (is_active = true);
