-- Add UPDATE RLS policy to the returns table
-- This allows authenticated users to update return records (e.g., adding FBR invoice numbers)

CREATE POLICY "Users can update returns" 
ON public.returns 
FOR UPDATE 
TO authenticated 
USING (true) 
WITH CHECK (true);
