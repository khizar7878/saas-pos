-- Sequence for Bill Numbers
CREATE SEQUENCE IF NOT EXISTS credit_sale_seq START 1001;

-- Credit Sales Table
CREATE TABLE IF NOT EXISTS public.credit_sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_number TEXT UNIQUE NOT NULL DEFAULT 'CS-' || nextval('credit_sale_seq')::TEXT,
    customer_id UUID REFERENCES public.customers(id),
    customer_name TEXT NOT NULL,
    customer_phone TEXT,
    total_amount DECIMAL(12,2) NOT NULL,
    items JSONB NOT NULL DEFAULT '[]',
    status TEXT CHECK (status IN ('pending', 'completed', 'delivered')) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    store_id UUID REFERENCES public.stores(id),
    
    -- For completed bills, link to the actual sale if needed (optional for future tracking)
    sale_id UUID REFERENCES public.sales(id)
);

-- Enable RLS
ALTER TABLE public.credit_sales ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view credit sales" ON public.credit_sales;
CREATE POLICY "Users can view credit sales" ON public.credit_sales FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can create credit sales" ON public.credit_sales;
CREATE POLICY "Users can create credit sales" ON public.credit_sales FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update credit sales" ON public.credit_sales;
CREATE POLICY "Users can update credit sales" ON public.credit_sales FOR UPDATE TO authenticated USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_credit_sales_customer ON public.credit_sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_credit_sales_status ON public.credit_sales(status);
