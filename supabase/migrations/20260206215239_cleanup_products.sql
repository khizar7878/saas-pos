-- Migration to delete all products and dependent transactional data
-- This is necessary to avoid foreign key constraint violations

-- 1. Delete Return Items (references products)
DELETE FROM public.return_items;

-- 2. Delete Returns (optional, but good for clean slate)
DELETE FROM public.returns;

-- 3. Delete Sale Items (references products)
DELETE FROM public.sale_items;

-- 4. Delete Sales (optional, but good for clean slate)
DELETE FROM public.sales;

-- 5. Delete Inventory Adjustments (references products)
DELETE FROM public.inventory_adjustments;

-- 6. Finally, Delete Products
DELETE FROM public.products;
