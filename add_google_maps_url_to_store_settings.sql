-- SQL Query to add google_maps_url column to store_settings table in Supabase

ALTER TABLE public.store_settings 
ADD COLUMN IF NOT EXISTS google_maps_url TEXT DEFAULT '';

ALTER TABLE public.store_settings 
ADD COLUMN IF NOT EXISTS map_location_url TEXT DEFAULT '';
