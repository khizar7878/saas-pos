-- 1. Add sale_item_id to return_items
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'return_items' AND column_name = 'sale_item_id') THEN
        ALTER TABLE public.return_items ADD COLUMN sale_item_id UUID REFERENCES public.sale_items(id);
    END IF;
END $$;

-- 2. Make product_name nullable in return_items (since we might not always have it or want to duplicate it)
ALTER TABLE public.return_items ALTER COLUMN product_name DROP NOT NULL;

-- 3. Add index for sale_item_id
CREATE INDEX IF NOT EXISTS idx_return_items_sale_item_id ON public.return_items(sale_item_id);

-- Explicitly notify schema cache reload
NOTIFY pgrst, 'reload schema';
