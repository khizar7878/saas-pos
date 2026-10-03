-- Add a new column to store custom role names (e.g., 'Head Cashier', 'Floor Manager')
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS custom_role_name TEXT;
