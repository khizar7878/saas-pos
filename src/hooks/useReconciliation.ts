import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfDay, endOfDay } from 'date-fns';
import { toast } from 'sonner';
import {
    DailyExpense,
    ReconciliationIbftEntry,
    ReconciliationCardEntry,
    DailyReconciliationRecord,
    ReconciliationCashDenominations,
    CounterSaleSummaryItem,
} from '@/types/reconciliation';

export const useDayReconciliation = (selectedDate: Date, customGroupedDates?: string[]) => {
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const dayOfWeek = format(selectedDate, 'EEEE').toLowerCase();

    const cacheKeyDates = customGroupedDates && customGroupedDates.length > 1
        ? [...customGroupedDates].sort().join(',')
        : 'single';

    return useQuery({
        queryKey: ['daily-reconciliation', dateStr, cacheKeyDates],
        queryFn: async () => {
            // 0. Fetch weekly_off_days from store_settings
            let weeklyOffDays: string[] = ['friday'];
            try {
                const { data: stData } = await supabase
                    .from('store_settings')
                    .select('weekly_off_days')
                    .limit(1)
                    .maybeSingle();
                if (stData && Array.isArray((stData as any).weekly_off_days)) {
                    weeklyOffDays = (stData as any).weekly_off_days;
                }
            } catch (err) {
                console.error('Error fetching weekly_off_days:', err);
            }

            const isScheduledOffDay = weeklyOffDays.includes(dayOfWeek);

            // 1. Check if dateStr matches an existing saved record or belongs to an existing grouped record
            const { data: matchedRecords, error: closingError } = await supabase
                .from('daily_reconciliations' as any)
                .select('*')
                .or(`reconciliation_date.eq.${dateStr},grouped_dates.cs.{${dateStr}}`)
                .limit(1);

            if (closingError) throw closingError;

            const closingRecord: DailyReconciliationRecord | null = matchedRecords?.[0] || null;

            // Determine effective dates to reconcile
            let effectiveDates: string[] = [dateStr];
            let isGrouped = false;
            let startDateStr = dateStr;
            let endDateStr = dateStr;

            if (closingRecord && closingRecord.is_grouped && Array.isArray(closingRecord.grouped_dates) && closingRecord.grouped_dates.length > 0) {
                // Saved group takes priority! Automatically restores the group when viewing any included day
                effectiveDates = [...closingRecord.grouped_dates].sort();
                isGrouped = true;
                startDateStr = closingRecord.start_date || effectiveDates[0];
                endDateStr = closingRecord.end_date || effectiveDates[effectiveDates.length - 1];
            } else if (customGroupedDates && customGroupedDates.length > 1) {
                // User explicitly selected multiple days in draft mode
                effectiveDates = [...customGroupedDates].sort();
                isGrouped = true;
                startDateStr = effectiveDates[0];
                endDateStr = effectiveDates[effectiveDates.length - 1];
            }

            const startIso = startOfDay(new Date(startDateStr + 'T00:00:00')).toISOString();
            const endIso = endOfDay(new Date(endDateStr + 'T23:59:59')).toISOString();

            // 2. Fetch System Sales across all effective dates
            const { data: rawSales, error: salesError } = await supabase
                .from('sales')
                .select('*')
                .gte('created_at', startIso)
                .lte('created_at', endIso)
                .neq('status', 'cancelled')
                .order('created_at', { ascending: false });

            if (salesError) throw salesError;

            // Filter sales strictly to effectiveDates
            const filteredSales = (rawSales || []).filter((s: any) => {
                const saleDay = format(new Date(s.created_at), 'yyyy-MM-dd');
                return effectiveDates.includes(saleDay);
            });

            // Process counter sales and split payment amounts
            let system_counter_sales_total = 0;
            let system_cash_sales = 0;
            let system_card_sales = 0;
            let system_ibft_sales = 0;

            const counterSales: CounterSaleSummaryItem[] = filteredSales.map((s: any) => {
                const total = Number(s.total_amount) || 0;
                system_counter_sales_total += total;

                let cash = 0;
                let card = 0;
                let ibft = 0;
                const isMixed = s.payment_method === 'mixed';

                if (isMixed && Array.isArray(s.payment_details)) {
                    s.payment_details.forEach((split: any) => {
                        const amt = Number(split.amount) || 0;
                        const method = String(split.method || '').toLowerCase();
                        if (method === 'cash') cash += amt;
                        else if (method === 'card') card += amt;
                        else if (method === 'ibft') ibft += amt;
                    });
                } else {
                    const method = String(s.payment_method || '').toLowerCase();
                    if (method === 'cash') cash = total;
                    else if (method === 'card') card = total;
                    else if (method === 'ibft') ibft = total;
                }

                system_cash_sales += cash;
                system_card_sales += card;
                system_ibft_sales += ibft;

                return {
                    id: s.id,
                    sale_number: s.sale_number,
                    created_at: s.created_at,
                    customer_name: s.customer_name,
                    payment_method: s.payment_method,
                    total_amount: total,
                    cash_amount: cash,
                    card_amount: card,
                    ibft_amount: ibft,
                    is_mixed: isMixed,
                };
            });

            // 3. Fetch Cash Returns for effective dates
            const { data: rawReturns, error: returnsError } = await supabase
                .from('returns')
                .select('*')
                .gte('created_at', startIso)
                .lte('created_at', endIso)
                .eq('status', 'completed')
                .eq('refund_method', 'cash');

            if (returnsError) throw returnsError;

            const filteredReturns = (rawReturns || []).filter((r: any) => {
                const returnDay = format(new Date(r.created_at), 'yyyy-MM-dd');
                return effectiveDates.includes(returnDay);
            });

            const system_cash_returns = filteredReturns.reduce(
                (sum, r: any) => sum + (Number(r.total_amount) || 0),
                0
            );

            // 4. Fetch Daily Expenses across effectiveDates
            const { data: expensesData, error: expensesError } = await supabase
                .from('daily_expenses' as any)
                .select('*')
                .in('expense_date', effectiveDates)
                .order('created_at', { ascending: false });

            if (expensesError) throw expensesError;

            const expenses: DailyExpense[] = expensesData || [];
            let total_expenses = 0;
            let cash_expenses = 0;
            let ibft_expenses = 0;
            let card_expenses = 0;

            expenses.forEach((e) => {
                const amt = Number(e.amount) || 0;
                total_expenses += amt;
                if (e.payment_method === 'cash') cash_expenses += amt;
                else if (e.payment_method === 'ibft') ibft_expenses += amt;
                else if (e.payment_method === 'card') card_expenses += amt;
            });

            // 5. Fetch Manual IBFT Entries across effectiveDates
            const { data: ibftData, error: ibftError } = await supabase
                .from('reconciliation_ibft_entries' as any)
                .select('*')
                .in('entry_date', effectiveDates)
                .order('created_at', { ascending: false });

            if (ibftError) throw ibftError;

            const ibftEntries: ReconciliationIbftEntry[] = ibftData || [];
            const manual_ibft_total = ibftEntries.reduce(
                (sum, entry) => sum + (Number(entry.amount) || 0),
                0
            );
            const ibft_variance = manual_ibft_total - system_ibft_sales;

            // 6. Fetch Manual Card Entries across effectiveDates
            const { data: cardData, error: cardError } = await supabase
                .from('reconciliation_card_entries' as any)
                .select('*')
                .in('entry_date', effectiveDates)
                .order('created_at', { ascending: false });

            if (cardError) throw cardError;

            const cardEntries: ReconciliationCardEntry[] = cardData || [];
            const manual_card_total = cardEntries.reduce(
                (sum, entry) => sum + (Number(entry.amount) || 0),
                0
            );
            const card_variance = manual_card_total - system_card_sales;

            // 7. Fetch Preceding Saved Closing Record prior to startDateStr
            // Auto-carryover closing balance as this session's opening float
            const { data: prevRecord } = await supabase
                .from('daily_reconciliations' as any)
                .select('*')
                .lt('reconciliation_date', startDateStr)
                .order('reconciliation_date', { ascending: false })
                .limit(1)
                .maybeSingle();

            return {
                dateStr,
                startDateStr,
                endDateStr,
                effectiveDates,
                isGrouped,
                isScheduledOffDay,
                weeklyOffDays,
                counterSales,
                returns: filteredReturns,
                expenses,
                ibftEntries,
                cardEntries,
                savedRecord: closingRecord,
                previousRecord: prevRecord as DailyReconciliationRecord | null,
                metrics: {
                    system_counter_sales_total,
                    system_cash_sales,
                    system_card_sales,
                    system_ibft_sales,
                    system_cash_returns,
                    net_counter_sales: Math.max(0, system_counter_sales_total - system_cash_returns),
                    total_expenses,
                    cash_expenses,
                    ibft_expenses,
                    card_expenses,
                    manual_ibft_total,
                    ibft_variance,
                    manual_card_total,
                    card_variance,
                },
            };
        },
    });
};

