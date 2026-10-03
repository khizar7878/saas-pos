--
-- PostgreSQL database dump
--

\restrict UW7jeopUSbdefwGmoald1OXYd26FfHKso1D83aVjPEGme8eQZ1fva65INusJPIl

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: pg_database_owner
--

CREATE SCHEMA public;


ALTER SCHEMA public OWNER TO pg_database_owner;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: pg_database_owner
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: adjustment_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.adjustment_type AS ENUM (
    'add',
    'remove',
    'correction'
);


ALTER TYPE public.adjustment_type OWNER TO postgres;

--
-- Name: fbr_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.fbr_status AS ENUM (
    'pending',
    'success',
    'failed'
);


ALTER TYPE public.fbr_status OWNER TO postgres;

--
-- Name: payment_method; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.payment_method AS ENUM (
    'cash',
    'card',
    'ibft',
    'mixed',
    'credit'
);


ALTER TYPE public.payment_method OWNER TO postgres;

--
-- Name: refund_method; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.refund_method AS ENUM (
    'cash',
    'card',
    'credit'
);


ALTER TYPE public.refund_method OWNER TO postgres;

--
-- Name: return_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.return_status AS ENUM (
    'pending',
    'approved',
    'rejected',
    'completed'
);


ALTER TYPE public.return_status OWNER TO postgres;

--
-- Name: sale_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.sale_type AS ENUM (
    'counter',
    'delivery'
);


ALTER TYPE public.sale_type OWNER TO postgres;

--
-- Name: user_role; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.user_role AS ENUM (
    'admin',
    'manager',
    'cashier'
);


ALTER TYPE public.user_role OWNER TO postgres;

