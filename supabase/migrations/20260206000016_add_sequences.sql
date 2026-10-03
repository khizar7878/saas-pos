-- Create sequences table
CREATE TABLE IF NOT EXISTS public.sequences (
    id TEXT PRIMARY KEY,
    current_value BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Insert default sequences if they don't exist
INSERT INTO public.sequences (id, current_value) 
VALUES 
    ('sale', 0),
    ('stock_receipt', 0),
    ('return', 0)
ON CONFLICT (id) DO NOTHING;

-- Create function to get next sequence
CREATE OR REPLACE FUNCTION public.get_next_sequence(seq_id TEXT)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    next_val BIGINT;
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

    RETURN next_val;
END;
$$;

-- Grant permissions (safe for public/authenticated usage)
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON TABLE public.sequences TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_next_sequence(TEXT) TO anon, authenticated;
