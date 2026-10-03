-- Fix held_carts foreign key constraint
-- The constraint was pointing to 'customers' but application uses 'accounts'.
-- We need to redirect the foreign key to the 'accounts' table.

DO $$
BEGIN
    -- 1. Drop the incorrect constraint
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'held_carts_customer_id_fkey' 
        AND table_name = 'held_carts'
    ) THEN
        ALTER TABLE public.held_carts DROP CONSTRAINT held_carts_customer_id_fkey;
    END IF;

    -- 2. Clean up any invalid references (customer_ids that don't exist in accounts)
    -- This prevents the new constraint from failing immediately
    UPDATE public.held_carts
    SET customer_id = NULL
    WHERE customer_id IS NOT NULL 
    AND customer_id NOT IN (SELECT id FROM public.accounts);

    -- 3. Add the correct constraint referencing accounts(id)
    ALTER TABLE public.held_carts 
    ADD CONSTRAINT held_carts_customer_id_fkey 
    FOREIGN KEY (customer_id) 
    REFERENCES public.accounts(id) 
    ON DELETE SET NULL;

END $$;
