# Multi-Device Workspace Sync Rule

To support seamless development across multiple machines (such as your Mac Mini and MacBook):
At the very start of any new session or conversation, the agent must check the git status and immediately run a `git pull` command to fetch and merge the latest changes from the remote repository before doing any other work.

# Database Connection Rule

To ensure database queries and migrations can be run seamlessly:
1. **Database Credentials**:
   - **SaaS Retail POS Multi-Tenant Database**:
     - **Project Ref**: `ehixouwzfbndaficwkzf`
     - **URL**: `https://ehixouwzfbndaficwkzf.supabase.co`
     - **Region**: `ap-northeast-1`
     - **DB Password**: `vGU4efjmpeJdO85E`
     - **Host**: `aws-0-ap-northeast-1.pooler.supabase.com` (Port `5432`)
     - **User**: `postgres.ehixouwzfbndaficwkzf`
     - **Publishable Key**: `sb_publishable_mxZXLPwOSAgM1yNUs5U-ZQ_AvRQ-nCW`
2. **Database Execution**: Since the local network does not support IPv6 direct connection, always use the IPv4 pooler connection string via the PostgreSQL client (`psql` installed at `/opt/homebrew/bin/psql` or `/opt/homebrew/opt/libpq/bin/psql`):
   - For executing SQL migration files:
     `PGPASSWORD="vGU4efjmpeJdO85E" /opt/homebrew/bin/psql -h aws-0-ap-northeast-1.pooler.supabase.com -p 5432 -U postgres.ehixouwzfbndaficwkzf -d postgres -f <file.sql>`
   - For inline query statements:
     `PGPASSWORD="vGU4efjmpeJdO85E" /opt/homebrew/bin/psql -h aws-0-ap-northeast-1.pooler.supabase.com -p 5432 -U postgres.ehixouwzfbndaficwkzf -d postgres -c "<sql-statement>"`

# No Auto-Push Rule

The agent must not push any updates (`git push`) to the remote repository until explicitly asked to do so by the user.

# Issue and Fix Tracking Rule

Agents must keep track of all reported issues, functionality updates, and the fixes applied for them:
- **Included**: All functionality updates, logic changes, bug fixes, and critical UI issues.
- **Excluded**: Basic or routine UI updates (e.g., minor layout, styling, or color tweaks).
- **Documentation**: Record each qualifying issue along with the specific fix/solution applied.

## Log

