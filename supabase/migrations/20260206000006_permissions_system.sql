-- User Permissions System for Retail POS
-- Creates app_routes and user_route_permissions tables

-- 1. Create routes table for all available application routes
CREATE TABLE IF NOT EXISTS public.app_routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    path TEXT UNIQUE NOT NULL,
    parent_name TEXT,
    icon_name TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. Create user route permissions (junction table)
CREATE TABLE IF NOT EXISTS public.user_route_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    route_id UUID NOT NULL REFERENCES public.app_routes(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(user_id, route_id)
);

-- 3. Enable RLS
ALTER TABLE public.app_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_route_permissions ENABLE ROW LEVEL SECURITY;

-- 4. Security definer function to check route access
CREATE OR REPLACE FUNCTION public.has_route_access(_user_id UUID, _route_path TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
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
            up.role = 'admin'
            OR EXISTS (
                SELECT 1 
                FROM public.user_route_permissions urp
                JOIN public.app_routes ar ON ar.id = urp.route_id
                WHERE urp.user_id = _user_id AND ar.path = _route_path
            )
        )
    )
$$;

-- 5. Security definer function to get user routes
CREATE OR REPLACE FUNCTION public.get_user_routes(_user_id UUID)
RETURNS TABLE(path TEXT, name TEXT, parent_name TEXT, icon_name TEXT, sort_order INTEGER)
LANGUAGE SQL
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
            up.role = 'admin'
            OR EXISTS (
                SELECT 1 FROM public.user_route_permissions urp
                WHERE urp.user_id = _user_id AND urp.route_id = ar.id
            )
        )
    )
    ORDER BY ar.sort_order, ar.name
$$;

-- 6. RLS Policies for app_routes
CREATE POLICY "All authenticated can view routes"
    ON public.app_routes FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Admins can manage routes"
    ON public.app_routes FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 7. RLS Policies for user_route_permissions
CREATE POLICY "Users can view own permissions"
    ON public.user_route_permissions FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Admins can manage permissions"
    ON public.user_route_permissions FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 8. Insert default routes based on navigation config
INSERT INTO public.app_routes (name, path, parent_name, icon_name, sort_order) VALUES
    -- Main
    ('Dashboard', '/', NULL, 'LayoutDashboard', 1),
    ('Customers', '/customers', NULL, 'Users', 2),
    
    -- Point of Sale
    ('Sales', '/pos/sales', 'Point of Sale', 'ShoppingCart', 10),
    ('Returns', '/pos/returns', 'Point of Sale', 'RotateCcw', 11),
    ('Forward Orders', '/pos/forward', 'Point of Sale', 'Send', 12),
    
    -- Reports
    ('Sales Summary', '/reports/sales-summary', 'Reports', 'Receipt', 20),
    ('Sales Report', '/reports/daily-sales', 'Reports', 'CalendarDays', 21),
    ('Expense Report', '/reports/expenses', 'Reports', 'CreditCard', 22),
    ('Profit & Loss', '/reports/profit-loss', 'Reports', 'TrendingUp', 23),
    ('Day Summary', '/reports/day-summary', 'Reports', 'CalendarDays', 24),
    ('Product Sales', '/reports/product-sales', 'Reports', 'Package', 25),
    ('Customer Sales', '/reports/customer-sales', 'Reports', 'Users', 26),
    ('Stock Summary', '/reports/stock-summary', 'Reports', 'Warehouse', 27),
    
    -- Inventory
    ('Products', '/products', 'Inventory', 'Package', 30),
    ('Categories', '/categories', 'Inventory', 'Tags', 31),
    ('Stock Receiving', '/inventory/receiving', 'Inventory', 'PackagePlus', 32),
    ('Stock Levels', '/inventory', 'Inventory', 'Layers', 33),
    ('Label Printing', '/barcodes', 'Inventory', 'Barcode', 34),
    
    -- Treasury
    ('Cash in Hand', '/treasury/cash-in-hand', 'Treasury', 'Wallet', 40),
    ('Cash in Drawer', '/treasury/cash-in-drawer', 'Treasury', 'Vault', 41),
    ('Expenses', '/expenses', 'Treasury', 'CreditCard', 42),
    
    -- Setup
    ('Store Settings', '/setup/store', 'Setup', 'Store', 100),
    ('Users', '/setup/users', 'Setup', 'UserCog', 101),
    ('Security', '/setup/security', 'Setup', 'Shield', 102)
ON CONFLICT (path) DO NOTHING;
