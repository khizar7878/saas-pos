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

def run_source_sql(sql):
    cmd = ['/opt/homebrew/bin/psql', '-h', SOURCE_HOST, '-p', SOURCE_PORT, '-U', SOURCE_USER, '-d', SOURCE_DB, '-t', '-A', '-F', '\t']
    env = {'PGPASSWORD': SOURCE_PASS, 'PATH': '/usr/bin:/bin:/opt/homebrew/bin'}
    proc = subprocess.run(cmd, input=sql.encode('utf-8'), env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if proc.returncode != 0:
        err = proc.stderr.decode('utf-8', errors='ignore')
        print("ERROR querying source SQL:", err)
        raise RuntimeError(err)
    return proc.stdout.decode('utf-8', errors='ignore')

def run_target_sql(sql):
    cmd = ['/opt/homebrew/bin/psql', '-h', TARGET_HOST, '-p', TARGET_PORT, '-U', TARGET_USER, '-d', TARGET_DB, '-v', 'ON_ERROR_STOP=1']
    env = {'PGPASSWORD': TARGET_PASS, 'PATH': '/usr/bin:/bin:/opt/homebrew/bin'}
    proc = subprocess.run(cmd, input=sql.encode('utf-8'), env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if proc.returncode != 0:
        err = proc.stderr.decode('utf-8', errors='ignore')
        print("ERROR running target SQL:", err)
        raise RuntimeError(err)
    return proc.stdout.decode('utf-8', errors='ignore')

print("Cloning catalog & customers from ak-retail-pos into saas-pos (teststore)...")

# 1. Categories
print("1. Cloning categories...")
cat_json = run_source_sql("SELECT json_agg(t) FROM (SELECT id, name, description, created_at, updated_at FROM product_categories) t;")
if cat_json.strip() and cat_json.strip() != "":
    cats = json.loads(cat_json)
    for c in cats:
        c_id = c['id']
        c_name = c['name'].replace("'", "''")
        c_desc = (c.get('description') or '').replace("'", "''")
        c_created = c.get('created_at') or 'now()'
        c_updated = c.get('updated_at') or 'now()'
        sql = f"""
        INSERT INTO public.product_categories (id, store_id, name, description, created_at, updated_at)
        VALUES ('{c_id}', '{TESTSTORE_ID}', '{c_name}', '{c_desc}', '{c_created}', '{c_updated}')
        ON CONFLICT (store_id, name) DO UPDATE SET description = EXCLUDED.description;
        """
        run_target_sql(sql)
    print(f"Cloned {len(cats)} categories.")

# 2. Products
print("2. Cloning products...")
prod_json = run_source_sql("""
SELECT json_agg(t) FROM (
    SELECT id, category_id, name, barcode, sku, price, cost_price, stock_quantity,
           min_stock_level, description, image_url, is_active, tax_rate, pct_code, unit, category, created_at, updated_at
    FROM products
) t;
""")
if prod_json.strip():
    prods = json.loads(prod_json)
    for p in prods:
        p_id = p['id']
        cat_id = f"'{p['category_id']}'" if p.get('category_id') else "NULL"
        name = (p.get('name') or '').replace("'", "''")
        barcode = f"'{p['barcode']}'" if p.get('barcode') else "NULL"
        sku = f"'{p['sku']}'" if p.get('sku') else "NULL"
        price = p.get('price') or 0
        cost_price = p.get('cost_price') or 0
        stock = p.get('stock_quantity') or 0
        min_stock = p.get('min_stock_level') or 0
        desc = (p.get('description') or '').replace("'", "''")
        img = (p.get('image_url') or '').replace("'", "''")
        is_active = 'true' if p.get('is_active', True) else 'false'
        tax = p.get('tax_rate') or 18
        pct = (p.get('pct_code') or '01011000').replace("'", "''")
        unit = (p.get('unit') or 'pcs').replace("'", "''")
        category_name = (p.get('category') or '').replace("'", "''")
        
        sql = f"""
        INSERT INTO public.products (
            id, store_id, category_id, name, barcode, sku, price, cost_price,
            stock_quantity, min_stock_level, description, image_url, is_active,
            tax_rate, pct_code, unit, category
        )
        VALUES (
            '{p_id}', '{TESTSTORE_ID}', {cat_id}, '{name}', {barcode}, {sku}, {price}, {cost_price},
            {stock}, {min_stock}, '{desc}', '{img}', {is_active},
            {tax}, '{pct}', '{unit}', '{category_name}'
        )
        ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            price = EXCLUDED.price,
            stock_quantity = EXCLUDED.stock_quantity;
        """
        run_target_sql(sql)
    print(f"Cloned {len(prods)} products.")

# 3. Product Variants
print("3. Cloning product variants...")
var_json = run_source_sql("""
SELECT json_agg(t) FROM (
    SELECT id, product_id, color_name, color_hex, variant_image_url, is_available, created_at, updated_at
    FROM product_variants
) t;
""")
if var_json.strip():
    variants = json.loads(var_json)
    for v in variants:
        v_id = v['id']
        p_id = v['product_id']
        c_name = (v.get('color_name') or '').replace("'", "''")
        c_hex = (v.get('color_hex') or '').replace("'", "''")
        v_img = (v.get('variant_image_url') or '').replace("'", "''")
        avail = 'true' if v.get('is_available', True) else 'false'
        sql = f"""
        INSERT INTO public.product_variants (id, product_id, color_name, color_hex, variant_image_url, is_available)
        VALUES ('{v_id}', '{p_id}', '{c_name}', '{c_hex}', '{v_img}', {avail})
        ON CONFLICT (id) DO NOTHING;
        """
        run_target_sql(sql)
    print(f"Cloned {len(variants)} product variants.")

# 4. Customers & Accounts
print("4. Cloning customers from accounts (receivable)...")
cust_json = run_source_sql("""
SELECT json_agg(t) FROM (
    SELECT id, name, account_type, account_subtype, current_balance, is_active
    FROM accounts
    WHERE account_subtype = 'receivable'
) t;
""")
if cust_json.strip():
    customers = json.loads(cust_json)
    for cust in customers:
        c_id = cust['id']
        name = (cust.get('name') or '').replace("'", "''")
        balance = cust.get('current_balance') or 0
        is_active = 'true' if cust.get('is_active', True) else 'false'
        
        # Insert into accounts
        sql_acc = f"""
        INSERT INTO public.accounts (id, store_id, name, account_type, account_subtype, current_balance, is_active)
        VALUES ('{c_id}', '{TESTSTORE_ID}', '{name}', 'asset', 'receivable', {balance}, {is_active})
        ON CONFLICT (store_id, name) DO UPDATE SET current_balance = EXCLUDED.current_balance;
        """
        run_target_sql(sql_acc)
        
        # Insert into customers table
        sql_cust = f"""
        INSERT INTO public.customers (id, store_id, name, current_balance)
        VALUES ('{c_id}', '{TESTSTORE_ID}', '{name}', {balance})
        ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, current_balance = EXCLUDED.current_balance;
        """
        run_target_sql(sql_cust)
    print(f"Cloned {len(customers)} customers and accounts.")

# 5. App Routes & Modules
print("5. Populating app routes...")
routes_sql = """
INSERT INTO public.app_routes (name, path, parent_name, icon_name, sort_order, module_key)
VALUES 
    ('Point of Sale', '/pos', NULL, 'ShoppingCart', 1, 'general'),
    ('Sales History', '/sales', 'Sales', 'Receipt', 2, 'general'),
    ('Held Carts', '/held-carts', 'Sales', 'Clock', 3, 'general'),
    ('Credit Sales', '/credit-sales', 'Sales', 'CreditCard', 4, 'credit_sales'),
    ('Returns & Exchanges', '/returns', 'Sales', 'RotateCcw', 5, 'general'),
    ('Products Catalog', '/products', 'Inventory', 'Package', 6, 'general'),
    ('Stock Receipt', '/stock-receipt', 'Inventory', 'Boxes', 7, 'general'),
    ('Barcode Printing', '/barcode-printing', 'Inventory', 'Barcode', 8, 'barcode_printing'),
    ('Daily Reconciliation', '/daily-reconciliation', 'Accounting', 'Calculator', 9, 'daily_reconciliation'),
    ('Closing Records', '/reconciliation-history', 'Accounting', 'History', 10, 'daily_reconciliation'),
    ('Treasury Accounts', '/accounts', 'Accounting', 'Landmark', 11, 'treasury_accounts'),
    ('Customers & Khata', '/customers', 'CRM', 'Users', 12, 'general'),
    ('FBR IMS Fiscalization', '/fbr-dashboard', 'Taxation', 'Building2', 13, 'fbr_integration'),
    ('Sales Analytics', '/sales-summary', 'Reports', 'BarChart3', 14, 'general'),
    ('Store Settings', '/settings', 'Configuration', 'Settings', 15, 'general'),
    ('User Management', '/users', 'Configuration', 'Shield', 16, 'general'),
    ('Superadmin Hub', '/superadmin', NULL, 'Crown', 99, 'superadmin')
ON CONFLICT DO NOTHING;
"""
run_target_sql(routes_sql)
print("App routes inserted.")

print("All catalog and customer data cloned into teststore successfully!")
