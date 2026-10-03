-- Run this query on your WAREHOUSE database (nmxxgoxbntlpjjwvvxvz)
-- to link parent products with their real-time stocks and costing.

-- 1. Create function to recalculate parent product stock and cost
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

        -- B. Calculate the landed cost of the latest linked/costed lot for this product
        -- Landed Cost = Gray Fabric Contract Item Rate + Dyeing Rate
        SELECT COALESCE(
            (
                SELECT COALESCE(gci.rate_per_meter, 0) + COALESCE(pl.dyeing_rate_per_meter, 0)
                FROM public.product_lots pl
                LEFT JOIN public.gray_contract_items gci ON pl.gray_fabric_type_id = gci.gray_fabric_type_id
                WHERE pl.parent_product_id = target_product_id
                  AND pl.is_gray_linked = true
                ORDER BY pl.created_at DESC, gci.created_at DESC
                LIMIT 1
            ),
            (
                -- Fallback to latest lot dyeing rate if not linked to gray fabric yet
                SELECT COALESCE(pl.dyeing_rate_per_meter, 0)
                FROM public.product_lots pl
                WHERE pl.parent_product_id = target_product_id
                ORDER BY pl.created_at DESC
                LIMIT 1
            ),
            0
        ) INTO latest_landed_cost;

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

-- 4. Initial backfill to sync all existing product stock and costs
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

        -- Get latest landed cost
        SELECT COALESCE(
            (
                SELECT COALESCE(gci.rate_per_meter, 0) + COALESCE(pl.dyeing_rate_per_meter, 0)
                FROM public.product_lots pl
                LEFT JOIN public.gray_contract_items gci ON pl.gray_fabric_type_id = gci.gray_fabric_type_id
                WHERE pl.parent_product_id = r.id
                  AND pl.is_gray_linked = true
                ORDER BY pl.created_at DESC, gci.created_at DESC
                LIMIT 1
            ),
            (
                SELECT COALESCE(pl.dyeing_rate_per_meter, 0)
                FROM public.product_lots pl
                WHERE pl.parent_product_id = r.id
                ORDER BY pl.created_at DESC
                LIMIT 1
            ),
            0
        ) INTO t_cost;

        UPDATE public.warehouse_products
        SET current_stock_meters = t_stock,
            cost_per_meter = CASE WHEN t_cost > 0 THEN t_cost ELSE cost_per_meter END
        WHERE id = r.id;
    END LOOP;
END $$;
