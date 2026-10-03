-- Rename columns in sale_items to match new Piece/Suit model
ALTER TABLE sale_items 
RENAME COLUMN quantity_meters TO quantity;

ALTER TABLE sale_items 
RENAME COLUMN price_per_meter TO unit_price;

-- Rename columns in return_items
ALTER TABLE return_items 
RENAME COLUMN quantity_meters TO quantity;

ALTER TABLE return_items 
RENAME COLUMN price_per_meter TO price_per_unit;

-- Optional: Update comments or metadata if needed
COMMENT ON COLUMN sale_items.quantity IS 'Quantity in Pieces/Suits';
COMMENT ON COLUMN return_items.quantity IS 'Quantity in Pieces/Suits';