// Hook to fetch reconciliation history
export const useReconciliationHistory = () => {
    return useQuery({
        queryKey: ['reconciliation-history'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('daily_reconciliations' as any)
                .select('*')
                .order('reconciliation_date', { ascending: false });

            if (error) throw error;
            return (data || []) as DailyReconciliationRecord[];
        },
    });
};

// Add Daily Expense
export const useAddDailyExpense = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (expense: {
            expense_date: string;
            description: string;
            amount: number;
            category?: string;
            payment_method?: 'cash' | 'ibft' | 'card';
            receipt_no?: string;
            notes?: string;
        }) => {
            const { data: { user } } = await supabase.auth.getUser();

            const { data, error } = await supabase
                .from('daily_expenses' as any)
                .insert({
                    expense_date: expense.expense_date,
                    description: expense.description,
                    amount: expense.amount,
                    category: expense.category || 'General Expense',
                    payment_method: expense.payment_method || 'cash',
                    receipt_no: expense.receipt_no || null,
                    notes: expense.notes || null,
                    created_by: user?.id || null,
                })
                .select()
                .single();

            if (error) throw error;
            return data as DailyExpense;
        },
        onMutate: async (newExpense) => {
            await queryClient.cancelQueries({ queryKey: ['daily-reconciliation', newExpense.expense_date] });
            const previousData = queryClient.getQueryData(['daily-reconciliation', newExpense.expense_date]);

            const tempId = 'temp-' + Date.now();
            const optimisticExpense: DailyExpense = {
                id: tempId,
                expense_date: newExpense.expense_date,
                category: newExpense.category || 'General Expense',
                description: newExpense.description,
                amount: newExpense.amount,
                payment_method: newExpense.payment_method || 'cash',
                receipt_no: newExpense.receipt_no || null,
                notes: newExpense.notes || null,
                created_by: null,
                created_at: new Date().toISOString(),
            };

            queryClient.setQueryData(['daily-reconciliation', newExpense.expense_date], (old: any) => {
                if (!old) return old;
                const updatedExpenses = [optimisticExpense, ...(old.expenses || [])];
                const newTotalExpenses = (old.metrics?.total_expenses || 0) + newExpense.amount;
                const newCashExpenses = (old.metrics?.cash_expenses || 0) + (newExpense.payment_method === 'cash' || !newExpense.payment_method ? newExpense.amount : 0);
                return {
                    ...old,
                    expenses: updatedExpenses,
                    metrics: {
                        ...old.metrics,
                        total_expenses: newTotalExpenses,
                        cash_expenses: newCashExpenses,
                    },
                };
            });

            return { previousData, tempId, dateStr: newExpense.expense_date };
        },
        onError: (err: any, _, context) => {
            if (context?.previousData) {
                queryClient.setQueryData(['daily-reconciliation', context.dateStr], context.previousData);
            }
            toast.error(`Failed to record expense: ${err.message}`);
        },
        onSuccess: (saved, variables, context) => {
            if (saved && context?.tempId) {
                queryClient.setQueryData(['daily-reconciliation', variables.expense_date], (old: any) => {
                    if (!old) return old;
                    return {
                        ...old,
                        expenses: (old.expenses || []).map((e: DailyExpense) => e.id === context.tempId ? saved : e),
                    };
                });
            }
            toast.success('Expense recorded');
        },
        onSettled: (_, __, variables) => {
            queryClient.invalidateQueries({ queryKey: ['daily-reconciliation', variables.expense_date] });
        },
    });
};

