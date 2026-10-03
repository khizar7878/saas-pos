# SaaS Retail POS: Comprehensive Development & Architecture Guide

## 1. Executive System Overview

**SaaS Retail POS (`saas-pos`)** is a multi-tenant cloud retail point-of-sale platform adapted from the FBR Tier-1 certified single-store retail engine (`ak-retail-pos`). It runs on a **unified single Vercel frontend deployment** paired with a **unified multi-tenant Supabase database** (`ehixouwzfbndaficwkzf`), guaranteeing strict logical data isolation, zero-friction tenant onboarding, and dynamic modular feature licensing.

### Core Architectural Tenets
1. **Model 1 SaaS Architecture**: Single codebase and single database serving multiple businesses. No separate database projects or individual Vercel deployments are required per client.
2. **Strict Row-Level Security (RLS)**: Every operational table is partitioned by `store_id uuid`. PostgreSQL database engine policies guarantee that no tenant can read, query, or mutate another tenant's inventory, financial ledgers, or fiscal sales.
3. **Dual FBR Environments (Sandbox $\longleftrightarrow$ Production)**: Dynamic runtime switching between official FBR Sandbox (mock/test fiscalization) and live production per client store with 1 click.
4. **Instant Demo Workspace (`teststore`)**: Out-of-the-box pre-seeded demo store populated with 258 products, 4 categories, 9 variants, and 109 customers cloned directly from `ak-retail-pos`.
5. **Central Superadmin Control Plane (`/superadmin`)**: A centralized portal to govern client stores, subscription lifecycles, modular feature flags, and tenant God-mode impersonation.
6. **Strict Production Isolation**: Production `ak-retail-pos` and its database (`lhalnbpcaphhszjliavr`) remain 100% separate and untouched.

---

## 2. Infrastructure & Database Credentials

### Primary SaaS Database (Supabase)
- **Project Ref**: `ehixouwzfbndaficwkzf`
- **Project URL**: `https://ehixouwzfbndaficwkzf.supabase.co`
- **Region**: `ap-northeast-1` (Tokyo, AWS)
- **Database Password**: `vGU4efjmpeJdO85E`
- **IPv4 Pooler Host**: `aws-0-ap-northeast-1.pooler.supabase.com`
- **Pooler Port**: `5432`
- **DB User**: `postgres.ehixouwzfbndaficwkzf`
- **Publishable Key**: `sb_publishable_mxZXLPwOSAgM1yNUs5U-ZQ_AvRQ-nCW`

### Terminal Database Commands (`psql`)
Because macOS local networks may not route IPv6 direct connections, always use the IPv4 pooler connection string via `/opt/homebrew/bin/psql` or `/opt/homebrew/opt/libpq/bin/psql`:

```bash
# Execute SQL migration file
PGPASSWORD="vGU4efjmpeJdO85E" /opt/homebrew/bin/psql -h aws-0-ap-northeast-1.pooler.supabase.com -p 5432 -U postgres.ehixouwzfbndaficwkzf -d postgres -f <migration.sql>

# Execute inline query statement
PGPASSWORD="vGU4efjmpeJdO85E" /opt/homebrew/bin/psql -h aws-0-ap-northeast-1.pooler.supabase.com -p 5432 -U postgres.ehixouwzfbndaficwkzf -d postgres -c "<sql-statement>"
```

### Reference Production Database (`ak-retail-pos` - Read-Only)
- **Project Ref**: `lhalnbpcaphhszjliavr`
- **Host**: `aws-1-ap-northeast-1.pooler.supabase.com` (Port `5432`)
- **DB Password**: `kexfac-tunCaf-decpi0`
- **User**: `postgres.lhalnbpcaphhszjliavr`

---

## 3. Database Schema & Multi-Tenant Partitioning

