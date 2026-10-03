-- Add return_type column to returns table
ALTER TABLE returns 
ADD COLUMN return_type text CHECK (return_type IN ('cash', 'credit')) DEFAULT 'cash';

-- Add quantity_returned column to sale_items table
ALTER TABLE sale_items
ADD COLUMN quantity_returned numeric DEFAULT 0;

-- Comment on columns
COMMENT ON COLUMN returns.return_type IS 'Distinguishes between Cash (Paid Invoice) and Credit (Credit Invoice) returns';
COMMENT ON COLUMN sale_items.quantity_returned IS 'Tracks quantity returned for this line item without modifying original quantity';