// Delete Daily Expense
export const useDeleteDailyExpense = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, dateStr }: { id: string; dateStr: string }) => {
            const { error } = await supabase
                .from('daily_expenses' as any)
                .delete()
                .eq('id', id);

            if (error) throw error;
            return { id, dateStr };
        },
        onMutate: async ({ id, dateStr }) => {
            await queryClient.cancelQueries({ queryKey: ['daily-reconciliation', dateStr] });
            const previousData = queryClient.getQueryData(['daily-reconciliation', dateStr]);

            queryClient.setQueryData(['daily-reconciliation', dateStr], (old: any) => {
                if (!old) return old;
                const removedExpense = (old.expenses || []).find((e: DailyExpense) => e.id === id);
                const removedAmt = removedExpense ? Number(removedExpense.amount) || 0 : 0;
                const isCash = removedExpense?.payment_method === 'cash';

                return {
                    ...old,
                    expenses: (old.expenses || []).filter((e: DailyExpense) => e.id !== id),
                    metrics: {
                        ...old.metrics,
                        total_expenses: Math.max(0, (old.metrics?.total_expenses || 0) - removedAmt),
                        cash_expenses: Math.max(0, (old.metrics?.cash_expenses || 0) - (isCash ? removedAmt : 0)),
                    },
                };
            });

            return { previousData, dateStr };
        },
        onError: (err: any, _, context) => {
            if (context?.previousData) {
                queryClient.setQueryData(['daily-reconciliation', context.dateStr], context.previousData);
            }
            toast.error(`Failed to delete expense: ${err.message}`);
        },
        onSuccess: () => {
            toast.success('Expense removed');
        },
        onSettled: (_, __, { dateStr }) => {
            queryClient.invalidateQueries({ queryKey: ['daily-reconciliation', dateStr] });
        },
    });
};

