-- Enable Realtime for held_carts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'held_carts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE held_carts;
  END IF;
END $$;

-- Drop old RLS policies that rely on user_id (which might be null)
DROP POLICY IF EXISTS "Users can view own held carts" ON public.held_carts;
DROP POLICY IF EXISTS "Users can manage own held carts" ON public.held_carts;

-- Create new RLS policies using created_by and assigned_to
CREATE POLICY "Users can view own held carts"
    ON public.held_carts FOR SELECT
    TO authenticated
    USING (
        created_by = auth.uid() OR 
        assigned_to = auth.uid() OR 
        public.is_admin()
    );

CREATE POLICY "Users can manage own held carts"
    ON public.held_carts FOR ALL
    TO authenticated
    USING (
        created_by = auth.uid() OR 
        assigned_to = auth.uid() OR 
        public.is_admin()
    )
    WITH CHECK (
        created_by = auth.uid() OR 
        assigned_to = auth.uid() OR 
        public.is_admin()
    );
