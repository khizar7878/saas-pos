-- SaaS Multi-Tenant Core RPC Functions

-- 1. get_next_sequence fallback wrapper
CREATE OR REPLACE FUNCTION public.get_next_sequence(p_seq_id text)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
    RETURN public.get_next_sequence_for_store(p_seq_id, COALESCE(public.current_store_id(), '11111111-1111-1111-1111-111111111111'::uuid));
END;
$$;

-- 2. Multi-tenant process_sale_transaction
CREATE OR REPLACE FUNCTION public.process_sale_transaction(sale_data jsonb, items_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    v_store_id UUID;
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
    v_current_balance NUMERIC;
    v_new_balance NUMERIC;
    v_result JSONB;
BEGIN
    -- Determine target store_id
    v_store_id := COALESCE(
        NULLIF(sale_data->>'store_id', '')::UUID,
        public.current_store_id(),
        '11111111-1111-1111-1111-111111111111'::UUID
    );

    v_customer_id := NULLIF(sale_data->>'customer_id', '')::UUID;
    v_total_amount := (sale_data->>'total_amount')::NUMERIC;
    v_payment_method := sale_data->>'payment_method';
    v_sale_type := COALESCE(sale_data->>'sale_type', 'counter');

    -- =====================================================================================
    -- 1. HANDLING CREDIT SALE (Pending)
    -- =====================================================================================
    IF v_payment_method = 'credit' THEN
        INSERT INTO public.credit_sales (
            store_id,
            customer_id,
            customer_name,
            customer_phone,
            bill_number,
            total_amount,
            paid_amount,
            balance_amount,
            items,
            status,
            created_by,
            received_by
        ) VALUES (
            v_store_id,
            v_customer_id,
            sale_data->>'customer_name',
            sale_data->>'customer_phone',
            public.get_next_sequence_for_store('credit_sale', v_store_id),
            v_total_amount,
            0,
            v_total_amount,
            items_data,
            'pending',
            auth.uid(),
            sale_data->>'received_by'
        ) RETURNING jsonb_build_object('id', id, 'bill_number', bill_number, 'type', 'credit_sale') INTO v_result;

        -- Update Customer Account Balance & Ledger
        IF v_customer_id IS NOT NULL THEN
            SELECT current_balance INTO v_current_balance FROM public.accounts WHERE id = v_customer_id AND store_id = v_store_id;
            IF v_current_balance IS NOT NULL THEN
                v_new_balance := v_current_balance + v_total_amount;
                UPDATE public.accounts SET current_balance = v_new_balance WHERE id = v_customer_id;

                INSERT INTO public.ledger_entries (
                    store_id, account_id, reference_type, reference_id, description, debit, credit, balance, created_at
                ) VALUES (
                    v_store_id, v_customer_id, 'credit_sale', (v_result->>'id')::UUID,
                    'Credit Sale Bill #' || (v_result->>'bill_number'),
                    v_total_amount, 0, v_new_balance, NOW()
                );
            END IF;
        END IF;

        -- Deduct Inventory Stock
        IF v_sale_type != 'delivery' THEN
            FOR v_item IN SELECT * FROM jsonb_array_elements(items_data)
            LOOP
                v_product_id := (v_item->>'product_id')::UUID;
                v_quantity := (v_item->>'quantity')::NUMERIC;

                UPDATE public.products
                SET stock_quantity = GREATEST(0, stock_quantity - v_quantity)
                WHERE id = v_product_id AND store_id = v_store_id;
            END LOOP;
        END IF;

        RETURN v_result;
    END IF;

    -- =====================================================================================
    -- 2. HANDLING STANDARD COMPLETED SALE
    -- =====================================================================================
    v_sale_number := public.get_next_sequence_for_store('sale', v_store_id);

    -- Resolve Deposit Account
    IF (sale_data->>'deposit_account_id') IS NOT NULL AND (sale_data->>'deposit_account_id') != '' THEN
        v_deposit_account_id := (sale_data->>'deposit_account_id')::UUID;
    ELSIF v_payment_method = 'cash' THEN
        SELECT id INTO v_deposit_account_id
        FROM public.accounts
        WHERE store_id = v_store_id AND account_subtype = 'cash_in_hand' AND is_active = true
        LIMIT 1;
    END IF;

    -- Insert Master Sale Record
    INSERT INTO public.sales (
        store_id,
        sale_number,
        customer_id,
        customer_name,
        customer_phone,
        subtotal,
        discount,
        discount_amount,
        discount_percent,
        total_amount,
        amount_received,
        change_amount,
        payment_method,
        payment_details,
        deposit_account_id,
        created_by,
        status,
        sale_type,
        notes,
        created_at
    ) VALUES (
        v_store_id,
        v_sale_number,
        v_customer_id,
        COALESCE(sale_data->>'customer_name', 'Walk-in'),
        sale_data->>'customer_phone',
        COALESCE((sale_data->>'subtotal')::NUMERIC, v_total_amount),
        COALESCE((sale_data->>'discount')::NUMERIC, 0),
        COALESCE((sale_data->>'discount_amount')::NUMERIC, 0),
        COALESCE((sale_data->>'discount_percent')::NUMERIC, 0),
        v_total_amount,
        COALESCE((sale_data->>'amount_received')::NUMERIC, v_total_amount),
        COALESCE((sale_data->>'change_amount')::NUMERIC, 0),
        v_payment_method::public.payment_method,
        sale_data->'payment_details',
        v_deposit_account_id,
        auth.uid(),
        'completed',
        v_sale_type::public.sale_type,
        sale_data->>'notes',
        NOW()
    ) RETURNING id INTO v_sale_id;

    -- Insert Line Items & Deduct Stock
    FOR v_item IN SELECT * FROM jsonb_array_elements(items_data)
    LOOP
        v_product_id := (v_item->>'product_id')::UUID;
        v_quantity := (v_item->>'quantity')::NUMERIC;

        INSERT INTO public.sale_items (
            sale_id,
            product_id,
            product_name,
            quantity,
            unit_price,
            total_price,
            tax_percentage,
            tax_amount,
            pct_code,
            discount
        ) VALUES (
            v_sale_id,
            v_product_id,
            v_item->>'product_name',
            v_quantity::INTEGER,
            (v_item->>'unit_price')::NUMERIC,
            (v_item->>'total_price')::NUMERIC,
            COALESCE((v_item->>'tax_percentage')::NUMERIC, 0),
            COALESCE((v_item->>'tax_amount')::NUMERIC, 0),
            COALESCE(v_item->>'pct_code', '01011000'),
            COALESCE((v_item->>'discount')::NUMERIC, 0)
        );

        IF v_sale_type != 'delivery' AND v_product_id IS NOT NULL THEN
            UPDATE public.products
            SET stock_quantity = GREATEST(0, stock_quantity - v_quantity)
            WHERE id = v_product_id AND store_id = v_store_id;
        END IF;
    END LOOP;

    -- Update Cash in Hand Account & Ledger
    IF v_deposit_account_id IS NOT NULL THEN
        SELECT current_balance INTO v_current_balance FROM public.accounts WHERE id = v_deposit_account_id;
        IF v_current_balance IS NOT NULL THEN
            v_new_balance := v_current_balance + v_total_amount;
            UPDATE public.accounts SET current_balance = v_new_balance WHERE id = v_deposit_account_id;

            INSERT INTO public.ledger_entries (
                store_id, account_id, reference_type, reference_id, description, debit, credit, balance
            ) VALUES (
                v_store_id, v_deposit_account_id, 'sale', v_sale_id,
                UPPER(v_payment_method) || ' Sale #' || v_sale_number,
                v_total_amount, 0, v_new_balance
            );
        END IF;
    END IF;

    -- Return created sale object
    SELECT jsonb_build_object(
        'id', id,
        'sale_number', sale_number,
        'total_amount', total_amount,
        'created_at', created_at,
        'type', 'sale'
    ) INTO v_result FROM public.sales WHERE id = v_sale_id;

    RETURN v_result;
END;
$$;

-- 3. Multi-tenant process_credit_sale_completion
CREATE OR REPLACE FUNCTION public.process_credit_sale_completion(
    p_credit_sale_id uuid,
    p_payment_method text,
    p_amount_received numeric,
    p_change_amount numeric
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    v_credit_sale RECORD;
    v_store_id UUID;
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
    SELECT * INTO v_credit_sale FROM public.credit_sales WHERE id = p_credit_sale_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Credit sale not found';
    END IF;

    IF v_credit_sale.status = 'completed' THEN
        RAISE EXCEPTION 'Bill already settled';
    END IF;

    v_store_id := v_credit_sale.store_id;
    v_sale_number := public.get_next_sequence_for_store('sale', v_store_id);

    IF p_payment_method = 'cash' THEN
        SELECT id INTO v_cash_account_id
        FROM public.accounts
        WHERE store_id = v_store_id AND account_subtype = 'cash_in_hand' AND is_active = true
        LIMIT 1;
        v_deposit_account_id := v_cash_account_id;
    END IF;

    INSERT INTO public.sales (
        store_id,
        sale_number,
        customer_id,
        customer_name,
        customer_phone,
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
        v_store_id,
        v_sale_number,
        v_credit_sale.customer_id,
        v_credit_sale.customer_name,
        v_credit_sale.customer_phone,
        v_credit_sale.total_amount,
        0,
        v_credit_sale.total_amount,
        p_payment_method::public.payment_method,
        p_amount_received,
        p_change_amount,
        v_deposit_account_id,
        'completed',
        NOW(),
        'counter'
    ) RETURNING id INTO v_sale_id;

    -- Process Remaining Net Items
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
            v_line_tax := CASE 
                WHEN COALESCE(v_item.tax_percentage, 0) > 0 THEN (v_line_total - (v_line_total / (1 + (v_item.tax_percentage / 100))))
                ELSE 0 
            END;

            INSERT INTO public.sale_items (
                sale_id,
                product_id,
                product_name,
                quantity,
                unit_price,
                total_price,
                tax_percentage,
                tax_amount,
                pct_code,
                discount
            ) VALUES (
                v_sale_id,
                v_item.product_id,
                v_item.product_name,
                v_net_quantity::INTEGER,
                v_item.unit_price,
                v_line_total,
                COALESCE(v_item.tax_percentage, 0),
                v_line_tax,
                COALESCE(v_item.pct_code, '01011000'),
                COALESCE(v_item.discount, 0)
            );

            v_sanitized_items := v_sanitized_items || jsonb_build_object(
                'product_id', v_item.product_id,
                'product_name', v_item.product_name,
                'quantity', v_net_quantity,
                'unit_price', v_item.unit_price,
                'total_price', v_line_total,
                'tax_percentage', COALESCE(v_item.tax_percentage, 0),
                'tax_amount', v_line_tax,
                'pct_code', COALESCE(v_item.pct_code, '01011000')
            );
        END IF;
    END LOOP;

    -- Update Credit Sale Status
    UPDATE public.credit_sales
    SET status = 'completed',
        sale_id = v_sale_id,
        paid_amount = v_credit_sale.total_amount,
        balance_amount = 0,
        updated_at = NOW()
    WHERE id = p_credit_sale_id;

    -- Update Customer Receivable Balance
    IF v_credit_sale.customer_id IS NOT NULL THEN
        SELECT current_balance INTO v_customer_balance FROM public.accounts WHERE id = v_credit_sale.customer_id;
        IF v_customer_balance IS NOT NULL THEN
            v_new_customer_balance := v_customer_balance - v_credit_sale.total_amount;
            UPDATE public.accounts SET current_balance = v_new_customer_balance WHERE id = v_credit_sale.customer_id;

            INSERT INTO public.ledger_entries (
                store_id, account_id, reference_type, reference_id, description, debit, credit, balance
            ) VALUES (
                v_store_id, v_credit_sale.customer_id, 'payment', v_sale_id,
                'Settlement of Bill #' || v_credit_sale.bill_number || ' (Sale #' || v_sale_number || ')',
                0, v_credit_sale.total_amount, v_new_customer_balance
            );
        END IF;
    END IF;

    -- Update Cash in Hand
    IF v_deposit_account_id IS NOT NULL THEN
        SELECT current_balance INTO v_current_balance FROM public.accounts WHERE id = v_deposit_account_id;
        IF v_current_balance IS NOT NULL THEN
            v_new_balance := v_current_balance + v_credit_sale.total_amount;
            UPDATE public.accounts SET current_balance = v_new_balance WHERE id = v_deposit_account_id;

            INSERT INTO public.ledger_entries (
                store_id, account_id, reference_type, reference_id, description, debit, credit, balance
            ) VALUES (
                v_store_id, v_deposit_account_id, 'sale', v_sale_id,
                UPPER(p_payment_method) || ' Credit Bill Settlement #' || v_credit_sale.bill_number,
                v_credit_sale.total_amount, 0, v_new_balance
            );
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'sale_id', v_sale_id,
        'sale_number', v_sale_number,
        'total_amount', v_credit_sale.total_amount,
        'customer_name', v_credit_sale.customer_name,
        'items', v_sanitized_items
    );
END;
$$;
