-- Add FBR fields to sales table
ALTER TABLE public.sales 
ADD COLUMN IF NOT EXISTS fbr_invoice_number TEXT,
ADD COLUMN IF NOT EXISTS fbr_qr_code TEXT;

-- Add FBR configuration to store_settings
-- We set defaults matching the user's existing setup so they don't need to configure it manually
ALTER TABLE public.store_settings
ADD COLUMN IF NOT EXISTS fbr_integration_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS fbr_pos_id TEXT DEFAULT '189142',
ADD COLUMN IF NOT EXISTS fbr_api_url TEXT DEFAULT 'http://localhost:5261/api/fbr/submit-invoice';

-- Add index for FBR invoice lookups
CREATE INDEX IF NOT EXISTS idx_sales_fbr_invoice_number ON public.sales(fbr_invoice_number);
