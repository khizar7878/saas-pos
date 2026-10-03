-- 1. Update existing order number
UPDATE public.online_orders
SET order_number = 'AK000001'
WHERE order_number = 'AK-ONLINE-57817';

-- 2. Ensure sequence tracking exists for online_order
INSERT INTO public.sequences (id, current_value)
VALUES ('online_order', 1)
ON CONFLICT (id) DO UPDATE SET current_value = GREATEST(public.sequences.current_value, 1);

-- 3. Update get_next_sequence RPC function to format online_order as AK000001 (AK + 6 digits)
CREATE OR REPLACE FUNCTION public.get_next_sequence(seq_id TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    next_val BIGINT;
    formatted_number TEXT;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.sequences WHERE id = seq_id) THEN
        INSERT INTO public.sequences (id, current_value) VALUES (seq_id, 0)
        ON CONFLICT (id) DO NOTHING;
    END IF;

    UPDATE public.sequences
    SET current_value = current_value + 1
    WHERE id = seq_id
    RETURNING current_value INTO next_val;

    IF next_val IS NULL THEN
        INSERT INTO public.sequences (id, current_value) VALUES (seq_id, 1)
        ON CONFLICT (id) DO UPDATE SET current_value = sequences.current_value + 1
        RETURNING current_value INTO next_val;
    END IF;

    IF seq_id = 'sale' THEN
        formatted_number := 'AK' || LPAD(next_val::TEXT, 8, '0');
    ELSIF seq_id = 'online_order' THEN
        formatted_number := 'AK' || LPAD(next_val::TEXT, 6, '0');
    ELSE
        formatted_number := next_val::TEXT;
    END IF;

    RETURN formatted_number;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_next_sequence(TEXT) TO anon, authenticated;
