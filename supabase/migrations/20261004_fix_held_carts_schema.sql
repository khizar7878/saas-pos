-- Fix held_carts schema and realtime sync for SaaS POS
-- Adds missing columns (created_by, assigned_to, page_type)
-- Configures store_id and user defaults and realtime publication

-- 1. Add missing columns
ALTER TABLE public.held_carts 
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS page_type TEXT DEFAULT 'sales';

-- 2. Set sensible defaults for multi-tenant and user context
ALTER TABLE public.held_carts ALTER COLUMN store_id SET DEFAULT public.current_store_id();
ALTER TABLE public.held_carts ALTER COLUMN created_by SET DEFAULT auth.uid();
ALTER TABLE public.held_carts ALTER COLUMN user_id SET DEFAULT auth.uid();

-- 3. Populate existing rows if any
UPDATE public.held_carts 
SET created_by = user_id 
WHERE created_by IS NULL AND user_id IS NOT NULL;

UPDATE public.held_carts 
SET page_type = 'sales' 
WHERE page_type IS NULL;

-- 4. Create performance indexes
CREATE INDEX IF NOT EXISTS idx_held_carts_created_by ON public.held_carts(created_by);
CREATE INDEX IF NOT EXISTS idx_held_carts_assigned_to ON public.held_carts(assigned_to);
CREATE INDEX IF NOT EXISTS idx_held_carts_page_type ON public.held_carts(page_type);

-- 5. Realtime publication & Replica Identity
ALTER TABLE public.held_carts REPLICA IDENTITY FULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'held_carts'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.held_carts;
    END IF;
END $$;

-- 6. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