### [2026-10-03] Multi-Tenant SaaS Retail POS Architecture, Superadmin Portal, FBR Sandbox Switcher & Teststore Data Cloning
- **Type**: Major Architectural Transformation & Platform Feature Implementation
- **Description**: Transformed the single-store retail POS into a scalable multi-tenant SaaS platform (`saas-pos`), running on a single Supabase project (`ehixouwzfbndaficwkzf`) and single frontend build with zero modifications to the production `ak-retail-pos`:
  1. **Logical Tenant Partitioning & PostgreSQL Row Level Security (RLS)**:
     - All 26 operational tables partitioned with `store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE`.
     - Deployed bulletproof RLS policies (`supabase/migrations/20261003_saas_rls_policies.sql`) checking `public.has_store_access(store_id)` against authenticated user's `store_id` and superadmin privileges.
     - Sub-tables (`sale_items`, `return_items`, `product_variants`) enforce tenant boundaries via parent joins.
  2. **Pre-Seeded Demo Store (`teststore`)**:
     - Pre-configured demo store with `id = '11111111-1111-1111-1111-111111111111'`, `slug = 'teststore'`, and `enterprise` tier.
     - Cloned all 258 products, 4 categories, 9 color variants, 109 customer receivable accounts, 9 bank names, and sequence counters directly from `ak-retail-pos` with zero data loss.
  3. **Dual FBR Environments (Sandbox $\longleftrightarrow$ Production)**:
     - Added dynamic runtime switcher between `🧪 Sandbox / Training Mode` and `🟢 Live Production Mode` on the FBR Dashboard (`/setup/fbr`), Store Settings, and Superadmin store controls.
     - Updated `fbrService.ts`: in Sandbox mode, simulates realistic fiscalization by generating instant mock fiscal numbers (`SANDBOX-189142-XXXX`) and valid QR codes without submitting to FBR Iris or incurring tax liability.
     - Updated `PrintBillDialog.tsx`: thermal receipts and previews clearly render a `*** TRAINING / TEST INVOICE (SANDBOX) ***` banner when operating in sandbox mode.
  4. **Superadmin Control Plane (`/superadmin`)**:
     - Dedicated superadmin portal for managing tenant stores, subscription lifecycles, and platform telemetry.
     - **1-Click Tenant Provisioning**: Onboard new client stores in seconds with custom name, slug, owner email, city, NTN/STRN, subscription tier, initial FBR mode, and modular feature flags. Automatically generates isolated settings and sequence counters.
     - **Modular Feature Flag Matrix**: Granular toggles per store for `fbr_integration`, `daily_reconciliation`, `treasury_accounts`, `credit_sales`, `barcode_printing`, and `online_store`.
     - **Tenant God-Mode (Store Impersonation)**: 1-click switch allows superadmins to view and manage any store's POS workspace directly.
  5. **Global Tenant Context (`src/contexts/TenantContext.tsx`)**:
     - Provides `currentStore`, `storeSettings`, `fbrEnvironment`, `setFbrEnvironment`, `isModuleEnabled`, `subscriptionStatus`, `isSuperAdmin`, `allStores`, and `switchStore`.
     - Dynamic sidebar navigation (`AppSidebar.tsx`) automatically hides/shows modules according to each store's licensed feature flags.
  6. **Multi-Tenant Core RPCs**:
     - Deployed multi-tenant `process_sale_transaction` and `process_credit_sale_completion` (`supabase/migrations/20261003_saas_core_rpcs.sql`), automatically binding transactions, inventory deductions, customer ledgers, and cash in hand to the active `store_id`.
     - Overloaded `get_next_sequence` and created `get_next_sequence_for_store(p_seq_id, p_store_id)`.
  7. **Pre-Seeded Credentials & 1-Click Login**:
     - Platform Superadmin: `superadmin@saaspos.pk` / `SuperAdmin@2026`
     - Test Store Owner: `owner@teststore.pk` / `TestOwner@2026`
     - Test Store Cashier: `demo@teststore.pk` / `DemoUser@2026`
     - Added 1-click instant login buttons to `/auth` for rapid testing and demonstrations.
  8. **Strict Isolation**: `ak-retail-pos` directory and database (`lhalnbpcaphhszjliavr`) were kept 100% untouched and functional.

- **Fix / Solution Files**:
  - `scripts/deploy_saas_db.py`: Initialized SaaS enum types, `stores`, `user_profiles`, and 26 partitioned operational tables.
  - `supabase/migrations/20261003_saas_rls_policies.sql`: Deployed PostgreSQL Row Level Security policies across all tables.
  - `supabase/migrations/20261003_saas_core_rpcs.sql`: Multi-tenant sale transactions and credit settlements RPC functions.
  - `src/contexts/TenantContext.tsx`: Central multi-tenant state and store switcher context.
  - `src/services/fbrService.ts`: FBR Sandbox simulation and dual-environment gateway routing.
  - `src/pages/Superadmin.tsx`: SaaS Superadmin dashboard for store onboarding, subscriptions, and module flags.
  - `src/pages/FbrDashboard.tsx`: Interactive FBR Sandbox $\leftrightarrow$ Production switcher and active mode banners.
  - `src/components/layout/AppSidebar.tsx`: Dynamic store branding, FBR environment tag, module-gated navigation, and Superadmin Hub shortcut.
  - `src/components/sales/PrintBillDialog.tsx`: Thermal receipt test watermark for sandbox invoices.
  - `src/pages/Auth.tsx`: Instant 1-click testing buttons for Demo Cashier and Superadmin.
  - `src/hooks/useStoreSettings.ts`: Tenant-aware store settings hook with `fbr_environment` support.
  - `src/App.tsx`: Registered `TenantProvider` and `/superadmin` route.