### 3.1 Custom Enumeration Types
```sql
CREATE TYPE public.user_role AS ENUM ('superadmin', 'owner', 'admin', 'manager', 'cashier');
CREATE TYPE public.subscription_tier AS ENUM ('starter', 'professional', 'enterprise', 'custom');
CREATE TYPE public.subscription_status AS ENUM ('trialing', 'active', 'past_due', 'suspended', 'cancelled');
CREATE TYPE public.fbr_environment AS ENUM ('sandbox', 'production');
CREATE TYPE public.payment_method AS ENUM ('cash', 'card', 'ibft', 'mixed', 'credit');
CREATE TYPE public.sale_type AS ENUM ('counter', 'delivery');
CREATE TYPE public.refund_method AS ENUM ('cash', 'card', 'credit');
CREATE TYPE public.return_status AS ENUM ('pending', 'approved', 'rejected', 'completed');
```

### 3.2 Tenant Master Entity: `stores`
```sql
CREATE TABLE public.stores (
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
    enabled_modules jsonb DEFAULT '{
        "fbr_integration": true,
        "daily_reconciliation": true,
        "treasury_accounts": true,
        "credit_sales": true,
        "barcode_printing": true,
        "online_store": false
    }'::jsonb,
    owner_id uuid,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
```

### 3.3 User Profiles: `user_profiles`
```sql
CREATE TABLE public.user_profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name text NOT NULL,
    role public.user_role NOT NULL DEFAULT 'cashier',
    store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL,
    is_active boolean DEFAULT true,
    custom_role_name text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
```
*Note: A user with `role = 'superadmin'` has `store_id = NULL` and platform-wide administrative privileges.*

### 3.4 Table Partitioning Matrix (26 Operational Tables)

| Domain | Table Name | Tenant Scoping Column | Key References & Indexes |
| :--- | :--- | :--- | :--- |
| **Tenant Settings** | `store_settings` | `store_id uuid UNIQUE` | FK to `stores(id)` ON DELETE CASCADE |
| **Catalog & Stock** | `product_categories` | `store_id uuid` | UNIQUE `(store_id, name)` |
| | `products` | `store_id uuid` | INDEX on `(store_id, barcode)`, `(store_id, sku)` |
| | `product_variants` | Inherited via `product_id` | FK to `products(id)` ON DELETE CASCADE |
| **Customers & CRM** | `customers` | `store_id uuid` | INDEX on `(store_id, phone)` |
| **Sales & POS** | `sales` | `store_id uuid` | UNIQUE `(store_id, sale_number)` |
| | `sale_items` | Inherited via `sale_id` | FK to `sales(id)` ON DELETE CASCADE |
| | `credit_sales` | `store_id uuid` | UNIQUE `(store_id, bill_number)` |
| | `held_carts` | `store_id uuid` | FK to `stores(id)`, stores cashier cart drafts |
| | `sequences` | `store_id uuid` | Composite PK `(store_id, id)` |
| **Returns & Exchanges**| `returns` | `store_id uuid` | UNIQUE `(store_id, return_number)` |
| | `return_items` | Inherited via `return_id` | FK to `returns(id)` ON DELETE CASCADE |
| **Accounting & Till** | `daily_reconciliations`| `store_id uuid` | UNIQUE `(store_id, reconciliation_date)` |
| | `daily_expenses` | `store_id uuid` | INDEX on `(store_id, expense_date)` |
| | `reconciliation_ibft_entries` | `store_id uuid` | Verified digital bank slips |
| | `reconciliation_card_entries` | `store_id uuid` | Verified card POS terminal slips |
| **Treasury & Khata** | `accounts` | `store_id uuid` | UNIQUE `(store_id, name)` |
| | `account_transactions`| `store_id uuid` | Inter-account transfers |
| | `ledger_entries` | `store_id uuid` | Complete double-entry accounting ledger |
| | `payments` | `store_id uuid` | Payment vouchers |
| | `bank_names` | `store_id uuid` | Store active bank accounts list |
| **Utilities & UI** | `spreadsheets` | `store_id uuid` | Custom user spreadsheets |
| | `app_routes` | Global / System | Route permissions lookup |
| | `user_route_permissions` | `user_id uuid` | User-to-route RBAC mapping |

---

## 4. Row Level Security (RLS) Engine

All 26 operational tables have PostgreSQL Row Level Security enabled (`rowsecurity = true`). Policies are defined in `supabase/migrations/20261003_saas_rls_policies.sql`.

