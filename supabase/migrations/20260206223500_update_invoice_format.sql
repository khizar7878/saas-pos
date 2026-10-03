-- Update get_next_sequence function to return formatted invoice numbers
-- Format: AK00000001 (AK prefix + 8-digit zero-padded number)

-- Drop the old function first (required to change return type)
DROP FUNCTION IF EXISTS public.get_next_sequence(TEXT);

CREATE OR REPLACE FUNCTION public.get_next_sequence(seq_id TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    next_val BIGINT;
    formatted_number TEXT;
BEGIN
    -- Check if sequence exists
    IF NOT EXISTS (SELECT 1 FROM public.sequences WHERE id = seq_id) THEN
        INSERT INTO public.sequences (id, current_value) VALUES (seq_id, 0);
    END IF;

    -- Increment and get value (atomic update)
    UPDATE public.sequences
    SET current_value = current_value + 1
    WHERE id = seq_id
    RETURNING current_value INTO next_val;

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

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_next_sequence(TEXT) TO anon, authenticated;
