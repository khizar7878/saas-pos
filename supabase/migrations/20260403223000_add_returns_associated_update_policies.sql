-- Add UPDATE RLS policies to allow processing returns from the POS frontend

-- 1. Allow authenticated users to update sale_items (specifically for setting quantity_returned)
CREATE POLICY "Users can update sale_items" 
ON public.sale_items 
FOR UPDATE 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- 2. Ensure all authenticated users can update products (specifically for restocking)
-- Even if "Managers and admins" have a policy, cashiers need to restock during returns.
CREATE POLICY "Users can update products for restocking" 
ON public.products 
FOR UPDATE 
TO authenticated 
USING (true) 
WITH CHECK (true);
