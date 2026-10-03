-- Daily Reconciliation & Clean Up Legacy Mechanism Migration
-- Date: 2026-09-26

-- 1. Drop legacy unused tables
DROP TABLE IF EXISTS day_closings CASCADE;
DROP TABLE IF EXISTS expenses CASCADE;

-- 2. Daily Expenses table
CREATE TABLE IF NOT EXISTS public.daily_expenses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    expense_date date NOT NULL DEFAULT CURRENT_DATE,
    category text NOT NULL,
    description text NOT NULL,
    amount numeric(12,2) NOT NULL CHECK (amount > 0),
    payment_method text NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'ibft', 'card')),
    receipt_no text,
    notes text,
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_daily_expenses_date ON public.daily_expenses(expense_date DESC);

ALTER TABLE public.daily_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all authenticated users full access to daily_expenses"
    ON public.daily_expenses FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- 3. Manual IBFT Entries table
CREATE TABLE IF NOT EXISTS public.reconciliation_ibft_entries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_date date NOT NULL DEFAULT CURRENT_DATE,
    description text,
    amount numeric(12,2) NOT NULL CHECK (amount > 0),
    bank_name text,
    reference_no text,
    notes text,
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ibft_entries_date ON public.reconciliation_ibft_entries(entry_date DESC);

ALTER TABLE public.reconciliation_ibft_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all authenticated users full access to reconciliation_ibft_entries"
    ON public.reconciliation_ibft_entries FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- 4. Manual Card Entries table
CREATE TABLE IF NOT EXISTS public.reconciliation_card_entries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_date date NOT NULL DEFAULT CURRENT_DATE,
    terminal_name text,
    description text,
    amount numeric(12,2) NOT NULL CHECK (amount > 0),
    slip_number text,
    notes text,
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_card_entries_date ON public.reconciliation_card_entries(entry_date DESC);

ALTER TABLE public.reconciliation_card_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all authenticated users full access to reconciliation_card_entries"
    ON public.reconciliation_card_entries FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- 5. Daily Reconciliations (Non-binding daily record keeping snapshot)
CREATE TABLE IF NOT EXISTS public.daily_reconciliations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    reconciliation_date date NOT NULL UNIQUE,
    status text NOT NULL DEFAULT 'saved' CHECK (status IN ('saved', 'reviewed')),
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
    denominations jsonb DEFAULT '{}'::jsonb,
    move_to_reserve numeric(12,2) DEFAULT 0,
    closing_balance numeric(12,2) DEFAULT 0,
    cash_in_reserve numeric(12,2) DEFAULT 0,
    closing_notes text,
    closed_by uuid REFERENCES auth.users(id),
    closed_at timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_daily_reconciliations_date ON public.daily_reconciliations(reconciliation_date DESC);

ALTER TABLE public.daily_reconciliations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all authenticated users full access to daily_reconciliations"
    ON public.daily_reconciliations FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
