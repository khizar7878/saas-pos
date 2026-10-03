DO $$
DECLARE
    target_sale_ids UUID[];
    target_account_ids UUID[];
BEGIN
    -- 1. Identify Sales to delete
    SELECT array_agg(id) INTO target_sale_ids 
    FROM sales 
    WHERE sale_number IN ('AK00000071', 'AK00000070');

    -- 2. Identify Accounts to delete
    SELECT array_agg(id) INTO target_account_ids 
    FROM accounts 
    WHERE name IN ('ABL Tehzeeb', 'Debug Account 1770644645046');

    -- 3. Cleanup Sales Data
    IF target_sale_ids IS NOT NULL THEN
        -- Delete sale items
        DELETE FROM sale_items WHERE sale_id = ANY(target_sale_ids);
        
        -- Delete ledger entries linked to these sales
        -- Casting to text to handle both UUID/Text column types for reference_id
        DELETE FROM ledger_entries 
        WHERE reference_id::text = ANY(target_sale_ids::text[]) 
          AND reference_type = 'sale';
          
        -- Delete the sales
        DELETE FROM sales WHERE id = ANY(target_sale_ids);
    END IF;

    -- 4. Cleanup Account Data
    IF target_account_ids IS NOT NULL THEN
        -- Delete ledger entries linked to these accounts
        DELETE FROM ledger_entries WHERE account_id = ANY(target_account_ids);
        
        -- Delete payments involving these accounts (if any)
        DELETE FROM payments 
        WHERE from_account_id = ANY(target_account_ids) 
           OR to_account_id = ANY(target_account_ids);
           
        -- Delete the accounts
        DELETE FROM accounts WHERE id = ANY(target_account_ids);
    END IF;
    
    -- 5. Cleanup Bank Names
    DELETE FROM bank_names WHERE name IN ('ABL Tehzeeb', 'Debug Bank 1770644645046');

END $$;
