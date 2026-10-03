-- Run this query on your RETAIL POS database (lhalnbpcaphhszjliavr)
-- to allow the AKWS (Wholesale POS) app to read sales and returns for combined reporting.

-- 1. Policies for sales
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY; -- Just in case

CREATE POLICY "Allow anonymous select on sales"
ON public.sales FOR SELECT
TO anon, authenticated
USING (true);

-- 2. Policies for returns
ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY; -- Just in case

CREATE POLICY "Allow anonymous select on returns"
ON public.returns FOR SELECT
TO anon, authenticated
USING (true);