// Add Manual IBFT Entry
export const useAddIbftEntry = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (entry: {
            entry_date: string;
            amount: number;
            description?: string;
            bank_name?: string;
            reference_no?: string;
            notes?: string;
        }) => {
            const { data: { user } } = await supabase.auth.getUser();

            const { data, error } = await supabase
                .from('reconciliation_ibft_entries' as any)
                .insert({
                    entry_date: entry.entry_date,
                    amount: entry.amount,
                    description: entry.description?.trim() || null,
                    bank_name: entry.bank_name || null,
                    reference_no: entry.reference_no || null,
                    notes: entry.notes || null,
                    created_by: user?.id || null,
                })
                .select()
                .single();

            if (error) throw error;
            return data as ReconciliationIbftEntry;
        },
        onMutate: async (newEntry) => {
            await queryClient.cancelQueries({ queryKey: ['daily-reconciliation', newEntry.entry_date] });
            const previousData = queryClient.getQueryData(['daily-reconciliation', newEntry.entry_date]);

            const tempId = 'temp-' + Date.now();
            const optimisticEntry: ReconciliationIbftEntry = {
                id: tempId,
                entry_date: newEntry.entry_date,
                amount: newEntry.amount,
                description: newEntry.description || null,
                bank_name: newEntry.bank_name || null,
                reference_no: newEntry.reference_no || null,
                notes: newEntry.notes || null,
                created_by: null,
                created_at: new Date().toISOString(),
            };

            queryClient.setQueryData(['daily-reconciliation', newEntry.entry_date], (old: any) => {
                if (!old) return old;
                const updatedEntries = [optimisticEntry, ...(old.ibftEntries || [])];
                const newManualIbftTotal = (old.metrics?.manual_ibft_total || 0) + newEntry.amount;
                const newIbftVariance = newManualIbftTotal - (old.metrics?.system_ibft_sales || 0);
                return {
                    ...old,
                    ibftEntries: updatedEntries,
                    metrics: {
                        ...old.metrics,
                        manual_ibft_total: newManualIbftTotal,
                        ibft_variance: newIbftVariance,
                    },
                };
            });

            return { previousData, tempId, dateStr: newEntry.entry_date };
        },
        onError: (err: any, _, context) => {
            if (context?.previousData) {
                queryClient.setQueryData(['daily-reconciliation', context.dateStr], context.previousData);
            }
            toast.error(`Failed to record IBFT: ${err.message}`);
        },
        onSuccess: (saved, variables, context) => {
            if (saved && context?.tempId) {
                queryClient.setQueryData(['daily-reconciliation', variables.entry_date], (old: any) => {
                    if (!old) return old;
                    return {
                        ...old,
                        ibftEntries: (old.ibftEntries || []).map((e: ReconciliationIbftEntry) => e.id === context.tempId ? saved : e),
                    };
                });
            }
            toast.success('IBFT transaction recorded');
        },
        onSettled: (_, __, variables) => {
            queryClient.invalidateQueries({ queryKey: ['daily-reconciliation', variables.entry_date] });
        },
    });
};

