// User Permissions System for POS
// Run this SQL in your Supabase SQL Editor

/*
-- 1. Create user_profiles table
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email text UNIQUE NOT NULL,
    full_name text,
    is_admin boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

-- 2. Create routes table for all available application routes
CREATE TABLE IF NOT EXISTS public.app_routes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    path text UNIQUE NOT NULL,
    parent_name text,
    icon_name text,
    sort_order integer DEFAULT 0,
    created_at timestamptz DEFAULT now() NOT NULL
);

-- 3. Create user route permissions (junction table)
CREATE TABLE IF NOT EXISTS public.user_route_permissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    route_id uuid NOT NULL REFERENCES public.app_routes(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE(user_id, route_id)
);

-- 4. Enable RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_route_permissions ENABLE ROW LEVEL SECURITY;

-- 5. Security definer functions
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(
        (SELECT is_admin FROM public.user_profiles WHERE id = _user_id),
        false
    )
$$;

CREATE OR REPLACE FUNCTION public.has_route_access(_user_id uuid, _route_path text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 
        FROM public.user_profiles up
        WHERE up.id = _user_id 
        AND up.is_active = true
        AND (
            up.is_admin = true
            OR EXISTS (
                SELECT 1 
                FROM public.user_route_permissions urp
                JOIN public.app_routes ar ON ar.id = urp.route_id
                WHERE urp.user_id = _user_id AND ar.path = _route_path
            )
        )
    )
$$;

CREATE OR REPLACE FUNCTION public.get_user_routes(_user_id uuid)
RETURNS TABLE(path text, name text, parent_name text, icon_name text, sort_order integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT ar.path, ar.name, ar.parent_name, ar.icon_name, ar.sort_order
    FROM public.app_routes ar
    WHERE EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = _user_id AND up.is_active = true
        AND (
            up.is_admin = true
            OR EXISTS (
                SELECT 1 FROM public.user_route_permissions urp
                WHERE urp.user_id = _user_id AND urp.route_id = ar.id
            )
        )
    )
    ORDER BY ar.sort_order, ar.name
$$;

-- 6. RLS Policies

-- user_profiles policies
CREATE POLICY "Users can view own profile"
    ON public.user_profiles FOR SELECT
    TO authenticated
    USING (auth.uid() = id OR public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert profiles"
    ON public.user_profiles FOR INSERT
    TO authenticated
    WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update profiles"
    ON public.user_profiles FOR UPDATE
    TO authenticated
    USING (public.is_admin(auth.uid()))
    WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete profiles"
    ON public.user_profiles FOR DELETE
    TO authenticated
    USING (public.is_admin(auth.uid()) AND id != auth.uid());

-- app_routes policies
CREATE POLICY "All authenticated can view routes"
    ON public.app_routes FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Admins can manage routes"
    ON public.app_routes FOR ALL
    TO authenticated
    USING (public.is_admin(auth.uid()))
    WITH CHECK (public.is_admin(auth.uid()));

-- user_route_permissions policies
CREATE POLICY "Users can view own permissions"
    ON public.user_route_permissions FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage permissions"
    ON public.user_route_permissions FOR ALL
    TO authenticated
    USING (public.is_admin(auth.uid()))
    WITH CHECK (public.is_admin(auth.uid()));

-- 7. Insert default routes
INSERT INTO public.app_routes (name, path, parent_name, icon_name, sort_order) VALUES
    ('Dashboard', '/', NULL, 'LayoutDashboard', 1),
    ('Sales', '/sales', NULL, 'ShoppingCart', 2),
    ('Returns', '/returns', NULL, 'RotateCcw', 3),
    ('Credit Sales', '/credit-sales', NULL, 'CreditCard', 4),
    ('Products', '/inventory/products', 'Inventory', 'Package', 10),
    ('Stock Receiving', '/inventory/receiving', 'Inventory', 'PackagePlus', 11),
    ('Stock Levels', '/inventory', 'Inventory', 'Layers', 12),
    ('Barcode Printing', '/inventory/barcodes', 'Inventory', 'Barcode', 13),
    ('All Accounts', '/accounts', 'Accounts', 'Users', 20),
    ('Cash in Hand', '/accounts/cash-in-hand', 'Accounts', 'Wallet', 21),
    ('Cash Reserve', '/accounts/cash-reserve', 'Accounts', 'Vault', 22),
    ('Cheques', '/accounts/cheques', 'Accounts', 'FileText', 23),
    ('Daily Closing', '/accounts/daily-closing', 'Accounts', 'ClipboardCheck', 24),
    ('Receivables', '/accounts/receivables', 'Accounts', 'TrendingUp', 25),
    ('Payables', '/accounts/payables', 'Accounts', 'TrendingDown', 26),
    ('Payments', '/accounts/payments', 'Accounts', 'Receipt', 27),
    ('Users', '/setup/users', 'Setup', 'UserCog', 100)
ON CONFLICT (path) DO NOTHING;

-- 8. Create trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_user_profile_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_user_profile_updated_at();

-- 9. IMPORTANT: Create admin profile for khizarhayat0015@gmail.com
-- Run this AFTER the admin user has signed up in Supabase Auth
-- Replace 'ADMIN_USER_UUID' with the actual UUID from auth.users

-- INSERT INTO public.user_profiles (id, email, full_name, is_admin, is_active)
-- VALUES ('ADMIN_USER_UUID', 'khizarhayat0015@gmail.com', 'Admin', true, true);
*/

export const SQL_MIGRATION = `
-- Run this in Supabase SQL Editor
-- See the commented SQL above for the full migration
`;
