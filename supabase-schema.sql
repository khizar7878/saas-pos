-- =============================================
-- FABRIC WHOLESALE POS - COMPLETE DATABASE SCHEMA
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- 1. USER ROLES (Security)
-- =============================================
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'cashier');

CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'cashier',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- =============================================
-- 2. PRODUCT CATEGORIES
-- =============================================
CREATE TABLE public.product_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 3. PRODUCTS (Fabric rolls)
-- =============================================
CREATE TABLE public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    sku TEXT UNIQUE NOT NULL,
    barcode TEXT UNIQUE,
    category_id UUID REFERENCES public.product_categories(id),
    price_per_meter DECIMAL(10,2) NOT NULL DEFAULT 0,
    cost_per_meter DECIMAL(10,2) NOT NULL DEFAULT 0,
    meters_per_roll DECIMAL(10,2) NOT NULL DEFAULT 100,
    current_stock_meters DECIMAL(10,2) NOT NULL DEFAULT 0,
    min_stock_meters DECIMAL(10,2) NOT NULL DEFAULT 50,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 4. ACCOUNT CATEGORIES (Chart of Accounts)
-- =============================================
CREATE TYPE public.account_type AS ENUM ('asset', 'liability', 'equity', 'revenue', 'expense');
CREATE TYPE public.account_subtype AS ENUM (
    -- Assets
    'cash_in_hand', 'cash_reserve', 'cheques', 'bank_account', 'receivable', 'inventory', 'fixed_asset',
    -- Liabilities
    'payable', 'loan', 'tax_payable',
    -- Equity
    'owner_capital', 'retained_earnings',
    -- Revenue
    'sales_revenue', 'service_revenue', 'interest_income',
    -- Expenses
    'cost_of_goods', 'operating_expense', 'bank_fees'
);