// Delete Manual IBFT Entry
export const useDeleteIbftEntry = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, dateStr }: { id: string; dateStr: string }) => {
            const { error } = await supabase
                .from('reconciliation_ibft_entries' as any)
                .delete()
                .eq('id', id);

            if (error) throw error;
            return { id, dateStr };
        },
        onMutate: async ({ id, dateStr }) => {
            await queryClient.cancelQueries({ queryKey: ['daily-reconciliation', dateStr] });
            const previousData = queryClient.getQueryData(['daily-reconciliation', dateStr]);

            queryClient.setQueryData(['daily-reconciliation', dateStr], (old: any) => {
                if (!old) return old;
                const removedEntry = (old.ibftEntries || []).find((e: ReconciliationIbftEntry) => e.id === id);
                const removedAmt = removedEntry ? Number(removedEntry.amount) || 0 : 0;
                const newTotal = Math.max(0, (old.metrics?.manual_ibft_total || 0) - removedAmt);
                const newVariance = newTotal - (old.metrics?.system_ibft_sales || 0);

                return {
                    ...old,
                    ibftEntries: (old.ibftEntries || []).filter((e: ReconciliationIbftEntry) => e.id !== id),
                    metrics: {
                        ...old.metrics,
                        manual_ibft_total: newTotal,
                        ibft_variance: newVariance,
                    },
                };
            });

            return { previousData, dateStr };
        },
        onError: (err: any, _, context) => {
            if (context?.previousData) {
                queryClient.setQueryData(['daily-reconciliation', context.dateStr], context.previousData);
            }
            toast.error(`Failed to remove IBFT: ${err.message}`);
        },
        onSuccess: () => {
            toast.success('IBFT entry removed');
        },
        onSettled: (_, __, { dateStr }) => {
            queryClient.invalidateQueries({ queryKey: ['daily-reconciliation', dateStr] });
        },
    });
};

