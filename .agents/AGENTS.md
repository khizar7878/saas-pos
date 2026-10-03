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
