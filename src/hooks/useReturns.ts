import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Return } from "@/types/database";
import { toast } from "sonner";

export interface ReturnWithDetails extends Return {
    customer?: {
        name: string;
    } | null;
    sale?: {
        sale_number: string;
    } | null;
    items_count?: number;
}

export interface ReturnItemInput {
    sale_item_id?: string | null;
    product_id: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    restock: boolean;
}

export interface CreateReturnData {
    sale_id?: string | null;
    customer_id?: string | null;
    customer_name: string; // Required now
    items: ReturnItemInput[];
    reason?: string;
}

export function useReturns() {
    const [returns, setReturns] = useState<ReturnWithDetails[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        fetchReturns();

        // Subscribe to changes
        const channel = supabase
            .channel('schema-db-changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'returns'
                },
                () => {
                    fetchReturns();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const fetchReturns = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from("returns")
                .select(`
          *,
          sale:sales!original_sale_id(sale_number),
          customer:accounts(name),
          request_items:return_items(count)
        `)
                .order("created_at", { ascending: false })
                .limit(50000);

            if (error) {
                console.error("Supabase Error fetching returns:", error);
                throw error;
            }

            console.log("Fetched Returns Data:", data);

            // Transform data to include items count and map customer name
            const transformedData = data?.map(item => ({
                ...item,
                customer: { name: (item.customer as any)?.name || 'Walk-in' },
                items_count: item.request_items?.[0]?.count || 0,
                // Remove the count object to clean up the type
                request_items: undefined
            })) as ReturnWithDetails[];

            setReturns(transformedData || []);
        } catch (err) {
            console.error("Error fetching returns:", err);
            setError(err instanceof Error ? err : new Error("Failed to fetch returns"));
        } finally {
            setLoading(false);
        }
    };

    return { returns, loading, error, refetch: fetchReturns };
}

export const useCreateReturn = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ sale_id, customer_id, customer_name, items, reason }: CreateReturnData) => {
            // 1. Get next return number
            const { data: returnNumber, error: seqError } = await supabase
                .rpc('get_next_sequence', { seq_id: 'return' });

            if (seqError) throw seqError;

            // Format Return Number: AKRT + 6 digits (e.g., AKRT000101)
            const formattedReturnNumber = `AKRT${String(returnNumber).padStart(6, '0')}`;

            const totalAmount = items.reduce((sum, item) => sum + item.total_price, 0);

            // 2. Create Return Record
            const { data: returnData, error: returnError } = await supabase
                .from('returns')
                .insert({
                    return_number: formattedReturnNumber,
                    original_sale_id: sale_id || null,
                    customer_id: customer_id || null,
                    customer_name: customer_name,
                    total_amount: totalAmount,
                    reason: reason,
                    status: 'completed',
                    refund_method: 'cash', // Always cash as requested
                })
                .select()
                .single();

            if (returnError) throw returnError;

            // 3. Create Return Items
            const returnItemsData = items.map(item => ({
                return_id: returnData.id,
                product_id: item.product_id,
                sale_item_id: item.sale_item_id || null,
                quantity: item.quantity,
                unit_price: item.unit_price,
                total_price: item.total_price,
            }));

            const { error: itemsError } = await supabase
                .from('return_items')
                .insert(returnItemsData);

            if (itemsError) throw itemsError;

            // 4. Update Stock (Parallelized for performance)
            const stockUpdates = items
                .filter(item => item.restock)
                .map(async (item) => {
                    const { data: product } = await supabase
                        .from('products')
                        .select('stock_quantity')
                        .eq('id', item.product_id)
                        .single();

                    if (product) {
                        return supabase
                            .from('products')
                            .update({ stock_quantity: product.stock_quantity + item.quantity })
                            .eq('id', item.product_id);
                    }
                });

            await Promise.all(stockUpdates);

            // 5. Always Refund from Cash in Hand (User Requirement)
            // Regardless of customer, we pay out cash.

            const { data: cashAccount } = await supabase
                .from('accounts')
                .select('id, current_balance')
                .eq('name', 'Cash in Hand')
                .single();

            if (cashAccount) {
                const newCashBalance = cashAccount.current_balance - totalAmount;

                // Update Cash Account Balance
                await supabase
                    .from('accounts')
                    .update({ current_balance: newCashBalance })
                    .eq('id', cashAccount.id);

                // Create Ledger Entry for Cash Out
                await supabase.from('ledger_entries').insert({
                    account_id: cashAccount.id,
                    reference_type: 'return',
                    reference_id: returnData.id,
                    description: `Cash Refund - Return #${returnNumber} ${customer_name ? `(${customer_name})` : ''}`,
                    debit: 0,
                    credit: totalAmount, // Credit decreases Asset (Cash Out)
                    balance: newCashBalance
                });
            }

            // 6. Update Sale Status if needed
            if (sale_id) {
                await supabase
                    .from('sales')
                    .update({ status: 'returned' })
                    .eq('id', sale_id);
            }

            return returnData;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['sales'] });
            queryClient.invalidateQueries({ queryKey: ['returns'] });
            queryClient.invalidateQueries({ queryKey: ['products'] });
            queryClient.invalidateQueries({ queryKey: ['accounts'] });
            queryClient.invalidateQueries({ queryKey: ['ledger_entries'] });
            toast.success('Return processed successfully');
        },
        onError: (error) => {
            console.error('Return failed:', error);
            toast.error(`Failed to process return: ${error.message}`);
        },
    });
};

export const useReturnsByDateRange = (from: Date | undefined, to: Date | undefined, saleType?: 'counter' | 'delivery') => {
    return useQuery({
        queryKey: ['returns', 'date-range', from?.toISOString(), to?.toISOString(), saleType],
        enabled: !!from,
        queryFn: async () => {
            if (!from) return [];

            const fromDate = new Date(from);
            fromDate.setHours(0, 0, 0, 0);

            const toDate = to || from;
            const toDateEnd = new Date(toDate);
            toDateEnd.setHours(23, 59, 59, 999);

            let query = supabase
                .from("returns")
                .select(`
                  *,
                  sale:sales!original_sale_id(sale_number, sale_type)
                `)
                .gte('created_at', fromDate.toISOString())
                .lte('created_at', toDateEnd.toISOString());

            if (saleType) {
                // To filter by a linked table column, we use the !inner modifier
                // However, since we already did a select above without !inner, 
                // we can also filter using postgrest syntax:
                query = query.eq('sale.sale_type', saleType).not('sale', 'is', null);
            }

            const { data, error } = await query
                .order('created_at', { ascending: false })
                .limit(50000);

            if (error) throw error;

            return data as ReturnWithDetails[];
        },
    });
};
