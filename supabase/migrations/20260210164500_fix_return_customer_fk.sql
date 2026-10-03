-- Repoint returns.customer_id to accounts table instead of customers table
-- This is required because the frontend selects customers from the 'accounts' table

DO $$
BEGIN
    -- 1. Drop existing FK if it references customers
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'returns_customer_id_fkey' 
        AND table_name = 'returns'
    ) THEN
        ALTER TABLE public.returns DROP CONSTRAINT returns_customer_id_fkey;
    END IF;

    -- 2. Add new FK referencing accounts
    ALTER TABLE public.returns 
    ADD CONSTRAINT returns_customer_id_fkey 
    FOREIGN KEY (customer_id) 
    REFERENCES public.accounts(id);

END $$;

-- Explicitly notify schema cache reload
NOTIFY pgrst, 'reload schema';
