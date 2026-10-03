-- Add PCT Code and Tax Rate columns to products table
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS pct_code text,
ADD COLUMN IF NOT EXISTS tax_rate numeric DEFAULT 0;

-- Comment on columns
COMMENT ON COLUMN public.products.pct_code IS 'Product Classification Tracking Code for FBR';
COMMENT ON COLUMN public.products.tax_rate IS 'Tax rate percentage included in the price';
