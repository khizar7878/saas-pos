-- Add missing tables for retail POS functionality

-- 1. Product categories table
CREATE TABLE IF NOT EXISTS public.product_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Product variations table (for future use, currently simplified)
CREATE TABLE IF NOT EXISTS public.product_variations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sku TEXT UNIQUE,
    barcode TEXT UNIQUE,
    price DECIMAL(12,2) NOT NULL,
    cost_price DECIMAL(12,2),
    stock_quantity INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Held carts table (for saving incomplete sales)
CREATE TABLE IF NOT EXISTS public.held_carts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cart_name TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id),
    customer_id UUID REFERENCES public.customers(id),
    items JSONB NOT NULL DEFAULT '[]',
    subtotal DECIMAL(12,2) DEFAULT 0,
    discount DECIMAL(12,2) DEFAULT 0,
    tax DECIMAL(12,2) DEFAULT 0,
    total DECIMAL(12,2) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Trusted devices table (for device management)
CREATE TABLE IF NOT EXISTS public.trusted_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    device_name TEXT NOT NULL,
    device_fingerprint TEXT NOT NULL UNIQUE,
    last_used_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Forward orders table
CREATE TABLE IF NOT EXISTS public.forward_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number TEXT UNIQUE NOT NULL,
    customer_id UUID REFERENCES public.customers(id),
    customer_name TEXT,
    customer_phone TEXT,
    items JSONB NOT NULL DEFAULT '[]',
    subtotal DECIMAL(12,2) NOT NULL,
    discount DECIMAL(12,2) DEFAULT 0,
    tax DECIMAL(12,2) DEFAULT 0,
    total DECIMAL(12,2) NOT NULL,
    status TEXT DEFAULT 'pending',
    delivery_date DATE,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.held_carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trusted_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forward_orders ENABLE ROW LEVEL SECURITY;

-- RLS Policies for product_categories
CREATE POLICY "All authenticated can view categories"
    ON public.product_categories FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Managers and admins can manage categories"
    ON public.product_categories FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- RLS Policies for product_variations
CREATE POLICY "All authenticated can view variations"
    ON public.product_variations FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Managers and admins can manage variations"
    ON public.product_variations FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- RLS Policies for held_carts
CREATE POLICY "Users can view own held carts"
    ON public.held_carts FOR SELECT
    TO authenticated
    USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "Users can manage own held carts"
    ON public.held_carts FOR ALL
    TO authenticated
    USING (user_id = auth.uid() OR public.is_admin())
    WITH CHECK (user_id = auth.uid() OR public.is_admin());

-- RLS Policies for trusted_devices
CREATE POLICY "Users can view own devices"
    ON public.trusted_devices FOR SELECT
    TO authenticated
    USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "Users can manage own devices"
    ON public.trusted_devices FOR ALL
    TO authenticated
    USING (user_id = auth.uid() OR public.is_admin())
    WITH CHECK (user_id = auth.uid() OR public.is_admin());

-- RLS Policies for forward_orders
CREATE POLICY "All authenticated can view forward orders"
    ON public.forward_orders FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "All authenticated can create forward orders"
    ON public.forward_orders FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Managers and admins can manage forward orders"
    ON public.forward_orders FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_product_variations_product_id ON public.product_variations(product_id);
CREATE INDEX IF NOT EXISTS idx_held_carts_user_id ON public.held_carts(user_id);
CREATE INDEX IF NOT EXISTS idx_trusted_devices_user_id ON public.trusted_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_trusted_devices_fingerprint ON public.trusted_devices(device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_forward_orders_customer_id ON public.forward_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_forward_orders_status ON public.forward_orders(status);

-- Add triggers for updated_at
CREATE TRIGGER update_product_categories_updated_at 
    BEFORE UPDATE ON public.product_categories 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_product_variations_updated_at 
    BEFORE UPDATE ON public.product_variations 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_held_carts_updated_at 
    BEFORE UPDATE ON public.held_carts 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trusted_devices_updated_at 
    BEFORE UPDATE ON public.trusted_devices 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_forward_orders_updated_at 
    BEFORE UPDATE ON public.forward_orders 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
