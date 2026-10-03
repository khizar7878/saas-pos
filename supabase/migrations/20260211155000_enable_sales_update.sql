-- Allow authenticated users to update their own sales (or all sales if they are staff)
-- For simplicity in this POS context where all users are trusted staff:
CREATE POLICY "Enable update for authenticated users on sales"
ON "public"."sales"
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);
