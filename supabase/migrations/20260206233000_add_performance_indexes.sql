-- Add indexes for sales table
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON public.sales(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_status ON public.sales(status);
CREATE INDEX IF NOT EXISTS idx_sales_customer_id ON public.sales(customer_id);

-- Add indexes for returns table
CREATE INDEX IF NOT EXISTS idx_returns_created_at ON public.returns(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_returns_original_sale_id ON public.returns(original_sale_id);

-- Add indexes for accounts table
CREATE INDEX IF NOT EXISTS idx_accounts_is_active ON public.accounts(is_active);
CREATE INDEX IF NOT EXISTS idx_accounts_account_subtype ON public.accounts(account_subtype);