### 4.1 Tenant Access Helper Function
```sql
CREATE OR REPLACE FUNCTION public.has_store_access(_store_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
    SELECT (
        public.is_superadmin() 
        OR _store_id = public.current_store_id()
        -- Allow demo store viewing for unauthenticated/demo requests if needed
        OR (_store_id = '11111111-1111-1111-1111-111111111111'::uuid AND auth.uid() IS NULL)
    );
$$;
```

### 4.2 Security Resolution Functions
```sql
-- Resolve current user's store_id from public.user_profiles
CREATE OR REPLACE FUNCTION public.current_store_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT store_id FROM public.user_profiles WHERE id = auth.uid();
$$;

-- Check if current authenticated user has platform superadmin role
CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = auth.uid() AND role = 'superadmin'
    );
$$;
```

### 4.3 Child Table Policy Pattern
For tables like `sale_items` that do not duplicate the `store_id` column:
```sql
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
```

---

## 5. Core Multi-Tenant Database RPCs

Core business transactions are executed via ACID-compliant PostgreSQL functions (`supabase/migrations/20261003_saas_core_rpcs.sql`):

### 5.1 `process_sale_transaction(sale_data jsonb, items_data jsonb)`
1. **Resolves Store Context**: Detects `sale_data->>'store_id'`, falls back to `public.current_store_id()`, or defaults to `teststore`.
2. **Handles Credit Sales**: Inserts into `credit_sales`, generates `bill_number` using `get_next_sequence_for_store('credit_sale', v_store_id)`, updates the customer's receivable balance in `accounts`, records debit entry in `ledger_entries`, and deducts stock from `products` for that specific `store_id`.
3. **Handles Counter Sales**:
   - Generates sequential invoice number: `v_sale_number := get_next_sequence_for_store('sale', v_store_id)`.
   - Inserts master record into `sales` with `store_id = v_store_id`.
   - Inserts line items into `sale_items` and deducts stock from `products`.
   - Automatically increments `accounts.current_balance` for the store's Cash-in-Hand till account and creates a corresponding `ledger_entries` audit record.
4. Returns the created sale metadata as JSON.

### 5.2 `process_credit_sale_completion(...)`
1. Verifies that the credit bill exists and has not already been completed.
2. Generates a new official sale number scoped to the bill's `store_id`.
3. Sanitizes remaining line item quantities (skips fully returned items, recalculates prorated GST tax and totals).
4. Inserts completed sale header and items into `sales` and `sale_items`.
5. Settles customer ledger: credits receivable account and debits cash till account.
6. Updates `credit_sales.status = 'completed'` and `balance_amount = 0`.

### 5.3 `get_next_sequence_for_store(p_seq_id text, p_store_id uuid)`
Atomic increment of tenant sequences (`sale`, `return`, `credit_sale`, `stock_receipt`), guaranteeing zero duplicate bill numbers even under heavy concurrent cashier checkout.

---

## 6. Pre-Seeded Demo Store: `teststore`

The database comes pre-seeded with a complete retail operation cloned from `ak-retail-pos`:

### Configuration
- **Store ID**: `11111111-1111-1111-1111-111111111111`
- **Store Name**: `Test Store Retail POS`
- **Slug**: `teststore`
- **Subscription Tier**: `enterprise`
- **Subscription Status**: `active`
- **FBR Initial Mode**: `sandbox`
- **Enabled Modules**: All modules enabled (`fbr_integration`, `daily_reconciliation`, `treasury_accounts`, `credit_sales`, `barcode_printing`, `online_store`).

### Cloned Retail Catalog & Khata
- **258 Products**: Complete fabrics catalog with prices, costs, barcodes, GST rates (18%), and PCT codes (`01011000`).
- **4 Product Categories**: Cotton, Wash and Wear, Latha, Accessories.
- **9 Color Variants**: Variants linked to products with hexadecimal color codes.
- **109 Customer Accounts**: All receivable customer accounts and ledger balances.
- **9 Bank Accounts**: Pre-configured banks for IBFT settlements.
- **4 Sequences**: Sale, return, credit sale, and stock receipt counters.

