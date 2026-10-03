-- Drop the existing role-based policies
DROP POLICY IF EXISTS "Managers and admins can manage products" ON public.products;

-- Create the new route-based policy
CREATE POLICY "Users with product route access can manage products" 
ON public.products 
FOR ALL 
TO authenticated 
USING (
    public.has_route_access(auth.uid(), '/products')
)
WITH CHECK (
    public.has_route_access(auth.uid(), '/products')
);
