
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useCustomer, useCustomerCompleteHistory } from "@/hooks/useCustomers";
import { ArrowLeft, User, Phone, Mail, MapPin, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { format, startOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";
import { DateRangePickerWithPresets } from "@/components/ui/date-range-picker";
import { useStoreSettings } from "@/hooks/useStoreSettings";
import { printCustomerLedger } from "@/utils/printCustomerLedger";
import { Loader2 } from "lucide-react";

const CustomerDetails = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const { data: customer, isLoading: isCustomerLoading } = useCustomer(id);
    const { data: history, isLoading: isHistoryLoading } = useCustomerCompleteHistory(id);
    const { data: storeSettings } = useStoreSettings();

    // Default: All Time
    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

    if (isCustomerLoading || isHistoryLoading) {
        return (
            <div className="h-full flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!customer) {
        return (
            <div className="p-6">
                <h1 className="text-2xl font-bold text-destructive">Customer not found</h1>
                <Button variant="outline" onClick={() => navigate('/customers')} className="mt-4">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Customers
                </Button>
            </div>
        );
    }

    // 1. Process Data
    const allCreditSales = history?.pendingCreditSales || []; // Contains all credit sales (pending, delivered, completed)

    // Filter Completed to identify Payments linked to completed credit sales
    const completedCreditSaleIds = new Set(
        allCreditSales
            .filter((s: any) => s.status === 'completed' && s.sale_id)
            .map((s: any) => s.sale_id)
    );

    // Format all credit sales:
    // Compute original bill amount before returns so returns can be presented as separate line items
    const formattedCreditSales = allCreditSales.map((cs: any) => {
        const returnedAmount = (cs.items as any[] || []).reduce((sum: number, item: any) => {
            const ret = item.quantity_returned || item.returned || 0;
            const price = item.unit_price || item.price || 0;
            return sum + (ret * price);
        }, 0);
        const billAmount = (cs.total_amount || 0) + returnedAmount;

        return {
            ...cs,
            type: 'credit_sale',
            date: new Date(cs.created_at),
            total_amount: billAmount,
            amount: billAmount
        };
    });

    // Filter out duplicate credit sale completion payments that have payment_number starting with 'PAY-AK'
    // (since credit sale settlements are already captured by the completion sales record above)
    const nonCreditPayments = (history?.payments || []).filter((p: any) =>
        !p.payment_number?.startsWith('PAY-AK')
    );

    // Combine into allTransactions
    const allTransactions = [
        ...(history?.sales || []).map((s: any) => {
            // Check if this sale is actually a payment for a credit sale
            if (completedCreditSaleIds.has(s.id)) {
                return {
                    ...s,
                    type: 'payment',
                    date: new Date(s.created_at),
                    isCreditPayment: true,
                    amount: s.total_amount // Crucial fix: add amount for consistency
                };
            }
            return { ...s, type: 'sale', date: new Date(s.created_at) };
        }),
        ...(history?.returns || []).map((r: any) => ({ ...r, type: 'return', date: new Date(r.created_at) })),
        ...nonCreditPayments.map((p: any) => ({ ...p, type: 'payment', date: new Date(p.created_at) })),
        ...formattedCreditSales
    ].sort((a, b) => b.date.getTime() - a.date.getTime());

    // 2. Current Balance directly from synchronized customer account
    const trueCurrentBalance = customer.current_balance || 0;

    // 3. Filter Transactions by Date Range
    const fromDate = dateRange?.from ? startOfDay(dateRange.from) : null;
    const toDate = dateRange?.to ? startOfDay(dateRange.to) : (fromDate || null);
    if (toDate) toDate.setHours(23, 59, 59, 999); // End of day

    const filteredTransactions = allTransactions.filter(tx => {
        if (!fromDate) return true;
        const txDate = new Date(tx.date);
        if (toDate) return txDate >= fromDate && txDate <= toDate;
        return txDate >= fromDate;
    });

    // 4. Calculate Opening Balance
    // Start with True Current Balance (End state), and reverse transactions back to `fromDate`.
    let openingBalance = trueCurrentBalance;
    if (fromDate) {
        const txsSinceStart = allTransactions.filter(tx => new Date(tx.date) >= fromDate);
        txsSinceStart.forEach(tx => {
            const amt = tx.amount ?? tx.total_amount ?? 0;
            if (tx.type === 'credit_sale') openingBalance -= amt;
            if (tx.type === 'return' && (tx.refund_method === 'credit' || tx.return_type === 'credit' || !tx.refund_method)) openingBalance += amt;
            if (tx.type === 'payment') openingBalance += amt;
            // Sales (Paid) have 0 effect on debt balance
        });
    } else {
        openingBalance = 0;
    }

    // Prepare Date Range String for Print
    const dateRangeStr = fromDate && toDate
        ? `${format(fromDate, 'dd MMM yyyy')} - ${format(toDate, 'dd MMM yyyy')}`
        : fromDate
            ? `Since ${format(fromDate, 'dd MMM yyyy')}`
            : 'All Time';

    const handlePrint = () => {
        printCustomerLedger(
            customer,
            // Pass transactions in CHRONOLOGICAL (Oldest first) order for the ledger calculation content
            // Currently filteredTransactions is Newest first (descending). Reverse it.
            [...filteredTransactions].reverse(),
            openingBalance,
            dateRangeStr,
            storeSettings
        );
    };

    return (
        <div className="bg-white min-h-screen">
            <div className="p-4 md:p-6 space-y-6 animate-in fade-in duration-500">
                {/* Header */}
                <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="-ml-2 text-muted-foreground hover:text-foreground"
                            onClick={() => navigate('/customers')}
                        >
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Back
                        </Button>
                        <h1 className="text-xl font-semibold">Customer Details</h1>
                    </div>

                    <div className="bg-white rounded-lg border shadow-sm p-6">
                        <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-6">
                            <div className="flex items-start gap-4">
                                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
                                    <User className="w-8 h-8 text-primary" />
                                </div>
                                <div className="space-y-1">
                                    <h1 className="text-2xl font-bold tracking-tight">{customer.name}</h1>
                                    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
                                        {customer.phone && (
                                            <div className="flex items-center gap-1.5 bg-muted/30 px-2 py-0.5 rounded-md">
                                                <Phone className="w-3.5 h-3.5" />
                                                <span>{customer.phone}</span>
                                            </div>
                                        )}
                                        {customer.email && (
                                            <div className="flex items-center gap-1.5 bg-muted/30 px-2 py-0.5 rounded-md">
                                                <Mail className="w-3.5 h-3.5" />
                                                <span>{customer.email}</span>
                                            </div>
                                        )}
                                        {customer.address && (
                                            <div className="flex items-center gap-1.5 bg-muted/30 px-2 py-0.5 rounded-md">
                                                <MapPin className="w-3.5 h-3.5" />
                                                <span>{customer.address}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-4 min-w-[300px] border-t lg:border-t-0 lg:border-l pt-4 lg:pt-0 pl-0 lg:pl-6">
                                <div className="flex-1 space-y-1">
                                    <p className="text-sm font-medium text-muted-foreground">Current Balance</p>
                                    <div className="flex items-center gap-2">
                                        <span className={cn(
                                            "text-2xl font-bold tracking-tight",
                                            trueCurrentBalance > 0 ? "text-warning" : "text-success"
                                        )}>
                                            Rs. {trueCurrentBalance.toLocaleString()}
                                        </span>
                                        <Badge variant={trueCurrentBalance > 0 ? "outline" : "default"}
                                            className={cn(
                                                "ml-auto sm:ml-0",
                                                trueCurrentBalance > 0
                                                    ? "border-warning/50 text-warning bg-warning/5"
                                                    : "bg-success hover:bg-success text-success-foreground"
                                            )}
                                        >
                                            {trueCurrentBalance > 0 ? "Receivable" : "Clear"}
                                        </Badge>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Controls */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <h2 className="text-lg font-semibold">Transaction History</h2>
                    <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                        <DateRangePickerWithPresets
                            date={dateRange}
                            setDate={setDateRange}
                        />
                        <Button variant="outline" onClick={handlePrint}>
                            <Printer className="w-4 h-4 mr-2" />
                            Print Ledger
                        </Button>
                    </div>
                </div>

                {/* Transaction Table */}
                <div className="rounded-md border bg-white shadow-sm overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/50">
                                <TableHead>Date</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Description / Items</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {fromDate && (
                                <TableRow className="bg-muted/30 font-medium">
                                    <TableCell className="font-medium text-muted-foreground py-3">
                                        {format(fromDate, 'dd MMM yyyy')}
                                    </TableCell>
                                    <TableCell className="py-3">
                                        <Badge variant="outline" className="bg-muted text-muted-foreground border-border">Opening</Badge>
                                    </TableCell>
                                    <TableCell className="py-3">
                                        <div className="flex flex-col gap-0.5">
                                            <span className="font-medium text-sm">Opening Balance</span>
                                            <span className="text-xs text-muted-foreground">Balance brought forward from previous period</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right font-medium py-3 text-warning">
                                        Rs. {openingBalance.toLocaleString()}
                                    </TableCell>
                                </TableRow>
                            )}

                            {filteredTransactions.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                        No transactions found for the selected period.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredTransactions.map((tx: any) => {
                                    const isSale = tx.type === 'sale';
                                    const isCreditSale = tx.type === 'credit_sale';
                                    const isReturn = tx.type === 'return';
                                    const isPayment = tx.type === 'payment';

                                    return (
                                        <TableRow key={`${tx.type}-${tx.id}`} className="hover:bg-muted/50">
                                            <TableCell className="font-medium text-muted-foreground align-top py-3">
                                                {format(tx.date, 'dd MMM yyyy HH:mm')}
                                            </TableCell>
                                            <TableCell className="align-top py-3">
                                                {isSale && <Badge variant="outline" className="bg-success/10 text-success border-success/20">Sale</Badge>}
                                                {isCreditSale && (
                                                    <Badge variant="outline" className={cn(
                                                        tx.status === 'completed' ? "bg-blue-50 text-blue-700 border-blue-200" :
                                                        tx.status === 'delivered' ? "bg-muted text-muted-foreground border-border" :
                                                        "bg-warning/10 text-warning border-warning/20"
                                                    )}>
                                                        {tx.status === 'completed' ? 'Credit (Paid)' : tx.status === 'delivered' ? 'Credit (Delivered)' : 'Credit'}
                                                    </Badge>
                                                )}
                                                {isReturn && <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">Return</Badge>}
                                                {isPayment && <Badge variant="outline" className="bg-success/10 text-success border-success/20">Payment</Badge>}
                                            </TableCell>
                                            <TableCell className="max-w-[300px] align-top py-3">
                                                <div className="flex flex-col gap-1">
                                                    <span className="font-medium text-sm">
                                                        {isSale && `Sale #${tx.sale_number}`}
                                                        {isCreditSale && `Bill #${tx.bill_number}`}
                                                        {isReturn && `Return #${tx.return_number}`}
                                                        {isPayment && (tx.payment_number ? `Payment #${tx.payment_number}` : 'Payment Received')}
                                                    </span>

                                                    {/* Item Details */}
                                                    {(isSale || isCreditSale || isReturn) && (
                                                        <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                                                            {(isReturn ? tx.return_items : (isSale ? tx.sale_items : tx.items))?.map((item: any, i: number) => {
                                                                const ret = item.quantity_returned || item.returned || 0;
                                                                return (
                                                                    <span key={i} className="block truncate">
                                                                        {item.product_name} x {item.quantity}
                                                                        {ret > 0 && ` (Ret: ${ret})`}
                                                                    </span>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                    {/* Payment Description (Empty/Simple) */}
                                                    {isPayment && tx.payment_number && <span className="text-xs text-muted-foreground">Payment Received</span>}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right font-medium align-top py-3">
                                                <span className={cn(
                                                    isSale && "text-success",
                                                    isCreditSale && "text-warning",
                                                    isReturn && "text-destructive",
                                                    isPayment && "text-success"
                                                )}>
                                                    Rs. {(tx.amount ?? tx.total_amount ?? 0).toLocaleString()}
                                                </span>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    );
};

export default CustomerDetails;
