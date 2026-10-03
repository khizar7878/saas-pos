-- Fix Tax Rate for Invoice AK00000131
-- Sets Tax Percentage to 18% and recalculates Tax Amount (Inclusive Logic)

UPDATE sale_items
SET
    tax_percentage = 18,
    -- Formula for Inclusive Tax: Price - (Price / (1 + Rate))
    -- 18% inclusive tax_amount = unit_price - (unit_price / 1.18)
    tax_amount = unit_price - (unit_price / 1.18)
FROM sales
WHERE sale_items.sale_id = sales.id
  AND sales.sale_number = 'AK00000131';
