import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfDay } from 'date-fns';
import { DateRange } from 'react-day-picker';

export interface Transaction {
    id: string;
    date: string;
    time: string;
    type: 'sale' | 'payment_received' | 'payment_made' | 'payment_circulated' | 'expense' | 'internal_transfer';
    description: string;
    referenceNumber: string;
    amount: number;
    accountName?: string;
}

export const useDaySummary = (dateRange: DateRange | undefined) => {
    return useQuery({
        queryKey: ['day-summary', dateRange?.from, dateRange?.to],
        enabled: !!dateRange?.from,
        queryFn: async (): Promise<Transaction[]> => {
            if (!dateRange?.from) return [];

            const from = startOfDay(dateRange.from).toISOString();
            const toDate = dateRange.to || dateRange.from;
            const to = new Date(toDate);
            to.setHours(23, 59, 59, 999);
            const toStr = to.toISOString();

            const transactions: Transaction[] = [];

            // 1. Fetch Sales
            const { data: sales, error: salesError } = await supabase
                .from('sales')
                .select(`
                    id,
                    created_at,
                    sale_number,
                    total_amount,
                    amount_received,
                    status,
                    customer:accounts!customer_id(name)
                `)
                .gte('created_at', from)
                .lte('created_at', toStr)
                // .neq('status', 'cancelled') // Include cancelled to show them
                .neq('status', 'returned')
                .order('created_at', { ascending: false })
                .limit(50000);

            if (salesError) throw salesError;

            sales.forEach((sale: any) => {
                const isCancelled = sale.status === 'cancelled';
                transactions.push({
                    id: sale.id,
                    date: format(new Date(sale.created_at), 'yyyy-MM-dd'),
                    time: format(new Date(sale.created_at), 'HH:mm'),
                    type: 'sale', // Keep as sale type for icon/grouping, or change if needed
                    description: isCancelled ? 'Sale Cancelled' : 'Sale',
                    referenceNumber: sale.sale_number,
                    amount: isCancelled ? -sale.total_amount : sale.total_amount, // Negative amount for cancelled
                    accountName: sale.customer?.name || 'Walk-in'
                });
            });

            // 2. Fetch Payments
            const { data: payments, error: paymentsError } = await supabase
                .from('payments')
                .select(`
                    id,
                    created_at,
                    payment_number,
                    amount,
                    payment_type,
                    from_account:accounts!from_account_id(name, account_type, account_subtype),
                    to_account:accounts!to_account_id(name, account_type, account_subtype)
                `)
                .gte('created_at', from)
                .lte('created_at', toStr)
                .order('created_at', { ascending: false })
                .limit(50000);

            if (paymentsError) throw paymentsError;

            payments.forEach((payment: any) => {
                let type: Transaction['type'] = 'payment_made';
                let description = 'Payment';
                let accountName = '';

                if (payment.payment_type === 'receive') {
                    type = 'payment_received';
                    description = 'Payment Received';
                    accountName = payment.from_account?.name || '';
                } else if (payment.payment_type === 'circulated') {
                    // Check if this is an internal transfer (between cash/reserve accounts)
                    const fromSubtype = payment.from_account?.account_subtype || '';
                    const toSubtype = payment.to_account?.account_subtype || '';
                    const fromName = payment.from_account?.name || '';
                    const toName = payment.to_account?.name || '';

                    const isCashTransfer =
                        (fromSubtype === 'cash_in_hand' || fromSubtype === 'cash_reserve') &&
                        (toSubtype === 'cash_in_hand' || toSubtype === 'cash_reserve');

                    if (isCashTransfer) {
                        type = 'internal_transfer';
                        description = 'Internal Transfer';
                        accountName = `${fromName} → ${toName}`;
                    } else {
                        type = 'payment_circulated';
                        description = 'Payment Circulated';
                        accountName = `${fromName} → ${toName}`;
                    }
                } else if (payment.payment_type === 'make') {
                    const isExpense = payment.to_account?.account_type === 'expense';
                    if (isExpense) {
                        type = 'expense';
                        description = 'Expense';
                    } else {
                        type = 'payment_made';
                        description = 'Payment Made';
                    }
                    accountName = payment.to_account?.name || '';
                }

                transactions.push({
                    id: payment.id,
                    date: format(new Date(payment.created_at), 'yyyy-MM-dd'),
                    time: format(new Date(payment.created_at), 'HH:mm'),
                    type,
                    description,
                    referenceNumber: payment.payment_number,
                    amount: payment.amount,
                    accountName
                });
            });

            // Sort all transactions by date and time (most recent first)
            return transactions.sort((a, b) => {
                const dateCompare = b.date.localeCompare(a.date);
                if (dateCompare !== 0) return dateCompare;
                return b.time.localeCompare(a.time);
            });
        }
    });
};