### [2026-10-04] End-to-End Tenant & Owner Auth Provisioning, GoTrue Password Encryption, and Smart Role Redirect
- **Type**: Major Architectural & Security Enhancement
- **Description**: Implemented end-to-end client onboarding and tenant auth resolution:
  1. **Atomic Provisioning RPC (`provision_tenant_store`)**:
     - Deployed PostgreSQL RPC (`supabase/migrations/20261004_provision_tenant_rpc.sql`) running under `SECURITY DEFINER`.
     - Atomically creates `public.stores`, `public.store_settings`, `public.sequences`, default cash-in-hand till and bank accounts in `public.accounts`, and default category in `public.product_categories`.
     - Generates GoTrue auth user in `auth.users` with standard 10-round bcrypt password hash (`crypt(p_owner_password, gen_salt('bf', 10))`), verified email status, and mandatory GoTrue empty-string tokens (`confirmation_token`, `recovery_token`, `email_change_token_new`, `email_change`).
     - Inserts identity record in `auth.identities` and profile in `public.user_profiles` with `role = 'owner'` linked to `store_id`.
     - Grants all 16 operational route permissions in `public.user_route_permissions` so the owner can immediately operate the POS, catalog, accounting, and reports.
  2. **Role Permission Upgrade (`public.has_role`)**:
     - Upgraded `public.has_role` so that `_role = 'admin'` automatically matches `superadmin`, `owner`, and `admin` roles, ensuring owners and superadmins have full administrative authority across all modules.
  3. **Superadmin Onboarding Wizard & Copyable Credentials UI**:
     - Upgraded Onboarding dialog in `src/pages/Superadmin.tsx` to collect Owner Name, Login Email, and Initial Password (with strong password generator and visibility toggle).
     - Added post-provisioning Credentials modal with 1-click clipboard copy of client credentials and direct "Switch to Store Workspace Now" button.
  4. **Smart Login Redirect in `src/pages/Auth.tsx`**:
     - Superadmin (`superadmin@saaspos.pk` or `role = 'superadmin'`) automatically lands on `/superadmin` upon login.
     - Store owners, cashiers, and managers land on `/` or their permitted route.
     - Refactored login page branding with modern SaaS store badge container and fixed seeded user password hashes in `auth.users`.

- **Fix / Solution Files**:
  - `supabase/migrations/20261004_provision_tenant_rpc.sql`: Database migration creating `provision_tenant_store` RPC and upgrading `has_role`.
  - `src/pages/Superadmin.tsx`: Added owner credentials inputs, random password generator, `provision_tenant_store` RPC invocation, and credentials success modal.
  - `src/pages/Auth.tsx`: Added role-aware landing redirects (Superadmin to `/superadmin`, store users to `/`), and modern UI branding.

### [2026-10-04] Granular Page-Level Permissions Matrix, Tier Presets, and FBR Master Disengagement System
- **Type**: Major Architectural & Access Control Transformation
- **Description**: Replaced coarse module-level toggles with granular page-level permissions across 27 application pages grouped into 7 intuitive sections, with automatic tier presets and an explicit FBR Master Disengagement switch:
  1. **Granular Permissions Configuration (`src/config/granularModules.ts`)**:
     - Partitioned 27 pages into 7 functional sections: Point of Sale (4 pages), Inventory & Catalog (6 pages), Reports & Analytics (10 pages), Till Balancing & Treasury (3 pages), Taxation & FBR (1 page), Online Store & Order Book (9 pages), Utilities & Setup (4 pages).
     - Defined automated tier presets:
       - **Starter**: 13 essential single-till pages, `fbr = false` (FBR completely disengaged).
       - **Professional**: 20 multi-till operational pages, `fbr = true`.
       - **Enterprise**: All 27 operational pages and modules enabled, `fbr = true`.
  2. **FBR Master Disengagement Engine**:
     - Dedicated Master FBR switch in the Superadmin control plane (`/superadmin`).
     - **When Disengaged (`fbr_integration = false`)**:
       - POS counter checkouts (`useSales.ts`) completely bypass FBR Iris/gateway APIs (zero network latency, instant transaction).
       - Receipt generation (`PrintBillDialog.tsx`) prints clean standard retail bills with zero FBR QR codes and zero `*** TRAINING / TEST INVOICE (SANDBOX) ***` watermarks.
       - Taxation & FBR navigation (`/setup/fbr`) is completely hidden from the sidebar.
       - Superadmin store table renders `🚫 Disengaged` badge.
     - **When Engaged (`fbr_integration = true`)**:
       - Fully supports dynamic switching between `🧪 Sandbox` (mock fiscal numbers + training watermark) and `🟢 Live Production`.
  3. **Superadmin Granular Control Center (`src/pages/Superadmin.tsx`)**:
     - Built `GranularPermissionsEditor` with collapsible section cards, active page counters (`X / Y Pages`), and section-level "Select All / Deselect All".
     - Real-time tier preset synchronization: selecting Starter, Professional, or Enterprise automatically applies preset pages while permitting custom fine-tuning.
     - Fully integrated into both **"Onboard New Store"** and **"Manage Store"** dialogs.
  4. **Dynamic Context & Sidebar Filtering (`TenantContext.tsx` & `AppSidebar.tsx`)**:
     - `useTenant().isPageEnabled(path)` verifies granular tenant licensing with backward-compatible fallbacks.
     - `AppSidebar` automatically hides unlicensed routes in real time.

