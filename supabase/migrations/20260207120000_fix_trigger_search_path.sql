-- Fix search_path for handle_new_user trigger function
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
        COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'admin'::public.user_role),
        default_store_id,
        true
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        store_id = EXCLUDED.store_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
