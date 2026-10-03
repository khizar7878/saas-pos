-- This migration only adds the user profile trigger
-- (Tables and types already exist from manual setup)

-- Add trigger to auto-create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    default_store_id UUID;
BEGIN
    -- Get the first store (or create one if none exists)
    SELECT id INTO default_store_id FROM public.stores LIMIT 1;
    
    -- If no store exists, create a default one
    IF default_store_id IS NULL THEN
        INSERT INTO public.stores (name, address, phone, is_active)
        VALUES ('Main Store', 'Default Address', '0000-0000000', true)
        RETURNING id INTO default_store_id;
    END IF;
    
    -- Create user profile
    INSERT INTO public.user_profiles (id, full_name, role, store_id, is_active)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'admin'::user_role),
        default_store_id,
        true
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Backfill: Create profiles for existing users that don't have one
DO $$
DECLARE
    default_store_id UUID;
    user_record RECORD;
BEGIN
    -- Get the first store
    SELECT id INTO default_store_id FROM public.stores LIMIT 1;
    
    -- Create profiles for users without one
    FOR user_record IN 
        SELECT u.id, u.email, u.raw_user_meta_data
        FROM auth.users u
        LEFT JOIN public.user_profiles p ON u.id = p.id
        WHERE p.id IS NULL
    LOOP
        INSERT INTO public.user_profiles (id, full_name, role, store_id, is_active)
        VALUES (
            user_record.id,
            COALESCE(user_record.raw_user_meta_data->>'full_name', user_record.email),
            'admin'::user_role,
            default_store_id,
            true
        )
        ON CONFLICT (id) DO NOTHING;
    END LOOP;
END $$;
