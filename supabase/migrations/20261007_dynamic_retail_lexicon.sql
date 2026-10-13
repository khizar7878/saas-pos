-- ==============================================================================
-- Dynamic Retail Lexicon & Industry Archetypes Migration
-- Enables multi-vertical product models (Fabrics, Apparel, General Retail, etc.)
-- ==============================================================================

-- 1. Add business_type to stores
ALTER TABLE public.stores 
ADD COLUMN IF NOT EXISTS business_type TEXT DEFAULT 'general_retail';

-- 2. Add lexicon to store_settings
ALTER TABLE public.store_settings 
ADD COLUMN IF NOT EXISTS lexicon JSONB DEFAULT '{
    "item_singular": "Product",
    "item_plural": "Products",
    "primary_unit": "pcs",
    "secondary_metric_name": null,
    "secondary_metric_symbol": null,
    "enable_secondary_metric": false,
    "allow_fractional_qty": false
}'::jsonb;

-- 3. Update existing teststore with fabric archetype configuration
UPDATE public.stores 
SET business_type = 'fabrics' 
WHERE id = '11111111-1111-1111-1111-111111111111' OR slug = 'teststore';

UPDATE public.store_settings 
SET lexicon = '{
    "item_singular": "Suit",
    "item_plural": "Suits",
    "primary_unit": "suits",
    "secondary_metric_name": "Meters",
    "secondary_metric_symbol": "m",
    "enable_secondary_metric": true,
    "allow_fractional_qty": false
}'::jsonb 
WHERE store_id = '11111111-1111-1111-1111-111111111111';

