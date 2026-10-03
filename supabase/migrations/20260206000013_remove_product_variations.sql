-- Remove product variations and switch to pieces/suits model
-- Run this in Supabase SQL Editor

-- 1. Drop product_variations table
DROP TABLE IF EXISTS public.product_variations CASCADE;

-- 2. Add properties to products table for unstitched suits
-- We assume 'stock_quantity' is now the number of pieces/suits.
-- We add 'meters_per_piece' to track the length of each suit.
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS meters_per_piece DECIMAL(10,2) DEFAULT 0;

-- 3. Rename columns if needed (optional but good for clarity)
-- We already established that 'price' and 'cost_price' exist in the DB.
-- We can add comments or just leave them.
COMMENT ON COLUMN public.products.stock_quantity IS 'Number of pieces/suits in stock';
COMMENT ON COLUMN public.products.price IS 'Price per piece/suit';
COMMENT ON COLUMN public.products.cost_price IS 'Cost price per piece/suit';
