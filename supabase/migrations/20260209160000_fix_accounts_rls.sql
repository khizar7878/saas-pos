-- Enable RLS on accounts table if not already enabled (should be, but just in case)
ALTER TABLE "public"."accounts" ENABLE ROW LEVEL SECURITY;

-- Create policy to allow authenticated users to view all accounts
CREATE POLICY "Enable read access for all users" ON "public"."accounts"
AS PERMISSIVE FOR SELECT
TO public
USING (true);

-- Also enable for bank_names just in case
ALTER TABLE "public"."bank_names" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON "public"."bank_names"
AS PERMISSIVE FOR SELECT
TO public
USING (true);
