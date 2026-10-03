-- Allow INSERT for accounts
CREATE POLICY "Enable insert access for all users" ON "public"."accounts"
AS PERMISSIVE FOR INSERT
TO public
WITH CHECK (true);

-- Allow UPDATE for accounts (for ledger sync balance updates)
CREATE POLICY "Enable update access for all users" ON "public"."accounts"
AS PERMISSIVE FOR UPDATE
TO public
USING (true)
WITH CHECK (true);

-- Allow INSERT for bank_names
CREATE POLICY "Enable insert access for all users" ON "public"."bank_names"
AS PERMISSIVE FOR INSERT
TO public
WITH CHECK (true);