// Add Manual Card Entry
export const useAddCardEntry = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (entry: {
            entry_date: string;
            amount: number;
            terminal_name?: string;
            description?: string;
            slip_number?: string;
            notes?: string;
        }) => {
            const { data: { user } } = await supabase.auth.getUser();

            const { data, error } = await supabase
                .from('reconciliation_card_entries' as any)
                .insert({
                    entry_date: entry.entry_date,
                    amount: entry.amount,
                    description: entry.description?.trim() || null,
                    terminal_name: entry.terminal_name || null,
                    slip_number: entry.slip_number || null,
                    notes: entry.notes || null,
                    created_by: user?.id || null,
                })
                .select()
                .single();

            if (error) throw error;
            return data as ReconciliationCardEntry;
        },
        onMutate: async (newEntry) => {
            await queryClient.cancelQueries({ queryKey: ['daily-reconciliation', newEntry.entry_date] });
            const previousData = queryClient.getQueryData(['daily-reconciliation', newEntry.entry_date]);

            const tempId = 'temp-' + Date.now();
            const optimisticEntry: ReconciliationCardEntry = {
                id: tempId,
                entry_date: newEntry.entry_date,
                amount: newEntry.amount,
                description: newEntry.description || null,
                terminal_name: newEntry.terminal_name || null,
                slip_number: newEntry.slip_number || null,
                notes: newEntry.notes || null,
                created_by: null,
                created_at: new Date().toISOString(),
            };

            queryClient.setQueryData(['daily-reconciliation', newEntry.entry_date], (old: any) => {
                if (!old) return old;
                const updatedEntries = [optimisticEntry, ...(old.cardEntries || [])];
                const newManualCardTotal = (old.metrics?.manual_card_total || 0) + newEntry.amount;
                const newCardVariance = newManualCardTotal - (old.metrics?.system_card_sales || 0);
                return {
                    ...old,
                    cardEntries: updatedEntries,
                    metrics: {
                        ...old.metrics,
                        manual_card_total: newManualCardTotal,
                        card_variance: newCardVariance,
                    },
                };
            });

            return { previousData, tempId, dateStr: newEntry.entry_date };
        },
        onError: (err: any, _, context) => {
            if (context?.previousData) {
                queryClient.setQueryData(['daily-reconciliation', context.dateStr], context.previousData);
            }
            toast.error(`Failed to record card slip: ${err.message}`);
        },
        onSuccess: (saved, variables, context) => {
            if (saved && context?.tempId) {
                queryClient.setQueryData(['daily-reconciliation', variables.entry_date], (old: any) => {
                    if (!old) return old;
                    return {
                        ...old,
                        cardEntries: (old.cardEntries || []).map((e: ReconciliationCardEntry) => e.id === context.tempId ? saved : e),
                    };
                });
            }
            toast.success('Card slip recorded');
        },
        onSettled: (_, __, variables) => {
            queryClient.invalidateQueries({ queryKey: ['daily-reconciliation', variables.entry_date] });
        },
    });
};

