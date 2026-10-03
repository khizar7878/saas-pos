-- Sales and Returns Tables

-- Sales Table
CREATE TABLE IF NOT EXISTS public.sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_number TEXT UNIQUE NOT NULL,
    fbr_invoice_number TEXT UNIQUE,
    sale_type sale_type NOT NULL DEFAULT 'counter',
    customer_id UUID REFERENCES public.customers(id),
    customer_name TEXT NOT NULL,
    customer_phone TEXT,
    subtotal DECIMAL(12,2) NOT NULL,
    discount DECIMAL(12,2) DEFAULT 0,
    total_amount DECIMAL(12,2) NOT NULL,
    payment_method payment_method NOT NULL,
    payment_details JSONB,
    created_by UUID REFERENCES auth.users(id),
    store_id UUID REFERENCES public.stores(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sale Items Table
CREATE TABLE IF NOT EXISTS public.sale_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID REFERENCES public.sales(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id),
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(12,2) NOT NULL,
    total_price DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Returns Table
CREATE TABLE IF NOT EXISTS public.returns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    return_number TEXT UNIQUE NOT NULL,
    fbr_return_number TEXT UNIQUE,
    original_sale_id UUID REFERENCES public.sales(id),
    customer_name TEXT NOT NULL,
    customer_phone TEXT,
    total_amount DECIMAL(12,2) NOT NULL,
    refund_method refund_method NOT NULL,
    reason TEXT,
    created_by UUID REFERENCES auth.users(id),
    store_id UUID REFERENCES public.stores(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Return Items Table
CREATE TABLE IF NOT EXISTS public.return_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    return_id UUID REFERENCES public.returns(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id),
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(12,2) NOT NULL,
    total_price DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Expenses Table
CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expense_number TEXT UNIQUE NOT NULL,
    description TEXT NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    payment_method payment_method NOT NULL,
    created_by UUID REFERENCES auth.users(id),
    store_id UUID REFERENCES public.stores(id),
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inventory Adjustments Table
CREATE TABLE IF NOT EXISTS public.inventory_adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES public.products(id),
    adjustment_type adjustment_type NOT NULL,
    quantity INTEGER NOT NULL,
    reason TEXT,
    created_by UUID REFERENCES auth.users(id),
    store_id UUID REFERENCES public.stores(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Day Closings Table
CREATE TABLE IF NOT EXISTS public.day_closings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    closing_date DATE NOT NULL,
    store_id UUID REFERENCES public.stores(id),
    closed_by UUID REFERENCES auth.users(id),
    
    system_cash DECIMAL(12,2) NOT NULL,
    physical_cash DECIMAL(12,2) NOT NULL,
    cash_variance DECIMAL(12,2) NOT NULL,
    cash_denominations JSONB NOT NULL,
    variance_notes TEXT,
    
    total_sales DECIMAL(12,2) NOT NULL,
    total_returns DECIMAL(12,2) NOT NULL,
    total_expenses DECIMAL(12,2) NOT NULL,
    net_cash_flow DECIMAL(12,2) NOT NULL,
    
    closed_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(closing_date, store_id)
);

-- FBR Integration Log Table
CREATE TABLE IF NOT EXISTS public.fbr_integration_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_type TEXT NOT NULL,
    transaction_id UUID NOT NULL,
    internal_number TEXT NOT NULL,
    fbr_number TEXT,
    status fbr_status NOT NULL DEFAULT 'pending',
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_sales_sale_number ON public.sales(sale_number);
CREATE INDEX IF NOT EXISTS idx_sales_fbr_number ON public.sales(fbr_invoice_number);
CREATE INDEX IF NOT EXISTS idx_sales_customer ON public.sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON public.sales(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON public.sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_returns_return_number ON public.returns(return_number);
CREATE INDEX IF NOT EXISTS idx_returns_original_sale ON public.returns(original_sale_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_day_closings_date ON public.day_closings(closing_date DESC);

-- Enable RLS
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.return_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.day_closings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fbr_integration_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view sales" ON public.sales FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create sales" ON public.sales FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users can view sale items" ON public.sale_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create sale items" ON public.sale_items FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users can view returns" ON public.returns FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create returns" ON public.returns FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users can view return items" ON public.return_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create return items" ON public.return_items FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users can view expenses" ON public.expenses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create expenses" ON public.expenses FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users can view inventory adjustments" ON public.inventory_adjustments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers can create inventory adjustments" ON public.inventory_adjustments FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
);

CREATE POLICY "Users can view day closings" ON public.day_closings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers can create day closings" ON public.day_closings FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
);

CREATE POLICY "Users can view FBR logs" ON public.fbr_integration_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "System can manage FBR logs" ON public.fbr_integration_log FOR ALL TO authenticated USING (true);
