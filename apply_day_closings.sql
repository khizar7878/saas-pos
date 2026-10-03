-- Apply both day_closings migrations in one file

-- First: Create table and basic policies
CREATE TABLE IF NOT EXISTS public.day_closings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  closing_date DATE NOT NULL UNIQUE,
  closed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  closed_by UUID REFERENCES auth.users(id),
  
  -- System Balances (from transactions)
  system_cash_in_hand DECIMAL(15,2) NOT NULL,
  system_cash_reserve DECIMAL(15,2) NOT NULL,
  system_bank_balance DECIMAL(15,2),
  
  -- Physical Cash Count (Cash in Hand only)
  physical_cash_total DECIMAL(15,2) NOT NULL,
  cash_denominations JSONB NOT NULL,
  
  -- Variance
  cash_variance DECIMAL(15,2) NOT NULL,
  variance_notes TEXT,
  
  -- Day Summary
  total_sales DECIMAL(15,2) NOT NULL,
  total_payments_received DECIMAL(15,2) NOT NULL,
  total_payments_made DECIMAL(15,2) NOT NULL,
  total_expenses DECIMAL(15,2) NOT NULL,
  total_circulated DECIMAL(15,2) NOT NULL,
  total_internal_transfers DECIMAL(15,2) NOT NULL,
  net_cash_flow DECIMAL(15,2) NOT NULL,
  
  -- Next Day Opening Balances
  next_day_cash_in_hand DECIMAL(15,2) NOT NULL,
  next_day_cash_reserve DECIMAL(15,2) NOT NULL,
  next_day_bank_balance DECIMAL(15,2),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_day_closings_date ON public.day_closings(closing_date DESC);

ALTER TABLE public.day_closings ENABLE ROW LEVEL SECURITY;

-- Drop old policies if they exist
DROP POLICY IF EXISTS "Users can view day closings" ON public.day_closings;
DROP POLICY IF EXISTS "Users can create day closings" ON public.day_closings;
DROP POLICY IF EXISTS "No updates to day closings" ON public.day_closings;
DROP POLICY IF EXISTS "No deletes of day closings" ON public.day_closings;

-- Create secure policies
CREATE POLICY "Users with day summary access can view closings"
  ON public.day_closings FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_route_access(auth.uid(), '/reports/day-summary'));

CREATE POLICY "Users with day summary access can close days"
  ON public.day_closings FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_route_access(auth.uid(), '/reports/day-summary'));

CREATE POLICY "No updates to day closings"
  ON public.day_closings FOR UPDATE
  USING (false);

CREATE POLICY "No deletes of day closings"
  ON public.day_closings FOR DELETE
  USING (false);

-- Create Cash Over/Short account
INSERT INTO public.accounts (name, account_type, account_subtype, is_system, opening_balance, current_balance)
VALUES ('Cash Over/Short', 'expense', 'other_expense', true, 0, 0)
ON CONFLICT (name) DO NOTHING;
