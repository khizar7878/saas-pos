-- Alter products table to add columns for linking to central warehouse products
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS warehouse_product_id UUID,
ADD COLUMN IF NOT EXISTS warehouse_variation_id UUID;

CREATE INDEX IF NOT EXISTS idx_products_warehouse_product_id ON public.products(warehouse_product_id);
CREATE INDEX IF NOT EXISTS idx_products_warehouse_variation_id ON public.products(warehouse_variation_id);
