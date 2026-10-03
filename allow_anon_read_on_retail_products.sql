-- Run this query on your RETAIL POS database (lhalnbpcaphhszjliavr)
-- to allow the AK-Warehouse app to read products and product categories for label printing.

-- 1. Policies for products
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY; -- Just in case

DROP POLICY IF EXISTS "Allow anonymous select on products" ON public.products;
CREATE POLICY "Allow anonymous select on products"
ON public.products FOR SELECT
TO anon, authenticated
USING (true);

-- 2. Policies for product_categories
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY; -- Just in case

DROP POLICY IF EXISTS "Allow anonymous select on product_categories" ON public.product_categories;
CREATE POLICY "Allow anonymous select on product_categories"
ON public.product_categories FOR SELECT
TO anon, authenticated
USING (true);
