import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DateRange } from "react-day-picker";
import { format } from "date-fns";

export interface ProductSalesData {
    product_id: string;
    product_name: string;
    product_code: string;
    current_stock: number; // Pieces/Suits
    total_quantity_sold: number; // Pieces/Suits
    total_revenue: number;
    transaction_count: number;
    avg_price_per_piece: number;
}

export const useProductSales = (dateRange?: DateRange) => {
    return useQuery({
        queryKey: ["product-sales", dateRange?.from, dateRange?.to],
        queryFn: async () => {
            // First, get sales within the date range
            let salesQuery = supabase
                .from("sales")
                .select("id, created_at, status")
                .eq("sale_type", "counter")
                .neq("status", "cancelled")
                .neq("status", "returned");

            // Apply date filter if provided
            if (dateRange?.from) {
                const fromDate = new Date(dateRange.from);
                fromDate.setHours(0, 0, 0, 0);
                salesQuery = salesQuery.gte("created_at", fromDate.toISOString());
            }

            if (dateRange?.to) {
                const toDate = new Date(dateRange.to);
                toDate.setHours(23, 59, 59, 999);
                salesQuery = salesQuery.lte("created_at", toDate.toISOString());
            }

            const { data: salesData, error: salesError } = await salesQuery;

            if (salesError) throw salesError;
            if (!salesData || salesData.length === 0) return [];

            const saleIds = salesData.map(s => s.id);

            // Get sale items for these sales
            // Note: Adjusting selected columns to match likely schema
            // quantity usually exists. quantity_meters might be old.
            // Using aliases if possible or just selecting both.
            // also current_stock_meters -> stock_quantity
            const { data: saleItems, error: itemsError } = await supabase
                .from("sale_items")
                .select(`
          product_id,
          quantity,
          unit_price,
          total_price,
          sale_id,
          products (
            id,
            name,
            sku,
            stock_quantity
          )
        `)
                .in("sale_id", saleIds);

            if (itemsError) throw itemsError;

            if (!saleItems || saleItems.length === 0) return [];

            // Aggregate data by product
            const productMap = new Map<string, ProductSalesData>();

            saleItems.forEach((item: any) => {
                const productId = item.product_id;
                let product = item.products;

                // Handle case where relation returns an array
                if (Array.isArray(product)) {
                    product = product[0];
                }

                if (!product) {
                    return;
                }

                if (!productMap.has(productId)) {
                    productMap.set(productId, {
                        product_id: productId,
                        product_name: product.name,
                        product_code: product.sku,
                        current_stock: product.stock_quantity || 0,
                        total_quantity_sold: 0,
                        total_revenue: 0,
                        transaction_count: 0,
                        avg_price_per_piece: 0,
                    });
                }

                const productData = productMap.get(productId)!;
                // Assuming 'quantity' is the pieces count
                productData.total_quantity_sold += Number(item.quantity) || 0;
                productData.total_revenue += Number(item.total_price) || 0;
                productData.transaction_count += 1;
            });

            // Calculate averages
            const result = Array.from(productMap.values()).map((product) => ({
                ...product,
                avg_price_per_piece:
                    product.total_quantity_sold > 0
                        ? product.total_revenue / product.total_quantity_sold
                        : 0,
            }));

            // Sort by revenue (highest first)
            return result.sort((a, b) => b.total_revenue - a.total_revenue);
        },
    });
};
