                                                                         pg_get_functiondef                                                                         
--------------------------------------------------------------------------------------------------------------------------------------------------------------------
 CREATE OR REPLACE FUNCTION public.process_credit_sale_completion(p_credit_sale_id uuid, p_payment_method text, p_amount_received numeric, p_change_amount numeric)+
  RETURNS jsonb                                                                                                                                                    +
  LANGUAGE plpgsql                                                                                                                                                 +
 AS $function$                                                                                                                                                     +
 DECLARE                                                                                                                                                           +
   v_credit_sale RECORD;                                                                                                                                           +
   v_sale_number TEXT;                                                                                                                                             +
   v_sale_id UUID;                                                                                                                                                 +
   v_deposit_account_id UUID;                                                                                                                                      +
   v_cash_account_id UUID;                                                                                                                                         +
   v_current_balance NUMERIC;                                                                                                                                      +
   v_new_balance NUMERIC;                                                                                                                                          +
   v_customer_balance NUMERIC;                                                                                                                                     +
   v_new_customer_balance NUMERIC;                                                                                                                                 +
   v_item RECORD;                                                                                                                                                  +
   v_returned_qty NUMERIC;                                                                                                                                         +
   v_net_quantity NUMERIC;                                                                                                                                         +
   v_line_total NUMERIC;                                                                                                                                           +
   v_line_tax NUMERIC;                                                                                                                                             +
   v_sanitized_items JSONB := '[]'::jsonb;                                                                                                                         +
 BEGIN                                                                                                                                                             +
   -- 1. Fetch Credit Sale                                                                                                                                         +
   SELECT * INTO v_credit_sale                                                                                                                                     +
   FROM credit_sales                                                                                                                                               +
   WHERE id = p_credit_sale_id;                                                                                                                                    +
                                                                                                                                                                   +
   IF NOT FOUND THEN                                                                                                                                               +
     RAISE EXCEPTION 'Credit sale not found';                                                                                                                      +
   END IF;                                                                                                                                                         +
                                                                                                                                                                   +
   IF v_credit_sale.status = 'completed' THEN                                                                                                                      +
     RAISE EXCEPTION 'Bill already paid';                                                                                                                          +
   END IF;                                                                                                                                                         +
                                                                                                                                                                   +
   -- 2. Get Next Sale Sequence                                                                                                                                    +
   v_sale_number := get_next_sequence('sale');                                                                                                                     +
                                                                                                                                                                   +
   -- 3. Determine Deposit Account (Cash in Hand)                                                                                                                  +
   v_deposit_account_id := NULL;                                                                                                                                   +
   IF p_payment_method = 'cash' THEN                                                                                                                               +
     SELECT id INTO v_cash_account_id                                                                                                                              +
     FROM accounts                                                                                                                                                 +
     WHERE account_subtype = 'cash_in_hand' AND is_active = true                                                                                                   +
     LIMIT 1;                                                                                                                                                      +
                                                                                                                                                                   +
     IF v_cash_account_id IS NOT NULL THEN                                                                                                                         +
       v_deposit_account_id := v_cash_account_id;                                                                                                                  +
     END IF;                                                                                                                                                       +
   END IF;                                                                                                                                                         +
                                                                                                                                                                   +
   -- 4. Insert Sale Record                                                                                                                                        +
   INSERT INTO sales (                                                                                                                                             +
     sale_number,                                                                                                                                                  +
     customer_id,                                                                                                                                                  +
     customer_name,                                                                                                                                                +
     subtotal,                                                                                                                                                     +
     discount_amount,                                                                                                                                              +
     total_amount,                                                                                                                                                 +
     payment_method,                                                                                                                                               +
     amount_received,                                                                                                                                              +
     change_amount,                                                                                                                                                +
     deposit_account_id,                                                                                                                                           +
     status,                                                                                                                                                       +
     created_at,                                                                                                                                                   +
     sale_type                                                                                                                                                     +
   ) VALUES (                                                                                                                                                      +
     v_sale_number,                                                                                                                                                +
     v_credit_sale.customer_id,                                                                                                                                    +
     v_credit_sale.customer_name,                                                                                                                                  +
     v_credit_sale.total_amount,                                                                                                                                   +
     0,                                                                                                                                                            +
     v_credit_sale.total_amount,                                                                                                                                   +
     p_payment_method::payment_method,                                                                                                                             +
     p_amount_received,                                                                                                                                            +
     p_change_amount,                                                                                                                                              +
     v_deposit_account_id,                                                                                                                                         +
     'completed',                                                                                                                                                  +
     NOW(),                                                                                                                                                        +
     'counter'                                                                                                                                                     +
   )                                                                                                                                                               +
   RETURNING id INTO v_sale_id;                                                                                                                                    +
                                                                                                                                                                   +
   -- 5. Insert Sale Items (Factoring in returns)                                                                                                                  +
   FOR v_item IN SELECT * FROM jsonb_to_recordset(v_credit_sale.items) AS x(                                                                                       +
     product_id UUID,                                                                                                                                              +
     product_name TEXT,                                                                                                                                            +
     quantity NUMERIC,                                                                                                                                             +
     unit_price NUMERIC,                                                                                                                                           +
     total_price NUMERIC,                                                                                                                                          +
     tax_percentage NUMERIC,                                                                                                                                       +
     tax_amount NUMERIC,                                                                                                                                           +
     pct_code TEXT,                                                                                                                                                +
     discount NUMERIC,                                                                                                                                             +
     quantity_returned NUMERIC,                                                                                                                                    +
     returned NUMERIC                                                                                                                                              +
   )                                                                                                                                                               +
   LOOP                                                                                                                                                            +
     v_returned_qty := COALESCE(v_item.quantity_returned, v_item.returned, 0);                                                                                     +
     v_net_quantity := GREATEST(0, v_item.quantity - v_returned_qty);                                                                                              +
                                                                                                                                                                   +
     IF v_net_quantity > 0 THEN                                                                                                                                    +
       v_line_total := v_net_quantity * v_item.unit_price;                                                                                                         +
                                                                                                                                                                   +
       IF COALESCE(v_item.tax_percentage, 0) > 0 THEN                                                                                                              +
         v_line_tax := v_line_total - (v_line_total / (1 + (v_item.tax_percentage / 100.0)));                                                                      +
       ELSE                                                                                                                                                        +
         v_line_tax := 0;                                                                                                                                          +
       END IF;                                                                                                                                                     +
                                                                                                                                                                   +
       INSERT INTO sale_items (                                                                                                                                    +
         sale_id,                                                                                                                                                  +
         product_id,                                                                                                                                               +
         product_name,                                                                                                                                             +
         quantity,                                                                                                                                                 +
         unit_price,                                                                                                                                               +
         total_price,                                                                                                                                              +
         tax_percent,                                                                                                                                              +
         tax_amount,                                                                                                                                               +
         tax_percentage,                                                                                                                                           +
         discount,                                                                                                                                                 +
         pct_code,                                                                                                                                                 +
         quantity_returned                                                                                                                                         +
       ) VALUES (                                                                                                                                                  +
         v_sale_id,                                                                                                                                                +
         v_item.product_id,                                                                                                                                        +
         v_item.product_name,                                                                                                                                      +
         v_net_quantity::integer,                                                                                                                                  +
         v_item.unit_price,                                                                                                                                        +
         v_line_total,                                                                                                                                             +
         COALESCE(v_item.tax_percentage, 0),                                                                                                                       +
         ROUND(v_line_tax, 2),                                                                                                                                     +
         COALESCE(v_item.tax_percentage, 0),                                                                                                                       +
         COALESCE(v_item.discount, 0),                                                                                                                             +
         COALESCE(v_item.pct_code, '01011000'),                                                                                                                    +
         0                                                                                                                                                         +
       );                                                                                                                                                          +
                                                                                                                                                                   +
       v_sanitized_items := v_sanitized_items || jsonb_build_object(                                                                                               +
         'product_id', v_item.product_id,                                                                                                                          +
         'product_name', v_item.product_name,                                                                                                                      +
         'name', v_item.product_name,                                                                                                                              +
         'quantity', v_net_quantity,                                                                                                                               +
         'unit_price', v_item.unit_price,                                                                                                                          +
         'total_price', v_line_total,                                                                                                                              +
         'tax_percentage', COALESCE(v_item.tax_percentage, 0),                                                                                                     +
         'tax_amount', ROUND(v_line_tax, 2),                                                                                                                       +
         'pct_code', COALESCE(v_item.pct_code, '01011000'),                                                                                                        +
         'discount', COALESCE(v_item.discount, 0)                                                                                                                  +
       );                                                                                                                                                          +
     END IF;                                                                                                                                                       +
   END LOOP;                                                                                                                                                       +
                                                                                                                                                                   +
   -- 6. Update Financials (Accounts & Ledger)                                                                                                                     +
   -- A. Deposit Account (Cash in Hand)                                                                                                                            +
   IF v_deposit_account_id IS NOT NULL THEN                                                                                                                        +
     SELECT current_balance INTO v_current_balance                                                                                                                 +
     FROM accounts                                                                                                                                                 +
     WHERE id = v_deposit_account_id;                                                                                                                              +
                                                                                                                                                                   +
     v_new_balance := v_current_balance + v_credit_sale.total_amount;                                                                                              +
                                                                                                                                                                   +
     UPDATE accounts                                                                                                                                               +
     SET current_balance = v_new_balance                                                                                                                           +
     WHERE id = v_deposit_account_id;                                                                                                                              +
                                                                                                                                                                   +
     INSERT INTO ledger_entries (                                                                                                                                  +
       account_id,                                                                                                                                                 +
       reference_type,                                                                                                                                             +
       reference_id,                                                                                                                                               +
       description,                                                                                                                                                +
       debit,                                                                                                                                                      +
       credit,                                                                                                                                                     +
       balance,                                                                                                                                                    +
       created_at                                                                                                                                                  +
     ) VALUES (                                                                                                                                                    +
       v_deposit_account_id,                                                                                                                                       +
       'sale',                                                                                                                                                     +
       v_sale_id,                                                                                                                                                  +
       'Payment for Credit Bill #' || v_credit_sale.bill_number,                                                                                                   +
       v_credit_sale.total_amount,                                                                                                                                 +
       0,                                                                                                                                                          +
       v_new_balance,                                                                                                                                              +
       NOW()                                                                                                                                                       +
     );                                                                                                                                                            +
   END IF;                                                                                                                                                         +
                                                                                                                                                                   +
   -- B. Credit Customer Account (Reduce Receivable)                                                                                                               +
   IF v_credit_sale.customer_id IS NOT NULL THEN                                                                                                                   +
     SELECT current_balance INTO v_customer_balance                                                                                                                +
     FROM accounts                                                                                                                                                 +
     WHERE id = v_credit_sale.customer_id;                                                                                                                         +
                                                                                                                                                                   +
     IF v_customer_balance IS NOT NULL THEN                                                                                                                        +
       v_new_customer_balance := v_customer_balance - v_credit_sale.total_amount;                                                                                  +
                                                                                                                                                                   +
       UPDATE accounts                                                                                                                                             +
       SET current_balance = v_new_customer_balance                                                                                                                +
       WHERE id = v_credit_sale.customer_id;                                                                                                                       +
                                                                                                                                                                   +
       INSERT INTO ledger_entries (                                                                                                                                +
         account_id,                                                                                                                                               +
         reference_type,                                                                                                                                           +
         reference_id,                                                                                                                                             +
         description,                                                                                                                                              +
         debit,                                                                                                                                                    +
         credit,                                                                                                                                                   +
         balance,                                                                                                                                                  +
         created_at                                                                                                                                                +
       ) VALUES (                                                                                                                                                  +
         v_credit_sale.customer_id,                                                                                                                                +
         'payment',                                                                                                                                                +
         v_sale_id,                                                                                                                                                +
         'Payment for Credit Bill #' || v_credit_sale.bill_number,                                                                                                 +
         0,                                                                                                                                                        +
         v_credit_sale.total_amount,                                                                                                                               +
         v_new_customer_balance,                                                                                                                                   +
         NOW()                                                                                                                                                     +
       );                                                                                                                                                          +
     END IF;                                                                                                                                                       +
                                                                                                                                                                   +
     -- Record in payments table so it permanently appears in customer payment history                                                                             +
     INSERT INTO payments (                                                                                                                                        +
       payment_number,                                                                                                                                             +
       from_account_id,                                                                                                                                            +
       to_account_id,                                                                                                                                              +
       amount,                                                                                                                                                     +
       payment_mode,                                                                                                                                               +
       reference_id,                                                                                                                                               +
       notes,                                                                                                                                                      +
       created_by,                                                                                                                                                 +
       created_at                                                                                                                                                  +
     ) VALUES (                                                                                                                                                    +
       'PAY-' || v_sale_number,                                                                                                                                    +
       v_credit_sale.customer_id,                                                                                                                                  +
       v_deposit_account_id,                                                                                                                                       +
       v_credit_sale.total_amount,                                                                                                                                 +
       p_payment_method,                                                                                                                                           +
       v_sale_id,                                                                                                                                                  +
       'Payment for Credit Bill #' || v_credit_sale.bill_number,                                                                                                   +
       auth.uid(),                                                                                                                                                 +
       NOW()                                                                                                                                                       +
     );                                                                                                                                                            +
   END IF;                                                                                                                                                         +
                                                                                                                                                                   +
   -- 7. Update Credit Sale Status                                                                                                                                 +
   UPDATE credit_sales                                                                                                                                             +
   SET status = 'completed', sale_id = v_sale_id                                                                                                                   +
   WHERE id = p_credit_sale_id;                                                                                                                                    +
                                                                                                                                                                   +
   -- Return the new Sale ID, Number, and sanitized items for frontend processing (like FBR)                                                                       +
   RETURN jsonb_build_object(                                                                                                                                      +
     'sale_id', v_sale_id,                                                                                                                                         +
     'sale_number', v_sale_number,                                                                                                                                 +
     'customer_name', v_credit_sale.customer_name,                                                                                                                 +
     'total_amount', v_credit_sale.total_amount,                                                                                                                   +
     'bill_number', v_credit_sale.bill_number,                                                                                                                     +
     'items', v_sanitized_items                                                                                                                                    +
   );                                                                                                                                                              +
                                                                                                                                                                   +
 EXCEPTION WHEN OTHERS THEN                                                                                                                                        +
   RAISE;                                                                                                                                                          +
 END;                                                                                                                                                              +
 $function$                                                                                                                                                        +
 
(1 row)

