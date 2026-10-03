import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfDay } from "date-fns";

export interface StockHistoryItem {
    id: string;
    name: string;
    sku: string | null;
    category: string | null;
    current_stock: number;
    stock_at_date: number; // Meters
    rolls_at_date: number; // Pieces/Rolls
    cost_per_piece: number;
    cost_per_meter: number;
    price: number;
    total_value_at_date: number;
    meters_per_piece: number;
    variations?: any[];
}

export const useStockHistory = (date: Date | undefined) => {
    return useQuery({
        queryKey: ['stock-history', date?.toISOString()],
        queryFn: async () => {
            // 1. Fetch Current Products Status
            const { data: products, error: prodError } = await supabase
                .from('products')
                .select(`
          id,
          name,
          sku,
          stock_quantity,
          cost_price,
          price,
          meters_per_piece,
          product_categories(name)
        `)
                .eq('is_active', true)
                .order('name');

            if (prodError) throw prodError;

            if (!date) {
                // Return current status
                return products.map(p => ({
                    id: p.id,
                    name: p.name,
                    sku: p.sku,
                    category: (p.product_categories as any)?.name || '-',
                    current_stock: p.stock_quantity,
                    stock_at_date: p.stock_quantity * (p.meters_per_piece || 0), // Convert to meters for "Stock (Meters)" column
                    rolls_at_date: p.stock_quantity, // Assuming stock_quantity is rolls/pieces
                    cost_per_piece: p.cost_price || 0,
                    cost_per_meter: (p.cost_price || 0) / (p.meters_per_piece || 1), // Calculate cost per meter
                    price: p.price,
                    total_value_at_date: p.stock_quantity * (p.cost_price || 0),
                    meters_per_piece: p.meters_per_piece,
                    variations: [] // Placeholder for now
                }));
            }

            // 2. Fetch Transactions AFTER the target date (to reverse them)
            const targetTime = startOfDay(date).toISOString();

            // A. Sale Items (quantity is pieces now)
            const { data: saleItems, error: salesError } = await supabase
                .from('sale_items')
                .select('product_id, quantity')
                .gt('created_at', targetTime);

            if (salesError) throw salesError;

            // B. Stock Receipts
            // Same here, 'rolls_received' vs 'quantity'?
            const { data: receiptItems, error: receiptsError } = await supabase
                .from('stock_receipt_items')
                .select('product_id, rolls_received') // assuming rolls_received is the column for pieces
                .gt('created_at', targetTime);

            if (receiptsError) throw receiptsError;

            // C. Returns (add back to stock if reversed? No, returns happened AFTER date.
            // If we are rewinding to past date, we need to Reverse RETURNS too.
            // A return ADDS to stock. So to go back in time, we SUBTRACT the return quantity.
            const { data: returnItems, error: returnsError } = await supabase
                .from('return_items')
                .select('product_id, quantity')
                .gt('created_at', targetTime);

            if (returnsError) throw returnsError;


            // 3. Calculate Historical Stock
            const productMap = new Map<string, number>(); // Stores DIFF to apply

            // For Sales: Sale decreases stock. To go BACK, we ADD quantity.
            saleItems?.forEach(item => {
                const qty = item.quantity || 0;
                const currentDiff = productMap.get(item.product_id) || 0;
                productMap.set(item.product_id, currentDiff + qty);
            });

            // For Receipts: Receipt increases stock. To go BACK, we SUBTRACT quantity.
            receiptItems?.forEach(item => {
                const qty = item.rolls_received || 0;
                const currentDiff = productMap.get(item.product_id) || 0;
                productMap.set(item.product_id, currentDiff - qty);
            });

            // For Returns: Return increases stock. To go BACK, we SUBTRACT quantity.
            returnItems?.forEach(item => {
                const qty = item.quantity || 0;
                const currentDiff = productMap.get(item.product_id) || 0;
                productMap.set(item.product_id, currentDiff - qty);
            });

            // 4. Merge
            return products.map(p => {
                const diff = productMap.get(p.id) || 0;
                const historicalStock = p.stock_quantity + diff; // Pieces/Rolls

                return {
                    id: p.id,
                    name: p.name,
                    sku: p.sku,
                    category: (p.product_categories as any)?.name || '-',
                    current_stock: p.stock_quantity,
                    stock_at_date: historicalStock * (p.meters_per_piece || 0), // Convert to meters
                    rolls_at_date: historicalStock, // Pieces/Rolls
                    cost_per_piece: p.cost_price || 0,
                    cost_per_meter: (p.cost_price || 0) / (p.meters_per_piece || 1), // Calculate cost per meter
                    price: p.price,
                    total_value_at_date: historicalStock * (p.cost_price || 0),
                    meters_per_piece: p.meters_per_piece,
                    variations: []
                };
            });
        }
    });
};
