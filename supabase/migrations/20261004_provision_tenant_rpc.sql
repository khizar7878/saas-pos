-- ==============================================================================
-- SaaS Multi-Tenant Provisioning RPC & Role Permission Enhancements
-- ==============================================================================

-- 1. Upgrade public.has_role so 'admin' matches superadmin, owner, and admin
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = _user_id 
        AND (
            role::text = _role
            OR (_role = 'admin' AND role::text IN ('superadmin', 'owner', 'admin'))
        )
        AND is_active = true
    );
$$;

-- 2. Tenant Provisioning RPC: Atomically provisions Store, Settings, Sequences,
--    Default Accounts, Owner Auth Credentials, Profile, and Permissions.
CREATE OR REPLACE FUNCTION public.provision_tenant_store(
    p_store_name TEXT,
    p_slug TEXT,
    p_owner_name TEXT,
    p_owner_email TEXT,
    p_owner_password TEXT,
    p_phone TEXT DEFAULT NULL,
    p_city TEXT DEFAULT 'Lahore',
    p_ntn TEXT DEFAULT NULL,
    p_subscription_tier public.subscription_tier DEFAULT 'professional',
    p_fbr_environment public.fbr_environment DEFAULT 'sandbox',
    p_fbr_pos_id TEXT DEFAULT '189142',
    p_enabled_modules JSONB DEFAULT '{
        "fbr_integration": true,
        "daily_reconciliation": true,
        "treasury_accounts": true,
        "credit_sales": true,
        "barcode_printing": true,
        "online_store": false
    }'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_clean_slug TEXT;
    v_clean_email TEXT;
    v_store_id UUID;
    v_owner_user_id UUID;
    v_encrypted_pw TEXT;
    v_route_record RECORD;
