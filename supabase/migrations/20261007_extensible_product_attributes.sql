-- ==============================================================================
-- Phase 2: Extensible Product Attributes & Store-Defined Custom Fields Migration
-- Enables stores to configure custom product fields (Brand, Material, Expiry, etc.)
-- ==============================================================================

-- 1. Add metadata and meters_per_piece to products
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS meters_per_piece NUMERIC(10, 2) DEFAULT 4.0;

-- GIN index for high-performance JSONB attribute queries and POS keyword search
CREATE INDEX IF NOT EXISTS idx_products_metadata 
ON public.products USING gin (metadata);

-- 2. Add custom_product_fields configuration to store_settings
ALTER TABLE public.store_settings 
ADD COLUMN IF NOT EXISTS custom_product_fields JSONB DEFAULT '[]'::jsonb;

-- 3. Configure teststore with Fabric default custom fields
UPDATE public.store_settings 
SET custom_product_fields = '[
  {
    "id": "fabric_type",
    "name": "Fabric Type",
    "type": "select",
    "options": ["Cotton", "Wash & Wear", "Boski", "Karandi", "Khaddar", "Lawn", "Silk", "Wool", "Linen"],
    "placeholder": "Select fabric type",
    "required": false,
    "show_in_pos": true,
    "show_in_table": true
  },
  {
    "id": "season",
    "name": "Season",
    "type": "select",
    "options": ["Summer", "Winter", "Mid-Season", "All Season"],
    "placeholder": "Select season",
    "required": false,
    "show_in_pos": true,
    "show_in_table": true
  },
  {
    "id": "pana",
    "name": "Pana / Width (Inches)",
    "type": "number",
    "placeholder": "e.g. 54 or 58",
    "required": false,
    "show_in_pos": false,
    "show_in_table": false
  },
  {
    "id": "brand",
    "name": "Brand / Mill",
    "type": "text",
    "placeholder": "e.g. Grace, Pasha, Ahmad",
    "required": false,
    "show_in_pos": true,
    "show_in_table": true
  }
]'::jsonb
WHERE store_id = '11111111-1111-1111-1111-111111111111';

-- 4. Upgrade provision_tenant_store to automatically initialize custom_product_fields based on business_type
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
    v_default_custom_fields JSONB;
