export type PaymentMethod = 'cash' | 'ibft' | 'card';

export interface DailyExpense {
    id: string;
    expense_date: string;
    category: string;
    description: string;
    amount: number;
    payment_method: PaymentMethod;
    receipt_no: string | null;
    notes: string | null;
    created_by: string | null;
    created_at: string;
}

export interface ReconciliationIbftEntry {
    id: string;
    entry_date: string;
    description?: string | null;
    amount: number;
    bank_name: string | null;
    reference_no: string | null;
    notes: string | null;
    created_by: string | null;
    created_at: string;
}

export interface ReconciliationCardEntry {
    id: string;
    entry_date: string;
    terminal_name: string | null;
    description?: string | null;
    amount: number;
    slip_number: string | null;
    notes: string | null;
    created_by: string | null;
    created_at: string;
}

export interface ReconciliationCashDenominations {
    notes_5000: number;
    notes_1000: number;
    notes_500: number;
    notes_100: number;
    notes_50: number;
    notes_20: number;
    notes_10: number;
    coins: number;
}

export interface DailyReconciliationRecord {
    id: string;
    reconciliation_date: string;
    status: 'saved' | 'reviewed';
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
    closing_notes: string | null;
    closed_by: string | null;
    closed_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface CounterSaleSummaryItem {
    id: string;
    sale_number: string;
    created_at: string;
    customer_name: string;
    payment_method: string;
    total_amount: number;
    cash_amount: number;
    card_amount: number;
    ibft_amount: number;
    is_mixed: boolean;
}
