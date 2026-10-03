import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DateRange } from "react-day-picker";

export interface CustomerSalesData {
    customer_id: string | 'walk-in';
    customer_name: string;
    phone: string | null;
    total_revenue: number;
    transaction_count: number;
    avg_sale_value: number;
    last_sale_date: string;
}

export const useCustomerSales = (dateRange?: DateRange) => {
    return useQuery({
        queryKey: ["customer-sales", dateRange?.from, dateRange?.to],
        queryFn: async () => {
            let salesQuery = supabase
                .from("sales")
                .select(`
                    id, 
                    created_at, 
                    total_amount,
                    status,
                    customer_id,
                    customer:accounts!customer_id(name, phone)
                `)
                .neq("status", "cancelled")
                .neq("status", "returned");

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

            const customerMap = new Map<string, CustomerSalesData>();

            salesData.forEach((sale: any) => {
                const customerId = sale.customer_id || 'walk-in';
                const customerName = sale.customer?.name || 'Walk-in Customer';
                const customerPhone = sale.customer?.phone || null;

                if (!customerMap.has(customerId)) {
                    customerMap.set(customerId, {
                        customer_id: customerId,
                        customer_name: customerName,
                        phone: customerPhone,
                        total_revenue: 0,
                        transaction_count: 0,
                        avg_sale_value: 0,
                        last_sale_date: sale.created_at,
                    });
                }

                const data = customerMap.get(customerId)!;
                data.total_revenue += sale.total_amount;
                data.transaction_count += 1;
                // Keep the most recent date
                if (new Date(sale.created_at) > new Date(data.last_sale_date)) {
                    data.last_sale_date = sale.created_at;
                }
            });

            // Calculate averages and convert to array
            const result = Array.from(customerMap.values()).map((customer) => ({
                ...customer,
                avg_sale_value: customer.transaction_count > 0
                    ? customer.total_revenue / customer.transaction_count
                    : 0,
            }));

            // Sort by revenue descending
            return result.sort((a, b) => b.total_revenue - a.total_revenue);
        },
    });
};
