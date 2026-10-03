-- Add customer_id column to returns table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'returns' AND column_name = 'customer_id') THEN
        ALTER TABLE public.returns ADD COLUMN customer_id UUID REFERENCES public.customers(id);
    END IF;
END $$;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_returns_customer_id ON public.returns(customer_id);

-- Explicitly notify schema cache reload just in case
NOTIFY pgrst, 'reload schema';
