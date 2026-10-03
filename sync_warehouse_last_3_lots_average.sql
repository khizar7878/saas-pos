-- Run this query on your WAREHOUSE database (nmxxgoxbntlpjjwvvxvz)
-- to keep parent product cost_per_meter in sync with the average of the last 3 lots (Approach B).

-- 1. Create or replace trigger function to calculate average of the latest 3 lots
CREATE OR REPLACE FUNCTION public.sync_warehouse_product_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    target_product_id UUID;
    total_stock NUMERIC;
    latest_landed_cost NUMERIC;
BEGIN
    -- Determine which product_id to update
    IF TG_TABLE_NAME = 'lot_inventory' THEN
        IF TG_OP = 'DELETE' THEN
            SELECT parent_product_id INTO target_product_id
            FROM public.product_lots
            WHERE id = OLD.lot_id;
        ELSE
            SELECT parent_product_id INTO target_product_id
            FROM public.product_lots
            WHERE id = NEW.lot_id;
        END IF;
    ELSIF TG_TABLE_NAME = 'product_lots' THEN
        IF TG_OP = 'DELETE' THEN
            target_product_id := OLD.parent_product_id;
        ELSE
            target_product_id := NEW.parent_product_id;
        END IF;
    END IF;

    IF target_product_id IS NOT NULL THEN
        -- A. Calculate total stock of Grade A, B, fresh_cut, cut_piece in lot_inventory for this product
        SELECT COALESCE(SUM(li.current_stock_meters), 0) INTO total_stock
        FROM public.lot_inventory li
        JOIN public.product_lots pl ON li.lot_id = pl.id
        WHERE pl.parent_product_id = target_product_id;

        -- B. Calculate the landed cost of the latest 3 lots for this product using an average
        -- Landed Cost = Gray Fabric Contract Item Rate + Dyeing Rate
        WITH latest_3_lots AS (
            SELECT 
                pl.id,
                COALESCE(
                    (
                        SELECT gci.rate_per_meter
                        FROM public.gray_contract_items gci
                        WHERE pl.gray_fabric_type_id = gci.gray_fabric_type_id
                        ORDER BY gci.created_at DESC
                        LIMIT 1
                    ), 
                    0
                ) + COALESCE(pl.dyeing_rate_per_meter, 0) AS landed_cost
            FROM public.product_lots pl
            WHERE pl.parent_product_id = target_product_id
            ORDER BY pl.created_at DESC
            LIMIT 3
        )
        SELECT COALESCE(AVG(landed_cost), 0) INTO latest_landed_cost
        FROM latest_3_lots;

        -- C. Update the warehouse product's total stock and landed cost
        UPDATE public.warehouse_products
        SET current_stock_meters = total_stock,
            cost_per_meter = CASE WHEN latest_landed_cost > 0 THEN latest_landed_cost ELSE cost_per_meter END,
            updated_at = NOW()
        WHERE id = target_product_id;
    END IF;

    RETURN NULL;
END;
$$;

-- 2. Create triggers on lot_inventory
DROP TRIGGER IF EXISTS trigger_sync_warehouse_product_stats_on_inventory ON public.lot_inventory;
CREATE TRIGGER trigger_sync_warehouse_product_stats_on_inventory
AFTER INSERT OR UPDATE OR DELETE ON public.lot_inventory
FOR EACH ROW EXECUTE FUNCTION public.sync_warehouse_product_stats();

-- 3. Create triggers on product_lots
DROP TRIGGER IF EXISTS trigger_sync_warehouse_product_stats_on_lots ON public.product_lots;
CREATE TRIGGER trigger_sync_warehouse_product_stats_on_lots
AFTER INSERT OR UPDATE OR DELETE ON public.product_lots
FOR EACH ROW EXECUTE FUNCTION public.sync_warehouse_product_stats();

-- 4. Backfill all existing warehouse products to recalculate and sync averages
DO $$
DECLARE
    r RECORD;
    t_stock NUMERIC;
    t_cost NUMERIC;
BEGIN
    FOR r IN SELECT id FROM public.warehouse_products LOOP
        -- Get total stock
        SELECT COALESCE(SUM(li.current_stock_meters), 0) INTO t_stock
        FROM public.lot_inventory li
        JOIN public.product_lots pl ON li.lot_id = pl.id
        WHERE pl.parent_product_id = r.id;

        -- Get latest 3 lots average landed cost
        WITH latest_3_lots AS (
            SELECT 
                pl.id,
                COALESCE(
                    (
                        SELECT gci.rate_per_meter
                        FROM public.gray_contract_items gci
                        WHERE pl.gray_fabric_type_id = gci.gray_fabric_type_id
                        ORDER BY gci.created_at DESC
                        LIMIT 1
                    ), 
                    0
                ) + COALESCE(pl.dyeing_rate_per_meter, 0) AS landed_cost
            FROM public.product_lots pl
            WHERE pl.parent_product_id = r.id
            ORDER BY pl.created_at DESC
            LIMIT 3
        )
        SELECT COALESCE(AVG(landed_cost), 0) INTO t_cost
        FROM latest_3_lots;

        UPDATE public.warehouse_products
        SET current_stock_meters = t_stock,
            cost_per_meter = CASE WHEN t_cost > 0 THEN t_cost ELSE cost_per_meter END
        WHERE id = r.id;
    END LOOP;
END $$;
