-- 1. Create return_status type if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'return_status') THEN
        CREATE TYPE return_status AS ENUM ('pending', 'approved', 'rejected', 'completed');
    END IF;
END $$;

-- 2. Enhance products policy to allow stock updates by authenticated users
-- Drop existing policy if it conflicts or just add a new one? 
-- The previous error didn't complain about policy, only about the type.
-- But "Enable update access for all users" might conflict if I already ran it partially? 
-- No, the previous migration failed at step 1 (type error), so it likely rolled back or didn't run.
-- Postgres transactions usually roll back on error in migration scripts if run via tool, but `supabase db push` might run statements.
-- However, "Enable update access for all users" on products:
-- I'll use a unique name to avoid conflict just in case: "Enable stock update for authenticated users"

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'products' AND policyname = 'Enable stock update for authenticated users'
    ) THEN
        CREATE POLICY "Enable stock update for authenticated users" ON "public"."products"
        AS PERMISSIVE FOR UPDATE
        TO authenticated
        USING (true)
        WITH CHECK (true);
    END IF;
END $$;

-- 3. Ensure returns table has status column using the new type
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'returns' AND column_name = 'status') THEN
        ALTER TABLE public.returns ADD COLUMN status return_status NOT NULL DEFAULT 'completed';
    END IF;
END $$;
