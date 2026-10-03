-- Fix held_carts foreign key constraint
-- The existing constraint might be referencing auth.users or has some other issue.
-- We want customer_id to reference public.customers(id).

DO $$
BEGIN
    -- Drop the existing constraint if it exists
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'held_carts_customer_id_fkey' 
        AND table_name = 'held_carts'
    ) THEN
        ALTER TABLE public.held_carts DROP CONSTRAINT held_carts_customer_id_fkey;
    END IF;

    -- Add the correct constraint
    ALTER TABLE public.held_carts 
    ADD CONSTRAINT held_carts_customer_id_fkey 
    FOREIGN KEY (customer_id) 
    REFERENCES public.customers(id) 
    ON DELETE SET NULL;

END $$;
