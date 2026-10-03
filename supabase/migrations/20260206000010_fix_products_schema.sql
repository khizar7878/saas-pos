-- Fix products table schema to support categories
-- Adds category_id foreign key and links to product_categories

-- 1. Add category_id column to products
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.product_categories(id);

-- 2. Create index for performance
CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products(category_id);

-- 3. (Optional) Migrate existing text categories if any
-- This attempts to find matching categories by name and link them
UPDATE public.products p
SET category_id = c.id
FROM public.product_categories c
WHERE p.category = c.name
AND p.category_id IS NULL;

-- 4. If you want to drop the old text column eventually, you can.
-- keeping it for now to avoid data loss if migration fails to match.
-- ALTER TABLE public.products DROP COLUMN category;
