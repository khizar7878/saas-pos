import os
import sys
import subprocess
import json

SOURCE_HOST = "aws-1-ap-northeast-1.pooler.supabase.com"
SOURCE_PORT = "5432"
SOURCE_USER = "postgres.lhalnbpcaphhszjliavr"
SOURCE_PASS = "kexfac-tunCaf-decpi0"
SOURCE_DB = "postgres"

TARGET_HOST = "aws-0-ap-northeast-1.pooler.supabase.com"
TARGET_PORT = "5432"
TARGET_USER = "postgres.ehixouwzfbndaficwkzf"
TARGET_PASS = "vGU4efjmpeJdO85E"
TARGET_DB = "postgres"

TESTSTORE_ID = "11111111-1111-1111-1111-111111111111"

def run_target_sql(sql):
    cmd = ['/opt/homebrew/bin/psql', '-h', TARGET_HOST, '-p', TARGET_PORT, '-U', TARGET_USER, '-d', TARGET_DB, '-v', 'ON_ERROR_STOP=1']
    env = {'PGPASSWORD': TARGET_PASS, 'PATH': '/usr/bin:/bin:/opt/homebrew/bin'}
    proc = subprocess.run(cmd, input=sql.encode('utf-8'), env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if proc.returncode != 0:
        err = proc.stderr.decode('utf-8', errors='ignore')
        print("ERROR running SQL:", err)
        raise RuntimeError(err)
    return proc.stdout.decode('utf-8', errors='ignore')

def run_source_sql(sql):
    cmd = ['/opt/homebrew/bin/psql', '-h', SOURCE_HOST, '-p', SOURCE_PORT, '-U', SOURCE_USER, '-d', SOURCE_DB, '-t', '-A']
    env = {'PGPASSWORD': SOURCE_PASS, 'PATH': '/usr/bin:/bin:/opt/homebrew/bin'}
    proc = subprocess.run(cmd, input=sql.encode('utf-8'), env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if proc.returncode != 0:
        err = proc.stderr.decode('utf-8', errors='ignore')
        print("ERROR querying source SQL:", err)
        raise RuntimeError(err)
    return proc.stdout.decode('utf-8', errors='ignore')

print("Starting SaaS Schema & Migration...")

# 1. Base Types & Extensions
schema_types = """
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$ BEGIN
    CREATE TYPE public.adjustment_type AS ENUM ('add', 'remove', 'correction');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE public.fbr_status AS ENUM ('pending', 'success', 'failed');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE public.payment_method AS ENUM ('cash', 'card', 'ibft', 'mixed', 'credit');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE public.refund_method AS ENUM ('cash', 'card', 'credit');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE public.return_status AS ENUM ('pending', 'approved', 'rejected', 'completed');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE public.sale_type AS ENUM ('counter', 'delivery');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE public.user_role AS ENUM ('superadmin', 'owner', 'admin', 'manager', 'cashier');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE public.subscription_tier AS ENUM ('starter', 'professional', 'enterprise', 'custom');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE public.subscription_status AS ENUM ('trialing', 'active', 'past_due', 'suspended', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE public.fbr_environment AS ENUM ('sandbox', 'production');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
"""
print("Applying extensions and enum types...")
run_target_sql(schema_types)

# 2. Master Stores and User Profiles
schema_core = """
CREATE TABLE IF NOT EXISTS public.stores (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    slug text UNIQUE NOT NULL,
    address text,
    phone text,
    contact_email text,
    city text,
    ntn_strn text,
    is_active boolean DEFAULT true,
    subscription_tier public.subscription_tier DEFAULT 'professional',
    subscription_status public.subscription_status DEFAULT 'active',
    trial_ends_at timestamptz DEFAULT (now() + interval '14 days'),
    billing_cycle text DEFAULT 'monthly',
    monthly_fee numeric(10,2) DEFAULT 0,
    max_terminals int DEFAULT 5,
    max_products int DEFAULT 10000,
    fbr_environment public.fbr_environment DEFAULT 'sandbox',
    enabled_modules jsonb DEFAULT '{"fbr_integration": true, "daily_reconciliation": true, "treasury_accounts": true, "credit_sales": true, "online_store": true, "barcode_printing": true}'::jsonb,
    owner_id uuid,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name text NOT NULL,
    role public.user_role NOT NULL DEFAULT 'cashier',
    store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL,
    is_active boolean DEFAULT true,
    custom_role_name text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_store ON public.user_profiles(store_id);
"""
print("Applying stores and user_profiles...")
run_target_sql(schema_core)

# 3. Operational Tables (Partitioned with store_id)
schema_tables = """
-- Store Settings
CREATE TABLE IF NOT EXISTS public.store_settings (
    id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    store_name text NOT NULL,
    address text,
    phone text,
    alt_phone text,
    email text,
    website text,
    logo_url text,
    header_text text,
    footer_text text,
    exchange_policy text,
    print_store_name boolean DEFAULT true,
    print_address boolean DEFAULT true,
    print_phone boolean DEFAULT true,
    print_alt_phone boolean DEFAULT true,
    print_email boolean DEFAULT true,
    print_header_text boolean DEFAULT true,
    print_footer_text boolean DEFAULT true,
    print_logo boolean DEFAULT true,
    print_customer_balance boolean DEFAULT true,
    fbr_integration_enabled boolean DEFAULT true,
    fbr_pos_id text DEFAULT '189142',
    fbr_api_url text DEFAULT 'http://146.190.202.112:5060/api/fbr/submit-invoice',
    fbr_bearer_token text,
    fbr_environment public.fbr_environment DEFAULT 'sandbox',
    weekly_off_days text[] DEFAULT ARRAY['friday']::text[],
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT uq_store_settings_store UNIQUE (store_id)
);

-- Categories & Products
CREATE TABLE IF NOT EXISTS public.product_categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT uq_product_categories_store_name UNIQUE (store_id, name)
);

CREATE TABLE IF NOT EXISTS public.products (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    category_id uuid REFERENCES public.product_categories(id) ON DELETE SET NULL,
    name text NOT NULL,
    barcode text,
    sku text,
    price numeric(12,2) NOT NULL DEFAULT 0,
    cost_price numeric(12,2) DEFAULT 0,
    stock_quantity numeric(12,2) NOT NULL DEFAULT 0,
    min_stock_level numeric(12,2) DEFAULT 0,
    description text,
    image_url text,
    is_active boolean DEFAULT true,
    tax_rate numeric(5,2) DEFAULT 18,
    pct_code text DEFAULT '01011000',
    unit text DEFAULT 'pcs',
    category text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_products_store ON public.products(store_id);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON public.products(store_id, barcode);
CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products(store_id, sku);

CREATE TABLE IF NOT EXISTS public.product_variants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    color_name text NOT NULL,
    color_hex text,
    variant_image_url text,
    is_available boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Customers
CREATE TABLE IF NOT EXISTS public.customers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    name text NOT NULL,
    phone text,
    email text,
    address text,
    city text,
    credit_limit numeric(12,2) DEFAULT 0,
    current_balance numeric(12,2) DEFAULT 0,
    notes text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_customers_store ON public.customers(store_id);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers(store_id, phone);

-- Sales & Sale Items
CREATE TABLE IF NOT EXISTS public.sales (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    sale_number text NOT NULL,
    fbr_invoice_number text,
    sale_type public.sale_type DEFAULT 'counter',
    customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
    customer_name text NOT NULL,
    customer_phone text,
    subtotal numeric(12,2) NOT NULL DEFAULT 0,
    discount numeric(12,2) DEFAULT 0,
    discount_amount numeric(12,2) DEFAULT 0,
    discount_percent numeric(5,2) DEFAULT 0,
    total_amount numeric(12,2) NOT NULL DEFAULT 0,
    amount_received numeric(12,2) DEFAULT 0,
    change_amount numeric(12,2) DEFAULT 0,
    payment_method public.payment_method NOT NULL DEFAULT 'cash',
    payment_details jsonb,
    created_by uuid REFERENCES auth.users(id),
    status text DEFAULT 'completed',
    notes text,
    fbr_qr_code text,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT uq_sales_store_number UNIQUE (store_id, sale_number)
);
CREATE INDEX IF NOT EXISTS idx_sales_store_date ON public.sales(store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_fbr_number ON public.sales(fbr_invoice_number);

CREATE TABLE IF NOT EXISTS public.sale_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
    product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
    product_name text NOT NULL,
    quantity integer NOT NULL DEFAULT 1,
    unit_price numeric(12,2) NOT NULL DEFAULT 0,
    total_price numeric(12,2) NOT NULL DEFAULT 0,
    tax_percent numeric(12,2) DEFAULT 0,
    tax_amount numeric(12,2) DEFAULT 0,
    tax_percentage numeric DEFAULT 0,
    discount numeric DEFAULT 0,
    pct_code text DEFAULT '01011000',
    quantity_returned numeric DEFAULT 0,
    created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON public.sale_items(sale_id);

-- Credit Sales
CREATE TABLE IF NOT EXISTS public.credit_sales (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    sale_id uuid REFERENCES public.sales(id) ON DELETE CASCADE,
    bill_number text NOT NULL,
    customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE,
    customer_name text NOT NULL,
    customer_phone text,
    total_amount numeric(12,2) NOT NULL DEFAULT 0,
    paid_amount numeric(12,2) DEFAULT 0,
    balance_amount numeric(12,2) DEFAULT 0,
    status text DEFAULT 'pending',
    notes text,
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT uq_credit_sales_store_bill UNIQUE (store_id, bill_number)
);

-- Returns & Return Items
CREATE TABLE IF NOT EXISTS public.returns (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    return_number text NOT NULL,
    fbr_return_number text,
    fbr_invoice_number text,
    original_sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL,
    customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
    customer_name text NOT NULL,
    customer_phone text,
    total_amount numeric(12,2) NOT NULL DEFAULT 0,
    refund_method public.refund_method NOT NULL DEFAULT 'cash',
    return_type text DEFAULT 'cash',
    reason text,
    status public.return_status DEFAULT 'completed',
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now(),
    CONSTRAINT uq_returns_store_number UNIQUE (store_id, return_number)
);

CREATE TABLE IF NOT EXISTS public.return_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    return_id uuid NOT NULL REFERENCES public.returns(id) ON DELETE CASCADE,
    sale_item_id uuid REFERENCES public.sale_items(id) ON DELETE SET NULL,
    product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
    product_name text NOT NULL,
    quantity integer NOT NULL DEFAULT 1,
    unit_price numeric(12,2) NOT NULL DEFAULT 0,
    total_price numeric(12,2) NOT NULL DEFAULT 0,
    created_at timestamptz DEFAULT now()
);

-- Daily Reconciliation & Till Cash
CREATE TABLE IF NOT EXISTS public.daily_reconciliations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    reconciliation_date date NOT NULL,
    status text DEFAULT 'draft',
    is_grouped boolean DEFAULT false,
    start_date date,
    end_date date,
    grouped_dates date[] DEFAULT '{}'::date[],
    system_counter_sales_total numeric(12,2) DEFAULT 0,
    system_cash_sales numeric(12,2) DEFAULT 0,
    system_card_sales numeric(12,2) DEFAULT 0,
    system_ibft_sales numeric(12,2) DEFAULT 0,
    system_cash_returns numeric(12,2) DEFAULT 0,
    total_expenses numeric(12,2) DEFAULT 0,
    cash_expenses numeric(12,2) DEFAULT 0,
    ibft_expenses numeric(12,2) DEFAULT 0,
    card_expenses numeric(12,2) DEFAULT 0,
    manual_ibft_total numeric(12,2) DEFAULT 0,
    ibft_variance numeric(12,2) DEFAULT 0,
    manual_card_total numeric(12,2) DEFAULT 0,
    card_variance numeric(12,2) DEFAULT 0,
    opening_cash numeric(12,2) DEFAULT 0,
    expected_cash numeric(12,2) DEFAULT 0,
    actual_cash numeric(12,2) DEFAULT 0,
    cash_variance numeric(12,2) DEFAULT 0,
    denominations jsonb,
    move_to_reserve numeric(12,2) DEFAULT 0,
    closing_balance numeric(12,2) DEFAULT 0,
    cash_in_reserve numeric(12,2) DEFAULT 0,
    sale_adjustments numeric(12,2) DEFAULT 0,
    closing_notes text,
    closed_by uuid REFERENCES auth.users(id),
    closed_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT uq_daily_reconciliations_store_date UNIQUE (store_id, reconciliation_date)
);

CREATE TABLE IF NOT EXISTS public.daily_expenses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    expense_date date NOT NULL,
    category text DEFAULT 'General Expense',
    description text NOT NULL,
    amount numeric(12,2) NOT NULL DEFAULT 0,
    payment_method text DEFAULT 'cash',
    receipt_no text,
    notes text,
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_daily_expenses_store_date ON public.daily_expenses(store_id, expense_date);

CREATE TABLE IF NOT EXISTS public.reconciliation_ibft_entries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    entry_date date NOT NULL,
    description text,
    amount numeric(12,2) NOT NULL DEFAULT 0,
    bank_name text,
    reference_no text,
    notes text,
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reconciliation_card_entries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    entry_date date NOT NULL,
    terminal_name text,
    description text,
    amount numeric(12,2) NOT NULL DEFAULT 0,
    slip_number text,
    notes text,
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now()
);

-- Accounts & Treasury
CREATE TABLE IF NOT EXISTS public.accounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    name text NOT NULL,
    account_type text NOT NULL,
    account_subtype text,
    account_number text,
    bank_name text,
    current_balance numeric(12,2) DEFAULT 0,
    is_system boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT uq_accounts_store_name UNIQUE (store_id, name)
);

CREATE TABLE IF NOT EXISTS public.account_transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    from_account_id uuid REFERENCES public.accounts(id),
    to_account_id uuid REFERENCES public.accounts(id),
    amount numeric(12,2) NOT NULL DEFAULT 0,
    transaction_type text NOT NULL,
    reference_type text,
    reference_id uuid,
    description text,
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ledger_entries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    account_id uuid REFERENCES public.accounts(id),
    reference_type text,
    reference_id uuid,
    description text,
    debit numeric(12,2) DEFAULT 0,
    credit numeric(12,2) DEFAULT 0,
    balance numeric(12,2) DEFAULT 0,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    payment_number text NOT NULL,
    from_account_id uuid REFERENCES public.accounts(id),
    to_account_id uuid REFERENCES public.accounts(id),
    amount numeric(12,2) NOT NULL DEFAULT 0,
    payment_mode text NOT NULL,
    reference_number text,
    notes text,
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now()
);

-- POS Auxiliary Tables
CREATE TABLE IF NOT EXISTS public.held_carts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    cart_name text NOT NULL,
    user_id uuid REFERENCES auth.users(id),
    customer_id uuid REFERENCES public.customers(id),
    cart_data jsonb NOT NULL,
    subtotal numeric(12,2) DEFAULT 0,
    discount numeric(12,2) DEFAULT 0,
    total_amount numeric(12,2) DEFAULT 0,
    notes text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sequences (
    id text NOT NULL,
    store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    current_value bigint DEFAULT 0,
    prefix text,
    created_at timestamptz DEFAULT now(),
    PRIMARY KEY (store_id, id)
);

CREATE TABLE IF NOT EXISTS public.spreadsheets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    name text NOT NULL,
    data jsonb,
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bank_names (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE,
    name text NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.app_routes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    path text NOT NULL,
    parent_name text,
    icon_name text,
    sort_order integer DEFAULT 0,
    module_key text DEFAULT 'general',
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_route_permissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    route_id uuid NOT NULL REFERENCES public.app_routes(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT uq_user_route_permissions UNIQUE (user_id, route_id)
);
"""
print("Applying operational tables with store_id partitioning...")
run_target_sql(schema_tables)

# 4. Sequences Helper RPC
sequences_fn = """
CREATE OR REPLACE FUNCTION public.get_next_sequence_for_store(p_seq_id text, p_store_id uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    next_val BIGINT;
    pfx TEXT := '';
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.sequences WHERE id = p_seq_id AND store_id = p_store_id) THEN
        INSERT INTO public.sequences (id, store_id, current_value, prefix)
        VALUES (p_seq_id, p_store_id, 0, CASE WHEN p_seq_id = 'sale_number' THEN 'INV' ELSE 'DOC' END)
        ON CONFLICT (store_id, id) DO NOTHING;
    END IF;

    UPDATE public.sequences
    SET current_value = current_value + 1
    WHERE id = p_seq_id AND store_id = p_store_id
    RETURNING current_value, COALESCE(prefix, '') INTO next_val, pfx;

    RETURN pfx || LPAD(next_val::TEXT, 6, '0');
END;
$$;
"""
print("Applying sequence function...")
run_target_sql(sequences_fn)

# 5. Insert Test Store (teststore)
seed_store = f"""
INSERT INTO public.stores (
    id, name, slug, address, phone, contact_email, city, ntn_strn,
    is_active, subscription_tier, subscription_status, billing_cycle,
    monthly_fee, max_terminals, max_products, fbr_environment, enabled_modules
)
VALUES (
    '{TESTSTORE_ID}',
    'Test Store',
    'teststore',
    '123 Mall Road, Lahore, Pakistan',
    '042-111222333',
    'support@teststore.pk',
    'Lahore',
    '1234567-8',
    true,
    'enterprise',
    'active',
    'monthly',
    0,
    10,
    50000,
    'sandbox',
    '{{"fbr_integration": true, "daily_reconciliation": true, "treasury_accounts": true, "credit_sales": true, "online_store": true, "barcode_printing": true}}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    is_active = EXCLUDED.is_active,
    fbr_environment = EXCLUDED.fbr_environment;

INSERT INTO public.store_settings (
    store_id, store_name, address, phone, alt_phone, email, website,
    header_text, footer_text, exchange_policy,
    fbr_integration_enabled, fbr_pos_id, fbr_api_url, fbr_environment, weekly_off_days
)
VALUES (
    '{TESTSTORE_ID}',
    'Test Store Retail POS',
    '123 Mall Road, Lahore, Pakistan',
    '042-111222333',
    '0300-1234567',
    'support@teststore.pk',
    'https://teststore.pk',
    'Premium Retail Demo Outlet',
    'Thank you for shopping with Test Store!',
    'Exchanges accepted within 7 days with original invoice.',
    true,
    '189142',
    'http://146.190.202.112:5060/api/fbr/submit-invoice',
    'sandbox',
    ARRAY['friday']::text[]
)
ON CONFLICT (store_id) DO NOTHING;
"""
print("Seeding demo store 'teststore'...")
run_target_sql(seed_store)

print("Schema initialization completed successfully!")