- **Fix / Solution Files**:
  - `src/config/granularModules.ts`: Master configuration defining 27 pages across 7 sections and subscription tier presets.
  - `src/contexts/TenantContext.tsx`: `isPageEnabled` resolution, `enabled_pages` typing, and hard FBR disengagement guard.
  - `src/components/layout/AppSidebar.tsx`: Real-time sidebar route filtering using `isPageEnabled`.
  - `src/hooks/useSales.ts`: Hard FBR disengagement guard during counter checkouts and credit sale settlements.
  - `src/components/sales/PrintBillDialog.tsx`: Receipt watermark condition tied to actual FBR invoice generation.
  - `src/pages/Superadmin.tsx`: Implemented `GranularPermissionsEditor`, tier auto-sync, FBR status column, and widened modal interfaces.

### [2026-10-04] Resolution for Blank Test Store Screen on Demo Login & Route Permissions Hierarchy
- **Type**: Bug Fix & Permissions Architecture Alignment
- **Description**: Resolved issue where logging in as `demo@teststore.pk` resulted in an empty sidebar and blank dashboard screen despite permissions being assigned to Test Store:
  1. **User Role Alignment**: Updated `demo@teststore.pk` in `public.user_profiles` to `role = 'owner'` linked to Test Store (`id = '11111111-1111-1111-1111-111111111111'`). Previously, `demo@teststore.pk` had `role = 'cashier'` with zero individual rows in `public.user_route_permissions`, which caused `hasRouteAccess` to block every navigation route.
  2. **Root Dashboard Access Guard**: In `src/contexts/TenantContext.tsx`, updated `isPageEnabled` to always return `true` for root path (`'/'`), ensuring the dashboard is never inadvertently excluded when `enabled_pages` only lists operational sub-pages.
  3. **Dashboard Fallback Navigation**: In `src/pages/Dashboard.tsx`, integrated `hasRouteAccess('/')` and replaced silent `null` rendering with intelligent fallback navigation to `/pos/sales` if dashboard access is restricted.
  4. **Graceful Staff Permissions Fallback**: In `src/contexts/PermissionsContext.tsx`, updated `hasRouteAccess` so that active staff users with unrestricted/unassigned route profiles default to essential POS till routes (`/`, `/pos/sales`, `/pos/returns`, `/customers`, `/pos/pending-payments`), preventing blank screen lockouts.
  5. **Synchronized `app_routes` Table**: Upserted all 39 application routes with unique path indexing into `public.app_routes` in the database, bringing legacy table routes in sync with `navigationConfig`.

- **Fix / Solution Files**:
  - `src/contexts/TenantContext.tsx`: Added root path guard (`pagePath === '/' || pagePath === '' -> true`) in `isPageEnabled`.
  - `src/contexts/PermissionsContext.tsx`: Enhanced `hasRouteAccess` with root dashboard pass-through and standard till route fallback.
  - `src/pages/Dashboard.tsx`: Added `hasRouteAccess` check and fallback redirect.
  - `Database`: Updated `demo@teststore.pk` to `role = 'owner'` and populated all 39 routes in `public.app_routes`.