-- 4. Overload / Upgrade provision_tenant_store to support business_type and custom lexicon
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
    }'::jsonb,
    p_business_type TEXT DEFAULT 'general_retail',
    p_lexicon JSONB DEFAULT NULL
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
    v_resolved_lexicon JSONB;
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

    -- Resolve Lexicon based on business_type if not explicitly passed
    IF p_lexicon IS NOT NULL THEN
        v_resolved_lexicon := p_lexicon;
    ELSE
        CASE p_business_type
            WHEN 'fabrics' THEN
                v_resolved_lexicon := '{
                    "item_singular": "Suit",
                    "item_plural": "Suits",
                    "primary_unit": "suits",
                    "secondary_metric_name": "Meters",
                    "secondary_metric_symbol": "m",
                    "enable_secondary_metric": true,
                    "allow_fractional_qty": false
                }'::jsonb;
            WHEN 'fabric_rolls' THEN
                v_resolved_lexicon := '{
                    "item_singular": "Fabric",
                    "item_plural": "Fabrics",
                    "primary_unit": "meters",
                    "secondary_metric_name": "Rolls",
                    "secondary_metric_symbol": "rolls",
                    "enable_secondary_metric": true,
                    "allow_fractional_qty": true
                }'::jsonb;
            WHEN 'apparel' THEN
                v_resolved_lexicon := '{
                    "item_singular": "Article",
                    "item_plural": "Articles",
                    "primary_unit": "pcs",
                    "secondary_metric_name": null,
                    "secondary_metric_symbol": null,
                    "enable_secondary_metric": false,
                    "allow_fractional_qty": false
                }'::jsonb;
            WHEN 'footwear' THEN
                v_resolved_lexicon := '{
                    "item_singular": "Pair",
                    "item_plural": "Pairs",
                    "primary_unit": "pairs",
                    "secondary_metric_name": null,
                    "secondary_metric_symbol": null,
                    "enable_secondary_metric": false,
                    "allow_fractional_qty": false
                }'::jsonb;
            WHEN 'electronics' THEN
                v_resolved_lexicon := '{
                    "item_singular": "Device",
                    "item_plural": "Devices",
                    "primary_unit": "pcs",
                    "secondary_metric_name": null,
                    "secondary_metric_symbol": null,
                    "enable_secondary_metric": false,
                    "allow_fractional_qty": false
                }'::jsonb;
            WHEN 'grocery' THEN
                v_resolved_lexicon := '{
                    "item_singular": "Item",
                    "item_plural": "Items",
                    "primary_unit": "kg",
                    "secondary_metric_name": null,
                    "secondary_metric_symbol": null,
                    "enable_secondary_metric": false,
                    "allow_fractional_qty": true
                }'::jsonb;
            ELSE
                v_resolved_lexicon := '{
                    "item_singular": "Product",
                    "item_plural": "Products",
                    "primary_unit": "pcs",
                    "secondary_metric_name": null,
                    "secondary_metric_symbol": null,
                    "enable_secondary_metric": false,
                    "allow_fractional_qty": false
                }'::jsonb;
        END CASE;
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
        business_type,
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
        COALESCE(p_business_type, 'general_retail'),
        v_owner_user_id,
        NOW(),
        NOW()
    );

    -- 2. Create Store Settings with Lexicon
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
        weekly_off_days,
        lexicon
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
        ARRAY['friday']::text[],
        v_resolved_lexicon
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
        (v_store_id, 'Meezan Bank Ltd (Primary)', 'asset', 'bank', 0, false, true);

    -- 5. Seed default General product category
    INSERT INTO public.product_categories (store_id, name, description)
    VALUES (v_store_id, 'General', 'Default Category')
    ON CONFLICT (store_id, name) DO NOTHING;

    -- 6. Create GoTrue User in auth.users
    INSERT INTO auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        invited_at,
        confirmation_token,
        confirmation_sent_at,
        recovery_token,
        recovery_sent_at,
        email_change_token_new,
        email_change,
        email_change_sent_at,
        last_sign_in_at,
        raw_app_meta_data,
        raw_user_meta_data,
        is_super_admin,
        created_at,
        updated_at,
        phone,
        phone_confirmed_at,
        phone_change,
        phone_change_token,
        phone_change_sent_at,
        email_change_token_current,
        email_change_confirm_status,
        banned_until,
        reauthentication_token,
        reauthentication_sent_at,
        is_sso_user,
        deleted_at,
        is_anonymous
    ) VALUES (
        '00000000-0000-0000-0000-000000000000',
        v_owner_user_id,
        'authenticated',
        'authenticated',
        v_clean_email,
        v_encrypted_pw,
        NOW(),
        NULL,
        '',
        NULL,
        '',
        NULL,
        '',
        '',
        NULL,
        NULL,
        '{"provider": "email", "providers": ["email"]}'::jsonb,
        jsonb_build_object('full_name', trim(p_owner_name), 'store_id', v_store_id),
        false,
        NOW(),
        NOW(),
        NULL,
        NULL,
        '',
        '',
        NULL,
        '',
        0,
        NULL,
        '',
        NULL,
        false,
        NULL,
        false
    );

    -- 7. Insert Identity record
    INSERT INTO auth.identities (
        id,
        user_id,
        identity_data,
        provider,
        provider_id,
        last_sign_in_at,
        created_at,
        updated_at
    ) VALUES (
        gen_random_uuid(),
        v_owner_user_id,
        jsonb_build_object('sub', v_owner_user_id::text, 'email', v_clean_email),
        'email',
        v_clean_email,
        NOW(),
        NOW(),
        NOW()
    );

    -- 8. Insert User Profile in public.user_profiles
    INSERT INTO public.user_profiles (
        id,
        full_name,
        role,
        store_id,
        is_active,
        custom_role_name,
        created_at,
        updated_at
    ) VALUES (
        v_owner_user_id,
        trim(p_owner_name),
        'owner',
        v_store_id,
        true,
        'Store Owner',
        NOW(),
        NOW()
    );

    -- 9. Grant route permissions
    FOR v_route_record IN 
        SELECT id FROM public.app_routes
    LOOP
        INSERT INTO public.user_route_permissions (user_id, route_id)
        VALUES (v_owner_user_id, v_route_record.id)
        ON CONFLICT DO NOTHING;
    END LOOP;

    -- Return provisioning payload
    RETURN jsonb_build_object(
        'success', true,
        'store_id', v_store_id,
        'store_name', trim(p_store_name),
        'slug', v_clean_slug,
        'business_type', COALESCE(p_business_type, 'general_retail'),
        'lexicon', v_resolved_lexicon,
        'owner_id', v_owner_user_id,
        'owner_email', v_clean_email,
        'initial_password', p_owner_password,
        'subscription_tier', p_subscription_tier,
        'fbr_environment', p_fbr_environment
    );
END;
$$;

-- 5. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
