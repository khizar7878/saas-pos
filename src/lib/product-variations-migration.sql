-- PRODUCT VARIATIONS MIGRATION
-- Run this in Supabase SQL Editor to add the product variations system

-- =============================================
-- 1. PRODUCT VARIATIONS TABLE
-- Each variation represents a specific cutting length with its own barcode
-- =============================================
CREATE TABLE public.product_variations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    sku TEXT UNIQUE NOT NULL,
    meters_per_unit DECIMAL(10,2) NOT NULL DEFAULT 1,
    stock_qty INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX idx_product_variations_product_id ON public.product_variations(product_id);
CREATE INDEX idx_product_variations_sku ON public.product_variations(sku);

-- =============================================
-- 2. TRIGGER: Update parent product's current_stock_meters
-- when variations are inserted, updated, or deleted
-- =============================================
CREATE OR REPLACE FUNCTION public.update_parent_product_stock()
RETURNS TRIGGER AS $$
DECLARE
    target_product_id UUID;
BEGIN
    -- Determine which product to update
    IF TG_OP = 'DELETE' THEN
        target_product_id := OLD.product_id;
    ELSE
        target_product_id := NEW.product_id;
    END IF;
    
    -- Recalculate total stock meters from all variations
    UPDATE public.products
    SET current_stock_meters = COALESCE(
        (SELECT SUM(meters_per_unit * stock_qty) 
         FROM public.product_variations 
         WHERE product_id = target_product_id AND is_active = TRUE),
        0
    ),
    updated_at = NOW()
    WHERE id = target_product_id;
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_parent_stock_on_variation_change
    AFTER INSERT OR UPDATE OR DELETE ON public.product_variations
    FOR EACH ROW EXECUTE FUNCTION public.update_parent_product_stock();

-- =============================================
-- 3. RLS POLICIES FOR product_variations
-- =============================================
ALTER TABLE public.product_variations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all authenticated users to read variations"
    ON public.product_variations FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow all authenticated users to insert variations"
    ON public.product_variations FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Allow all authenticated users to update variations"
    ON public.product_variations FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow all authenticated users to delete variations"
    ON public.product_variations FOR DELETE
    TO authenticated
    USING (true);

-- =============================================
-- 4. Make SKU optional on products table
-- (variations will now hold the unique barcodes)
-- =============================================
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_sku_key;
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_barcode_key;
ALTER TABLE public.products ALTER COLUMN sku DROP NOT NULL;
