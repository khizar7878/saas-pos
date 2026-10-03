-- Allow INSERT for ledger_entries
-- This is required for AKWS to push transaction details to Retail POS
CREATE POLICY "Enable insert access for all users" ON "public"."ledger_entries"
AS PERMISSIVE FOR INSERT
TO public
WITH CHECK (true);
