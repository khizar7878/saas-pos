-- Update sales table foreign key to reference accounts instead of customers
-- The application has moved to using the accounts table for customers

-- Drop old constraint
ALTER TABLE public.sales
DROP CONSTRAINT IF EXISTS sales_customer_id_fkey;

-- Add new constraint referencing accounts
ALTER TABLE public.sales
ADD CONSTRAINT sales_customer_id_fkey
FOREIGN KEY (customer_id)
REFERENCES public.accounts(id);

-- Also update returns table if it references customers (checking just in case, though logically it might link to sales)
-- Searching previous schema, returns didn't seem to have customer_id foreign key explicitly defined in standard schema, 
-- but if we want to be sure, we can check. 
-- However, based on the error, only sales table is the blocker right now.