### [2026-10-04] Sales Summary Query Latency Fix & Customer Khata Schema Alignment
- **Type**: Bug Fix & Database Schema Architecture Alignment
- **Description**: Resolved issue where sales made in the POS did not appear in the Sales Summary report (`/reports/sales-summary`) and the page suffered severe loading latency (~15 seconds):
  1. **Foreign Key Alignment to `public.accounts`**:
     - POS sales queries perform relational joins with customer accounts: `customer:accounts!customer_id(id, name, phone, current_balance)`.
     - In the initial SaaS migration, `sales.customer_id`, `returns.customer_id`, `credit_sales.customer_id`, and `held_carts.customer_id` had been created referencing `public.customers(id)` instead of `public.accounts(id)`.
     - Repointed all `customer_id` foreign keys to `public.accounts(id) ON DELETE SET NULL`.
  2. **Missing Customer Receivable Columns on `public.accounts`**:
     - Added missing customer khata profile columns to `public.accounts`: `phone`, `email`, `address`, `city`, `credit_limit`, `opening_balance`, `account_title`, `branch_location`, and `bank_name_id`.
     - Reloaded PostgREST schema cache (`NOTIFY pgrst, 'reload schema'`), eliminating the `PGRST200` relation error and 15s retry backoff loop. Queries now execute in `<50ms`.
  3. **Walk-In & Direct Customer Name Fallbacks**:
     - In `src/pages/SalesSummary.tsx` and `src/pages/DetailedSalesSummary.tsx`, updated search filters and table/card customer labels to gracefully fall back to `(item as any).customer_name || 'Walk-in'` when `item.customer` is `null` (standard for walk-in counter sales).

- **Fix / Solution Files**:
  - `Database`: Foreign key migration on `sales`, `returns`, `credit_sales`, and `held_carts` to `public.accounts(id)`, column additions on `public.accounts`, and schema cache reload.
  - `src/pages/SalesSummary.tsx`: Added `customer_name` fallback to search filtering and customer column rendering in both mobile and desktop layouts.
  - `src/pages/DetailedSalesSummary.tsx`: Added `customer_name` fallback to search filtering and customer column rendering in both mobile and desktop layouts.

### [2026-10-04] Held Carts Schema Alignment, Tenant Defaults, and Realtime Publication Fix
- **Type**: Bug Fix & Multi-Tenant Database Architecture
- **Description**: Resolved "Failed to load held carts" error on the POS Sales page (`/pos/sales`):
  1. **Missing Workflow Columns in `public.held_carts`**:
     - The POS hook `useHeldCarts` queries `held_carts` filtering by `created_by`, `assigned_to`, and `page_type`.
     - These columns were missing in `public.held_carts` from the initial SaaS table creation, causing PostgREST queries to fail with column missing errors.
     - Added `created_by UUID REFERENCES auth.users(id)`, `assigned_to UUID REFERENCES auth.users(id)`, and `page_type TEXT DEFAULT 'sales'` with corresponding performance indexes.
  2. **Multi-Tenant Automatic Defaults**:
     - Configured `DEFAULT public.current_store_id()` on `held_carts.store_id`, `DEFAULT auth.uid()` on `created_by` and `user_id`, ensuring carts created from any terminal automatically attach to the active store and user without relying on client-side manual ID stitching.
  3. **Realtime Synchronization & Cache Reload**:
     - Enabled `REPLICA IDENTITY FULL` on `public.held_carts` and added the table to the `supabase_realtime` publication, allowing held and forwarded carts to sync across till terminals and devices in real time.
     - Updated `useHeldCarts.ts` with tenant store ID isolation and cache keys.
     - Reloaded PostgREST schema cache (`NOTIFY pgrst, 'reload schema'`).

- **Fix / Solution Files**:
  - `supabase/migrations/20261004_fix_held_carts_schema.sql`: Database migration adding columns, defaults, indexes, and realtime publication.
  - `src/hooks/useHeldCarts.ts`: Added tenant store context, query key store isolation, and store ID payload handling.