BEGIN
    -- Security verification: Only superadmin can provision new client tenants
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
        RAISE EXCEPTION 'User email "%" already exists. Please use a unique login email.', v_clean_email;
    END IF;

    -- Resolve default lexicon based on archetype if not explicitly passed
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

    -- Resolve default custom product fields based on archetype
    CASE p_business_type
        WHEN 'fabrics' THEN
            v_default_custom_fields := '[
                {"id": "fabric_type", "name": "Fabric Type", "type": "select", "options": ["Cotton", "Wash & Wear", "Boski", "Karandi", "Khaddar", "Lawn", "Silk", "Wool", "Linen"], "placeholder": "Select fabric type", "required": false, "show_in_pos": true, "show_in_table": true},
                {"id": "season", "name": "Season", "type": "select", "options": ["Summer", "Winter", "Mid-Season", "All Season"], "placeholder": "Select season", "required": false, "show_in_pos": true, "show_in_table": true},
                {"id": "pana", "name": "Pana / Width (Inches)", "type": "number", "placeholder": "e.g. 54 or 58", "required": false, "show_in_pos": false, "show_in_table": false},
                {"id": "brand", "name": "Brand / Mill", "type": "text", "placeholder": "e.g. Grace, Pasha, Ahmad", "required": false, "show_in_pos": true, "show_in_table": true}
            ]'::jsonb;
        WHEN 'fabric_rolls' THEN
            v_default_custom_fields := '[
                {"id": "material", "name": "Material Composition", "type": "text", "placeholder": "e.g. 100% Linen", "required": false, "show_in_pos": true, "show_in_table": true},
                {"id": "width", "name": "Roll Width (Inches)", "type": "number", "placeholder": "e.g. 60", "required": false, "show_in_pos": false, "show_in_table": false},
                {"id": "pattern", "name": "Pattern", "type": "select", "options": ["Solid / Plain", "Printed", "Jacquard", "Embroidered", "Striped"], "placeholder": "Select pattern", "required": false, "show_in_pos": true, "show_in_table": true}
            ]'::jsonb;
        WHEN 'apparel' THEN
            v_default_custom_fields := '[
                {"id": "brand", "name": "Brand", "type": "text", "placeholder": "e.g. Zara, Outfitters", "required": false, "show_in_pos": true, "show_in_table": true},
                {"id": "gender", "name": "Gender / Dept", "type": "select", "options": ["Men", "Women", "Boys", "Girls", "Unisex"], "placeholder": "Select gender", "required": false, "show_in_pos": true, "show_in_table": true},
                {"id": "material", "name": "Material", "type": "text", "placeholder": "e.g. 100% Cotton, Denim", "required": false, "show_in_pos": false, "show_in_table": false},
                {"id": "fit", "name": "Fit Style", "type": "select", "options": ["Regular Fit", "Slim Fit", "Relaxed Fit", "Oversized"], "placeholder": "Select fit", "required": false, "show_in_pos": true, "show_in_table": true}
            ]'::jsonb;
        WHEN 'footwear' THEN
            v_default_custom_fields := '[
                {"id": "brand", "name": "Brand", "type": "text", "placeholder": "e.g. Nike, Service, Bata", "required": false, "show_in_pos": true, "show_in_table": true},
                {"id": "gender", "name": "Gender", "type": "select", "options": ["Men", "Women", "Kids", "Unisex"], "placeholder": "Select gender", "required": false, "show_in_pos": true, "show_in_table": true},
                {"id": "upper_material", "name": "Upper Material", "type": "select", "options": ["Genuine Leather", "Synthetic", "Canvas", "Mesh", "Suede"], "placeholder": "Select material", "required": false, "show_in_pos": false, "show_in_table": false}
            ]'::jsonb;
        WHEN 'electronics' THEN
            v_default_custom_fields := '[
                {"id": "brand", "name": "Brand / Manufacturer", "type": "text", "placeholder": "e.g. Samsung, Apple, Sony", "required": false, "show_in_pos": true, "show_in_table": true},
                {"id": "model", "name": "Model / Specs", "type": "text", "placeholder": "e.g. Galaxy S24, 256GB", "required": false, "show_in_pos": true, "show_in_table": true},
                {"id": "warranty", "name": "Warranty Period", "type": "text", "placeholder": "e.g. 1 Year Official Warranty", "required": false, "show_in_pos": true, "show_in_table": true}
            ]'::jsonb;
        WHEN 'grocery' THEN
            v_default_custom_fields := '[
                {"id": "brand", "name": "Brand / Packager", "type": "text", "placeholder": "e.g. National, Nestle", "required": false, "show_in_pos": true, "show_in_table": true},
                {"id": "expiry_date", "name": "Expiry Date", "type": "date", "required": false, "show_in_pos": false, "show_in_table": true},
                {"id": "batch_no", "name": "Batch / Lot #", "type": "text", "placeholder": "e.g. B-2026-04", "required": false, "show_in_pos": false, "show_in_table": false}
            ]'::jsonb;
        ELSE
            v_default_custom_fields := '[
                {"id": "brand", "name": "Brand", "type": "text", "placeholder": "e.g. Brand Name", "required": false, "show_in_pos": true, "show_in_table": true}
            ]'::jsonb;
    END CASE;

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

    -- 2. Create Store Settings with Lexicon and Custom Product Fields
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
        lexicon,
        custom_product_fields
    ) VALUES (
        v_store_id,
        trim(p_store_name),
        'Main Outlet, ' || COALESCE(p_city, 'Lahore'),
        p_phone,
        v_clean_email,
        'Welcome to ' || trim(p_store_name),
        'Thank you for shopping with us!',
        'Exchanges accepted within 7 days with original invoice.',
        (p_enabled_modules->>'fbr_integration')::boolean,
        p_fbr_pos_id,
        'http://146.190.202.112:5060/api/fbr/submit-invoice',
        p_fbr_environment,
        ARRAY['friday'],
        v_resolved_lexicon,
        v_default_custom_fields
    );

    -- 3. Create Default Sequences for Tenant
    INSERT INTO public.sequences (id, store_id, current_number) VALUES
        ('sale_number', v_store_id, 1),
        ('return_number', v_store_id, 1),
        ('quotation_number', v_store_id, 1),
        ('fbr_invoice_number', v_store_id, 1),
        ('order_number', v_store_id, 1001)
    ON CONFLICT (id, store_id) DO NOTHING;

    -- 4. Create Default Till Cash Account & Bank Account
    INSERT INTO public.accounts (
        id,
        store_id,
        name,
        account_type,
        account_number,
        current_balance,
        is_active,
        created_at
    ) VALUES
        (gen_random_uuid(), v_store_id, 'Cash in Hand (Counter 1)', 'asset', 'CASH-01', 0, true, NOW()),
        (gen_random_uuid(), v_store_id, 'Meezan Bank Ltd', 'asset', 'MBL-MAIN', 0, true, NOW());

    -- 5. Create Default Product Category
    INSERT INTO public.product_categories (
        id,
        store_id,
        name,
        description,
        is_active,
        created_at
    ) VALUES
        (gen_random_uuid(), v_store_id, 'General Catalog', 'Default primary category', true, NOW());

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
        confirmed_at,
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
        jsonb_build_object(
            'full_name', trim(p_owner_name),
            'store_id', v_store_id,
            'role', 'owner'
        ),
        false,
        NOW(),
        NOW(),
        p_phone,
        NULL,
        '',
        '',
        NULL,
        NOW(),
        '',
        0,
        NULL,
        '',
        NULL,
        false,
        NULL,
        false
    );

    -- 7. Create auth.identities
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
        v_owner_user_id,
        v_owner_user_id,
        jsonb_build_object(
            'sub', v_owner_user_id::text,
            'email', v_clean_email,
            'email_verified', true
        ),
        'email',
        v_clean_email,
        NULL,
        NOW(),
        NOW()
    );

    -- 8. Create User Profile
    INSERT INTO public.user_profiles (
        id,
        store_id,
        full_name,
        role,
        is_active,
        phone,
        created_at,
        updated_at
    ) VALUES (
        v_owner_user_id,
        v_store_id,
        trim(p_owner_name),
        'owner',
        true,
        p_phone,
        NOW(),
        NOW()
    );

    -- 9. Grant All Operational Route Permissions to Store Owner
    FOR v_route_record IN SELECT id FROM public.app_routes LOOP
        INSERT INTO public.user_route_permissions (
            user_id,
            route_id,
            can_access,
            created_at
        ) VALUES (
            v_owner_user_id,
            v_route_record.id,
            true,
            NOW()
        )
        ON CONFLICT (user_id, route_id) DO UPDATE SET can_access = true;
    END LOOP;

    -- Return provisioning result payload
    RETURN jsonb_build_object(
        'success', true,
        'store_id', v_store_id,
        'store_name', trim(p_store_name),
        'slug', v_clean_slug,
        'owner_user_id', v_owner_user_id,
        'owner_email', v_clean_email,
        'business_type', COALESCE(p_business_type, 'general_retail'),
        'subscription_tier', p_subscription_tier,
        'created_at', NOW()
    );
END;
$$;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
