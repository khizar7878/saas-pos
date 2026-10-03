-- Add missing indexes for performance optimization
-- These indexes will significantly speed up common queries

-- Sales table indexes
CREATE INDEX IF NOT EXISTS idx_sales_status ON public.sales(status);
CREATE INDEX IF NOT EXISTS idx_sales_status_created_at ON public.sales(status, created_at DESC);

-- Returns table indexes  
CREATE INDEX IF NOT EXISTS idx_returns_created_at ON public.returns(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_returns_original_sale ON public.returns(original_sale_id);

-- Accounts table indexes
CREATE INDEX IF NOT EXISTS idx_accounts_is_active ON public.accounts(is_active);
CREATE INDEX IF NOT EXISTS idx_accounts_subtype_active ON public.accounts(account_subtype, is_active);
CREATE INDEX IF NOT EXISTS idx_accounts_balance ON public.accounts(current_balance) WHERE current_balance > 0;

-- Sale items for aggregation queries
CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON public.sale_items(product_id);

-- Composite index for common dashboard query pattern
CREATE INDEX IF NOT EXISTS idx_sales_date_status ON public.sales(created_at DESC, status) 
  WHERE status NOT IN ('cancelled', 'returned');