--
-- Name: get_next_sequence(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_next_sequence(seq_id text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    next_val BIGINT;
    formatted_number TEXT;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.sequences WHERE id = seq_id) THEN
        INSERT INTO public.sequences (id, current_value) VALUES (seq_id, 0)
        ON CONFLICT (id) DO NOTHING;
    END IF;

    UPDATE public.sequences
    SET current_value = current_value + 1
    WHERE id = seq_id
    RETURNING current_value INTO next_val;

    IF next_val IS NULL THEN
        INSERT INTO public.sequences (id, current_value) VALUES (seq_id, 1)
        ON CONFLICT (id) DO UPDATE SET current_value = sequences.current_value + 1
        RETURNING current_value INTO next_val;
    END IF;

    IF seq_id = 'sale' THEN
        formatted_number := 'AK' || LPAD(next_val::TEXT, 8, '0');
    ELSIF seq_id = 'online_order' THEN
        formatted_number := 'AK' || LPAD(next_val::TEXT, 6, '0');
    ELSE
        formatted_number := next_val::TEXT;
    END IF;

    RETURN formatted_number;
END;
$$;


ALTER FUNCTION public.get_next_sequence(seq_id text) OWNER TO postgres;

--
-- Name: get_user_page_type_for_cart(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_user_page_type_for_cart(_user_id uuid) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    has_sales_access BOOLEAN;
    is_user_admin BOOLEAN;
BEGIN
    -- Check if user is admin
    SELECT EXISTS (
        SELECT 1 
        FROM user_profiles 
        WHERE id = _user_id 
        AND role = 'admin'
    ) INTO is_user_admin;
    
    -- Admins have access to sales
    IF is_user_admin THEN
        RETURN 'sales';
    END IF;
    
    -- Check if user has access to /pos/sales route
    SELECT EXISTS (
        SELECT 1 
        FROM user_route_permissions urp
        JOIN app_routes ar ON ar.id = urp.route_id
        WHERE urp.user_id = _user_id 
        AND ar.path = '/pos/sales'
    ) INTO has_sales_access;
    
    -- Return appropriate page type
    IF has_sales_access THEN
        RETURN 'sales';
    ELSE
        RETURN 'forwarding';
    END IF;
END;
$$;


ALTER FUNCTION public.get_user_page_type_for_cart(_user_id uuid) OWNER TO postgres;

--
-- Name: get_user_routes(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_user_routes(_user_id uuid) RETURNS TABLE(path text, name text, parent_name text, icon_name text, sort_order integer)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
    SELECT ar.path, ar.name, ar.parent_name, ar.icon_name, ar.sort_order
    FROM public.app_routes ar
    WHERE EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = _user_id AND up.is_active = true
        AND (
            up.role = 'admin'
            OR EXISTS (
                SELECT 1 FROM public.user_route_permissions urp
                WHERE urp.user_id = _user_id AND urp.route_id = ar.id
            )
        )
    )
    ORDER BY ar.sort_order, ar.name
$$;


ALTER FUNCTION public.get_user_routes(_user_id uuid) OWNER TO postgres;

--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    default_store_id UUID;
BEGIN
    -- Get the first store (or create one if none exists)
    SELECT id INTO default_store_id FROM public.stores LIMIT 1;
    
    -- If no store exists, create a default one
    IF default_store_id IS NULL THEN
        INSERT INTO public.stores (name, address, phone, is_active)
        VALUES ('Main Store', 'Default Address', '0000-0000000', true)
        RETURNING id INTO default_store_id;
    END IF;
    
    -- Create user profile
    INSERT INTO public.user_profiles (id, full_name, role, store_id, is_active)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'admin'::public.user_role),
        default_store_id,
        true
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        store_id = EXCLUDED.store_id;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

--
-- Name: has_role(uuid, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.has_role(_user_id uuid, _role text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = _user_id 
        AND role::text = _role
        AND is_active = true
    )
$$;


ALTER FUNCTION public.has_role(_user_id uuid, _role text) OWNER TO postgres;

--
-- Name: has_route_access(uuid, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.has_route_access(_user_id uuid, _route_path text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
    SELECT EXISTS (
        SELECT 1 
        FROM public.user_profiles up
        WHERE up.id = _user_id 
        AND up.is_active = true
        AND (
            up.role = 'admin'
            OR EXISTS (
                SELECT 1 
                FROM public.user_route_permissions urp
                JOIN public.app_routes ar ON ar.id = urp.route_id
                WHERE urp.user_id = _user_id AND ar.path = _route_path
            )
        )
    )
$$;


ALTER FUNCTION public.has_route_access(_user_id uuid, _route_path text) OWNER TO postgres;

--
-- Name: is_admin(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.is_admin() RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$;


ALTER FUNCTION public.is_admin() OWNER TO postgres;

--
-- Name: process_credit_sale_completion(uuid, text, numeric, numeric); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.process_credit_sale_completion(p_credit_sale_id uuid, p_payment_method text, p_amount_received numeric, p_change_amount numeric) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_credit_sale RECORD;
  v_sale_number TEXT;
  v_sale_id UUID;
  v_deposit_account_id UUID;
  v_cash_account_id UUID;
  v_current_balance NUMERIC;
  v_new_balance NUMERIC;
  v_customer_balance NUMERIC;
  v_new_customer_balance NUMERIC;
  v_item RECORD;
  v_returned_qty NUMERIC;
  v_net_quantity NUMERIC;
  v_line_total NUMERIC;
  v_line_tax NUMERIC;
  v_sanitized_items JSONB := '[]'::jsonb;
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

  -- 5. Insert Sale Items (Factoring in returns)
  FOR v_item IN SELECT * FROM jsonb_to_recordset(v_credit_sale.items) AS x(
    product_id UUID,
    product_name TEXT,
    quantity NUMERIC,
    unit_price NUMERIC,
    total_price NUMERIC,
    tax_percentage NUMERIC,
    tax_amount NUMERIC,
    pct_code TEXT,
    discount NUMERIC,
    quantity_returned NUMERIC,
    returned NUMERIC
  )
  LOOP
    v_returned_qty := COALESCE(v_item.quantity_returned, v_item.returned, 0);
    v_net_quantity := GREATEST(0, v_item.quantity - v_returned_qty);

    IF v_net_quantity > 0 THEN
      v_line_total := v_net_quantity * v_item.unit_price;
      
      IF COALESCE(v_item.tax_percentage, 0) > 0 THEN
        v_line_tax := v_line_total - (v_line_total / (1 + (v_item.tax_percentage / 100.0)));
      ELSE
        v_line_tax := 0;
      END IF;

      INSERT INTO sale_items (
        sale_id,
        product_id,
        product_name,
        quantity,
        unit_price,
        total_price,
        tax_percent,
        tax_amount,
        tax_percentage,
        discount,
        pct_code,
        quantity_returned
      ) VALUES (
        v_sale_id,
        v_item.product_id,
        v_item.product_name,
        v_net_quantity::integer,
        v_item.unit_price,
        v_line_total,
        COALESCE(v_item.tax_percentage, 0),
        ROUND(v_line_tax, 2),
        COALESCE(v_item.tax_percentage, 0),
        COALESCE(v_item.discount, 0),
        COALESCE(v_item.pct_code, '01011000'),
        0
      );

      v_sanitized_items := v_sanitized_items || jsonb_build_object(
        'product_id', v_item.product_id,
        'product_name', v_item.product_name,
        'name', v_item.product_name,
        'quantity', v_net_quantity,
        'unit_price', v_item.unit_price,
        'total_price', v_line_total,
        'tax_percentage', COALESCE(v_item.tax_percentage, 0),
        'tax_amount', ROUND(v_line_tax, 2),
        'pct_code', COALESCE(v_item.pct_code, '01011000'),
        'discount', COALESCE(v_item.discount, 0)
      );
    END IF;
  END LOOP;

  -- 6. Update Financials (Accounts & Ledger)
  -- A. Deposit Account (Cash in Hand)
  IF v_deposit_account_id IS NOT NULL THEN
    SELECT current_balance INTO v_current_balance
    FROM accounts
    WHERE id = v_deposit_account_id;

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

  -- B. Credit Customer Account (Reduce Receivable)
  IF v_credit_sale.customer_id IS NOT NULL THEN
    SELECT current_balance INTO v_customer_balance
    FROM accounts
    WHERE id = v_credit_sale.customer_id;

    IF v_customer_balance IS NOT NULL THEN
      v_new_customer_balance := v_customer_balance - v_credit_sale.total_amount;

      UPDATE accounts
      SET current_balance = v_new_customer_balance
      WHERE id = v_credit_sale.customer_id;

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
        v_credit_sale.customer_id,
        'payment',
        v_sale_id,
        'Payment for Credit Bill #' || v_credit_sale.bill_number,
        0,
        v_credit_sale.total_amount,
        v_new_customer_balance,
        NOW()
      );
    END IF;

    -- Record in payments table so it permanently appears in customer payment history
    INSERT INTO payments (
      payment_number,
      from_account_id,
      to_account_id,
      amount,
      payment_mode,
      reference_id,
      notes,
      created_by,
      created_at
    ) VALUES (
      'PAY-' || v_sale_number,
      v_credit_sale.customer_id,
      v_deposit_account_id,
      v_credit_sale.total_amount,
      p_payment_method,
      v_sale_id,
      'Payment for Credit Bill #' || v_credit_sale.bill_number,
      auth.uid(),
      NOW()
    );
  END IF;

  -- 7. Update Credit Sale Status
  UPDATE credit_sales
  SET status = 'completed', sale_id = v_sale_id
  WHERE id = p_credit_sale_id;

  -- Return the new Sale ID, Number, and sanitized items for frontend processing (like FBR)
  RETURN jsonb_build_object(
    'sale_id', v_sale_id,
    'sale_number', v_sale_number,
    'customer_name', v_credit_sale.customer_name,
    'total_amount', v_credit_sale.total_amount,
    'bill_number', v_credit_sale.bill_number,
    'items', v_sanitized_items 
  );

EXCEPTION WHEN OTHERS THEN
  RAISE;
END;
$$;


ALTER FUNCTION public.process_credit_sale_completion(p_credit_sale_id uuid, p_payment_method text, p_amount_received numeric, p_change_amount numeric) OWNER TO postgres;

--
-- Name: process_sale_transaction(jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.process_sale_transaction(sale_data jsonb, items_data jsonb) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_sale_number TEXT;
  v_sale_id UUID;
  v_customer_id UUID;
  v_total_amount NUMERIC;
  v_payment_method TEXT;
  v_sale_type TEXT;
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
  
  -- Explicitly get sale_type, default to 'counter'
  v_sale_type := COALESCE(sale_data->>'sale_type', 'counter');

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
      created_by,
      received_by
    ) VALUES (
      v_customer_id,
      sale_data->>'customer_name',
      v_total_amount,
      items_data,
      'pending',
      auth.uid(),
      sale_data->>'received_by'
    ) RETURNING jsonb_build_object('id', id, 'bill_number', bill_number, 'type', 'credit_sale') INTO v_result;

    -- Update Customer Account Balance & Ledger
    IF v_customer_id IS NOT NULL THEN
      SELECT current_balance INTO v_current_balance FROM accounts WHERE id = v_customer_id;
      IF v_current_balance IS NOT NULL THEN
        v_new_balance := v_current_balance + v_total_amount;
        UPDATE accounts SET current_balance = v_new_balance WHERE id = v_customer_id;

        INSERT INTO ledger_entries (
          account_id, reference_type, reference_id, description, debit, credit, balance, created_at
        ) VALUES (
          v_customer_id, 'credit_sale', (v_result->>'id')::UUID,
          'Credit Sale Bill #' || (v_result->>'bill_number'),
          v_total_amount, 0, v_new_balance, NOW()
        );
      END IF;
    END IF;

    -- Update Stock ONLY if NOT delivery
    IF v_sale_type != 'delivery' THEN
        FOR v_item IN SELECT * FROM jsonb_array_elements(items_data)
        LOOP
          v_product_id := (v_item->>'product_id')::UUID;
          v_quantity := (v_item->>'quantity')::NUMERIC;

          UPDATE products
          SET stock_quantity = GREATEST(0, stock_quantity - v_quantity)
          WHERE id = v_product_id;
        END LOOP;
    END IF;

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
    IF v_sale_type != 'delivery' THEN
        SELECT id INTO v_cash_account_id FROM accounts WHERE account_subtype = 'cash_in_hand' AND is_active = true LIMIT 1;
        v_deposit_account_id := v_cash_account_id;
    END IF;
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
    sale_type,
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
    v_payment_method::payment_method,
    (sale_data->>'amount_received')::NUMERIC,
    (sale_data->>'change_amount')::NUMERIC,
    v_deposit_account_id,
    v_sale_type::sale_type,
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

  -- Insert Sale Items & Update Stock
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

    -- Update Stock ONLY if NOT delivery
    IF v_sale_type != 'delivery' THEN
        UPDATE products
        SET stock_quantity = GREATEST(0, stock_quantity - v_quantity)
        WHERE id = v_product_id;
    END IF;
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

      IF v_split_method = 'cash' THEN
         IF v_sale_type != 'delivery' THEN
             SELECT id INTO v_split_account_id FROM accounts WHERE account_subtype = 'cash_in_hand' AND is_active = true LIMIT 1;
         END IF;
      ELSIF v_split_method = 'ibft' THEN
         v_split_account_id := NULLIF(v_split->>'bankAccountId', '')::UUID;
      ELSIF v_split_method = 'cheque' THEN
         SELECT id INTO v_split_account_id FROM accounts WHERE account_subtype = 'cheques' AND is_active = true LIMIT 1;
         
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

  -- Case B: SINGLE Payment
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


ALTER FUNCTION public.process_sale_transaction(sale_data jsonb, items_data jsonb) OWNER TO postgres;

--
-- Name: update_account_balance(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_account_balance() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Deduct from source account
    IF NEW.from_account_id IS NOT NULL THEN
        UPDATE public.accounts 
        SET current_balance = current_balance - NEW.amount
        WHERE id = NEW.from_account_id;
    END IF;
    
    -- Add to destination account
    IF NEW.to_account_id IS NOT NULL THEN
        UPDATE public.accounts 
        SET current_balance = current_balance + NEW.amount
        WHERE id = NEW.to_account_id;
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_account_balance() OWNER TO postgres;

--
-- Name: update_sale_payment_method(uuid, text, numeric, uuid, jsonb, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_sale_payment_method(p_sale_id uuid, p_new_method text, p_amount_received numeric, p_new_account_id uuid DEFAULT NULL::uuid, p_payment_splits jsonb DEFAULT NULL::jsonb, p_updated_by uuid DEFAULT auth.uid()) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
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


ALTER FUNCTION public.update_sale_payment_method(p_sale_id uuid, p_new_method text, p_amount_received numeric, p_new_account_id uuid, p_payment_splits jsonb, p_updated_by uuid) OWNER TO postgres;

--
-- Name: update_spreadsheets_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_spreadsheets_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_spreadsheets_updated_at() OWNER TO postgres;

--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: account_transactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.account_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    from_account_id uuid,
    to_account_id uuid,
    amount numeric(12,2) NOT NULL,
    transaction_type text NOT NULL,
    reference_id uuid,
    notes text,
    created_by uuid,
    store_id uuid,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.account_transactions OWNER TO postgres;

--
-- Name: accounts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    account_type text NOT NULL,
    current_balance numeric(12,2) DEFAULT 0,
    is_system boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    bank_name_id uuid,
    account_subtype text,
    address text,
    phone text,
    email text,
    credit_limit numeric(12,2) DEFAULT 0,
    opening_balance numeric(12,2) DEFAULT 0,
    city text,
    account_number text,
    account_title text,
    branch_location text,
    retail_shop_id uuid,
    akws_account_id uuid
);


ALTER TABLE public.accounts OWNER TO postgres;

--
-- Name: app_routes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.app_routes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    path text NOT NULL,
    parent_name text,
    icon_name text,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.app_routes OWNER TO postgres;

--
-- Name: bank_names; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bank_names (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.bank_names OWNER TO postgres;

--
-- Name: credit_sale_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.credit_sale_seq
    START WITH 1001
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.credit_sale_seq OWNER TO postgres;

--
-- Name: credit_sales; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.credit_sales (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bill_number text DEFAULT ('CS-'::text || (nextval('public.credit_sale_seq'::regclass))::text) NOT NULL,
    customer_id uuid,
    customer_name text NOT NULL,
    customer_phone text,
    total_amount numeric(12,2) NOT NULL,
    items jsonb DEFAULT '[]'::jsonb NOT NULL,
    status text DEFAULT 'pending'::text,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    store_id uuid,
    sale_id uuid,
    received_by text,
    CONSTRAINT credit_sales_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'completed'::text, 'delivered'::text])))
);


ALTER TABLE public.credit_sales OWNER TO postgres;

--
-- Name: customers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.customers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    phone text,
    email text,
    address text,
    credit_limit numeric(12,2) DEFAULT 0,
    current_balance numeric(12,2) DEFAULT 0,
    is_registered boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.customers OWNER TO postgres;

--
-- Name: daily_expenses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.daily_expenses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    expense_date date DEFAULT CURRENT_DATE NOT NULL,
    category text NOT NULL,
    description text NOT NULL,
    amount numeric(12,2) NOT NULL,
    payment_method text DEFAULT 'cash'::text NOT NULL,
    receipt_no text,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT daily_expenses_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT daily_expenses_payment_method_check CHECK ((payment_method = ANY (ARRAY['cash'::text, 'ibft'::text, 'card'::text])))
);


ALTER TABLE public.daily_expenses OWNER TO postgres;

--
-- Name: daily_reconciliations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.daily_reconciliations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reconciliation_date date NOT NULL,
    status text DEFAULT 'saved'::text NOT NULL,
    system_counter_sales_total numeric(12,2) DEFAULT 0,
    system_cash_sales numeric(12,2) DEFAULT 0,
    system_card_sales numeric(12,2) DEFAULT 0,
    system_ibft_sales numeric(12,2) DEFAULT 0,
    system_cash_returns numeric(12,2) DEFAULT 0,
    total_expenses numeric(12,2) DEFAULT 0,
    cash_expenses numeric(12,2) DEFAULT 0,
    ibft_expenses numeric(12,2) DEFAULT 0,
    card_expenses numeric(12,2) DEFAULT 0,
    manual_ibft_total numeric(12,2) DEFAULT 0,
    ibft_variance numeric(12,2) DEFAULT 0,
    manual_card_total numeric(12,2) DEFAULT 0,
    card_variance numeric(12,2) DEFAULT 0,
    opening_cash numeric(12,2) DEFAULT 0,
    expected_cash numeric(12,2) DEFAULT 0,
    actual_cash numeric(12,2) DEFAULT 0,
    cash_variance numeric(12,2) DEFAULT 0,
    denominations jsonb DEFAULT '{}'::jsonb,
    closing_notes text,
    closed_by uuid,
    closed_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    move_to_reserve numeric(12,2) DEFAULT 0,
    closing_balance numeric(12,2) DEFAULT 0,
    cash_in_reserve numeric(12,2) DEFAULT 0,
    sale_adjustments numeric(12,2) DEFAULT 0,
    is_grouped boolean DEFAULT false,
    start_date date,
    end_date date,
    grouped_dates date[] DEFAULT '{}'::date[],
    CONSTRAINT daily_reconciliations_status_check CHECK ((status = ANY (ARRAY['saved'::text, 'reviewed'::text])))
);


