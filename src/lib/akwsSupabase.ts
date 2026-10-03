import { createClient } from '@supabase/supabase-js';

// AKWS Credentials
const AKWS_SUPABASE_URL = "https://nmxxgoxbntlpjjwvvxvz.supabase.co";
const AKWS_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5teHhnb3hibnRscGpqd3Z2eHZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwODE2MjIsImV4cCI6MjA4NDY1NzYyMn0.oZuz6onKvLuQGKYY1hUvawcH5omH76CcBy4J-7Z7G_Q";

export const akwsSupabase = createClient(AKWS_SUPABASE_URL, AKWS_SUPABASE_ANON_KEY, {
    auth: {
        persistSession: false, // We don't need auth persistence for this secondary client
        autoRefreshToken: false,
    },
});
