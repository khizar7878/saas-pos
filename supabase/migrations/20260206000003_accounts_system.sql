-- Accounts System for Treasury Management

-- Accounts Table (Lightweight)
CREATE TABLE IF NOT EXISTS public.accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    account_type TEXT NOT NULL, -- 'cash', 'bank'
    current_balance DECIMAL(12,2) DEFAULT 0,
    is_system BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Account Transactions Table
CREATE TABLE IF NOT EXISTS public.account_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_account_id UUID REFERENCES public.accounts(id),
    to_account_id UUID REFERENCES public.accounts(id),
    amount DECIMAL(12,2) NOT NULL,
    transaction_type TEXT NOT NULL, -- 'sale', 'transfer', 'expense', 'adjustment'
    reference_id UUID, -- sale_id, expense_id, etc.
    notes TEXT,
    created_by UUID REFERENCES auth.users(id),
    store_id UUID REFERENCES public.stores(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_accounts_type ON public.accounts(account_type);
CREATE INDEX IF NOT EXISTS idx_account_transactions_from ON public.account_transactions(from_account_id);
CREATE INDEX IF NOT EXISTS idx_account_transactions_to ON public.account_transactions(to_account_id);
CREATE INDEX IF NOT EXISTS idx_account_transactions_type ON public.account_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_account_transactions_created_at ON public.account_transactions(created_at DESC);

-- Enable RLS
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for accounts
CREATE POLICY "Users can view accounts" ON public.accounts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers can manage accounts" ON public.accounts FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
);

-- RLS Policies for account_transactions
CREATE POLICY "Users can view account transactions" ON public.account_transactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create account transactions" ON public.account_transactions FOR INSERT TO authenticated WITH CHECK (true);

-- Add updated_at trigger
CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON public.accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert system accounts
INSERT INTO public.accounts (name, account_type, current_balance, is_system, is_active)
VALUES 
    ('Cash in Hand', 'cash', 0, true, true),
    ('Cash in Drawer', 'cash', 0, true, true)
ON CONFLICT (name) DO NOTHING;

-- Function to update account balances
CREATE OR REPLACE FUNCTION update_account_balance()
RETURNS TRIGGER AS $$
BEGIN
    -- Deduct from source account
    IF NEW.from_account_id IS NOT NULL THEN
        UPDATE public.accounts 
        SET current_balance = current_balance - NEW.amount
        WHERE id = NEW.from_account_id;
    END IF;
    
    -- Add to destination account
    IF NEW.to_account_id IS NOT NULL THEN
        UPDATE public.accounts 
        SET current_balance = current_balance + NEW.amount
        WHERE id = NEW.to_account_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update balances
CREATE TRIGGER update_balances_on_transaction
    AFTER INSERT ON public.account_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_account_balance();