### Pre-Seeded User Accounts (1-Click Login Ready)

| Role | Email | Password | Scope |
| :--- | :--- | :--- | :--- |
| **Platform Superadmin** | `superadmin@saaspos.pk` | `SuperAdmin@2026` | Platform-wide control (`/superadmin`) |
| **Test Store Owner** | `owner@teststore.pk` | `TestOwner@2026` | Test Store Owner (`teststore`) |
| **Test Store Cashier** | `demo@teststore.pk` | `DemoUser@2026` | POS Cashier checkout (`teststore`) |

*Note: The login page at `/auth` includes 1-click quick-fill buttons for both `🧪 Test Store Demo` and `👑 Superadmin`.*

---

## 7. Dual FBR Fiscalization Engine

The application supports real-time switching between mock test fiscalization and live production.

```mermaid
flowchart TD
    Checkout[Cashier Checkout / Credit Bill Settlement] --> EnvCheck{FBR Mode?}
    
    EnvCheck -->|🧪 Sandbox| MockEngine[Local Sandbox Simulator in fbrService.ts]
    MockEngine --> GenNumber["Generate Mock USIN: SANDBOX-POSID-XXXX"]
    GenNumber --> GenQR[Generate Valid QR Data URL]
    GenQR --> PrintTest["Print Thermal Receipt with *** TRAINING / TEST INVOICE *** Mark"]
    GenQR --> NoIris["Zero FBR Iris Liability (Not posted to Annex-C)"]

    EnvCheck -->|🟢 Production| LiveRouter{Host Environment?}
    LiveRouter -->|Localhost / Counter PC| LocalProxy["Local Counter Gateway (http://127.0.0.1:5060)"]
    LiveRouter -->|Hosted Web / Vercel| CloudDroplet["Cloud Gateway (Singapore 146.190.202.112:5060)"]
    LocalProxy --> Upstream[FBR Tier-1 IMS (gw.fbr.gov.pk)]
    CloudDroplet --> Upstream
    Upstream --> LiveInvoice[Official Iris Signed Invoice Number & QR]
```

### 7.1 Sandbox Mode Mechanics
- **Trigger**: `fbr_environment === 'sandbox'` in `stores` or `store_settings`.
- **Implementation**: In `src/services/fbrService.ts`, when sandbox is detected:
  - Generates realistic mock fiscal number: `SANDBOX-${payload.POSID}-${randomSuffix}`.
  - Generates a lightweight, scanned-readable QR code data URL.
  - Returns HTTP 200 simulation response with Code `100`.
  - Guarantees **zero tax liability**: No requests leave the browser for FBR, preventing erroneous tax bills or Iris discrepancies.
- **Receipt Watermarking**: In `src/components/sales/PrintBillDialog.tsx`, thermal receipts output:
  `*** TRAINING / TEST INVOICE (SANDBOX) ***`

### 7.2 Production Mode Mechanics
- Submits full payload to FBR Tier-1 IMS via Singapore DigitalOcean droplet or local counter gateway.
- Receives official FBR invoice number and generates official fiscal QR code.
- Recorded directly on FBR Iris Annex-C monthly return.

---

## 8. Superadmin Control Plane (`/superadmin`)

The Superadmin Portal is accessible only to platform administrators (`user_profiles.role = 'superadmin'`).

### 8.1 Key Features
1. **Executive KPI Ribbon**: Total stores count, active vs trialing subscriptions, production vs sandbox deployment counts, and current active workspace indicator.
2. **Client Stores Management Table**:
   - Filter by search query (store name, slug, email, city).
   - Filter by subscription status (`active`, `trialing`, `suspended`, `cancelled`).
   - Filter by FBR mode (`sandbox`, `production`).
   - Quick 1-click FBR toggle directly in table rows (`🧪 Sandbox` $\longleftrightarrow$ `🟢 Production`).