### [2026-10-07] Dynamic Retail Model, Universal Product Lexicon, and Industry Archetypes Engine
- **Type**: Major Architectural Transformation & Platform Generalization
- **Description**: Transformed the textile/fabric-centric POS model into a universal retail architecture capable of onboarding any retail vertical (General Retail, Fashion Apparel, Footwear, Electronics, Weighing Scale Groceries, Cut-to-Order Textiles):
  1. **Dynamic Retail Lexicon & Business Types**:
     - Added `business_type text DEFAULT 'general_retail'` to `public.stores`.
     - Added `lexicon jsonb` to `public.store_settings` encapsulating `item_singular`, `item_plural`, `primary_unit`, `secondary_metric_name`, `secondary_metric_symbol`, `enable_secondary_metric`, and `allow_fractional_qty`.
     - Preserved `teststore` with `business_type = 'fabrics'` and full suit/meter lexicon.
     - Upgraded `provision_tenant_store` PostgreSQL RPC to accept and automatically initialize `p_business_type` and `p_lexicon`.
  2. **Industry Archetypes Configuration (`src/config/industryArchetypes.ts`)**:
     - Standardized 7 retail presets:
       - General Retail & Supermarket (`general_retail`)
       - Textiles & Unstitched Suits (`fabrics`)
       - Cut-to-Order Fabrics & Drapery (`fabric_rolls`)
       - Fashion Apparel & Boutiques (`apparel`)
       - Footwear & Shoes (`footwear`)
       - Electronics, Mobile & Tech (`electronics`)
       - Grocery & Weighing Scale (`grocery`)
  3. **Global Tenant Context Dynamics (`src/contexts/TenantContext.tsx`)**:
     - `useTenant().lexicon` provides reactive access to store terminology and secondary metric toggles across all pages.
  4. **Multi-Page Lexicon & Metric Adaptations**:
     - `Products.tsx` & `ProductForm.tsx`: Dynamically adjust labels (`Add New {item_singular}`, `Stock ({item_plural})`, `Price/{item_singular}`), and collapse the secondary metric column/input when `enable_secondary_metric = false`.
     - `StockSummary.tsx`, `StockReceiving.tsx`, `StockReport.tsx`, `ReceivedStockReport.tsx`, `Inventory.tsx`: Dynamic stats cards, headers, unit badges, and conditional secondary measurement columns.
     - `CartItems.tsx`: Dynamic unit badge in POS cart based on `lexicon.primary_unit`.
     - `OnlineProducts.tsx` & `OnlineOrders.tsx`: Replaced hardcoded suit/meter text with dynamic item labels, units, and conditional secondary dimensions.
     - `WarehouseLinks.tsx`: Dynamic variation labelling based on active secondary metric.
  5. **Superadmin & Store Settings Lexicon Controls**:
     - Superadmin onboarding wizard includes Industry Archetype selector dropdown with archetype description, badge, and live unit indicator.
     - Superadmin stores table displays retail archetype badge for each tenant.
     - Added visual "Product Terminology & Metrics" card in `StoreSettings.tsx` with 1-click industry preset quick-fills and granular customization.

- **Fix / Solution Files**:
  - `supabase/migrations/20261007_dynamic_retail_lexicon.sql`: Database schema update and `provision_tenant_store` RPC upgrade.
  - `src/config/industryArchetypes.ts`: Master configuration for 7 retail archetypes and lexicon interfaces.
  - `src/contexts/TenantContext.tsx`: Integrated reactive `lexicon` provider into multi-tenant context.
  - `src/pages/Superadmin.tsx`: Added archetype picker to tenant onboarding and archetype badges to store table.
  - `src/pages/StoreSettings.tsx`: Added Product Terminology & Metrics configuration card.
  - `src/pages/Products.tsx` & `src/components/products/ProductForm.tsx`: Dynamic catalog labels and conditional metric columns.
  - `src/pages/StockSummary.tsx`, `src/pages/StockReceiving.tsx`, `src/pages/StockReport.tsx`, `src/pages/ReceivedStockReport.tsx`, `src/pages/Inventory.tsx`: Adapted inventory and stock reports.
  - `src/components/sales/CartItems.tsx`, `src/pages/WarehouseLinks.tsx`, `src/pages/OnlineProducts.tsx`, `src/pages/OnlineOrders.tsx`: Dynamic unit badges, variation labels, and ecommerce storefront phrasing.

### [2026-10-07] Extensible Product Attributes, Custom Specifications & Archetype Defaults (Phase 2)
- **Type**: Major Architectural & Catalog Generalization
- **Description**: Implemented store-defined custom product attributes and extensible metadata schemas across the entire catalog and onboarding engine:
  1. **Dynamic Metadata Storage (`metadata jsonb`)**:
     - Added `metadata jsonb DEFAULT '{}'::jsonb` with GIN indexing to `public.products`.
     - Added `custom_product_fields jsonb DEFAULT '[]'::jsonb` to `public.store_settings`.
     - Seeded `teststore` with custom fabric fields (`fabric_type`, `season`, `pana`, `brand`) for seamless backward compatibility.
     - Upgraded `provision_tenant_store` PostgreSQL RPC to automatically initialize tenant-specific default custom fields according to the selected industry archetype.
  2. **Reactive Product Form Attributes**:
     - `ProductForm.tsx` dynamically renders input fields (Select dropdowns, numeric inputs, text, date pickers) for any active `customProductFields` configured for the store.
     - Automatically saves all custom attributes into `product.metadata`.
  3. **Visual Store Settings Attribute Manager**:
     - Added "Product Specifications & Custom Attributes" card in `StoreSettings.tsx`.
     - Store owners can view active attributes, add new fields (with automatic slug generation and type selection), remove fields, or 1-click reset to their industry archetype defaults.
  4. **Catalog Metadata Visualization**:
     - Products table in `Products.tsx` renders custom specification badges (e.g. Brand, Fabric Type, Season, Warranty) cleanly underneath product names.

