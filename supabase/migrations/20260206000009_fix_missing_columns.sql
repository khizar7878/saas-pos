-- Fix missing columns in tables

-- Add missing columns to held_carts
ALTER TABLE public.held_carts 
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- Add missing columns to trusted_devices
ALTER TABLE public.trusted_devices 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- Update existing held_carts to set created_by to user_id if null
UPDATE public.held_carts 
SET created_by = user_id 
WHERE created_by IS NULL;