ALTER TABLE public.daily_reconciliations OWNER TO postgres;

--
-- Name: fbr_integration_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.fbr_integration_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    transaction_type text NOT NULL,
    transaction_id uuid NOT NULL,
    internal_number text NOT NULL,
    fbr_number text,
    status public.fbr_status DEFAULT 'pending'::public.fbr_status NOT NULL,
    error_message text,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.fbr_integration_log OWNER TO postgres;

--
-- Name: forward_orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.forward_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_number text NOT NULL,
    customer_id uuid,
    customer_name text,
    customer_phone text,
    items jsonb DEFAULT '[]'::jsonb NOT NULL,
    subtotal numeric(12,2) NOT NULL,
    discount numeric(12,2) DEFAULT 0,
    tax numeric(12,2) DEFAULT 0,
    total numeric(12,2) NOT NULL,
    status text DEFAULT 'pending'::text,
    delivery_date date,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.forward_orders OWNER TO postgres;

--
-- Name: held_carts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.held_carts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cart_name text NOT NULL,
    user_id uuid,
    customer_id uuid,
    cart_data jsonb DEFAULT '[]'::jsonb NOT NULL,
    subtotal numeric(12,2) DEFAULT 0,
    discount numeric(12,2) DEFAULT 0,
    tax numeric(12,2) DEFAULT 0,
    total_amount numeric(12,2) DEFAULT 0,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    assigned_to uuid,
    page_type text DEFAULT 'sales'::text
);

ALTER TABLE ONLY public.held_carts REPLICA IDENTITY FULL;


ALTER TABLE public.held_carts OWNER TO postgres;

--
-- Name: inventory_adjustments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.inventory_adjustments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid,
    adjustment_type public.adjustment_type NOT NULL,
    quantity integer NOT NULL,
    reason text,
    created_by uuid,
    store_id uuid,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.inventory_adjustments OWNER TO postgres;

--
-- Name: ledger_entries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ledger_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    account_id uuid,
    reference_type text NOT NULL,
    reference_id uuid NOT NULL,
    description text,
    debit numeric(12,2) DEFAULT 0,
    credit numeric(12,2) DEFAULT 0,
    balance numeric(12,2) DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.ledger_entries OWNER TO postgres;

--
-- Name: online_customers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.online_customers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    auth_user_id uuid,
    full_name text NOT NULL,
    phone text NOT NULL,
    email text,
    default_address text,
    city text,
    postal_code text,
    notes text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    password_hash text
);


ALTER TABLE public.online_customers OWNER TO postgres;

--
-- Name: online_order_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.online_order_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    product_id uuid NOT NULL,
    suits_quantity integer DEFAULT 1 NOT NULL,
    meters_per_suit numeric(10,2) DEFAULT 4.0 NOT NULL,
    total_meters numeric(10,2) NOT NULL,
    price_per_suit numeric(10,2) NOT NULL,
    total_price numeric(12,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    selected_color text
);


ALTER TABLE public.online_order_items OWNER TO postgres;

--
-- Name: online_orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.online_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_number text NOT NULL,
    customer_name text NOT NULL,
    customer_phone text NOT NULL,
    customer_email text,
    shipping_address text NOT NULL,
    city text NOT NULL,
    postal_code text,
    notes text,
    subtotal numeric(12,2) DEFAULT 0 NOT NULL,
    shipping_cost numeric(12,2) DEFAULT 0 NOT NULL,
    total_amount numeric(12,2) DEFAULT 0 NOT NULL,
    payment_method text DEFAULT 'ibft'::text NOT NULL,
    payment_status text DEFAULT 'pending_verification'::text NOT NULL,
    payment_proof_url text,
    order_status text DEFAULT 'pending'::text NOT NULL,
    pos_sale_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    customer_id uuid,
    consignment_number text
);


ALTER TABLE public.online_orders OWNER TO postgres;

--
-- Name: payments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    payment_number text,
    from_account_id uuid,
    to_account_id uuid,
    amount numeric(12,2) NOT NULL,
    payment_mode text NOT NULL,
    reference_id uuid,
    created_by uuid,
    store_id uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.payments OWNER TO postgres;

--
-- Name: product_categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.product_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.product_categories OWNER TO postgres;

--
-- Name: product_variants; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.product_variants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    color_name text NOT NULL,
    color_hex text DEFAULT '#295975'::text NOT NULL,
    variant_image_url text,
    is_available boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.product_variants OWNER TO postgres;

--
-- Name: products; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    barcode text,
    sku text,
    price numeric(12,2) NOT NULL,
    cost_price numeric(12,2),
    stock_quantity integer DEFAULT 0,
    min_stock_level integer DEFAULT 0,
    category text,
    description text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    category_id uuid,
    meters_per_piece numeric(10,2) DEFAULT 0,
    pct_code text,
    tax_rate numeric DEFAULT 0,
    warehouse_product_id uuid,
    warehouse_variation_id uuid,
    is_online boolean DEFAULT false,
    online_title text,
    online_description text,
    meters_per_suit numeric(10,2) DEFAULT 4.0,
    price_per_suit numeric(10,2) DEFAULT 0,
    fabric_type text DEFAULT 'Cotton'::text,
    season text DEFAULT 'All Season'::text,
    pana_inches integer DEFAULT 54,
    is_featured boolean DEFAULT false,
    is_new_arrival boolean DEFAULT true,
    is_bestseller boolean DEFAULT false,
    images text[] DEFAULT '{}'::text[],
    video_url text
);


ALTER TABLE public.products OWNER TO postgres;

--
-- Name: COLUMN products.price; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.products.price IS 'Price per piece/suit';


--
-- Name: COLUMN products.cost_price; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.products.cost_price IS 'Cost price per piece/suit';


--
-- Name: COLUMN products.stock_quantity; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.products.stock_quantity IS 'Number of pieces/suits in stock';


--
-- Name: COLUMN products.pct_code; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.products.pct_code IS 'Product Classification Tracking Code for FBR';


--
-- Name: COLUMN products.tax_rate; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.products.tax_rate IS 'Tax rate percentage included in the price';


--
-- Name: reconciliation_card_entries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.reconciliation_card_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entry_date date DEFAULT CURRENT_DATE NOT NULL,
    terminal_name text,
    description text,
    amount numeric(12,2) NOT NULL,
    slip_number text,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT reconciliation_card_entries_amount_check CHECK ((amount > (0)::numeric))
);


ALTER TABLE public.reconciliation_card_entries OWNER TO postgres;

--
-- Name: reconciliation_ibft_entries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.reconciliation_ibft_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entry_date date DEFAULT CURRENT_DATE NOT NULL,
    description text,
    amount numeric(12,2) NOT NULL,
    bank_name text,
    reference_no text,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT reconciliation_ibft_entries_amount_check CHECK ((amount > (0)::numeric))
);


ALTER TABLE public.reconciliation_ibft_entries OWNER TO postgres;

--
-- Name: return_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.return_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    return_id uuid,
    product_id uuid,
    product_name text,
    quantity integer NOT NULL,
    unit_price numeric(12,2) NOT NULL,
    total_price numeric(12,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    sale_item_id uuid
);


ALTER TABLE public.return_items OWNER TO postgres;

--
-- Name: returns; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.returns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    return_number text NOT NULL,
    fbr_return_number text,
    original_sale_id uuid,
    customer_name text NOT NULL,
    customer_phone text,
    total_amount numeric(12,2) NOT NULL,
    refund_method public.refund_method NOT NULL,
    reason text,
    created_by uuid,
    store_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    status public.return_status DEFAULT 'completed'::public.return_status NOT NULL,
    customer_id uuid,
    return_type text DEFAULT 'cash'::text,
    fbr_invoice_number text,
    CONSTRAINT returns_return_type_check CHECK ((return_type = ANY (ARRAY['cash'::text, 'credit'::text])))
);

ALTER TABLE ONLY public.returns REPLICA IDENTITY FULL;


ALTER TABLE public.returns OWNER TO postgres;

--
-- Name: COLUMN returns.return_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.returns.return_type IS 'Distinguishes between Cash (Paid Invoice) and Credit (Credit Invoice) returns';


--
-- Name: sale_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sale_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sale_id uuid,
    product_id uuid,
    product_name text NOT NULL,
    quantity integer NOT NULL,
    unit_price numeric(12,2) NOT NULL,
    total_price numeric(12,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    tax_percent numeric(12,2) DEFAULT 0,
    tax_amount numeric(12,2) DEFAULT 0,
    tax_percentage numeric DEFAULT 0,
    discount numeric DEFAULT 0,
    pct_code text DEFAULT '01011000'::text,
    quantity_returned numeric DEFAULT 0
);


ALTER TABLE public.sale_items OWNER TO postgres;

--
-- Name: COLUMN sale_items.quantity_returned; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.sale_items.quantity_returned IS 'Tracks quantity returned for this line item without modifying original quantity';


--
-- Name: sales; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sales (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sale_number text NOT NULL,
    fbr_invoice_number text,
    sale_type public.sale_type DEFAULT 'counter'::public.sale_type NOT NULL,
    customer_id uuid,
    customer_name text NOT NULL,
    customer_phone text,
    subtotal numeric(12,2) NOT NULL,
    discount numeric(12,2) DEFAULT 0,
    total_amount numeric(12,2) NOT NULL,
    payment_method public.payment_method NOT NULL,
    payment_details jsonb,
    created_by uuid,
    store_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    amount_received numeric(12,2) DEFAULT 0,
    change_amount numeric(12,2) DEFAULT 0,
    discount_amount numeric(12,2) DEFAULT 0,
    discount_percent numeric(5,2) DEFAULT 0,
    status text DEFAULT 'completed'::text,
    notes text,
    deposit_account_id uuid,
    cheque_number text,
    cheque_bank text,
    cheque_date date,
    fbr_qr_code text
);

ALTER TABLE ONLY public.sales REPLICA IDENTITY FULL;


ALTER TABLE public.sales OWNER TO postgres;

