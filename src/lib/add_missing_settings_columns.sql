
-- Add all potentially missing columns to store_settings table
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS alt_phone TEXT;
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS header_text TEXT;
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS footer_text TEXT;
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS exchange_policy TEXT DEFAULT '';