// Delete Manual Card Entry
export const useDeleteCardEntry = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, dateStr }: { id: string; dateStr: string }) => {
            const { error } = await supabase
                .from('reconciliation_card_entries' as any)
                .delete()
                .eq('id', id);

            if (error) throw error;
            return { id, dateStr };
        },
        onMutate: async ({ id, dateStr }) => {
            await queryClient.cancelQueries({ queryKey: ['daily-reconciliation', dateStr] });
            const previousData = queryClient.getQueryData(['daily-reconciliation', dateStr]);

            queryClient.setQueryData(['daily-reconciliation', dateStr], (old: any) => {
                if (!old) return old;
                const removedEntry = (old.cardEntries || []).find((e: ReconciliationCardEntry) => e.id === id);
                const removedAmt = removedEntry ? Number(removedEntry.amount) || 0 : 0;
                const newTotal = Math.max(0, (old.metrics?.manual_card_total || 0) - removedAmt);
                const newVariance = newTotal - (old.metrics?.system_card_sales || 0);

                return {
                    ...old,
                    cardEntries: (old.cardEntries || []).filter((e: ReconciliationCardEntry) => e.id !== id),
                    metrics: {
                        ...old.metrics,
                        manual_card_total: newTotal,
                        card_variance: newVariance,
                    },
                };
            });

            return { previousData, dateStr };
        },
        onError: (err: any, _, context) => {
            if (context?.previousData) {
                queryClient.setQueryData(['daily-reconciliation', context.dateStr], context.previousData);
            }
            toast.error(`Failed to remove card slip: ${err.message}`);
        },
        onSuccess: () => {
            toast.success('Card slip removed');
        },
        onSettled: (_, __, { dateStr }) => {
            queryClient.invalidateQueries({ queryKey: ['daily-reconciliation', dateStr] });
        },
    });
};

// Save Day Closing Record (Non-binding record keeping)
export const useSaveDailyReconciliation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (input: {
            reconciliation_date: string;
            is_grouped?: boolean;
            start_date?: string;
            end_date?: string;
            grouped_dates?: string[];
            system_counter_sales_total: number;
            system_cash_sales: number;
            system_card_sales: number;
            system_ibft_sales: number;
            system_cash_returns: number;
            total_expenses: number;
            cash_expenses: number;
            ibft_expenses: number;
            card_expenses: number;
            manual_ibft_total: number;
            ibft_variance: number;
            manual_card_total: number;
            card_variance: number;
            opening_cash: number;
            expected_cash: number;
            actual_cash: number;
            cash_variance: number;
            denominations: ReconciliationCashDenominations;
            move_to_reserve?: number;
            closing_balance?: number;
            cash_in_reserve?: number;
            sale_adjustments?: number;
            closing_notes?: string;
        }) => {
            const { data: { user } } = await supabase.auth.getUser();

            // If grouping multiple days, clean up any pre-existing single-day records for those dates to prevent duplicates
            if (input.is_grouped && Array.isArray(input.grouped_dates) && input.grouped_dates.length > 1) {
                const otherDates = input.grouped_dates.filter(d => d !== input.reconciliation_date);
                if (otherDates.length > 0) {
                    await supabase
                        .from('daily_reconciliations' as any)
                        .delete()
                        .in('reconciliation_date', otherDates);
                }
            }

            const payload: any = {
                ...input,
                is_grouped: input.is_grouped || false,
                start_date: input.start_date || input.reconciliation_date,
                end_date: input.end_date || input.reconciliation_date,
                grouped_dates: input.grouped_dates && input.grouped_dates.length > 0 ? input.grouped_dates : [input.reconciliation_date],
                status: 'saved',
                closed_by: user?.id || null,
                closed_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };

            const { data, error } = await supabase
                .from('daily_reconciliations' as any)
                .upsert(payload, { onConflict: 'reconciliation_date' })
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['daily-reconciliation'] });
            queryClient.invalidateQueries({ queryKey: ['reconciliation-history'] });
            toast.success(variables.is_grouped ? 'Grouped reconciliation saved to database' : 'Cash & reconciliation details saved to database');
        },
        onError: (err: any) => {
            toast.error(`Failed to save closing record: ${err.message}`);
        },
    });
};

// Ungroup a previously grouped reconciliation record
export const useUngroupDailyReconciliation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id }: { id: string }) => {
            const { error } = await supabase
                .from('daily_reconciliations' as any)
                .delete()
                .eq('id', id);

            if (error) throw error;
            return true;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['daily-reconciliation'] });
            queryClient.invalidateQueries({ queryKey: ['reconciliation-history'] });
            toast.success('Grouped reconciliation uncoupled successfully');
        },
        onError: (err: any) => {
            toast.error(`Failed to ungroup: ${err.message}`);
        },
    });
};
