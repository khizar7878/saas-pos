-- Add column to store FBR return invoice numbers for returns
ALTER TABLE public.returns ADD COLUMN IF NOT EXISTS fbr_invoice_number TEXT;
