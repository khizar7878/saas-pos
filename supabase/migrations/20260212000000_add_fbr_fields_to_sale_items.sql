-- Add missing FBR-required columns to sale_items table
ALTER TABLE sale_items
ADD COLUMN IF NOT EXISTS tax_percentage NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS tax_amount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS pct_code TEXT DEFAULT '01011000';

-- Update the process_sale_transaction function to store FBR fields
CREATE OR REPLACE FUNCTION process_sale_transaction(
  sale_data JSONB,
  items_data JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_sale_number TEXT;
  v_sale_id UUID;
  v_customer_id UUID;
  v_total_amount NUMERIC;
  v_payment_method TEXT;
  v_deposit_account_id UUID;
  v_item JSONB;
  v_product_id UUID;
  v_quantity NUMERIC;
  v_new_stock NUMERIC;
  v_cash_account_id UUID;
  v_cheque_account_id UUID;
  v_split JSONB;
  v_split_amount NUMERIC;
  v_split_method TEXT;
  v_split_account_id UUID;
  v_current_balance NUMERIC;
  v_new_balance NUMERIC;
  v_result JSONB;
BEGIN
  -- Extract basic info
  v_customer_id := NULLIF(sale_data->>'customer_id', '')::UUID;
  v_total_amount := (sale_data->>'total_amount')::NUMERIC;
  v_payment_method := sale_data->>'payment_method';

  -- =====================================================================================
  -- 1. HANDLING CREDIT SALE (Pending)
  -- =====================================================================================
  IF v_payment_method = 'credit' THEN
    -- Insert into credit_sales
    INSERT INTO credit_sales (
      customer_id,
      customer_name,
      total_amount,
      items,
      status,
      created_by
    ) VALUES (
      v_customer_id,
      sale_data->>'customer_name',
      v_total_amount,
      items_data, -- Store raw JSON items
      'pending',
      auth.uid()
    ) RETURNING jsonb_build_object('id', id, 'bill_number', bill_number, 'type', 'credit_sale') INTO v_result;

    -- Update Stock
    FOR v_item IN SELECT * FROM jsonb_array_elements(items_data)
    LOOP
      v_product_id := (v_item->>'product_id')::UUID;
      v_quantity := (v_item->>'quantity')::NUMERIC;

      UPDATE products
      SET stock_quantity = GREATEST(0, stock_quantity - v_quantity)
      WHERE id = v_product_id;
    END LOOP;

    RETURN v_result;
  END IF;

  -- =====================================================================================
  -- 2. HANDLING STANDARD SALE
  -- =====================================================================================
  
  -- Generate Sale Number
  SELECT get_next_sequence('sale') INTO v_sale_number;

  -- Resolve Deposit Account ID
  v_deposit_account_id := NULLIF(sale_data->>'deposit_account_id', '')::UUID;

  IF v_payment_method = 'cash' AND v_deposit_account_id IS NULL THEN
    SELECT id INTO v_cash_account_id FROM accounts WHERE account_subtype = 'cash_in_hand' AND is_active = true LIMIT 1;
    v_deposit_account_id := v_cash_account_id;
  END IF;

  IF v_payment_method = 'cheque' AND v_deposit_account_id IS NULL THEN
    SELECT id INTO v_cheque_account_id FROM accounts WHERE account_subtype = 'cheques' AND is_active = true LIMIT 1;
    v_deposit_account_id := v_cheque_account_id;
  END IF;

  -- Insert Sale Record
  INSERT INTO sales (
    sale_number,
    customer_id,
    customer_name,
    subtotal,
    discount_amount,
    discount_percent,
    total_amount,
    payment_method,
    amount_received,
    change_amount,
    deposit_account_id,
    status,
    notes,
    cheque_number,
    cheque_bank,
    cheque_date,
    payment_details
  ) VALUES (
    v_sale_number,
    v_customer_id,
    sale_data->>'customer_name',
    (sale_data->>'subtotal')::NUMERIC,
    (sale_data->>'discount_amount')::NUMERIC,
    COALESCE((sale_data->>'discount_percent')::NUMERIC, 0),
    v_total_amount,
    v_payment_method::payment_method, -- Cast to enum
    (sale_data->>'amount_received')::NUMERIC,
    (sale_data->>'change_amount')::NUMERIC,
    v_deposit_account_id,
    'completed',
    sale_data->>'notes',
    sale_data->>'cheque_number',
    sale_data->>'cheque_bank',
    NULLIF(sale_data->>'cheque_date', '')::DATE,
    CASE 
      WHEN v_payment_method = 'mixed' THEN sale_data->'payment_splits'
      ELSE NULL
    END
  ) RETURNING id INTO v_sale_id;

  -- Insert Sale Items & Update Stock (NOW WITH FBR FIELDS)
  FOR v_item IN SELECT * FROM jsonb_array_elements(items_data)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_quantity := (v_item->>'quantity')::NUMERIC;

    INSERT INTO sale_items (
      sale_id,
      product_id,
      product_name,
      quantity,
      unit_price,
      total_price,
      tax_percentage,
      tax_amount,
      discount,
      pct_code
    ) VALUES (
      v_sale_id,
      v_product_id,
      v_item->>'product_name',
      v_quantity,
      (v_item->>'unit_price')::NUMERIC,
      (v_item->>'total_price')::NUMERIC,
      COALESCE((v_item->>'tax_percentage')::NUMERIC, 0),
      COALESCE((v_item->>'tax_amount')::NUMERIC, 0),
      COALESCE((v_item->>'discount')::NUMERIC, 0),
      COALESCE(v_item->>'pct_code', '01011000')
    );

    UPDATE products
    SET stock_quantity = GREATEST(0, stock_quantity - v_quantity)
    WHERE id = v_product_id;
  END LOOP;

  -- =====================================================================================
  -- 3. FINANCIAL UPDATES (Ledger & Accounts)
  -- =====================================================================================

  -- Case A: MIXED Payment
  IF v_payment_method = 'mixed' THEN
    FOR v_split IN SELECT * FROM jsonb_array_elements(sale_data->'payment_splits')
    LOOP
      v_split_amount := (v_split->>'amount')::NUMERIC;
      v_split_method := v_split->>'method';
      v_split_account_id := NULL;

      -- Determine Account for Split
      IF v_split_method = 'cash' THEN
         SELECT id INTO v_split_account_id FROM accounts WHERE account_subtype = 'cash_in_hand' AND is_active = true LIMIT 1;
      ELSIF v_split_method = 'ibft' THEN
         v_split_account_id := NULLIF(v_split->>'bankAccountId', '')::UUID;
      ELSIF v_split_method = 'cheque' THEN
         SELECT id INTO v_split_account_id FROM accounts WHERE account_subtype = 'cheques' AND is_active = true LIMIT 1;
         
         -- Insert Cheque Record
         IF (v_split->'chequeDetails') IS NOT NULL THEN
            INSERT INTO cheques (
              cheque_number, bank_name, amount, cheque_date, status, received_from_account_id, received_via, source_sale_id, notes
            ) VALUES (
              v_split->'chequeDetails'->>'chequeNumber',
              v_split->'chequeDetails'->>'chequeBank',
              v_split_amount,
              NULLIF(v_split->'chequeDetails'->>'chequeDate', '')::DATE,
              'available',
              v_customer_id,
              'sale',
              v_sale_id,
              'Split Payment from Sale #' || v_sale_number
            );
         END IF;
      ELSIF v_split_method = 'credit' AND v_customer_id IS NOT NULL THEN
         v_split_account_id := v_customer_id;
      END IF;

      -- Update Account & Ledger if valid account found
      IF v_split_account_id IS NOT NULL THEN
        SELECT current_balance INTO v_current_balance FROM accounts WHERE id = v_split_account_id;
        v_new_balance := v_current_balance + v_split_amount;

        UPDATE accounts SET current_balance = v_new_balance WHERE id = v_split_account_id;

        INSERT INTO ledger_entries (
          account_id, reference_type, reference_id, description, debit, credit, balance
        ) VALUES (
          v_split_account_id, 'sale', v_sale_id, 
          UPPER(v_split_method) || ' Split - Sale #' || v_sale_number,
          v_split_amount, 0, v_new_balance
        );
      END IF;

    END LOOP;

  -- Case B: SINGLE Payment (Cash, Card, Cheque, IBFT) - Excludes Credit (handled above)
  ELSE
    IF v_deposit_account_id IS NOT NULL THEN
       SELECT current_balance INTO v_current_balance FROM accounts WHERE id = v_deposit_account_id;
       v_new_balance := v_current_balance + v_total_amount;

       UPDATE accounts SET current_balance = v_new_balance WHERE id = v_deposit_account_id;

       INSERT INTO ledger_entries (
          account_id, reference_type, reference_id, description, debit, credit, balance
       ) VALUES (
          v_deposit_account_id, 'sale', v_sale_id, 
          UPPER(v_payment_method) || ' Sale #' || v_sale_number,
          v_total_amount, 0, v_new_balance
       );
    END IF;

    -- Handle Single Payment Cheque Record
    IF v_payment_method = 'cheque' AND (sale_data->>'cheque_number') IS NOT NULL THEN
       INSERT INTO cheques (
          cheque_number, bank_name, amount, cheque_date, status, received_from_account_id, received_via, source_sale_id, notes
       ) VALUES (
          sale_data->>'cheque_number',
          sale_data->>'cheque_bank',
          v_total_amount,
          NULLIF(sale_data->>'cheque_date', '')::DATE,
          'available',
          v_customer_id,
          'sale',
          v_sale_id,
          'Received from Sale #' || v_sale_number
       );
    END IF;

  END IF;

  -- Return the created sale object
  SELECT jsonb_build_object(
    'id', id,
    'sale_number', sale_number,
    'total_amount', total_amount,
    'created_at', created_at,
    'type', 'sale'
  ) INTO v_result FROM sales WHERE id = v_sale_id;

  RETURN v_result;
END;
$$;