--
-- Name: sequences; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sequences (
    id text NOT NULL,
    current_value bigint DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    prefix text
);


ALTER TABLE public.sequences OWNER TO postgres;

--
-- Name: spreadsheets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.spreadsheets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text DEFAULT 'Untitled Spreadsheet'::text NOT NULL,
    data jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.spreadsheets OWNER TO postgres;

--
-- Name: stock_receipt_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.stock_receipt_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    receipt_id uuid,
    product_id uuid,
    rolls_received integer DEFAULT 0,
    meters_per_roll numeric(10,2) DEFAULT 0,
    total_meters numeric(10,2) DEFAULT 0,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


ALTER TABLE public.stock_receipt_items OWNER TO postgres;

--
-- Name: stock_receipt_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.stock_receipt_seq
    START WITH 1001
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.stock_receipt_seq OWNER TO postgres;

--
-- Name: stock_receipts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.stock_receipts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    receipt_number text NOT NULL,
    total_rolls integer DEFAULT 0,
    total_meters numeric(10,2) DEFAULT 0,
    notes text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


ALTER TABLE public.stock_receipts OWNER TO postgres;

--
-- Name: store_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.store_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_name text DEFAULT 'AK Retail POS'::text,
    address text,
    phone text,
    email text,
    website text,
    tax_rate numeric(5,2) DEFAULT 0,
    currency_symbol text DEFAULT 'Rs.'::text,
    logo_url text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    alt_phone text,
    header_text text,
    footer_text text,
    exchange_policy text DEFAULT ''::text,
    fbr_integration_enabled boolean DEFAULT false,
    fbr_pos_id text DEFAULT '189142'::text,
    fbr_api_url text DEFAULT 'http://localhost:5261/api/fbr/submit-invoice'::text,
    store_tagline text DEFAULT 'Quality Fabrics for Everyone'::text,
    support_phone text DEFAULT '03228515152'::text,
    support_whatsapp text DEFAULT '03228515152'::text,
    support_email text DEFAULT 'contact@abrekaram.com'::text,
    outlet_address text DEFAULT 'Cloth Market, Faisalabad'::text,
    outlet_city text DEFAULT 'Faisalabad'::text,
    delivery_charge numeric(10,2) DEFAULT 250.00,
    free_shipping_min_amount numeric(10,2) DEFAULT 5000.00,
    estimated_delivery_days text DEFAULT '2 - 4 Working Days'::text,
    bank_name text DEFAULT 'Meezan Bank Limited'::text,
    account_title text DEFAULT 'Abr e Karam Fabrics'::text,
    account_number text DEFAULT '01010102938475'::text,
    iban_number text DEFAULT 'PK36MEZN0001010102938475'::text,
    payment_instructions text DEFAULT 'Please transfer the total order amount via IBFT/EasyPaisa/JazzCash and attach the payment proof screenshot or reference ID during checkout.'::text,
    announcement_text text DEFAULT '✨ Free Shipping on All Orders Above Rs. 5,000 Across Pakistan!'::text,
    is_announcement_active boolean DEFAULT true,
    facebook_url text DEFAULT ''::text,
    instagram_url text DEFAULT ''::text,
    google_maps_url text DEFAULT ''::text,
    map_location_url text DEFAULT ''::text,
    weekly_off_days text[] DEFAULT ARRAY['friday'::text]
);


ALTER TABLE public.store_settings OWNER TO postgres;

