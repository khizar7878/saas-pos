-- Fix foreign key constraint on credit_sales table
-- It was incorrectly referencing 'customers' table, but should reference 'accounts' table (where customers are stored as receivable accounts)

ALTER TABLE public.credit_sales
DROP CONSTRAINT credit_sales_customer_id_fkey;

ALTER TABLE public.credit_sales
ADD CONSTRAINT credit_sales_customer_id_fkey
FOREIGN KEY (customer_id)
REFERENCES public.accounts(id);
