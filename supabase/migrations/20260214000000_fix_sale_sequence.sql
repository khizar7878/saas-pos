-- Fix get_next_sequence to ensure it never returns NULL and handles initialization safely

CREATE TABLE IF NOT EXISTS public.sequences (
    id TEXT PRIMARY KEY,
    current_value BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure sale sequence exists
INSERT INTO public.sequences (id, current_value) 
VALUES ('sale', 0), ('stock_receipt', 0), ('return', 0)
ON CONFLICT (id) DO NOTHING;

-- Re-define get_next_sequence with robust logic
CREATE OR REPLACE FUNCTION public.get_next_sequence(seq_id TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    next_val BIGINT;
    formatted_number TEXT;
BEGIN
    -- Ensure sequence exists (Double check for safety)
    IF NOT EXISTS (SELECT 1 FROM public.sequences WHERE id = seq_id) THEN
        INSERT INTO public.sequences (id, current_value) VALUES (seq_id, 0)
        ON CONFLICT (id) DO NOTHING;
    END IF;

    -- Increment and get value (atomic update)
    UPDATE public.sequences
    SET current_value = current_value + 1
    WHERE id = seq_id
    RETURNING current_value INTO next_val;

    -- Safety check: If update failed (shouldn't happen), try to recover or fail explicitly
    IF next_val IS NULL THEN
        -- Fallback: Insert if missing (redundant but safe) and return 1
        INSERT INTO public.sequences (id, current_value) VALUES (seq_id, 1)
        ON CONFLICT (id) DO UPDATE SET current_value = sequences.current_value + 1
        RETURNING current_value INTO next_val;
    END IF;

    -- Format the number based on sequence type
    IF seq_id = 'sale' THEN
        -- Format: AK00000001
        formatted_number := 'AK' || LPAD(next_val::TEXT, 8, '0');
    ELSE
        -- For other sequences, just return the number as text
        formatted_number := next_val::TEXT;
    END IF;

    RETURN formatted_number;
END;
$$;

-- Grant permissions again to be sure
GRANT EXECUTE ON FUNCTION public.get_next_sequence(TEXT) TO anon, authenticated;
GRANT ALL ON TABLE public.sequences TO anon, authenticated;