--
-- Name: stores; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.stores (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    address text,
    phone text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.stores OWNER TO postgres;

--
-- Name: user_profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_profiles (
    id uuid NOT NULL,
    full_name text NOT NULL,
    role public.user_role DEFAULT 'cashier'::public.user_role NOT NULL,
    store_id uuid,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    custom_role_name text
);


ALTER TABLE public.user_profiles OWNER TO postgres;

--
-- Name: user_route_permissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_route_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    route_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.user_route_permissions OWNER TO postgres;

--
-- Name: account_transactions account_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.account_transactions
    ADD CONSTRAINT account_transactions_pkey PRIMARY KEY (id);


--
-- Name: accounts accounts_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_name_key UNIQUE (name);


--
-- Name: accounts accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_pkey PRIMARY KEY (id);


--
-- Name: app_routes app_routes_path_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.app_routes
    ADD CONSTRAINT app_routes_path_key UNIQUE (path);


--
-- Name: app_routes app_routes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.app_routes
    ADD CONSTRAINT app_routes_pkey PRIMARY KEY (id);


--
-- Name: bank_names bank_names_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bank_names
    ADD CONSTRAINT bank_names_name_key UNIQUE (name);


--
-- Name: bank_names bank_names_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bank_names
    ADD CONSTRAINT bank_names_pkey PRIMARY KEY (id);


--
-- Name: credit_sales credit_sales_bill_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.credit_sales
    ADD CONSTRAINT credit_sales_bill_number_key UNIQUE (bill_number);


--
-- Name: credit_sales credit_sales_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.credit_sales
    ADD CONSTRAINT credit_sales_pkey PRIMARY KEY (id);


--
-- Name: customers customers_phone_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_phone_key UNIQUE (phone);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: daily_expenses daily_expenses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.daily_expenses
    ADD CONSTRAINT daily_expenses_pkey PRIMARY KEY (id);


--
-- Name: daily_reconciliations daily_reconciliations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.daily_reconciliations
    ADD CONSTRAINT daily_reconciliations_pkey PRIMARY KEY (id);


--
-- Name: daily_reconciliations daily_reconciliations_reconciliation_date_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.daily_reconciliations
    ADD CONSTRAINT daily_reconciliations_reconciliation_date_key UNIQUE (reconciliation_date);


--
-- Name: fbr_integration_log fbr_integration_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fbr_integration_log
    ADD CONSTRAINT fbr_integration_log_pkey PRIMARY KEY (id);


--
-- Name: forward_orders forward_orders_order_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.forward_orders
    ADD CONSTRAINT forward_orders_order_number_key UNIQUE (order_number);


--
-- Name: forward_orders forward_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.forward_orders
    ADD CONSTRAINT forward_orders_pkey PRIMARY KEY (id);


--
-- Name: held_carts held_carts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.held_carts
    ADD CONSTRAINT held_carts_pkey PRIMARY KEY (id);


--
-- Name: inventory_adjustments inventory_adjustments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_adjustments
    ADD CONSTRAINT inventory_adjustments_pkey PRIMARY KEY (id);


--
-- Name: ledger_entries ledger_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ledger_entries
    ADD CONSTRAINT ledger_entries_pkey PRIMARY KEY (id);


--
-- Name: online_customers online_customers_auth_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.online_customers
    ADD CONSTRAINT online_customers_auth_user_id_key UNIQUE (auth_user_id);


--
-- Name: online_customers online_customers_phone_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.online_customers
    ADD CONSTRAINT online_customers_phone_key UNIQUE (phone);


--
-- Name: online_customers online_customers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.online_customers
    ADD CONSTRAINT online_customers_pkey PRIMARY KEY (id);


--
-- Name: online_order_items online_order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.online_order_items
    ADD CONSTRAINT online_order_items_pkey PRIMARY KEY (id);


--
-- Name: online_orders online_orders_order_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.online_orders
    ADD CONSTRAINT online_orders_order_number_key UNIQUE (order_number);


--
-- Name: online_orders online_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.online_orders
    ADD CONSTRAINT online_orders_pkey PRIMARY KEY (id);


--
-- Name: payments payments_payment_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_payment_number_key UNIQUE (payment_number);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: product_categories product_categories_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_categories
    ADD CONSTRAINT product_categories_name_key UNIQUE (name);


--
-- Name: product_categories product_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_categories
    ADD CONSTRAINT product_categories_pkey PRIMARY KEY (id);


--
-- Name: product_variants product_variants_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_variants
    ADD CONSTRAINT product_variants_pkey PRIMARY KEY (id);


--
-- Name: products products_barcode_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_barcode_key UNIQUE (barcode);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: products products_sku_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_sku_key UNIQUE (sku);


--
-- Name: reconciliation_card_entries reconciliation_card_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reconciliation_card_entries
    ADD CONSTRAINT reconciliation_card_entries_pkey PRIMARY KEY (id);


--
-- Name: reconciliation_ibft_entries reconciliation_ibft_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reconciliation_ibft_entries
    ADD CONSTRAINT reconciliation_ibft_entries_pkey PRIMARY KEY (id);


--
-- Name: return_items return_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.return_items
    ADD CONSTRAINT return_items_pkey PRIMARY KEY (id);


--
-- Name: returns returns_fbr_return_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.returns
    ADD CONSTRAINT returns_fbr_return_number_key UNIQUE (fbr_return_number);


--
-- Name: returns returns_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.returns
    ADD CONSTRAINT returns_pkey PRIMARY KEY (id);


--
-- Name: returns returns_return_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.returns
    ADD CONSTRAINT returns_return_number_key UNIQUE (return_number);


--
-- Name: sale_items sale_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sale_items
    ADD CONSTRAINT sale_items_pkey PRIMARY KEY (id);


--
-- Name: sales sales_fbr_invoice_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_fbr_invoice_number_key UNIQUE (fbr_invoice_number);


--
-- Name: sales sales_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_pkey PRIMARY KEY (id);


--
-- Name: sales sales_sale_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_sale_number_key UNIQUE (sale_number);


--
-- Name: sequences sequences_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sequences
    ADD CONSTRAINT sequences_pkey PRIMARY KEY (id);


--
-- Name: spreadsheets spreadsheets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.spreadsheets
    ADD CONSTRAINT spreadsheets_pkey PRIMARY KEY (id);


--
-- Name: stock_receipt_items stock_receipt_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_receipt_items
    ADD CONSTRAINT stock_receipt_items_pkey PRIMARY KEY (id);


--
-- Name: stock_receipts stock_receipts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_receipts
    ADD CONSTRAINT stock_receipts_pkey PRIMARY KEY (id);


--
-- Name: store_settings store_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.store_settings
    ADD CONSTRAINT store_settings_pkey PRIMARY KEY (id);


--
-- Name: stores stores_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stores
    ADD CONSTRAINT stores_pkey PRIMARY KEY (id);


--
-- Name: user_profiles user_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_pkey PRIMARY KEY (id);


--
-- Name: user_route_permissions user_route_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_route_permissions
    ADD CONSTRAINT user_route_permissions_pkey PRIMARY KEY (id);


--
-- Name: user_route_permissions user_route_permissions_user_id_route_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_route_permissions
    ADD CONSTRAINT user_route_permissions_user_id_route_id_key UNIQUE (user_id, route_id);


--
-- Name: idx_account_transactions_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_account_transactions_created_at ON public.account_transactions USING btree (created_at DESC);


--
-- Name: idx_account_transactions_from; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_account_transactions_from ON public.account_transactions USING btree (from_account_id);


--
-- Name: idx_account_transactions_to; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_account_transactions_to ON public.account_transactions USING btree (to_account_id);


--
-- Name: idx_account_transactions_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_account_transactions_type ON public.account_transactions USING btree (transaction_type);


--
-- Name: idx_accounts_account_subtype; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_accounts_account_subtype ON public.accounts USING btree (account_subtype);


--
-- Name: idx_accounts_balance; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_accounts_balance ON public.accounts USING btree (current_balance) WHERE (current_balance > (0)::numeric);


--
-- Name: idx_accounts_is_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_accounts_is_active ON public.accounts USING btree (is_active);


--
-- Name: idx_accounts_phone; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_accounts_phone ON public.accounts USING btree (phone);


--
-- Name: idx_accounts_subtype; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_accounts_subtype ON public.accounts USING btree (account_subtype);


--
-- Name: idx_accounts_subtype_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_accounts_subtype_active ON public.accounts USING btree (account_subtype, is_active);


--
-- Name: idx_accounts_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_accounts_type ON public.accounts USING btree (account_type);


--
-- Name: idx_card_entries_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_card_entries_date ON public.reconciliation_card_entries USING btree (entry_date DESC);


--
-- Name: idx_credit_sales_customer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_credit_sales_customer ON public.credit_sales USING btree (customer_id);


--
-- Name: idx_credit_sales_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_credit_sales_status ON public.credit_sales USING btree (status);


--
-- Name: idx_customers_phone; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customers_phone ON public.customers USING btree (phone);


--
-- Name: idx_daily_expenses_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_daily_expenses_date ON public.daily_expenses USING btree (expense_date DESC);


--
-- Name: idx_daily_reconciliations_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_daily_reconciliations_date ON public.daily_reconciliations USING btree (reconciliation_date DESC);


--
-- Name: idx_daily_reconciliations_date_range; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_daily_reconciliations_date_range ON public.daily_reconciliations USING btree (start_date, end_date);


--
-- Name: idx_daily_reconciliations_grouped_dates; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_daily_reconciliations_grouped_dates ON public.daily_reconciliations USING gin (grouped_dates);


--
-- Name: idx_forward_orders_customer_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_forward_orders_customer_id ON public.forward_orders USING btree (customer_id);


--
-- Name: idx_forward_orders_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_forward_orders_status ON public.forward_orders USING btree (status);


--
-- Name: idx_held_carts_assigned_to; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_held_carts_assigned_to ON public.held_carts USING btree (assigned_to);


--
-- Name: idx_held_carts_page_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_held_carts_page_type ON public.held_carts USING btree (page_type);


--
-- Name: idx_held_carts_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_held_carts_user_id ON public.held_carts USING btree (user_id);


--
-- Name: idx_ibft_entries_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ibft_entries_date ON public.reconciliation_ibft_entries USING btree (entry_date DESC);


--
-- Name: idx_ledger_entries_account; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ledger_entries_account ON public.ledger_entries USING btree (account_id);


--
-- Name: idx_ledger_entries_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ledger_entries_created_at ON public.ledger_entries USING btree (created_at DESC);


--
-- Name: idx_ledger_entries_ref; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ledger_entries_ref ON public.ledger_entries USING btree (reference_type, reference_id);


--
-- Name: idx_payments_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_payments_created_at ON public.payments USING btree (created_at DESC);


--
-- Name: idx_payments_from; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_payments_from ON public.payments USING btree (from_account_id);


--
-- Name: idx_payments_to; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_payments_to ON public.payments USING btree (to_account_id);


--
-- Name: idx_products_barcode; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_barcode ON public.products USING btree (barcode);


--
-- Name: idx_products_category_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_category_id ON public.products USING btree (category_id);


--
-- Name: idx_products_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_name ON public.products USING btree (name);


--
-- Name: idx_products_sku; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_sku ON public.products USING btree (sku);


--
-- Name: idx_products_warehouse_product_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_warehouse_product_id ON public.products USING btree (warehouse_product_id);


--
-- Name: idx_products_warehouse_variation_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_warehouse_variation_id ON public.products USING btree (warehouse_variation_id);


--
-- Name: idx_return_items_sale_item_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_return_items_sale_item_id ON public.return_items USING btree (sale_item_id);


--
-- Name: idx_returns_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_returns_created_at ON public.returns USING btree (created_at DESC);


--
-- Name: idx_returns_customer_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_returns_customer_id ON public.returns USING btree (customer_id);


--
-- Name: idx_returns_original_sale; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_returns_original_sale ON public.returns USING btree (original_sale_id);


--
-- Name: idx_returns_original_sale_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_returns_original_sale_id ON public.returns USING btree (original_sale_id);


--
-- Name: idx_returns_return_number; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_returns_return_number ON public.returns USING btree (return_number);


--
-- Name: idx_sale_items_product_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sale_items_product_id ON public.sale_items USING btree (product_id);


--
-- Name: idx_sale_items_sale; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sale_items_sale ON public.sale_items USING btree (sale_id);


--
-- Name: idx_sales_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sales_created_at ON public.sales USING btree (created_at DESC);


--
-- Name: idx_sales_customer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sales_customer ON public.sales USING btree (customer_id);


--
-- Name: idx_sales_customer_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sales_customer_id ON public.sales USING btree (customer_id);


--
-- Name: idx_sales_date_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sales_date_status ON public.sales USING btree (created_at DESC, status) WHERE (status <> ALL (ARRAY['cancelled'::text, 'returned'::text]));


--
-- Name: idx_sales_fbr_invoice_number; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sales_fbr_invoice_number ON public.sales USING btree (fbr_invoice_number);


--
-- Name: idx_sales_fbr_number; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sales_fbr_number ON public.sales USING btree (fbr_invoice_number);


--
-- Name: idx_sales_sale_number; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sales_sale_number ON public.sales USING btree (sale_number);


--
-- Name: idx_sales_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sales_status ON public.sales USING btree (status);


--
-- Name: idx_sales_status_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sales_status_created_at ON public.sales USING btree (status, created_at DESC);


--
-- Name: idx_user_profiles_store; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_profiles_store ON public.user_profiles USING btree (store_id);


--
-- Name: spreadsheets spreadsheets_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER spreadsheets_updated_at BEFORE UPDATE ON public.spreadsheets FOR EACH ROW EXECUTE FUNCTION public.update_spreadsheets_updated_at();


--
-- Name: accounts update_accounts_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON public.accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: account_transactions update_balances_on_transaction; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_balances_on_transaction AFTER INSERT ON public.account_transactions FOR EACH ROW EXECUTE FUNCTION public.update_account_balance();


--
-- Name: bank_names update_bank_names_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_bank_names_updated_at BEFORE UPDATE ON public.bank_names FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: customers update_customers_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: forward_orders update_forward_orders_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_forward_orders_updated_at BEFORE UPDATE ON public.forward_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: held_carts update_held_carts_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_held_carts_updated_at BEFORE UPDATE ON public.held_carts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: product_categories update_product_categories_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_product_categories_updated_at BEFORE UPDATE ON public.product_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: products update_products_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: stores update_stores_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_stores_updated_at BEFORE UPDATE ON public.stores FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: user_profiles update_user_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: account_transactions account_transactions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.account_transactions
    ADD CONSTRAINT account_transactions_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: account_transactions account_transactions_from_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.account_transactions
    ADD CONSTRAINT account_transactions_from_account_id_fkey FOREIGN KEY (from_account_id) REFERENCES public.accounts(id);


--
-- Name: account_transactions account_transactions_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.account_transactions
    ADD CONSTRAINT account_transactions_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id);


--
-- Name: account_transactions account_transactions_to_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.account_transactions
    ADD CONSTRAINT account_transactions_to_account_id_fkey FOREIGN KEY (to_account_id) REFERENCES public.accounts(id);


--
-- Name: accounts accounts_bank_name_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_bank_name_id_fkey FOREIGN KEY (bank_name_id) REFERENCES public.bank_names(id);


--
-- Name: credit_sales credit_sales_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.credit_sales
    ADD CONSTRAINT credit_sales_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: credit_sales credit_sales_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.credit_sales
    ADD CONSTRAINT credit_sales_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.accounts(id);


--
-- Name: credit_sales credit_sales_sale_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.credit_sales
    ADD CONSTRAINT credit_sales_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES public.sales(id);


--
-- Name: credit_sales credit_sales_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.credit_sales
    ADD CONSTRAINT credit_sales_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id);


--
-- Name: daily_expenses daily_expenses_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.daily_expenses
    ADD CONSTRAINT daily_expenses_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: daily_reconciliations daily_reconciliations_closed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.daily_reconciliations
    ADD CONSTRAINT daily_reconciliations_closed_by_fkey FOREIGN KEY (closed_by) REFERENCES auth.users(id);


--
-- Name: forward_orders forward_orders_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.forward_orders
    ADD CONSTRAINT forward_orders_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: forward_orders forward_orders_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.forward_orders
    ADD CONSTRAINT forward_orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: held_carts held_carts_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.held_carts
    ADD CONSTRAINT held_carts_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES auth.users(id);


--
-- Name: held_carts held_carts_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.held_carts
    ADD CONSTRAINT held_carts_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: held_carts held_carts_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.held_carts
    ADD CONSTRAINT held_carts_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.accounts(id) ON DELETE SET NULL;


--
-- Name: held_carts held_carts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.held_carts
    ADD CONSTRAINT held_carts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: inventory_adjustments inventory_adjustments_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_adjustments
    ADD CONSTRAINT inventory_adjustments_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: inventory_adjustments inventory_adjustments_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_adjustments
    ADD CONSTRAINT inventory_adjustments_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: inventory_adjustments inventory_adjustments_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_adjustments
    ADD CONSTRAINT inventory_adjustments_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id);


--
-- Name: ledger_entries ledger_entries_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ledger_entries
    ADD CONSTRAINT ledger_entries_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id);


--
-- Name: online_order_items online_order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.online_order_items
    ADD CONSTRAINT online_order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.online_orders(id) ON DELETE CASCADE;