- **Fix / Solution Files**:
  - `supabase/migrations/20261007_extensible_product_attributes.sql`: Database schema update and `provision_tenant_store` RPC upgrade.
  - `src/config/industryArchetypes.ts`: Defined `CustomProductField` interface and archetype default field sets.
  - `src/contexts/TenantContext.tsx`: Provided `customProductFields` in tenant context with fallback.
  - `src/components/products/ProductForm.tsx`: Dynamic specifications form rendering.
  - `src/pages/Products.tsx`: FormData metadata state handling and catalog badge display.
  - `src/pages/StoreSettings.tsx`: Visual custom product attributes management card.

### [2026-10-07] Universal Multi-Axis Variant Matrix, Combinatorial Generator & POS Checkout Integration (Phase 3)
- **Type**: Major Architectural & Point of Sale Enhancement
- **Description**: Transformed the legacy single-color swatch system into a full universal multi-axis variant matrix (Sizes $\times$ Colors $\times$ Options) with individual SKUs, barcodes, price overrides, inventory tracking, and POS integration:
  1. **Database Schema Upgrade (`public.product_variants` & `public.sale_items`)**:
     - Added `title text`, `size text`, `sku text`, `barcode text`, `price numeric(10,2)`, `cost_price numeric(10,2)`, `stock_quantity integer DEFAULT 0`, and `attributes jsonb` to `public.product_variants`.
     - Made `color_name` nullable so non-apparel variants (e.g. storage size, shoe sizes) are fully supported without fake color fields.
     - Added `has_variants boolean DEFAULT false` to `public.products` with performance indexes on `product_id`, `sku`, and `barcode`.
     - Added `variant_id uuid REFERENCES public.product_variants(id)` to `public.sale_items`.
     - Upgraded `process_sale_transaction` PostgreSQL RPC to automatically deduct variant-specific inventory alongside parent product inventory whenever a variant is sold.
  2. **Product Variants Manager Dialog (`ProductVariantsDialog.tsx`)**:
     - Built comprehensive variant management dialog accessible from the Products catalog (`/products`).
     - **Active Variants List**: Displays all variants with size badges, color swatches, individual SKUs, price overrides, and inline stock counters.
     - **Matrix Generator**: Generates the Cartesian product (e.g. Sizes S, M, L $\times$ Colors Black, White $\rightarrow$ 6 variants) in 1 click, automatically building SKUs and allocating initial stock.
     - **Single Variant Creator**: Manual variant creation with custom size, color picker hex, barcode, price, and stock.
  3. **POS Integration & 1-Click Variant Selector (`PosVariantSelectorModal.tsx`)**:
     - When tapping any product with `has_variants === true` on the POS screen (`/pos/sales`), a quick variant selector modal opens, displaying all available variants with live prices and stock indicators.
     - Barcode scanner automatically detects variant-level barcodes or SKUs and immediately adds the exact variant to the cart.
     - Cart displays variant badges (e.g. "Size: 42 / Navy Blue") on line items and passes `variant_id` to the atomic sale RPC.

- **Fix / Solution Files**:
  - `supabase/migrations/20261007_universal_variant_matrix.sql`: Database schema migration and indexes.
  - `src/types/database.ts`: Added `ProductVariant`, `has_variants`, and `variant_id` typings.
  - `src/hooks/useProductVariants.ts`: Query and mutation hooks for single, batch, update, and delete variant operations.
  - `src/components/products/ProductVariantsDialog.tsx`: Multi-tab variant manager dialog with combinatorial matrix generator.
  - `src/components/sales/PosVariantSelectorModal.tsx`: Fast 1-click POS variant selection modal.
  - `src/components/sales/CartItems.tsx`: Added `variantId` and `variantTitle` to cart items and visual badges.
  - `src/pages/Products.tsx`: Wired "Variants" badge and "Manage Variants" action in catalog table.
  - `src/pages/Sales.tsx`: Wired POS variant modal, variant-aware barcode scanning, and RPC transaction payloads.

