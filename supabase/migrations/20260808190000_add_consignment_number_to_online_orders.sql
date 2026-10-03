-- Add consignment_number column to public.online_orders table
ALTER TABLE public.online_orders 
ADD COLUMN IF NOT EXISTS consignment_number TEXT;