--
-- Name: online_order_items online_order_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.online_order_items
    ADD CONSTRAINT online_order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: online_orders online_orders_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.online_orders
    ADD CONSTRAINT online_orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.online_customers(id);


--
-- Name: online_orders online_orders_pos_sale_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.online_orders
    ADD CONSTRAINT online_orders_pos_sale_id_fkey FOREIGN KEY (pos_sale_id) REFERENCES public.sales(id);


--
-- Name: payments payments_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: payments payments_from_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_from_account_id_fkey FOREIGN KEY (from_account_id) REFERENCES public.accounts(id);


--
-- Name: payments payments_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id);


--
-- Name: payments payments_to_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_to_account_id_fkey FOREIGN KEY (to_account_id) REFERENCES public.accounts(id);


--
-- Name: product_variants product_variants_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_variants
    ADD CONSTRAINT product_variants_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: products products_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.product_categories(id);


--
-- Name: reconciliation_card_entries reconciliation_card_entries_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reconciliation_card_entries
    ADD CONSTRAINT reconciliation_card_entries_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: reconciliation_ibft_entries reconciliation_ibft_entries_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reconciliation_ibft_entries
    ADD CONSTRAINT reconciliation_ibft_entries_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: return_items return_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.return_items
    ADD CONSTRAINT return_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: return_items return_items_return_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.return_items
    ADD CONSTRAINT return_items_return_id_fkey FOREIGN KEY (return_id) REFERENCES public.returns(id) ON DELETE CASCADE;


--
-- Name: return_items return_items_sale_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.return_items
    ADD CONSTRAINT return_items_sale_item_id_fkey FOREIGN KEY (sale_item_id) REFERENCES public.sale_items(id);


--
-- Name: returns returns_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.returns
    ADD CONSTRAINT returns_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: returns returns_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.returns
    ADD CONSTRAINT returns_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.accounts(id);


--
-- Name: returns returns_original_sale_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.returns
    ADD CONSTRAINT returns_original_sale_id_fkey FOREIGN KEY (original_sale_id) REFERENCES public.sales(id);


--
-- Name: returns returns_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.returns
    ADD CONSTRAINT returns_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id);


--
-- Name: sale_items sale_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sale_items
    ADD CONSTRAINT sale_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: sale_items sale_items_sale_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sale_items
    ADD CONSTRAINT sale_items_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES public.sales(id) ON DELETE CASCADE;


--
-- Name: sales sales_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: sales sales_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.accounts(id);


--
-- Name: sales sales_deposit_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_deposit_account_id_fkey FOREIGN KEY (deposit_account_id) REFERENCES public.accounts(id);


--
-- Name: sales sales_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id);


--
-- Name: spreadsheets spreadsheets_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.spreadsheets
    ADD CONSTRAINT spreadsheets_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: stock_receipt_items stock_receipt_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_receipt_items
    ADD CONSTRAINT stock_receipt_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: stock_receipt_items stock_receipt_items_receipt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_receipt_items
    ADD CONSTRAINT stock_receipt_items_receipt_id_fkey FOREIGN KEY (receipt_id) REFERENCES public.stock_receipts(id) ON DELETE CASCADE;


--
-- Name: store_settings store_settings_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.store_settings
    ADD CONSTRAINT store_settings_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: user_profiles user_profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_profiles user_profiles_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id);


--
-- Name: user_route_permissions user_route_permissions_route_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_route_permissions
    ADD CONSTRAINT user_route_permissions_route_id_fkey FOREIGN KEY (route_id) REFERENCES public.app_routes(id) ON DELETE CASCADE;


--
-- Name: user_route_permissions user_route_permissions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_route_permissions
    ADD CONSTRAINT user_route_permissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;


--
-- Name: user_profiles Admins can delete profiles; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can delete profiles" ON public.user_profiles FOR DELETE TO authenticated USING (public.is_admin());


--
-- Name: bank_names Admins can manage bank names; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage bank names" ON public.bank_names TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: user_route_permissions Admins can manage permissions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage permissions" ON public.user_route_permissions TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: app_routes Admins can manage routes; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage routes" ON public.app_routes TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: stores Admins can manage stores; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage stores" ON public.stores TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = 'admin'::public.user_role)))));


--
-- Name: forward_orders All authenticated can create forward orders; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "All authenticated can create forward orders" ON public.forward_orders FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: product_categories All authenticated can view categories; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "All authenticated can view categories" ON public.product_categories FOR SELECT TO authenticated USING (true);


--
-- Name: forward_orders All authenticated can view forward orders; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "All authenticated can view forward orders" ON public.forward_orders FOR SELECT TO authenticated USING (true);


--
-- Name: app_routes All authenticated can view routes; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "All authenticated can view routes" ON public.app_routes FOR SELECT TO authenticated USING (true);


--
-- Name: daily_expenses Allow all authenticated users full access to daily_expenses; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow all authenticated users full access to daily_expenses" ON public.daily_expenses TO authenticated USING (true) WITH CHECK (true);


--
-- Name: daily_reconciliations Allow all authenticated users full access to daily_reconciliati; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow all authenticated users full access to daily_reconciliati" ON public.daily_reconciliations TO authenticated USING (true) WITH CHECK (true);


--
-- Name: reconciliation_card_entries Allow all authenticated users full access to reconciliation_car; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow all authenticated users full access to reconciliation_car" ON public.reconciliation_card_entries TO authenticated USING (true) WITH CHECK (true);


--
-- Name: reconciliation_ibft_entries Allow all authenticated users full access to reconciliation_ibf; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow all authenticated users full access to reconciliation_ibf" ON public.reconciliation_ibft_entries TO authenticated USING (true) WITH CHECK (true);


--
-- Name: online_customers Allow anon insert on online_customers; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow anon insert on online_customers" ON public.online_customers FOR INSERT TO authenticated, anon WITH CHECK (true);


--
-- Name: store_settings Allow anon insert on store_settings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow anon insert on store_settings" ON public.store_settings FOR INSERT TO authenticated, anon WITH CHECK (true);


--
-- Name: online_order_items Allow anon insert online_order_items; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow anon insert online_order_items" ON public.online_order_items FOR INSERT TO authenticated, anon WITH CHECK (true);


--
-- Name: online_orders Allow anon insert online_orders; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow anon insert online_orders" ON public.online_orders FOR INSERT TO authenticated, anon WITH CHECK (true);


--
-- Name: product_categories Allow anon select categories online; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow anon select categories online" ON public.product_categories FOR SELECT TO authenticated, anon USING (true);


--
-- Name: online_customers Allow anon select on online_customers; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow anon select on online_customers" ON public.online_customers FOR SELECT TO authenticated, anon USING (true);


--
-- Name: product_variants Allow anon select on product_variants; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow anon select on product_variants" ON public.product_variants FOR SELECT TO authenticated, anon USING (true);


--
-- Name: store_settings Allow anon select on store_settings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow anon select on store_settings" ON public.store_settings FOR SELECT TO authenticated, anon USING (true);


--
-- Name: online_order_items Allow anon select online_order_items; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow anon select online_order_items" ON public.online_order_items FOR SELECT TO authenticated, anon USING (true);


--
-- Name: online_orders Allow anon select online_orders; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow anon select online_orders" ON public.online_orders FOR SELECT TO authenticated, anon USING (true);


--
-- Name: products Allow anon select products online; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow anon select products online" ON public.products FOR SELECT TO authenticated, anon USING (true);


--
-- Name: online_customers Allow anon update on online_customers; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow anon update on online_customers" ON public.online_customers FOR UPDATE TO authenticated, anon USING (true) WITH CHECK (true);


--
-- Name: store_settings Allow anon update on store_settings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow anon update on store_settings" ON public.store_settings FOR UPDATE TO authenticated, anon USING (true) WITH CHECK (true);


--
-- Name: online_orders Allow anon update online_orders; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow anon update online_orders" ON public.online_orders FOR UPDATE TO authenticated, anon USING (true) WITH CHECK (true);


--
-- Name: product_categories Allow anonymous select on product_categories; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow anonymous select on product_categories" ON public.product_categories FOR SELECT TO authenticated, anon USING (true);


--
-- Name: products Allow anonymous select on products; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow anonymous select on products" ON public.products FOR SELECT TO authenticated, anon USING (true);


--
-- Name: returns Allow anonymous select on returns; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow anonymous select on returns" ON public.returns FOR SELECT TO authenticated, anon USING (true);


--
-- Name: sales Allow anonymous select on sales; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow anonymous select on sales" ON public.sales FOR SELECT TO authenticated, anon USING (true);


--
-- Name: online_customers Allow authenticated all on online_customers; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow authenticated all on online_customers" ON public.online_customers TO authenticated USING (true) WITH CHECK (true);


--
-- Name: product_variants Allow authenticated all on product_variants; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow authenticated all on product_variants" ON public.product_variants TO authenticated USING (true) WITH CHECK (true);


--
-- Name: store_settings Allow authenticated all on store_settings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow authenticated all on store_settings" ON public.store_settings TO authenticated USING (true) WITH CHECK (true);


--
-- Name: store_settings Allow authenticated insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow authenticated insert" ON public.store_settings FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: store_settings Allow authenticated update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow authenticated update" ON public.store_settings FOR UPDATE TO authenticated USING (true);


--
-- Name: user_profiles Allow profile creation; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow profile creation" ON public.user_profiles FOR INSERT TO authenticated WITH CHECK (((id = auth.uid()) OR public.is_admin()));


--
-- Name: store_settings Allow public read access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow public read access" ON public.store_settings FOR SELECT USING (true);


--
-- Name: stock_receipt_items Enable all access for authenticated users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable all access for authenticated users" ON public.stock_receipt_items USING ((auth.role() = 'authenticated'::text));


--
-- Name: stock_receipts Enable all access for authenticated users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable all access for authenticated users" ON public.stock_receipts USING ((auth.role() = 'authenticated'::text));


--
-- Name: accounts Enable insert access for all users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable insert access for all users" ON public.accounts FOR INSERT WITH CHECK (true);


--
-- Name: bank_names Enable insert access for all users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable insert access for all users" ON public.bank_names FOR INSERT WITH CHECK (true);


--
-- Name: ledger_entries Enable insert access for all users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable insert access for all users" ON public.ledger_entries FOR INSERT WITH CHECK (true);


