import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfMonth, startOfWeek, addDays, format } from 'date-fns';

export interface DashboardStats {
    salesToday: {
        value: number;
        count: number;
    };
    cashSales: {
        value: number;
        count: number;
    };
    cardSales: {
        value: number;
        count: number;
    };
    ibftSales: {
        value: number;
        count: number;
    };
    productsSold: {
        value: number;
    };
    weeklySales: {
        date: string;
        amount: number;
    }[];
    topProducts: {
        name: string;
        quantity: number;
        amount: number;
    }[];
    topCategories: {
        name: string;
        amount: number;
    }[];
}

export const useDashboardStats = () => {
    return useQuery({
        queryKey: ['dashboard-stats-counter'], // Updated to force cache refresh with Counter Sales filter
        queryFn: async (): Promise<DashboardStats> => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);



            // 1. Fetch Today's Sales with details
            const { data: todaySales, error: todayError } = await supabase
                .from('sales')
                .select(`
          total_amount,
          amount_received,
          payment_method,
          sale_items (
            quantity,
            total_price,
            product_name,
            product:products (
                product_categories (
                    name
                )
            )
          )
        `)
                .gte('created_at', today.toISOString())
                .eq('sale_type', 'counter')
                .neq('status', 'cancelled')
                .neq('status', 'returned');

            if (todayError) throw todayError;

            // Aggregations
            let salesTodayValue = 0;
            let salesTodayCount = 0;
            let cashSalesValue = 0;
            let cashSalesCount = 0;
            let cardSalesValue = 0;
            let cardSalesCount = 0;
            let ibftSalesValue = 0;
            let ibftSalesCount = 0;
            let productsSoldToday = 0;

            const productPerformance: Record<string, { quantity: number; amount: number }> = {};
            const categoryPerformance: Record<string, number> = {};

            todaySales.forEach(sale => {
                salesTodayValue += sale.total_amount;
                salesTodayCount++;

                // Payment Methods
                if (sale.payment_method === 'cash') {
                    cashSalesValue += sale.total_amount;
                    cashSalesCount++;
                } else if (sale.payment_method === 'card') {
                    cardSalesValue += sale.total_amount;
                    cardSalesCount++;
                } else if (sale.payment_method === 'ibft') {
                    ibftSalesValue += sale.total_amount;
                    ibftSalesCount++;
                }

                // Items Aggregation
                sale.sale_items.forEach((item: any) => {
                    const qty = item.quantity || 0;
                    const amount = item.total_price || 0;
                    productsSoldToday += qty;

                    // Top Products
                    // Use product_name as key/label
                    const pName = item.product_name || "Unknown Product";
                    if (!productPerformance[pName]) {
                        productPerformance[pName] = { quantity: 0, amount: 0 };
                    }
                    productPerformance[pName].quantity += qty;
                    productPerformance[pName].amount += amount;

                    // Top Categories
                    // Note: product link might be null if product deleted, but usually safe
                    const catName = item.product?.product_categories?.name || "Uncategorized";
                    if (!categoryPerformance[catName]) {
                        categoryPerformance[catName] = 0;
                    }
                    categoryPerformance[catName] += amount;
                });
            });

            // Process Top 10 Products
            const topProducts = Object.entries(productPerformance)
                .map(([name, stats]) => ({ name, ...stats }))
                .sort((a, b) => b.quantity - a.quantity) // Sort by quantity or amount? Request says "performing", usually Sales Amount is better for business, but quantity shows volume. Let's use Amount for "Performance".
                .sort((a, b) => b.amount - a.amount)
                .slice(0, 10);

            // Process Top 4 Categories
            const topCategories = Object.entries(categoryPerformance)
                .map(([name, amount]) => ({ name, amount }))
                .sort((a, b) => b.amount - a.amount)
                .slice(0, 4);


            // 2. Weekly Sales (Current Week: Sat - Thu)
            // Calculate start of current week (Saturday)
            const startOfCurrentWeek = startOfWeek(today, { weekStartsOn: 6 }); // 6 = Saturday
            const endOfCurrentWeek = addDays(startOfCurrentWeek, 6); // Friday (we will filter to Thu below if needed, or just map 6 days)

            const { data: weeklyData, error: weeklyError } = await supabase
                .from('sales')
                .select('created_at, total_amount')
                .gte('created_at', startOfCurrentWeek.toISOString())
                .lte('created_at', endOfCurrentWeek.toISOString()) // Safety bound
                .eq('sale_type', 'counter')
                .neq('status', 'cancelled')
                .neq('status', 'returned');

            if (weeklyError) throw weeklyError;

            // Group by Date for Sat-Thu (6 days)
            const weeklyMap: Record<string, number> = {};
            const weekDates: Date[] = [];

            // Initialize Sat to Thursday (0 to 5)
            for (let i = 0; i < 6; i++) {
                const d = addDays(startOfCurrentWeek, i);
                const dateKey = format(d, 'yyyy-MM-dd');
                weeklyMap[dateKey] = 0;
                weekDates.push(d);
            }

            weeklyData.forEach(sale => {
                const dateKey = format(new Date(sale.created_at), 'yyyy-MM-dd');
                if (weeklyMap[dateKey] !== undefined) {
                    weeklyMap[dateKey] += sale.total_amount;
                }
            });

            const weeklySales = weekDates.map(date => {
                const dateKey = format(date, 'yyyy-MM-dd');
                return {
                    date: format(date, 'EEE'), // Sat, Sun...
                    amount: weeklyMap[dateKey] || 0
                };
            });


            return {
                salesToday: {
                    value: salesTodayValue,
                    count: salesTodayCount
                },
                cashSales: {
                    value: cashSalesValue,
                    count: cashSalesCount
                },
                cardSales: {
                    value: cardSalesValue,
                    count: cardSalesCount
                },
                ibftSales: {
                    value: ibftSalesValue,
                    count: ibftSalesCount
                },
                productsSold: {
                    value: productsSoldToday
                },
                weeklySales,
                topProducts,
                topCategories
            };
        },
        // Removed aggressive 30s auto-refresh for better performance
        // Users can manually refresh if needed
        staleTime: 60000, // Consider data fresh for 1 minute
    });
};
