-- Migration: Universal Multi-Axis Variant Matrix (Size x Color x Option)
-- Extends product_variants from fabric color swatches to full universal SKU/variant matrix

-- 1. Add variant attributes and stock columns to public.product_variants
ALTER TABLE public.product_variants
    ADD COLUMN IF NOT EXISTS title text,
    ADD COLUMN IF NOT EXISTS size text,
    ADD COLUMN IF NOT EXISTS sku text,
    ADD COLUMN IF NOT EXISTS barcode text,
    ADD COLUMN IF NOT EXISTS price numeric(10,2),
    ADD COLUMN IF NOT EXISTS cost_price numeric(10,2),
    ADD COLUMN IF NOT EXISTS stock_quantity integer DEFAULT 0,
    ADD COLUMN IF NOT EXISTS attributes jsonb DEFAULT '{}'::jsonb;

-- 2. Make color_name nullable for non-color variants (e.g. storage size, shoe sizes)
ALTER TABLE public.product_variants ALTER COLUMN color_name DROP NOT NULL;

-- 3. Populate title for existing swatches
UPDATE public.product_variants
SET title = color_name
WHERE title IS NULL AND color_name IS NOT NULL;

-- 4. Add has_variants flag to public.products
ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS has_variants boolean DEFAULT false;

-- 5. Sync has_variants flag for existing products that have variants
UPDATE public.products
SET has_variants = true
WHERE id IN (SELECT DISTINCT product_id FROM public.product_variants);

-- 6. Add performance indexes for variant lookup
CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON public.product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_sku ON public.product_variants(sku) WHERE sku IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_product_variants_barcode ON public.product_variants(barcode) WHERE barcode IS NOT NULL;

-- 7. Add variant_id to sale_items if not present
ALTER TABLE public.sale_items
    ADD COLUMN IF NOT EXISTS variant_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL;

-- 8. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