--
-- Name: accounts Enable read access for all users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable read access for all users" ON public.accounts FOR SELECT USING (true);


--
-- Name: bank_names Enable read access for all users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable read access for all users" ON public.bank_names FOR SELECT USING (true);


--
-- Name: products Enable stock update for authenticated users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable stock update for authenticated users" ON public.products FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: accounts Enable update access for all users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable update access for all users" ON public.accounts FOR UPDATE USING (true) WITH CHECK (true);


--
-- Name: sales Enable update for authenticated users on sales; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable update for authenticated users on sales" ON public.sales FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: bank_names Everyone can view bank names; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Everyone can view bank names" ON public.bank_names FOR SELECT TO authenticated USING (true);


--
-- Name: product_categories Managers and admins can manage categories; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Managers and admins can manage categories" ON public.product_categories TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: customers Managers and admins can manage customers; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Managers and admins can manage customers" ON public.customers TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = ANY (ARRAY['admin'::public.user_role, 'manager'::public.user_role]))))));


--
-- Name: forward_orders Managers and admins can manage forward orders; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Managers and admins can manage forward orders" ON public.forward_orders TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: inventory_adjustments Managers can create inventory adjustments; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Managers can create inventory adjustments" ON public.inventory_adjustments FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = ANY (ARRAY['admin'::public.user_role, 'manager'::public.user_role]))))));


--
-- Name: accounts Managers can manage accounts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Managers can manage accounts" ON public.accounts TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = ANY (ARRAY['admin'::public.user_role, 'manager'::public.user_role]))))));


--
-- Name: fbr_integration_log System can manage FBR logs; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "System can manage FBR logs" ON public.fbr_integration_log TO authenticated USING (true);


--
-- Name: account_transactions Users can create account transactions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can create account transactions" ON public.account_transactions FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: credit_sales Users can create credit sales; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can create credit sales" ON public.credit_sales FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: customers Users can create customers; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can create customers" ON public.customers FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: ledger_entries Users can create ledger entries; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can create ledger entries" ON public.ledger_entries FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: payments Users can create payments; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can create payments" ON public.payments FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: return_items Users can create return items; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can create return items" ON public.return_items FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: returns Users can create returns; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can create returns" ON public.returns FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: sale_items Users can create sale items; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can create sale items" ON public.sale_items FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: sales Users can create sales; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can create sales" ON public.sales FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: spreadsheets Users can delete their own spreadsheets; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can delete their own spreadsheets" ON public.spreadsheets FOR DELETE USING ((auth.uid() = created_by));


--
-- Name: spreadsheets Users can insert their own spreadsheets; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert their own spreadsheets" ON public.spreadsheets FOR INSERT WITH CHECK ((auth.uid() = created_by));


--
-- Name: held_carts Users can manage own held carts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can manage own held carts" ON public.held_carts TO authenticated USING (((created_by = auth.uid()) OR (assigned_to = auth.uid()) OR public.is_admin())) WITH CHECK (((created_by = auth.uid()) OR (assigned_to = auth.uid()) OR public.is_admin()));


--
-- Name: credit_sales Users can update credit sales; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update credit sales" ON public.credit_sales FOR UPDATE TO authenticated USING (true);


--
-- Name: user_profiles Users can update own profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update own profile" ON public.user_profiles FOR UPDATE TO authenticated USING (((id = auth.uid()) OR public.is_admin())) WITH CHECK (((id = auth.uid()) OR public.is_admin()));


--
-- Name: products Users can update products for restocking; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update products for restocking" ON public.products FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: returns Users can update returns; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update returns" ON public.returns FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: sale_items Users can update sale_items; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update sale_items" ON public.sale_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: spreadsheets Users can update their own spreadsheets; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update their own spreadsheets" ON public.spreadsheets FOR UPDATE USING ((auth.uid() = created_by));


--
-- Name: fbr_integration_log Users can view FBR logs; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view FBR logs" ON public.fbr_integration_log FOR SELECT TO authenticated USING (true);


--
-- Name: account_transactions Users can view account transactions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view account transactions" ON public.account_transactions FOR SELECT TO authenticated USING (true);


--
-- Name: accounts Users can view accounts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view accounts" ON public.accounts FOR SELECT TO authenticated USING (true);


--
-- Name: credit_sales Users can view credit sales; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view credit sales" ON public.credit_sales FOR SELECT TO authenticated USING (true);


--
-- Name: customers Users can view customers; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view customers" ON public.customers FOR SELECT TO authenticated USING (true);


--
-- Name: inventory_adjustments Users can view inventory adjustments; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view inventory adjustments" ON public.inventory_adjustments FOR SELECT TO authenticated USING (true);


--
-- Name: ledger_entries Users can view ledger entries; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view ledger entries" ON public.ledger_entries FOR SELECT TO authenticated USING (true);


--
-- Name: held_carts Users can view own held carts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own held carts" ON public.held_carts FOR SELECT TO authenticated USING (((created_by = auth.uid()) OR (assigned_to = auth.uid()) OR public.is_admin()));


--
-- Name: user_route_permissions Users can view own permissions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own permissions" ON public.user_route_permissions FOR SELECT TO authenticated USING (((auth.uid() = user_id) OR public.is_admin()));


--
-- Name: user_profiles Users can view own profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own profile" ON public.user_profiles FOR SELECT TO authenticated USING (((id = auth.uid()) OR public.is_admin()));


--
-- Name: payments Users can view payments; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view payments" ON public.payments FOR SELECT TO authenticated USING (true);


--
-- Name: products Users can view products; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view products" ON public.products FOR SELECT TO authenticated USING (true);


--
-- Name: return_items Users can view return items; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view return items" ON public.return_items FOR SELECT TO authenticated USING (true);


--
-- Name: returns Users can view returns; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view returns" ON public.returns FOR SELECT TO authenticated USING (true);


--
-- Name: sale_items Users can view sale items; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view sale items" ON public.sale_items FOR SELECT TO authenticated USING (true);


--
-- Name: sales Users can view sales; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view sales" ON public.sales FOR SELECT TO authenticated USING (true);


--
-- Name: stores Users can view stores; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view stores" ON public.stores FOR SELECT TO authenticated USING (true);


--
-- Name: spreadsheets Users can view their own spreadsheets; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view their own spreadsheets" ON public.spreadsheets FOR SELECT USING ((auth.uid() = created_by));


--
-- Name: products Users with product route access can manage products; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users with product route access can manage products" ON public.products TO authenticated USING (public.has_route_access(auth.uid(), '/products'::text)) WITH CHECK (public.has_route_access(auth.uid(), '/products'::text));


--
-- Name: account_transactions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.account_transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: accounts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

--
-- Name: app_routes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.app_routes ENABLE ROW LEVEL SECURITY;

--
-- Name: bank_names; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.bank_names ENABLE ROW LEVEL SECURITY;

--
-- Name: credit_sales; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.credit_sales ENABLE ROW LEVEL SECURITY;

--
-- Name: customers; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

--
-- Name: daily_expenses; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.daily_expenses ENABLE ROW LEVEL SECURITY;

--
-- Name: daily_reconciliations; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.daily_reconciliations ENABLE ROW LEVEL SECURITY;

--
-- Name: fbr_integration_log; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.fbr_integration_log ENABLE ROW LEVEL SECURITY;

--
-- Name: forward_orders; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.forward_orders ENABLE ROW LEVEL SECURITY;

--
-- Name: held_carts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.held_carts ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_adjustments; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.inventory_adjustments ENABLE ROW LEVEL SECURITY;

--
-- Name: ledger_entries; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: online_customers; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.online_customers ENABLE ROW LEVEL SECURITY;

--
-- Name: online_order_items; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.online_order_items ENABLE ROW LEVEL SECURITY;

--
-- Name: online_orders; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.online_orders ENABLE ROW LEVEL SECURITY;

--
-- Name: payments; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

--
-- Name: product_categories; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

--
-- Name: product_variants; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

--
-- Name: products; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

--
-- Name: reconciliation_card_entries; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.reconciliation_card_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: reconciliation_ibft_entries; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.reconciliation_ibft_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: return_items; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.return_items ENABLE ROW LEVEL SECURITY;

--
-- Name: returns; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;

--
-- Name: sale_items; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;

--
-- Name: sales; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

--
-- Name: spreadsheets; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.spreadsheets ENABLE ROW LEVEL SECURITY;

--
-- Name: stock_receipt_items; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.stock_receipt_items ENABLE ROW LEVEL SECURITY;

--
-- Name: stock_receipts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.stock_receipts ENABLE ROW LEVEL SECURITY;

--
-- Name: store_settings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: stores; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