3. **1-Click Tenant Provisioning Wizard**:
   - Fields: Store Name, Slug (auto-slugified), Owner Email, Phone, City, NTN/STRN, Subscription Tier, Initial FBR Mode, POS ID, and Feature Flags.
   - Automatically provisions `stores` record, `store_settings` record, and sequential counters in under 60 seconds.
4. **Modular Feature Flag Matrix**:
   - Per-store licensing toggles:
     - `fbr_integration`: FBR Fiscalization dashboard and auto-submit.
     - `daily_reconciliation`: Day-end till balancing, expenses, and audit history.
     - `treasury_accounts`: Bank accounts, ledger, and inter-account transfers.
     - `credit_sales`: Customer credit bills and pending settlements.
     - `barcode_printing`: Barcode labels and custom label designer.
     - `online_store`: E-commerce catalog, web orders, and online store settings.
5. **Tenant God-Mode (Store Impersonation)**:
   - Superadmins can click **"Switch To Store"** on any client row to instantly load that store's POS workspace, review cashier till closings, and debug configuration without requiring cashier passwords.

---

## 9. Frontend Architecture & State Management

### 9.1 Global Tenant Context (`src/contexts/TenantContext.tsx`)
```tsx
interface TenantContextType {
  currentStore: Store | null;
  storeSettings: StoreSettings | null;
  fbrEnvironment: 'sandbox' | 'production';
  setFbrEnvironment: (env: 'sandbox' | 'production') => Promise<void>;
  isModuleEnabled: (moduleKey: string) => boolean;
  subscriptionStatus: 'active' | 'trialing' | 'past_due' | 'suspended' | 'cancelled';
  isSuperAdmin: boolean;
  allStores: Store[];
  switchStore: (storeId: string) => Promise<void>;
  refreshStore: () => Promise<void>;
  loading: boolean;
}
```

### 9.2 Dynamic Module Route Guarding in Sidebar (`AppSidebar.tsx`)
The navigation sidebar dynamically filters sections and individual route items based on `isModuleEnabled(moduleKey)`:
- If `online_store` is false: Hides "Online Store" and "Order Book" sections.
- If `daily_reconciliation` is false: Hides "Reconciliation" and "Closing History".
- If `fbr_integration` is false: Hides "FBR Integration" under Setup.
- If `barcode_printing` is false: Hides "Label Printing" and "Custom Labels".
- If `credit_sales` is false: Hides "Pending Payments".
- For Superadmins: Renders the **Superadmin Hub** shortcut with a Crown badge at the top of the sidebar.

---

## 10. Development Workflow & Commands

### 10.1 Running the SaaS POS Locally
```bash
cd /Users/khizar/Documents/React/saas-pos
npm run dev
```
The application will launch on `http://localhost:8080/`.

### 10.2 Production Build Verification
```bash
cd /Users/khizar/Documents/React/saas-pos
npm run build
```
Build output produces minified assets in `dist/` with 0 TypeScript errors.

### 10.3 Testing Checklist
- [x] Login via `/auth` using 1-click **Test Store Demo** button (`demo@teststore.pk`).
- [x] Verify 258 products load on `/products` and Point of Sale (`/pos/sales`).
- [x] Execute a test checkout in **Sandbox Mode**: Verify mock invoice number `SANDBOX-189142-XXXX` and test receipt banner.
- [x] Switch to **Production Mode** on `/setup/fbr` and test FBR gateway reachability.
- [x] Login as **Superadmin** (`superadmin@saaspos.pk`) and open `/superadmin`.
- [x] Test onboarding a new client store via the wizard.
- [x] Test toggling module flags (e.g. disabling `online_store`) and verify sidebar reacts instantly.
- [x] Test God-mode store switching.

---

## 11. Codebase Isolation & Safety Rules

1. **Strict Production Isolation**: Under no circumstances should `/Users/khizar/Documents/React/ak-retail-pos` or its database `lhalnbpcaphhszjliavr` be modified or written to.
2. **No Auto-Push**: Do not execute `git push` to remote repositories unless explicitly instructed by the user.
3. **Tracking & Documentation**: Maintain documentation in `.agents/AGENTS.md` and `DEVELOPMENT.md` for all new features and database migrations.
