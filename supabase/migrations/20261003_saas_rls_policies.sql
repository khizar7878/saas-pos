-- Multi-Tenant SaaS RLS Policies

-- 1. Helper function to check tenant access
CREATE OR REPLACE FUNCTION public.has_store_access(_store_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
    SELECT (
        public.is_superadmin() 
        OR _store_id = public.current_store_id()
        -- Allow demo store reading for unauthenticated/demo requests if needed
        OR (_store_id = '11111111-1111-1111-1111-111111111111'::uuid AND auth.uid() IS NULL)
    );
$$;

-- 2. Stores Table Policies
DROP POLICY IF EXISTS "Stores access policy" ON public.stores;
CREATE POLICY "Stores access policy" ON public.stores
    FOR ALL TO authenticated, anon
    USING (
        public.is_superadmin()
        OR id = public.current_store_id()
        OR is_active = true
    )
    WITH CHECK (
        public.is_superadmin()
        OR (id = public.current_store_id() AND public.has_role(auth.uid(), 'owner'))
    );

-- 3. User Profiles Policies
DROP POLICY IF EXISTS "User profiles read policy" ON public.user_profiles;
DROP POLICY IF EXISTS "User profiles write policy" ON public.user_profiles;
CREATE POLICY "User profiles read policy" ON public.user_profiles
    FOR SELECT TO authenticated
    USING (
        public.is_superadmin()
        OR id = auth.uid()
        OR store_id = public.current_store_id()
    );

CREATE POLICY "User profiles write policy" ON public.user_profiles
    FOR ALL TO authenticated
    USING (
        public.is_superadmin()
        OR id = auth.uid()
        OR (store_id = public.current_store_id() AND public.has_role(auth.uid(), 'admin'))
    )
    WITH CHECK (
        public.is_superadmin()
        OR id = auth.uid()
        OR (store_id = public.current_store_id() AND public.has_role(auth.uid(), 'admin'))
    );

-- 4. App Routes Policies
DROP POLICY IF EXISTS "App routes read policy" ON public.app_routes;
CREATE POLICY "App routes read policy" ON public.app_routes
    FOR SELECT TO authenticated, anon
    USING (true);

DROP POLICY IF EXISTS "User route permissions policy" ON public.user_route_permissions;
CREATE POLICY "User route permissions policy" ON public.user_route_permissions
    FOR ALL TO authenticated
    USING (
        public.is_superadmin()
        OR user_id = auth.uid()
        OR public.has_role(auth.uid(), 'admin')
    )
    WITH CHECK (
        public.is_superadmin()
        OR public.has_role(auth.uid(), 'admin')
    );

-- 5. Operational Tables with direct store_id
DO $$
DECLARE
    tbl text;
    tables text[] := ARRAY[
        'store_settings',
        'product_categories',
        'products',
        'customers',
        'sales',
        'credit_sales',
        'returns',
        'daily_reconciliations',
        'daily_expenses',
        'reconciliation_ibft_entries',
        'reconciliation_card_entries',
        'accounts',
        'account_transactions',
        'ledger_entries',
        'payments',
        'held_carts',
        'sequences',
        'spreadsheets',
        'bank_names'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Tenant isolation policy on %I" ON public.%I;', tbl, tbl);
        EXECUTE format('
            CREATE POLICY "Tenant isolation policy on %I" ON public.%I
            FOR ALL TO authenticated, anon
            USING (public.has_store_access(store_id))
            WITH CHECK (public.has_store_access(store_id));
        ', tbl, tbl);
    END LOOP;
END $$;

-- 6. Child Tables without direct store_id (sale_items, return_items, product_variants)
DROP POLICY IF EXISTS "Tenant isolation on sale_items" ON public.sale_items;
CREATE POLICY "Tenant isolation on sale_items" ON public.sale_items
    FOR ALL TO authenticated, anon
    USING (
        EXISTS (
            SELECT 1 FROM public.sales s
            WHERE s.id = sale_items.sale_id AND public.has_store_access(s.store_id)
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.sales s
            WHERE s.id = sale_items.sale_id AND public.has_store_access(s.store_id)
        )
    );

DROP POLICY IF EXISTS "Tenant isolation on return_items" ON public.return_items;
CREATE POLICY "Tenant isolation on return_items" ON public.return_items
    FOR ALL TO authenticated, anon
    USING (
        EXISTS (
            SELECT 1 FROM public.returns r
            WHERE r.id = return_items.return_id AND public.has_store_access(r.store_id)
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.returns r
            WHERE r.id = return_items.return_id AND public.has_store_access(r.store_id)
        )
    );

DROP POLICY IF EXISTS "Tenant isolation on product_variants" ON public.product_variants;
CREATE POLICY "Tenant isolation on product_variants" ON public.product_variants
    FOR ALL TO authenticated, anon
    USING (
        EXISTS (
            SELECT 1 FROM public.products p
            WHERE p.id = product_variants.product_id AND public.has_store_access(p.store_id)
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.products p
            WHERE p.id = product_variants.product_id AND public.has_store_access(p.store_id)
        )
    );
