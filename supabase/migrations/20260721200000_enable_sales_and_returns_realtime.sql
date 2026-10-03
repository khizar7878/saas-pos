-- Enable Supabase Realtime publication and FULL REPLICA IDENTITY for sales and returns tables

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'sales'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sales;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'returns'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.returns;
  END IF;
END $$;

-- Enable REPLICA IDENTITY FULL so all row changes (including UPDATE/DELETE) send complete payload data
ALTER TABLE public.sales REPLICA IDENTITY FULL;
ALTER TABLE public.returns REPLICA IDENTITY FULL;
