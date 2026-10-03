-- Fix held_carts schema and remove trusted_devices
-- Run this in Supabase SQL Editor

-- 1. Drop trusted_devices table as it is not needed
DROP TABLE IF EXISTS public.trusted_devices CASCADE;

-- 2. Fix held_carts columns to match application code
ALTER TABLE public.held_carts 
RENAME COLUMN items TO cart_data;

ALTER TABLE public.held_carts 
RENAME COLUMN total TO total_amount;

ALTER TABLE public.held_carts 
ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id);

ALTER TABLE public.held_carts 
ADD COLUMN IF NOT EXISTS page_type TEXT DEFAULT 'sales';

-- 3. Create index for performance
CREATE INDEX IF NOT EXISTS idx_held_carts_assigned_to ON public.held_carts(assigned_to);
CREATE INDEX IF NOT EXISTS idx_held_carts_page_type ON public.held_carts(page_type);

-- 4. Update existing rows if any
UPDATE public.held_carts SET page_type = 'sales' WHERE page_type IS NULL;
