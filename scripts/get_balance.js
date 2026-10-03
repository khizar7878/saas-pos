
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL; // Or SUPABASE_URL if server-side
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY; // Or SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials in .env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function getBalance() {
    const { data, error } = await supabase
        .from('accounts')
        .select('name, current_balance, akws_account_id')
        .eq('name', 'ABL Tehzeeb')
        .single();

    if (error) {
        console.error("Error fetching account:", error);
    } else {
        console.log("Account Details:", data);
    }
}

getBalance();

