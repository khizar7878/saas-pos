-- Add bank_names table and relationship to accounts
-- This fixes 400 errors where API expects bank_names(name) join

-- 1. Create bank_names table
CREATE TABLE IF NOT EXISTS public.bank_names (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add bank_name_id to accounts
ALTER TABLE public.accounts 
ADD COLUMN IF NOT EXISTS bank_name_id UUID REFERENCES public.bank_names(id);

-- 3. Insert specific bank names if they don't exist
INSERT INTO public.bank_names (name) VALUES 
    ('HBL'),
    ('Meezan Bank'),
    ('Bank Alfalah'),
    ('JazzCash'),
    ('EasyPaisa'),
    ('Cash')
ON CONFLICT (name) DO NOTHING;

-- 4. Enable RLS for bank_names
ALTER TABLE public.bank_names ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for bank_names
CREATE POLICY "Everyone can view bank names"
    ON public.bank_names FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Admins can manage bank names"
    ON public.bank_names FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 6. Add trigger for updated_at
CREATE TRIGGER update_bank_names_updated_at 
    BEFORE UPDATE ON public.bank_names 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