BEGIN
    -- Security verification: Only superadmin can provision new client tenants (allow direct DB admin script when auth.uid() IS NULL)
    IF auth.uid() IS NOT NULL AND NOT public.is_superadmin() THEN
        RAISE EXCEPTION 'Access Denied: Only platform superadmins can provision new tenant stores.';
    END IF;

    -- Clean & sanitize inputs
    v_clean_slug := lower(trim(p_slug));
    v_clean_email := lower(trim(p_owner_email));

    IF v_clean_slug = '' THEN
        RAISE EXCEPTION 'Store URL slug cannot be empty.';
    END IF;

    IF v_clean_email = '' OR p_owner_password = '' THEN
        RAISE EXCEPTION 'Owner email and initial password are required.';
    END IF;

    -- Check if slug already exists
    IF EXISTS (SELECT 1 FROM public.stores WHERE slug = v_clean_slug) THEN
        RAISE EXCEPTION 'Store slug "%" is already taken. Please choose another.', v_clean_slug;
    END IF;

    -- Check if owner email already exists in auth.users
    IF EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = v_clean_email) THEN
        RAISE EXCEPTION 'A user with email "%" already exists in the system.', v_clean_email;
    END IF;

    -- Generate UUIDs
    v_store_id := gen_random_uuid();
    v_owner_user_id := gen_random_uuid();

    -- Hash password using bcrypt (10 rounds standard for Supabase GoTrue)
    v_encrypted_pw := extensions.crypt(p_owner_password, extensions.gen_salt('bf', 10));

    -- 1. Create Store Record
    INSERT INTO public.stores (
        id,
        name,
        slug,
        address,
        phone,
        contact_email,
        city,
        ntn_strn,
        is_active,
        subscription_tier,
        subscription_status,
        billing_cycle,
        monthly_fee,
        max_terminals,
        max_products,
        fbr_environment,
        enabled_modules,
        owner_id,
        created_at,
        updated_at
    ) VALUES (
        v_store_id,
        trim(p_store_name),
        v_clean_slug,
        'Main Outlet, ' || COALESCE(p_city, 'Lahore'),
        p_phone,
        v_clean_email,
        p_city,
        p_ntn,
        true,
        p_subscription_tier,
        'active',
        'monthly',
        0,
        5,
        10000,
        p_fbr_environment,
        p_enabled_modules,
        v_owner_user_id,
        NOW(),
        NOW()
    );

    -- 2. Create Store Settings
    INSERT INTO public.store_settings (
        store_id,
        store_name,
        address,
        phone,
        email,
        header_text,
        footer_text,
        exchange_policy,
        fbr_integration_enabled,
        fbr_pos_id,
        fbr_api_url,
        fbr_environment,
        weekly_off_days
    ) VALUES (
        v_store_id,
        trim(p_store_name),
        'Main Outlet, ' || COALESCE(p_city, 'Lahore'),
        p_phone,
        v_clean_email,
        'Welcome to ' || trim(p_store_name),
        'Thank you for shopping with us!',
        'Exchanges accepted within 7 days with original invoice.',
        COALESCE((p_enabled_modules->>'fbr_integration')::boolean, true),
        COALESCE(NULLIF(trim(p_fbr_pos_id), ''), '189142'),
        'http://146.190.202.112:5060/api/fbr/submit-invoice',
        p_fbr_environment,
        ARRAY['friday']::text[]
    );

    -- 3. Initialize Operational Sequences
    INSERT INTO public.sequences (id, store_id, current_value, prefix) VALUES
        ('sale', v_store_id, 0, 'INV-'),
        ('return', v_store_id, 0, 'RET-'),
        ('credit_sale', v_store_id, 0, 'CS-'),
        ('stock_receipt', v_store_id, 0, 'SR-');

    -- 4. Create Default Accounts (Cash in Hand Till & Primary Bank)
    INSERT INTO public.accounts (store_id, name, account_type, account_subtype, current_balance, is_system, is_active)
    VALUES
        (v_store_id, 'Cash in Hand (Counter Till)', 'asset', 'cash_in_hand', 0, true, true),
        (v_store_id, 'Primary Business Bank', 'asset', 'bank', 0, false, true);

    -- 5. Create Default Product Category
    INSERT INTO public.product_categories (store_id, name, description)
    VALUES (v_store_id, 'General Items', 'Default category for products');

    -- 6. Create Owner User in auth.users
    INSERT INTO auth.users (
        id,
        instance_id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        confirmation_token,
        recovery_token,
        email_change_token_new,
        email_change,
        phone,
        phone_change,
        phone_change_token,
        reauthentication_token,
        raw_app_meta_data,
        raw_user_meta_data,
        is_sso_user,
        created_at,
        updated_at
    ) VALUES (
        v_owner_user_id,
        '00000000-0000-0000-0000-000000000000'::uuid,
        'authenticated',
        'authenticated',
        v_clean_email,
        v_encrypted_pw,
        NOW(),
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        jsonb_build_object(
            'provider', 'email',
            'providers', jsonb_build_array('email'),
            'store_id', v_store_id::text
        ),
        jsonb_build_object(
            'full_name', trim(p_owner_name)
        ),
        false,
        NOW(),
        NOW()
    );

    -- 7. Create Owner Identity in auth.identities
    INSERT INTO auth.identities (
        id,
        provider_id,
        user_id,
        identity_data,
        provider,
        created_at,
        updated_at
    ) VALUES (
        gen_random_uuid(),
        v_owner_user_id::text,
        v_owner_user_id,
        jsonb_build_object(
            'sub', v_owner_user_id::text,
            'email', v_clean_email
        ),
        'email',
        NOW(),
        NOW()
    );

    -- 8. Create Owner User Profile in public.user_profiles
    INSERT INTO public.user_profiles (
        id,
        full_name,
        role,
        store_id,
        is_active,
        created_at,
        updated_at
    ) VALUES (
        v_owner_user_id,
        trim(p_owner_name),
        'owner'::public.user_role,
        v_store_id,
        true,
        NOW(),
        NOW()
    );

    -- 9. Grant Route Permissions to Owner (All operational routes except superadmin)
    FOR v_route_record IN (
        SELECT id FROM public.app_routes WHERE COALESCE(module_key, '') != 'superadmin'
    )
    LOOP
        INSERT INTO public.user_route_permissions (user_id, route_id)
        VALUES (v_owner_user_id, v_route_record.id)
        ON CONFLICT DO NOTHING;
    END LOOP;

    -- Return full provisioning result
    RETURN jsonb_build_object(
        'success', true,
        'store_id', v_store_id,
        'store_name', trim(p_store_name),
        'slug', v_clean_slug,
        'owner_id', v_owner_user_id,
        'owner_name', trim(p_owner_name),
        'owner_email', v_clean_email
    );
END;
$$;