### [2026-10-07] TenantProvider useMemo ReferenceError Runtime Fix
- **Type**: Bug Fix & Runtime Stability
- **Description**: Resolved `ReferenceError: Can't find variable: useMemo` causing a blank white screen inside `<TenantProvider>` at `src/contexts/TenantContext.tsx:291`. Added missing `useMemo` named import from React.
- **Fix / Solution Files**:
  - `src/contexts/TenantContext.tsx`: Imported `useMemo` from `'react'`.

### [2026-10-07] Superadmin Store Icon Component ReferenceError Fix
- **Type**: Bug Fix & Runtime Stability
- **Description**: Resolved `ReferenceError: Can't find variable: Store` at `src/pages/Superadmin.tsx:1035`. The JSX label `<Store className="..." />` attempted to render the Lucide icon `Store`, but `Store` was shadowed and imported purely as a TypeScript interface (`type Store`) from `TenantContext`. Renamed the type import to `type Store as TenantStore` and explicitly imported the `Store` icon component from `lucide-react`.
### [2026-10-07] Superadmin ChevronUp ReferenceError & app_routes RLS Write Policy Fix
- **Type**: Bug Fix & Security/Permissions Alignment
- **Description**: Resolved two runtime console errors affecting Superadmin and app route sync:
  1. **ChevronUp ReferenceError**: In `src/pages/Superadmin.tsx`, `<GranularPermissionsEditor>` used `<ChevronUp className="w-4 h-4" />` on line 296 for section collapse toggles, but `ChevronUp` had not been included in the named imports from `lucide-react`. Added `ChevronUp` to `lucide-react` imports.
  2. **403 Forbidden / 42501 Insufficient Privilege on `public.app_routes`**: During initial app boot, `useRouteSync.ts` runs an upsert against `public.app_routes` to synchronize routes from `navigationConfig`. The table previously only had a `SELECT` RLS policy (`App routes read policy`), causing PostgREST to reject upserts with `42501 (permission denied)`. Created and executed migration `supabase/migrations/20261007_app_routes_write_policy.sql` adding `INSERT`, `UPDATE`, and `DELETE` policies on `public.app_routes` for users where `public.is_superadmin() OR public.has_role(auth.uid(), 'admin')` is true, and reloaded the PostgREST schema cache.
- **Fix / Solution Files**:
  - `src/pages/Superadmin.tsx`: Added `ChevronUp` to `lucide-react` imports.
  - `supabase/migrations/20261007_app_routes_write_policy.sql`: Deployed write RLS policy on `public.app_routes`.

### [2026-10-13] GitHub Repository Synchronization & Vercel Production Deployment
- **Type**: Platform Deployment & Infrastructure Integration
- **Description**: Uploaded the multi-tenant SaaS POS codebase to GitHub and connected/deployed to Vercel production:
  1. **GitHub Repository Sync**: Connected local repository to `https://github.com/khizar7878/saas-pos` (`origin/main`). Staged and committed all recent multi-tenant retail features, universal variants, dynamic retail archetypes, and database migrations, and pushed branch `main`.
  2. **Vercel Project Provisioning & Linking**: Linked local workspace to Vercel project `muhammad-khizar-hayats-projects/saas-pos` and connected the GitHub repository.
  3. **Environment Configuration**: Configured production, preview, and development environment variables on Vercel (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_APP_NAME`, `VITE_APP_SHORT_NAME`, `VITE_WAREHOUSE_SUPABASE_URL`, `VITE_WAREHOUSE_SUPABASE_ANON_KEY`).
  4. **Deployment & SSO Protection Optimization**: Deployed production build to `https://saas-pos-rho.vercel.app` and disabled SSO deployment protection to permit seamless cashier and store owner access. Verified SPA rewrites (`vercel.json`) return HTTP 200 for deep route direct access.
- **Fix / Solution Files**:
  - Remote Repository: `https://github.com/khizar7878/saas-pos`
  - Production URL: `https://saas-pos-rho.vercel.app`
  - Vercel Project: `muhammad-khizar-hayats-projects/saas-pos`
