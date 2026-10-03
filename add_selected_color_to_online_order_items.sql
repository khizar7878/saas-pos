-- Migration: Add selected_color column to public.online_order_items table
ALTER TABLE public.online_order_items 
ADD COLUMN IF NOT EXISTS selected_color TEXT;