CREATE TABLE public.account_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    account_type account_type NOT NULL,
    account_subtype account_subtype NOT NULL,
    description TEXT,
    is_system BOOLEAN DEFAULT FALSE, -- System accounts cannot be deleted
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 5. BANK NAMES (Predefined list)
-- =============================================
CREATE TABLE public.bank_names (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    short_code TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 6. ACCOUNTS (Customers, Suppliers, Bank Accounts, Cash)
-- =============================================
CREATE TABLE public.accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    category_id UUID REFERENCES public.account_categories(id),
    account_type account_type NOT NULL,
    account_subtype account_subtype NOT NULL,
    
    -- Contact info (for customers/suppliers)
    phone TEXT,
    email TEXT,
    address TEXT,
    
    -- Bank account details
    bank_name_id UUID REFERENCES public.bank_names(id),
    account_number TEXT,
    account_title TEXT,
    branch_location TEXT,
    
    -- Financial
    opening_balance DECIMAL(12,2) DEFAULT 0,
    current_balance DECIMAL(12,2) DEFAULT 0,
    credit_limit DECIMAL(12,2) DEFAULT 0,
    
    is_active BOOLEAN DEFAULT TRUE,
    is_system BOOLEAN DEFAULT FALSE, -- System accounts (Cash in Hand, Cash Reserve) cannot be deleted
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 7. CUSTOMERS (Receivables - simplified view)
-- =============================================
CREATE VIEW public.customers AS
SELECT 
    id, name, phone, email, address, 
    current_balance as balance,
    credit_limit, is_active, created_at
FROM public.accounts 
WHERE account_subtype = 'receivable';

-- =============================================
-- 8. SUPPLIERS (Payables - simplified view)
-- =============================================
CREATE VIEW public.suppliers AS
SELECT 
    id, name, phone, email, address,
    current_balance as balance,
    is_active, created_at
FROM public.accounts 
WHERE account_subtype = 'payable';

-- =============================================
-- 9. SALES
-- =============================================
CREATE TYPE public.sale_status AS ENUM ('completed', 'held', 'cancelled', 'returned');
CREATE TYPE public.payment_method AS ENUM ('cash', 'ibft', 'cheque', 'credit', 'mixed');

CREATE TABLE public.sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_number TEXT UNIQUE NOT NULL,
    customer_id UUID REFERENCES public.accounts(id),
    
    subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
    discount_amount DECIMAL(12,2) DEFAULT 0,
    discount_percent DECIMAL(5,2) DEFAULT 0,
    total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    
    payment_method payment_method NOT NULL DEFAULT 'cash',
    amount_received DECIMAL(12,2) DEFAULT 0,
    change_amount DECIMAL(12,2) DEFAULT 0,
    deposit_account_id UUID REFERENCES public.accounts(id), -- Where payment was deposited
    
    status sale_status DEFAULT 'completed',
    notes TEXT,
    
    -- Cheque details (for cheque payments)
    cheque_number TEXT,
    cheque_bank TEXT,
    cheque_date DATE,
    
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 10. SALE ITEMS
-- =============================================
CREATE TABLE public.sale_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID REFERENCES public.sales(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES public.products(id) NOT NULL,
    
    quantity_meters DECIMAL(10,2) NOT NULL, -- For custom cuts or full rolls
    is_full_roll BOOLEAN DEFAULT FALSE,
    rolls_count INTEGER DEFAULT 0, -- If selling full rolls
    
    price_per_meter DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(12,2) NOT NULL,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 11. HELD CARTS (For holding sales temporarily)
-- =============================================
CREATE TABLE public.held_carts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cart_name TEXT NOT NULL,
    customer_id UUID REFERENCES public.accounts(id),
    cart_data JSONB NOT NULL, -- Stores cart items as JSON
    total_amount DECIMAL(12,2) DEFAULT 0,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 12. RETURNS
-- =============================================
CREATE TYPE public.return_status AS ENUM ('pending', 'approved', 'completed', 'rejected');

CREATE TABLE public.returns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    return_number TEXT UNIQUE NOT NULL,
    original_sale_id UUID REFERENCES public.sales(id),
    customer_id UUID REFERENCES public.accounts(id),
    
    total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    reason TEXT,
    status return_status DEFAULT 'pending',
    
    processed_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.return_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    return_id UUID REFERENCES public.returns(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES public.products(id) NOT NULL,
    sale_item_id UUID REFERENCES public.sale_items(id),
    
    quantity_meters DECIMAL(10,2) NOT NULL,
    price_per_meter DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(12,2) NOT NULL,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 13. STOCK RECEIVING (From Warehouse)
-- =============================================
CREATE TABLE public.stock_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_number TEXT UNIQUE NOT NULL,
    
    total_rolls INTEGER DEFAULT 0,
    total_meters DECIMAL(12,2) DEFAULT 0,
    notes TEXT,
    
    received_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.stock_receipt_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_id UUID REFERENCES public.stock_receipts(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES public.products(id) NOT NULL,
    
    rolls_received INTEGER NOT NULL DEFAULT 1,
    meters_per_roll DECIMAL(10,2) NOT NULL,
    total_meters DECIMAL(12,2) NOT NULL,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 14. PAYMENTS (Make, Receive, Circulate)
-- =============================================
CREATE TYPE public.payment_type AS ENUM ('receive', 'make', 'circulated');
CREATE TYPE public.payment_mode AS ENUM ('cash', 'ibft', 'cheque');

CREATE TABLE public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_number TEXT UNIQUE NOT NULL,
    payment_type payment_type NOT NULL,
    payment_mode payment_mode NOT NULL DEFAULT 'cash',
    
    from_account_id UUID REFERENCES public.accounts(id) NOT NULL,
    to_account_id UUID REFERENCES public.accounts(id) NOT NULL,
    
    amount DECIMAL(12,2) NOT NULL,
    notes TEXT,
    
    -- Attachment (receipt/proof image)
    attachment_url TEXT,
    
    -- Cheque details (for cheque payments)
    cheque_number TEXT,
    cheque_bank TEXT,
    cheque_date DATE,
    
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 15. LEDGER ENTRIES (Transaction history for all accounts)
-- =============================================
CREATE TABLE public.ledger_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,
    
    description TEXT NOT NULL,
    debit DECIMAL(12,2) DEFAULT 0,
    credit DECIMAL(12,2) DEFAULT 0,
    balance DECIMAL(12,2) NOT NULL,
    
    -- Reference to source transaction
    reference_type TEXT, -- 'sale', 'return', 'payment', 'stock_receipt', 'adjustment'
    reference_id UUID,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 16. DAILY CASH CLOSING
-- =============================================
CREATE TABLE public.daily_closings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    closing_date DATE UNIQUE NOT NULL,
    
    opening_balance DECIMAL(12,2) NOT NULL,
    total_cash_in DECIMAL(12,2) DEFAULT 0,
    total_cash_out DECIMAL(12,2) DEFAULT 0,
    expected_closing DECIMAL(12,2) NOT NULL,
    physical_count DECIMAL(12,2),
    difference DECIMAL(12,2),
    
    is_reconciled BOOLEAN DEFAULT FALSE,
    notes TEXT,
    
    closed_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 17. SEQUENCE GENERATORS (For invoice/receipt numbers)
-- =============================================
CREATE TABLE public.sequences (
    id TEXT PRIMARY KEY,
    prefix TEXT NOT NULL,
    current_value INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default sequences
INSERT INTO public.sequences (id, prefix, current_value) VALUES
    ('sale', 'INV-', 1000),
    ('return', 'RET-', 1000),
    ('stock_receipt', 'SR-', 1000),
    ('payment', 'PAY-', 1000);

-- Function to get next sequence number
CREATE OR REPLACE FUNCTION public.get_next_sequence(seq_id TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    next_val INTEGER;
    seq_prefix TEXT;
BEGIN
    UPDATE public.sequences 
    SET current_value = current_value + 1, updated_at = NOW()
    WHERE id = seq_id
    RETURNING current_value, prefix INTO next_val, seq_prefix;
    
    RETURN seq_prefix || LPAD(next_val::TEXT, 5, '0');
END;
$$;

-- =============================================
-- 18. INSERT DEFAULT DATA
-- =============================================

-- Default Bank Names (Pakistan)
INSERT INTO public.bank_names (name, short_code) VALUES
    ('Habib Bank Limited', 'HBL'),
    ('United Bank Limited', 'UBL'),
    ('MCB Bank', 'MCB'),
    ('Allied Bank Limited', 'ABL'),
    ('Bank Alfalah', 'BAFL'),
    ('Meezan Bank', 'MEBL'),
    ('Faysal Bank', 'FBL'),
    ('Askari Bank', 'AKBL'),
    ('Bank Al Habib', 'BAHL'),
    ('Standard Chartered', 'SCB'),
    ('National Bank of Pakistan', 'NBP'),
    ('Habib Metropolitan Bank', 'HMB'),
    ('JS Bank', 'JSB'),
    ('Soneri Bank', 'SNBL'),
    ('Summit Bank', 'SMBL'),
    ('JazzCash', 'JAZZ'),
    ('Easypaisa', 'EP'),
    ('SadaPay', 'SADA'),
    ('NayaPay', 'NAYA');

-- Default Account Categories
INSERT INTO public.account_categories (name, account_type, account_subtype, is_system) VALUES
    ('Cash in Hand', 'asset', 'cash_in_hand', TRUE),
    ('Cash Reserve', 'asset', 'cash_reserve', TRUE),
    ('Cheques', 'asset', 'cheques', TRUE),
    ('Bank Accounts', 'asset', 'bank_account', TRUE),
    ('Accounts Receivable', 'asset', 'receivable', TRUE),
    ('Inventory', 'asset', 'inventory', TRUE),
    ('Accounts Payable', 'liability', 'payable', TRUE),
    ('Sales Revenue', 'revenue', 'sales_revenue', TRUE),
    ('Cost of Goods Sold', 'expense', 'cost_of_goods', TRUE);

-- Default System Accounts
INSERT INTO public.accounts (name, account_type, account_subtype, is_system, opening_balance, current_balance)
SELECT 'Cash in Hand', 'asset', 'cash_in_hand', TRUE, 0, 0
WHERE NOT EXISTS (SELECT 1 FROM public.accounts WHERE name = 'Cash in Hand');

INSERT INTO public.accounts (name, account_type, account_subtype, is_system, opening_balance, current_balance)
SELECT 'Cash Reserve', 'asset', 'cash_reserve', TRUE, 0, 0
WHERE NOT EXISTS (SELECT 1 FROM public.accounts WHERE name = 'Cash Reserve');

INSERT INTO public.accounts (name, account_type, account_subtype, is_system, opening_balance, current_balance)
SELECT 'Cheques', 'asset', 'cheques', TRUE, 0, 0
WHERE NOT EXISTS (SELECT 1 FROM public.accounts WHERE name = 'Cheques');

-- Default Product Categories
INSERT INTO public.product_categories (name, description) VALUES
    ('Cotton', 'Cotton fabrics'),
    ('Silk', 'Silk fabrics'),
    ('Polyester', 'Polyester fabrics'),
    ('Linen', 'Linen fabrics'),
    ('Wool', 'Wool fabrics'),
    ('Chiffon', 'Chiffon fabrics'),
    ('Velvet', 'Velvet fabrics'),
    ('Denim', 'Denim fabrics');

-- =============================================
-- 19. ROW LEVEL SECURITY POLICIES
-- =============================================

-- Enable RLS on all tables
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_names ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.held_carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.return_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_closings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sequences ENABLE ROW LEVEL SECURITY;

-- Policies for authenticated users (adjust based on your needs)
CREATE POLICY "Authenticated users can read products" ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage products" ON public.products FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read categories" ON public.product_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage categories" ON public.product_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read accounts" ON public.accounts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage accounts" ON public.accounts FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read account_categories" ON public.account_categories FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read bank_names" ON public.bank_names FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage bank_names" ON public.bank_names FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read sales" ON public.sales FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage sales" ON public.sales FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read sale_items" ON public.sale_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage sale_items" ON public.sale_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Users can manage their held_carts" ON public.held_carts FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read returns" ON public.returns FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage returns" ON public.returns FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read return_items" ON public.return_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage return_items" ON public.return_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read stock_receipts" ON public.stock_receipts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage stock_receipts" ON public.stock_receipts FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read stock_receipt_items" ON public.stock_receipt_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage stock_receipt_items" ON public.stock_receipt_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read payments" ON public.payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage payments" ON public.payments FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read ledger_entries" ON public.ledger_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage ledger_entries" ON public.ledger_entries FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read daily_closings" ON public.daily_closings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage daily_closings" ON public.daily_closings FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read sequences" ON public.sequences FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can update sequences" ON public.sequences FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Users can read their roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- =============================================
-- 20. TRIGGERS FOR AUTO-UPDATING TIMESTAMPS
-- =============================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON public.accounts
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_sales_updated_at BEFORE UPDATE ON public.sales
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_returns_updated_at BEFORE UPDATE ON public.returns
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- =============================================
-- 21. FUNCTION TO UPDATE STOCK ON SALE
-- =============================================
CREATE OR REPLACE FUNCTION public.update_stock_on_sale()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.products
    SET current_stock_meters = current_stock_meters - NEW.quantity_meters
    WHERE id = NEW.product_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_stock_on_sale
    AFTER INSERT ON public.sale_items
    FOR EACH ROW EXECUTE FUNCTION public.update_stock_on_sale();

-- =============================================
-- 22. FUNCTION TO UPDATE STOCK ON RECEIVING
-- =============================================
CREATE OR REPLACE FUNCTION public.update_stock_on_receive()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.products
    SET current_stock_meters = current_stock_meters + NEW.total_meters
    WHERE id = NEW.product_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_stock_on_receive
    AFTER INSERT ON public.stock_receipt_items
    FOR EACH ROW EXECUTE FUNCTION public.update_stock_on_receive();

-- =============================================
-- SCHEMA COMPLETE!
-- =============================================
