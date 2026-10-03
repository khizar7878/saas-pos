-- Migration: Remove legacy day-closing lock from update_sale_payment_method
-- Date: 2026-09-26
-- Reason: Daily Reconciliation is non-binding audit record-keeping and must not lock or prevent editing sales.
--         Also drops the obsolete table dependency on dropped 'day_closings'.

-- 1. Drop obsolete 4-parameter overload if it exists
DROP FUNCTION IF EXISTS public.update_sale_payment_method(uuid, text, uuid, uuid);

-- 2. Update 6-parameter function removing day_closings check
CREATE OR REPLACE FUNCTION public.update_sale_payment_method(
  p_sale_id UUID,
  p_new_method TEXT,
  p_amount_received NUMERIC,
  p_new_account_id UUID DEFAULT NULL, -- For IBFT/Card
  p_payment_splits JSONB DEFAULT NULL, -- For Mixed
  p_updated_by UUID DEFAULT auth.uid()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sale RECORD;
  v_old_account_id UUID;
  v_new_account_id UUID;
  v_amount NUMERIC;
  v_current_balance NUMERIC;
  v_new_balance NUMERIC;
  v_cash_account_id UUID;
  
  -- Reversal Variables
  v_old_amount_received NUMERIC;
  v_old_change_amount NUMERIC;
  v_old_deposit_account_id UUID;

  -- New Transaction Variables
  v_new_change_amount NUMERIC;
  
  -- Mixed Payment Loop
  v_split JSONB;
  v_split_amount NUMERIC;
  v_split_method TEXT;
  v_split_account_id UUID;
  
BEGIN
  -- 1. Get Sale Details
  SELECT * INTO v_sale FROM sales WHERE id = p_sale_id;
  
  IF v_sale IS NULL THEN
    RAISE EXCEPTION 'Sale not found';
  END IF;

  v_amount := v_sale.total_amount; -- Total Bill Amount (Fixed)

  -- 2. REVERSE OLD TRANSACTION
  -- =========================================================
  v_old_amount_received := v_sale.amount_received;
  v_old_change_amount := v_sale.change_amount;
  v_old_deposit_account_id := v_sale.deposit_account_id;

  -- Get Cash Account ID for reference
  SELECT id INTO v_cash_account_id FROM accounts WHERE account_subtype = 'cash_in_hand' LIMIT 1;

  IF v_sale.payment_method = 'mixed' THEN
      -- Reverse Mixed Splits
      FOR v_split IN SELECT * FROM jsonb_array_elements(v_sale.payment_details)
      LOOP
          v_split_amount := (v_split->>'amount')::NUMERIC;
          v_split_method := v_split->>'method';
          v_split_account_id := NULL;

          IF v_split_method = 'cash' THEN
             v_split_account_id := v_cash_account_id;
          ELSIF v_split_method = 'ibft' THEN
             v_split_account_id := NULLIF(v_split->>'bankAccountId', '')::UUID;
          ELSIF v_split_method = 'cheque' THEN
             SELECT id INTO v_split_account_id FROM accounts WHERE account_subtype = 'cheques' LIMIT 1;
          END IF;

          IF v_split_account_id IS NOT NULL THEN
             SELECT current_balance INTO v_current_balance FROM accounts WHERE id = v_split_account_id;
             v_new_balance := v_current_balance - v_split_amount; -- Reverse Debit (Credit)
             UPDATE accounts SET current_balance = v_new_balance WHERE id = v_split_account_id;
             
             INSERT INTO ledger_entries (account_id, reference_type, reference_id, description, debit, credit, balance)
             VALUES (v_split_account_id, 'correction', p_sale_id, 'Reversal: ' || v_split_method || ' Split', 0, v_split_amount, v_new_balance);
          END IF;
      END LOOP;

  ELSIF v_sale.payment_method = 'ibft' AND v_old_change_amount > 0 AND v_old_deposit_account_id IS NOT NULL THEN
      -- Reverse IBFT Overpayment Logic
      -- 1. Reverse Bank Credit (Asset -)
      SELECT current_balance INTO v_current_balance FROM accounts WHERE id = v_old_deposit_account_id;
      v_new_balance := v_current_balance - v_old_amount_received; 
      UPDATE accounts SET current_balance = v_new_balance WHERE id = v_old_deposit_account_id;

      INSERT INTO ledger_entries (account_id, reference_type, reference_id, description, debit, credit, balance)
      VALUES (v_old_deposit_account_id, 'correction', p_sale_id, 'Reversal: IBFT Received', 0, v_old_amount_received, v_new_balance);

      -- 2. Reverse Cash Debit (Asset +)
      IF v_cash_account_id IS NOT NULL THEN
          SELECT current_balance INTO v_current_balance FROM accounts WHERE id = v_cash_account_id;
          v_new_balance := v_current_balance + v_old_change_amount;
          
          UPDATE accounts SET current_balance = v_new_balance WHERE id = v_cash_account_id;
          
          INSERT INTO ledger_entries (account_id, reference_type, reference_id, description, debit, credit, balance)
          VALUES (v_cash_account_id, 'correction', p_sale_id, 'Reversal: Change Returned', v_old_change_amount, 0, v_new_balance);
      END IF;

  ELSE
      -- Generic Reversal (Cash, Simple IBFT, Card)
      v_old_account_id := v_old_deposit_account_id;
      IF v_sale.payment_method = 'cash' THEN v_old_account_id := v_cash_account_id; END IF;
      
      IF v_old_account_id IS NOT NULL THEN
          SELECT current_balance INTO v_current_balance FROM accounts WHERE id = v_old_account_id;
          v_new_balance := v_current_balance - v_amount; -- Reverse Debit (Credit)
          UPDATE accounts SET current_balance = v_new_balance WHERE id = v_old_account_id;
          
          INSERT INTO ledger_entries (account_id, reference_type, reference_id, description, debit, credit, balance)
          VALUES (v_old_account_id, 'correction', p_sale_id, 'Reversal: ' || v_sale.payment_method || ' Sale', 0, v_amount, v_new_balance);
      END IF;
  END IF;

  -- 3. APPLY NEW TRANSACTION
  -- =========================================================
  v_new_change_amount := GREATEST(0, p_amount_received - v_amount);

  IF p_new_method = 'mixed' THEN
      FOR v_split IN SELECT * FROM jsonb_array_elements(p_payment_splits)
      LOOP
          v_split_amount := (v_split->>'amount')::NUMERIC;
          v_split_method := v_split->>'method';
          v_split_account_id := NULL;

          IF v_split_method = 'cash' THEN
             v_split_account_id := v_cash_account_id;
          ELSIF v_split_method = 'ibft' THEN
             v_split_account_id := NULLIF(v_split->>'bankAccountId', '')::UUID;
          ELSIF v_split_method = 'card' THEN
             NULL; 
          END IF;

          IF v_split_account_id IS NOT NULL THEN
             SELECT current_balance INTO v_current_balance FROM accounts WHERE id = v_split_account_id;
             v_new_balance := v_current_balance + v_split_amount; -- Debit (Asset +)
             UPDATE accounts SET current_balance = v_new_balance WHERE id = v_split_account_id;

             INSERT INTO ledger_entries (account_id, reference_type, reference_id, description, debit, credit, balance)
             VALUES (v_split_account_id, 'sale', p_sale_id, 'Updated: ' || v_split_method || ' Split', v_split_amount, 0, v_new_balance);
          END IF;
      END LOOP;

  ELSIF p_new_method = 'ibft' AND v_new_change_amount > 0 AND p_new_account_id IS NOT NULL THEN
      -- New IBFT Overpayment Logic
      -- 1. Debit Bank Full Amount (Asset +)
      SELECT current_balance INTO v_current_balance FROM accounts WHERE id = p_new_account_id;
      v_new_balance := v_current_balance + p_amount_received;
      UPDATE accounts SET current_balance = v_new_balance WHERE id = p_new_account_id;

      INSERT INTO ledger_entries (account_id, reference_type, reference_id, description, debit, credit, balance)
      VALUES (p_new_account_id, 'sale', p_sale_id, 'Updated: IBFT Received (Incl. Overpayment)', p_amount_received, 0, v_new_balance);

      -- 2. Credit Cash Change Amount (Asset -)
      IF v_cash_account_id IS NOT NULL THEN
          SELECT current_balance INTO v_current_balance FROM accounts WHERE id = v_cash_account_id;
          v_new_balance := v_current_balance - v_new_change_amount;
          UPDATE accounts SET current_balance = v_new_balance WHERE id = v_cash_account_id;

          INSERT INTO ledger_entries (account_id, reference_type, reference_id, description, debit, credit, balance)
          VALUES (v_cash_account_id, 'sale', p_sale_id, 'Updated: Change Returned', 0, v_new_change_amount, v_new_balance);
      END IF;
      
      v_new_account_id := p_new_account_id;

  ELSE
      -- Generic New (Cash, Simple IBFT, Card)
      v_new_account_id := p_new_account_id;
      IF p_new_method = 'cash' THEN v_new_account_id := v_cash_account_id; END IF;
      
      IF v_new_account_id IS NOT NULL THEN
          SELECT current_balance INTO v_current_balance FROM accounts WHERE id = v_new_account_id;
          v_new_balance := v_current_balance + v_amount; -- Debit (Asset +)
          UPDATE accounts SET current_balance = v_new_balance WHERE id = v_new_account_id;
          
          INSERT INTO ledger_entries (account_id, reference_type, reference_id, description, debit, credit, balance)
          VALUES (v_new_account_id, 'sale', p_sale_id, 'Updated: ' || p_new_method || ' Sale', v_amount, 0, v_new_balance);
      END IF;
  END IF;

  -- 4. Update Sale Record
  UPDATE sales SET 
    payment_method = p_new_method::payment_method,
    deposit_account_id = v_new_account_id,
    amount_received = p_amount_received,
    change_amount = v_new_change_amount,
    payment_details = p_payment_splits,
    notes = COALESCE(notes, '') || E'\nPayment method updated to ' || p_new_method
  WHERE id = p_sale_id;

  RETURN jsonb_build_object('success', true);
END;
$$;
