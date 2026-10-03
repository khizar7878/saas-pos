-- Create stock_receipts table
CREATE TABLE IF NOT EXISTS public.stock_receipts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    receipt_number TEXT NOT NULL,
    total_rolls INTEGER DEFAULT 0,
    total_meters NUMERIC(10, 2) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create stock_receipt_items table
CREATE TABLE IF NOT EXISTS public.stock_receipt_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    receipt_id UUID REFERENCES public.stock_receipts(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id),
    rolls_received INTEGER DEFAULT 0,
    meters_per_roll NUMERIC(10, 2) DEFAULT 0,
    total_meters NUMERIC(10, 2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create sequence for stock receipts if not exists
CREATE SEQUENCE IF NOT EXISTS stock_receipt_seq START 1001;

-- RPC to get next sequence (reusing existing pattern if possible, or creating new)
CREATE OR REPLACE FUNCTION public.get_next_sequence(seq_id text)
RETURNS text
LANGUAGE plpgsql
AS $function$
DECLARE
    next_val INTEGER;
BEGIN
    IF seq_id = 'stock_receipt' THEN
        next_val := nextval('stock_receipt_seq');
        RETURN 'REC-' || next_val;
    END IF;
    RETURN NULL;
END;
$function$;

-- Enable RLS
ALTER TABLE public.stock_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_receipt_items ENABLE ROW LEVEL SECURITY;

-- Policies (Allow all for now for authenticated users, adjust as needed)
CREATE POLICY "Enable all access for authenticated users" ON public.stock_receipts
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable all access for authenticated users" ON public.stock_receipt_items
    FOR ALL USING (auth.role() = 'authenticated');
