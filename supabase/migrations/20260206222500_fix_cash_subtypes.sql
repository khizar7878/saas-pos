-- Fix account subtypes to ensure Cash sales go to 'Cash in Hand' only
-- Previous migration set both to 'cash_in_hand', which causes ambiguity

-- 1. Set 'Cash in Drawer' to a different subtype
UPDATE public.accounts
SET account_subtype = 'cash_drawer'
WHERE name = 'Cash in Drawer';

-- 2. Ensure 'Cash in Hand' is the only one with 'cash_in_hand' subtype
UPDATE public.accounts
SET account_subtype = 'cash_in_hand'
WHERE name = 'Cash in Hand';
