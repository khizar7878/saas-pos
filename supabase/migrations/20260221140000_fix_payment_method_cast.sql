-- Fix for the payment_method cast issue in process_credit_sale_completion and v_sale_data record assignment

CREATE OR REPLACE FUNCTION process_credit_sale_completion(
  p_credit_sale_id UUID,
  p_payment_method TEXT,
  p_amount_received NUMERIC,
  p_change_amount NUMERIC
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_credit_sale RECORD;
  v_sale_number TEXT;
  v_sale_id UUID;
  v_deposit_account_id UUID;
  v_cash_account_id UUID;
  v_current_balance NUMERIC;
  v_new_balance NUMERIC;
  v_items JSONB;
  v_item RECORD;
BEGIN
  -- 1. Fetch Credit Sale
  SELECT * INTO v_credit_sale
  FROM credit_sales
  WHERE id = p_credit_sale_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Credit sale not found';
  END IF;

  IF v_credit_sale.status = 'completed' THEN
    RAISE EXCEPTION 'Bill already paid';
  END IF;

  -- 2. Get Next Sale Sequence
  v_sale_number := get_next_sequence('sale');

  -- 3. Determine Deposit Account (Cash in Hand)
  v_deposit_account_id := NULL;
  IF p_payment_method = 'cash' THEN
    SELECT id INTO v_cash_account_id
    FROM accounts
    WHERE account_subtype = 'cash_in_hand' AND is_active = true
    LIMIT 1;
    
    IF v_cash_account_id IS NOT NULL THEN
      v_deposit_account_id := v_cash_account_id;
    END IF;
  END IF;

  -- 4. Insert Sale Record
  INSERT INTO sales (
    sale_number,
    customer_id,
    customer_name,
    subtotal,
    discount_amount,
    total_amount,
    payment_method,
    amount_received,
    change_amount,
    deposit_account_id,
    status,
    created_at,
    sale_type 
  ) VALUES (
    v_sale_number,
    v_credit_sale.customer_id,
    v_credit_sale.customer_name,
    v_credit_sale.total_amount, 
    0,
    v_credit_sale.total_amount,
    p_payment_method::payment_method,
    p_amount_received,
    p_change_amount,
    v_deposit_account_id,
    'completed',
    NOW(),
    'counter' 
  )
  RETURNING id INTO v_sale_id;

  -- 5. Insert Sale Items
  FOR v_item IN SELECT * FROM jsonb_to_recordset(v_credit_sale.items) AS x(
    product_id UUID,
    product_name TEXT,
    quantity NUMERIC,
    unit_price NUMERIC,
    total_price NUMERIC,
    tax_percentage NUMERIC,
    tax_amount NUMERIC
  )
  LOOP
    INSERT INTO sale_items (
      sale_id,
      product_id,
      product_name,
      quantity,
      unit_price,
      total_price,
      tax_percent,
      tax_amount
    ) VALUES (
      v_sale_id,
      v_item.product_id,
      v_item.product_name,
      v_item.quantity,
      v_item.unit_price,
      v_item.total_price,
      COALESCE(v_item.tax_percentage, 0),
      COALESCE(v_item.tax_amount, 0)
    );
  END LOOP;

  -- 6. Update Financials (Accounts & Ledger)
  IF v_deposit_account_id IS NOT NULL THEN
    -- Lock account for update
    SELECT current_balance INTO v_current_balance
    FROM accounts
    WHERE id = v_deposit_account_id
    FOR UPDATE;

    v_new_balance := v_current_balance + v_credit_sale.total_amount;

    UPDATE accounts
    SET current_balance = v_new_balance
    WHERE id = v_deposit_account_id;

    INSERT INTO ledger_entries (
      account_id,
      reference_type,
      reference_id,
      description,
      debit,
      credit,
      balance,
      created_at
    ) VALUES (
      v_deposit_account_id,
      'sale',
      v_sale_id,
      'Payment for Credit Bill #' || v_credit_sale.bill_number,
      v_credit_sale.total_amount,
      0,
      v_new_balance,
      NOW()
    );
  END IF;

  -- 7. Update Credit Sale Status
  UPDATE credit_sales
  SET status = 'completed', sale_id = v_sale_id
  WHERE id = p_credit_sale_id;

  -- Return the new Sale ID and Number for frontend processing (like FBR)
  RETURN jsonb_build_object(
    'sale_id', v_sale_id,
    'sale_number', v_sale_number,
    'customer_name', v_credit_sale.customer_name,
    'total_amount', v_credit_sale.total_amount,
    'bill_number', v_credit_sale.bill_number,
    'items', v_credit_sale.items 
  );

EXCEPTION WHEN OTHERS THEN
  RAISE;
END;
$$;
