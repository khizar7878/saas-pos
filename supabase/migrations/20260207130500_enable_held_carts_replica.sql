-- Enable REPLICA IDENTITY FULL for held_carts to ensure realtime updates work correctly
ALTER TABLE public.held_carts REPLICA IDENTITY FULL;