--
-- Name: user_profiles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: user_route_permissions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.user_route_permissions ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION get_next_sequence(seq_id text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_next_sequence(seq_id text) TO anon;
GRANT ALL ON FUNCTION public.get_next_sequence(seq_id text) TO authenticated;
GRANT ALL ON FUNCTION public.get_next_sequence(seq_id text) TO service_role;


--
-- Name: FUNCTION get_user_page_type_for_cart(_user_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_user_page_type_for_cart(_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_user_page_type_for_cart(_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_user_page_type_for_cart(_user_id uuid) TO service_role;


--
-- Name: FUNCTION get_user_routes(_user_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_user_routes(_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_user_routes(_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_user_routes(_user_id uuid) TO service_role;


--
-- Name: FUNCTION handle_new_user(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.handle_new_user() TO anon;
GRANT ALL ON FUNCTION public.handle_new_user() TO authenticated;
GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;


--
-- Name: FUNCTION has_role(_user_id uuid, _role text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.has_role(_user_id uuid, _role text) TO anon;
GRANT ALL ON FUNCTION public.has_role(_user_id uuid, _role text) TO authenticated;
GRANT ALL ON FUNCTION public.has_role(_user_id uuid, _role text) TO service_role;


--
-- Name: FUNCTION has_route_access(_user_id uuid, _route_path text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.has_route_access(_user_id uuid, _route_path text) TO anon;
GRANT ALL ON FUNCTION public.has_route_access(_user_id uuid, _route_path text) TO authenticated;
GRANT ALL ON FUNCTION public.has_route_access(_user_id uuid, _route_path text) TO service_role;


--
-- Name: FUNCTION is_admin(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.is_admin() TO anon;
GRANT ALL ON FUNCTION public.is_admin() TO authenticated;
GRANT ALL ON FUNCTION public.is_admin() TO service_role;


--
-- Name: FUNCTION process_credit_sale_completion(p_credit_sale_id uuid, p_payment_method text, p_amount_received numeric, p_change_amount numeric); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.process_credit_sale_completion(p_credit_sale_id uuid, p_payment_method text, p_amount_received numeric, p_change_amount numeric) TO anon;
GRANT ALL ON FUNCTION public.process_credit_sale_completion(p_credit_sale_id uuid, p_payment_method text, p_amount_received numeric, p_change_amount numeric) TO authenticated;
GRANT ALL ON FUNCTION public.process_credit_sale_completion(p_credit_sale_id uuid, p_payment_method text, p_amount_received numeric, p_change_amount numeric) TO service_role;


--
-- Name: FUNCTION process_sale_transaction(sale_data jsonb, items_data jsonb); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.process_sale_transaction(sale_data jsonb, items_data jsonb) TO anon;
GRANT ALL ON FUNCTION public.process_sale_transaction(sale_data jsonb, items_data jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.process_sale_transaction(sale_data jsonb, items_data jsonb) TO service_role;


--
-- Name: FUNCTION update_account_balance(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.update_account_balance() TO anon;
GRANT ALL ON FUNCTION public.update_account_balance() TO authenticated;
GRANT ALL ON FUNCTION public.update_account_balance() TO service_role;


--
-- Name: FUNCTION update_sale_payment_method(p_sale_id uuid, p_new_method text, p_amount_received numeric, p_new_account_id uuid, p_payment_splits jsonb, p_updated_by uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.update_sale_payment_method(p_sale_id uuid, p_new_method text, p_amount_received numeric, p_new_account_id uuid, p_payment_splits jsonb, p_updated_by uuid) TO anon;
GRANT ALL ON FUNCTION public.update_sale_payment_method(p_sale_id uuid, p_new_method text, p_amount_received numeric, p_new_account_id uuid, p_payment_splits jsonb, p_updated_by uuid) TO authenticated;
GRANT ALL ON FUNCTION public.update_sale_payment_method(p_sale_id uuid, p_new_method text, p_amount_received numeric, p_new_account_id uuid, p_payment_splits jsonb, p_updated_by uuid) TO service_role;


--
-- Name: FUNCTION update_spreadsheets_updated_at(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.update_spreadsheets_updated_at() TO anon;
GRANT ALL ON FUNCTION public.update_spreadsheets_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.update_spreadsheets_updated_at() TO service_role;


--
-- Name: FUNCTION update_updated_at_column(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.update_updated_at_column() TO anon;
GRANT ALL ON FUNCTION public.update_updated_at_column() TO authenticated;
GRANT ALL ON FUNCTION public.update_updated_at_column() TO service_role;


--
-- Name: TABLE account_transactions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.account_transactions TO anon;
GRANT ALL ON TABLE public.account_transactions TO authenticated;
GRANT ALL ON TABLE public.account_transactions TO service_role;


--
-- Name: TABLE accounts; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.accounts TO anon;
GRANT ALL ON TABLE public.accounts TO authenticated;
GRANT ALL ON TABLE public.accounts TO service_role;


--
-- Name: TABLE app_routes; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.app_routes TO anon;
GRANT ALL ON TABLE public.app_routes TO authenticated;
GRANT ALL ON TABLE public.app_routes TO service_role;


--
-- Name: TABLE bank_names; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.bank_names TO anon;
GRANT ALL ON TABLE public.bank_names TO authenticated;
GRANT ALL ON TABLE public.bank_names TO service_role;


--
-- Name: SEQUENCE credit_sale_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.credit_sale_seq TO anon;
GRANT ALL ON SEQUENCE public.credit_sale_seq TO authenticated;
GRANT ALL ON SEQUENCE public.credit_sale_seq TO service_role;


--
-- Name: TABLE credit_sales; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.credit_sales TO anon;
GRANT ALL ON TABLE public.credit_sales TO authenticated;
GRANT ALL ON TABLE public.credit_sales TO service_role;


--
-- Name: TABLE customers; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.customers TO anon;
GRANT ALL ON TABLE public.customers TO authenticated;
GRANT ALL ON TABLE public.customers TO service_role;


--
-- Name: TABLE daily_expenses; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.daily_expenses TO anon;
GRANT ALL ON TABLE public.daily_expenses TO authenticated;
GRANT ALL ON TABLE public.daily_expenses TO service_role;


--
-- Name: TABLE daily_reconciliations; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.daily_reconciliations TO anon;
GRANT ALL ON TABLE public.daily_reconciliations TO authenticated;
GRANT ALL ON TABLE public.daily_reconciliations TO service_role;


--
-- Name: TABLE fbr_integration_log; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.fbr_integration_log TO anon;
GRANT ALL ON TABLE public.fbr_integration_log TO authenticated;
GRANT ALL ON TABLE public.fbr_integration_log TO service_role;


--
-- Name: TABLE forward_orders; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.forward_orders TO anon;
GRANT ALL ON TABLE public.forward_orders TO authenticated;
GRANT ALL ON TABLE public.forward_orders TO service_role;


--
-- Name: TABLE held_carts; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.held_carts TO anon;
GRANT ALL ON TABLE public.held_carts TO authenticated;
GRANT ALL ON TABLE public.held_carts TO service_role;


--
-- Name: TABLE inventory_adjustments; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.inventory_adjustments TO anon;
GRANT ALL ON TABLE public.inventory_adjustments TO authenticated;
GRANT ALL ON TABLE public.inventory_adjustments TO service_role;


--
-- Name: TABLE ledger_entries; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.ledger_entries TO anon;
GRANT ALL ON TABLE public.ledger_entries TO authenticated;
GRANT ALL ON TABLE public.ledger_entries TO service_role;


--
-- Name: TABLE online_customers; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.online_customers TO anon;
GRANT ALL ON TABLE public.online_customers TO authenticated;
GRANT ALL ON TABLE public.online_customers TO service_role;


--
-- Name: TABLE online_order_items; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.online_order_items TO anon;
GRANT ALL ON TABLE public.online_order_items TO authenticated;
GRANT ALL ON TABLE public.online_order_items TO service_role;


--
-- Name: TABLE online_orders; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.online_orders TO anon;
GRANT ALL ON TABLE public.online_orders TO authenticated;
GRANT ALL ON TABLE public.online_orders TO service_role;


--
-- Name: TABLE payments; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.payments TO anon;
GRANT ALL ON TABLE public.payments TO authenticated;
GRANT ALL ON TABLE public.payments TO service_role;


--
-- Name: TABLE product_categories; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.product_categories TO anon;
GRANT ALL ON TABLE public.product_categories TO authenticated;
GRANT ALL ON TABLE public.product_categories TO service_role;


--
-- Name: TABLE product_variants; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.product_variants TO anon;
GRANT ALL ON TABLE public.product_variants TO authenticated;
GRANT ALL ON TABLE public.product_variants TO service_role;


--
-- Name: TABLE products; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.products TO anon;
GRANT ALL ON TABLE public.products TO authenticated;
GRANT ALL ON TABLE public.products TO service_role;


--
-- Name: TABLE reconciliation_card_entries; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.reconciliation_card_entries TO anon;
GRANT ALL ON TABLE public.reconciliation_card_entries TO authenticated;
GRANT ALL ON TABLE public.reconciliation_card_entries TO service_role;


--
-- Name: TABLE reconciliation_ibft_entries; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.reconciliation_ibft_entries TO anon;
GRANT ALL ON TABLE public.reconciliation_ibft_entries TO authenticated;
GRANT ALL ON TABLE public.reconciliation_ibft_entries TO service_role;


--
-- Name: TABLE return_items; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.return_items TO anon;
GRANT ALL ON TABLE public.return_items TO authenticated;
GRANT ALL ON TABLE public.return_items TO service_role;


--
-- Name: TABLE returns; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.returns TO anon;
GRANT ALL ON TABLE public.returns TO authenticated;
GRANT ALL ON TABLE public.returns TO service_role;


--
-- Name: TABLE sale_items; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.sale_items TO anon;
GRANT ALL ON TABLE public.sale_items TO authenticated;
GRANT ALL ON TABLE public.sale_items TO service_role;


--
-- Name: TABLE sales; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.sales TO anon;
GRANT ALL ON TABLE public.sales TO authenticated;
GRANT ALL ON TABLE public.sales TO service_role;


--
-- Name: TABLE sequences; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.sequences TO anon;
GRANT ALL ON TABLE public.sequences TO authenticated;
GRANT ALL ON TABLE public.sequences TO service_role;


--
-- Name: TABLE spreadsheets; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.spreadsheets TO anon;
GRANT ALL ON TABLE public.spreadsheets TO authenticated;
GRANT ALL ON TABLE public.spreadsheets TO service_role;


--
-- Name: TABLE stock_receipt_items; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.stock_receipt_items TO anon;
GRANT ALL ON TABLE public.stock_receipt_items TO authenticated;
GRANT ALL ON TABLE public.stock_receipt_items TO service_role;


--
-- Name: SEQUENCE stock_receipt_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.stock_receipt_seq TO anon;
GRANT ALL ON SEQUENCE public.stock_receipt_seq TO authenticated;
GRANT ALL ON SEQUENCE public.stock_receipt_seq TO service_role;


--
-- Name: TABLE stock_receipts; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.stock_receipts TO anon;
GRANT ALL ON TABLE public.stock_receipts TO authenticated;
GRANT ALL ON TABLE public.stock_receipts TO service_role;


--
-- Name: TABLE store_settings; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.store_settings TO anon;
GRANT ALL ON TABLE public.store_settings TO authenticated;
GRANT ALL ON TABLE public.store_settings TO service_role;


--
-- Name: TABLE stores; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.stores TO anon;
GRANT ALL ON TABLE public.stores TO authenticated;
GRANT ALL ON TABLE public.stores TO service_role;


--
-- Name: TABLE user_profiles; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.user_profiles TO anon;
GRANT ALL ON TABLE public.user_profiles TO authenticated;
GRANT ALL ON TABLE public.user_profiles TO service_role;


--
-- Name: TABLE user_route_permissions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.user_route_permissions TO anon;
GRANT ALL ON TABLE public.user_route_permissions TO authenticated;
GRANT ALL ON TABLE public.user_route_permissions TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict UW7jeopUSbdefwGmoald1OXYd26FfHKso1D83aVjPEGme8eQZ1fva65INusJPIl

