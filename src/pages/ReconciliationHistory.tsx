import React, { useState } from 'react';
import { format } from 'date-fns';
import {
    History,
    Calendar,
    Printer,
    CheckCircle2,
    Eye,
    Coins,
    DollarSign,
    Building2,
    CreditCard,
    FileText,
    FileCheck2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useReconciliationHistory } from '@/hooks/useReconciliation';
import { DailyReconciliationRecord, DailyExpense } from '@/types/reconciliation';
import { printReconciliationReport } from '@/utils/printReconciliationReport';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

export const ReconciliationHistory: React.FC = () => {
    const navigate = useNavigate();
    const { data: history = [], isLoading } = useReconciliationHistory();
    const { data: storeSettings } = useStoreSettings();
    const [selectedRecord, setSelectedRecord] = useState<DailyReconciliationRecord | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState<boolean>(false);

    const handlePrint = async (record: DailyReconciliationRecord, format: '80mm' | 'a5' = '80mm') => {
        let expenses: DailyExpense[] = [];
        try {
            let expQuery = supabase.from('daily_expenses' as any).select('*');
            if (record.is_grouped && record.grouped_dates && record.grouped_dates.length > 0) {
                expQuery = expQuery.in('expense_date', record.grouped_dates);
            } else {
                expQuery = expQuery.eq('expense_date', record.reconciliation_date);
            }
            const { data: expData } = await expQuery.order('created_at', { ascending: true });
            if (expData) expenses = expData as DailyExpense[];
        } catch (e) {
            console.error("Could not fetch expenses for historical report:", e);
        }

        printReconciliationReport(
            {
                record,
                expenses,
                storeName: storeSettings?.store_name || "AK RETAIL POS",
                storeAddress: storeSettings?.address || "",
                storePhone: storeSettings?.phone || "",
            },
            format
        );
    };

    return (
        <div className="h-full flex flex-col p-4 md:p-6 2xl:p-8 2xl:max-w-[1750px] 2xl:mx-auto w-full space-y-6 2xl:space-y-8 overflow-y-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4 2xl:pb-6">
                <div>
                    <div className="flex items-center gap-3">
                        <History className="w-6 h-6 2xl:w-7 2xl:h-7 text-primary" />
                        <h1 className="text-2xl 2xl:text-3xl font-bold tracking-tight text-foreground">
                            Closing Records & Audit History
                        </h1>
                    </div>
                    <p className="text-xs 2xl:text-sm text-muted-foreground mt-0.5">
                        Historical log of saved end-of-day reconciliations, denomination counts, and discrepancies.
                    </p>
                </div>

                <Button
                    onClick={() => navigate('/reconciliation')}
                    size="sm"
                    className="h-9 2xl:h-10 text-xs 2xl:text-sm px-3 2xl:px-4 font-semibold"
                >
                    Back to Today's Reconciliation
                </Button>
            </div>

            {/* History Table */}
            <Card className="shadow-sm">
                <CardHeader className="pb-3 2xl:pb-4 border-b">
                    <CardTitle className="text-sm 2xl:text-base font-bold">Saved Daily Closings</CardTitle>
                    <CardDescription className="text-xs 2xl:text-sm">
                        Click on any day to view detailed breakdown or reprint the closing receipt.
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="text-xs 2xl:text-sm">
                                <TableHead className="2xl:py-3.5 2xl:text-sm">Date</TableHead>
                                <TableHead className="text-right 2xl:py-3.5 2xl:text-sm">System Sales</TableHead>
                                <TableHead className="text-right 2xl:py-3.5 2xl:text-sm">Expenses</TableHead>
                                <TableHead className="text-right 2xl:py-3.5 2xl:text-sm">Physical Cash</TableHead>
                                <TableHead className="text-right 2xl:py-3.5 2xl:text-sm">IBFT</TableHead>
                                <TableHead className="text-right 2xl:py-3.5 2xl:text-sm">Card Payments</TableHead>
                                <TableHead className="text-right 2xl:py-3.5 2xl:text-sm">Collected Sales</TableHead>
                                <TableHead className="text-center 2xl:py-3.5 2xl:text-sm">Variance</TableHead>
                                <TableHead className="text-right 2xl:py-3.5 2xl:text-sm">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="text-center py-10 2xl:py-14 text-xs 2xl:text-sm text-muted-foreground">
                                        Loading reconciliation records...
                                    </TableCell>
                                </TableRow>
                            ) : history.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="text-center py-10 2xl:py-14 text-xs 2xl:text-sm text-muted-foreground">
                                        No daily reconciliation records saved yet. Save a closing snapshot from the Daily Reconciliation tab.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                history.map((rec) => {
                                    const saleAdj = Number(rec.sale_adjustments) || 0;
                                    const ibftVar = Number(rec.ibft_variance) || 0;
                                    const cardVar = Number(rec.card_variance) || 0;
                                    const totalPhysical = (Number(rec.actual_cash) || 0) + (Number(rec.cash_in_reserve) || 0);

                                    const netCashFromSales = totalPhysical - (Number(rec.opening_cash) || 0) + (Number(rec.cash_expenses) || 0);
                                    const collectedSales = netCashFromSales + (Number(rec.manual_ibft_total) || 0) + (Number(rec.manual_card_total) || 0);
                                    const netSales = (Number(rec.system_counter_sales_total) || 0) - (Number(rec.system_cash_returns) || 0) + saleAdj;
                                    const grandVariance = collectedSales - netSales;

                                    return (
                                        <TableRow key={rec.id} className="text-xs 2xl:text-sm hover:bg-muted/40">
                                            <TableCell className="font-semibold text-foreground 2xl:py-3.5">
                                                {rec.is_grouped ? (
                                                    <div>
                                                        <div className="flex items-center gap-1.5 whitespace-nowrap">
                                                            <Calendar className="w-3.5 h-3.5 2xl:w-4 2xl:h-4 text-primary" />
                                                            <span>
                                                                {format(new Date((rec.start_date || rec.reconciliation_date) + 'T00:00:00'), 'dd MMM')} &ndash; {format(new Date((rec.end_date || rec.reconciliation_date) + 'T00:00:00'), 'dd MMM yyyy')}
                                                            </span>
                                                        </div>
                                                        <div className="mt-1">
                                                            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-[10px] 2xl:text-xs font-semibold py-0 px-1.5">
                                                                Grouped ({rec.grouped_dates?.length || 2} Days)
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2">
                                                        <Calendar className="w-3.5 h-3.5 2xl:w-4 2xl:h-4 text-muted-foreground" />
                                                        {rec.reconciliation_date}
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right 2xl:py-3.5">
                                                <div className="font-medium text-foreground">
                                                    Rs. {netSales.toLocaleString()}
                                                </div>
                                                {(saleAdj !== 0 || Number(rec.system_cash_returns || 0) > 0) && (
                                                    <div className="text-[10px] 2xl:text-xs text-muted-foreground font-normal">
                                                        Gross: {Number(rec.system_counter_sales_total).toLocaleString()}
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right text-amber-700 font-medium 2xl:py-3.5">
                                                Rs. {Number(rec.total_expenses).toLocaleString()}
                                            </TableCell>
                                            <TableCell className="text-right 2xl:py-3.5">
                                                <div className="font-bold text-foreground">
                                                    Rs. {totalPhysical.toLocaleString()}
                                                </div>
                                                <div className="text-[10px] 2xl:text-xs text-muted-foreground font-normal whitespace-nowrap">
                                                    Res: {Number(rec.cash_in_reserve || 0).toLocaleString()} | Drawer: {Number(rec.actual_cash || 0).toLocaleString()} | Res. Drawer: {Number(rec.move_to_reserve || 0).toLocaleString()}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right 2xl:py-3.5">
                                                <div className="font-semibold text-foreground">
                                                    Rs. {Number(rec.manual_ibft_total || 0).toLocaleString()}
                                                </div>
                                                <div className="mt-0.5">
                                                    <Badge
                                                        variant="outline"
                                                        className={`text-[10px] 2xl:text-xs font-semibold py-0.5 px-2 ${
                                                            ibftVar === 0
                                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                                : ibftVar > 0
                                                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                                                : 'bg-rose-50 text-rose-700 border-rose-200'
                                                        }`}
                                                    >
                                                        {ibftVar === 0 ? 'Matched' : `${ibftVar > 0 ? '+' : ''}${ibftVar.toLocaleString()}`}
                                                    </Badge>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right 2xl:py-3.5">
                                                <div className="font-semibold text-foreground">
                                                    Rs. {Number(rec.manual_card_total || 0).toLocaleString()}
                                                </div>
                                                <div className="mt-0.5">
                                                    <Badge
                                                        variant="outline"
                                                        className={`text-[10px] 2xl:text-xs font-semibold py-0.5 px-2 ${
                                                            cardVar === 0
                                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                                : cardVar > 0
                                                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                                                : 'bg-rose-50 text-rose-700 border-rose-200'
                                                        }`}
                                                    >
                                                        {cardVar === 0 ? 'Matched' : `${cardVar > 0 ? '+' : ''}${cardVar.toLocaleString()}`}
                                                    </Badge>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right font-bold text-foreground 2xl:py-3.5">
                                                Rs. {collectedSales.toLocaleString()}
                                            </TableCell>
                                            <TableCell className="text-center 2xl:py-3.5">
                                                <Badge
                                                    variant="outline"
                                                    className={`text-[10px] 2xl:text-xs font-semibold py-0.5 px-2 ${
                                                        grandVariance === 0
                                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                            : grandVariance > 0
                                                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                                                            : 'bg-rose-50 text-rose-700 border-rose-200'
                                                    }`}
                                                >
                                                    {grandVariance === 0 ? 'Balanced' : `${grandVariance > 0 ? '+' : ''}${grandVariance.toLocaleString()}`}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right space-x-1 2xl:py-3.5">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7 2xl:h-8 2xl:w-8 text-muted-foreground hover:bg-primary hover:text-white dark:hover:text-white transition-colors [&_svg]:transition-colors hover:[&_svg]:text-white"
                                                    onClick={() => {
                                                        setSelectedRecord(rec);
                                                        setIsDetailOpen(true);
                                                    }}
                                                    title="View breakdown"
                                                >
                                                    <Eye className="w-3.5 h-3.5 2xl:w-4 2xl:h-4 text-inherit" />
                                                </Button>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-7 w-7 2xl:h-8 2xl:w-8 text-muted-foreground hover:bg-primary hover:text-white dark:hover:text-white transition-colors [&_svg]:transition-colors hover:[&_svg]:text-white"
                                                            title="Print closing report"
                                                        >
                                                            <Printer className="w-3.5 h-3.5 2xl:w-4 2xl:h-4 text-inherit" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-48 2xl:w-52">
                                                        <DropdownMenuItem
                                                            className="cursor-pointer text-xs 2xl:text-sm flex items-center gap-2 py-2"
                                                            onClick={() => handlePrint(rec, '80mm')}
                                                        >
                                                            <Printer className="w-4 h-4 text-muted-foreground" />
                                                            <span>80mm Thermal Slip</span>
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            className="cursor-pointer text-xs 2xl:text-sm flex items-center gap-2 py-2"
                                                            onClick={() => handlePrint(rec, 'a5')}
                                                        >
                                                            <FileCheck2 className="w-4 h-4 text-muted-foreground" />
                                                            <span>A5 Executive Report</span>
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Record Detail Dialog */}
            <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
                <DialogContent className="sm:max-w-lg 2xl:max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-base 2xl:text-lg font-bold flex items-center justify-between">
                            <span>
                                {selectedRecord?.is_grouped
                                    ? `Closing Record – ${format(new Date((selectedRecord.start_date || selectedRecord.reconciliation_date) + 'T00:00:00'), 'dd MMM')} to ${format(new Date((selectedRecord.end_date || selectedRecord.reconciliation_date) + 'T00:00:00'), 'dd MMM yyyy')} (${selectedRecord.grouped_dates?.length || 2} Days)`
                                    : `Closing Record – ${selectedRecord?.reconciliation_date}`
                                }
                            </span>
                            <div className="flex items-center gap-1.5">
                                {selectedRecord?.is_grouped && (
                                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-xs 2xl:text-sm">
                                        Grouped ({selectedRecord.grouped_dates?.length || 2} Days)
                                    </Badge>
                                )}
                                <Badge variant="outline" className="bg-success/10 text-success border-success/30 text-xs 2xl:text-sm">
                                    <CheckCircle2 className="w-3 h-3 2xl:w-3.5 2xl:h-3.5 mr-1" />
                                    Saved Record
                                </Badge>
                            </div>
                        </DialogTitle>
                    </DialogHeader>

                    {selectedRecord && (() => {
                        const histSaleAdj = Number(selectedRecord.sale_adjustments) || 0;
                        const histTotalPhysical = Number(selectedRecord.actual_cash || 0) + Number(selectedRecord.cash_in_reserve || 0);
                        const histNetCashFromSales = histTotalPhysical - Number(selectedRecord.opening_cash || 0) + Number(selectedRecord.cash_expenses || 0);
                        const histTotalCollections = histNetCashFromSales + Number(selectedRecord.manual_ibft_total || 0) + Number(selectedRecord.manual_card_total || 0);
                        const histNetSales = Number(selectedRecord.system_counter_sales_total || 0) - Number(selectedRecord.system_cash_returns || 0) + histSaleAdj;
                        const histGrandVariance = histTotalCollections - histNetSales;

                        return (
                        <div className="space-y-4 2xl:space-y-5 py-2 text-xs 2xl:text-sm">
                            {/* Grand Collections Variance Callout */}
                            <div
                                className={`p-2.5 2xl:p-3.5 rounded-lg border flex items-center justify-between font-semibold ${
                                    histGrandVariance === 0
                                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                        : histGrandVariance > 0
                                        ? 'bg-blue-50 text-blue-800 border-blue-200'
                                        : 'bg-rose-50 text-rose-800 border-rose-200'
                                }`}
                            >
                                <div>
                                    <span className="block text-[11px] 2xl:text-xs uppercase tracking-wider">Overall Grand Collections Variance</span>
                                    <span className="text-[10px] 2xl:text-xs opacity-80 font-normal">
                                        Total Collections (Rs. {histTotalCollections.toLocaleString()}) − Net Sales (Rs. {histNetSales.toLocaleString()})
                                    </span>
                                </div>
                                <div className="text-base 2xl:text-xl font-bold">
                                    {histGrandVariance >= 0 ? '+' : ''}Rs. {histGrandVariance.toLocaleString()}
                                </div>
                            </div>

                            {/* Sales & Expense summary */}
                            <div className="grid grid-cols-2 gap-3 2xl:gap-4 bg-muted/40 p-3 2xl:p-4 rounded-lg border">
                                <div>
                                    <span className="text-muted-foreground">Net System Recorded Sales:</span>
                                    <div className="font-bold text-sm 2xl:text-base text-foreground">
                                        Rs. {histNetSales.toLocaleString()}
                                    </div>
                                    <div className="text-[10px] 2xl:text-xs text-muted-foreground mt-0.5">
                                        Gross: {Number(selectedRecord.system_counter_sales_total).toLocaleString()}
                                        {Number(selectedRecord.system_cash_returns || 0) > 0 && ` | Returns: -Rs. ${Number(selectedRecord.system_cash_returns).toLocaleString()}`}
                                        {histSaleAdj !== 0 && ` | Adj: ${histSaleAdj >= 0 ? '+' : ''}Rs. ${histSaleAdj.toLocaleString()}`}
                                    </div>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Total Expenses:</span>
                                    <div className="font-bold text-sm 2xl:text-base text-amber-700">
                                        Rs. {Number(selectedRecord.total_expenses).toLocaleString()}
                                    </div>
                                    <div className="text-[10px] 2xl:text-xs text-muted-foreground mt-0.5">
                                        Cash: {Number(selectedRecord.cash_expenses).toLocaleString()} | Card: {Number(selectedRecord.card_expenses).toLocaleString()} | IBFT: {Number(selectedRecord.ibft_expenses).toLocaleString()}
                                    </div>
                                </div>
                            </div>

                            {/* Digital Variances */}
                            <div className="grid grid-cols-2 gap-3 2xl:gap-4">
                                <div className="p-2.5 2xl:p-3.5 rounded-lg border bg-card">
                                    <span className="font-semibold text-foreground">IBFT Reconciliation</span>
                                    <div className="flex justify-between mt-1 text-muted-foreground">
                                        <span>Target: Rs. {Number(selectedRecord.system_ibft_sales).toLocaleString()}</span>
                                        <span>Actual: Rs. {Number(selectedRecord.manual_ibft_total).toLocaleString()}</span>
                                    </div>
                                    <div className="text-right font-bold mt-1 text-foreground">
                                        Variance: Rs. {Number(selectedRecord.ibft_variance).toLocaleString()}
                                    </div>
                                </div>

                                <div className="p-2.5 2xl:p-3.5 rounded-lg border bg-card">
                                    <span className="font-semibold text-foreground">Card Reconciliation</span>
                                    <div className="flex justify-between mt-1 text-muted-foreground">
                                        <span>Target: Rs. {Number(selectedRecord.system_card_sales).toLocaleString()}</span>
                                        <span>Actual: Rs. {Number(selectedRecord.manual_card_total).toLocaleString()}</span>
                                    </div>
                                    <div className="text-right font-bold mt-1 text-foreground">
                                        Variance: Rs. {Number(selectedRecord.card_variance).toLocaleString()}
                                    </div>
                                </div>
                            </div>

                            {/* Cash Flow */}
                            <div className="p-3 2xl:p-4 rounded-lg border bg-muted/20 space-y-1.5 2xl:space-y-2">
                                <span className="font-bold text-foreground">Cash Drawer Reconciliation</span>
                                <div className="flex justify-between text-muted-foreground">
                                    <span>Opening Balance:</span>
                                    <span>Rs. {Number(selectedRecord.opening_cash).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-muted-foreground">
                                    <span>Expected Drawer Cash:</span>
                                    <span>Rs. {Number(selectedRecord.expected_cash).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-muted-foreground">
                                    <span>Cash in Reserve:</span>
                                    <span>Rs. {Number(selectedRecord.cash_in_reserve || 0).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between font-bold text-foreground">
                                    <span>Cash in Drawer:</span>
                                    <span>Rs. {Number(selectedRecord.actual_cash).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between font-bold text-foreground border-t pt-1">
                                    <span>Total Physical Cash:</span>
                                    <span>Rs. {(Number(selectedRecord.actual_cash || 0) + Number(selectedRecord.cash_in_reserve || 0)).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between font-bold text-foreground">
                                    <span>Drawer Variance:</span>
                                    <span>{Number(selectedRecord.cash_variance) >= 0 ? '+' : ''}Rs. {Number(selectedRecord.cash_variance).toLocaleString()}</span>
                                </div>
                                {selectedRecord.move_to_reserve !== undefined && Number(selectedRecord.move_to_reserve) > 0 && (
                                    <div className="flex justify-between text-muted-foreground border-t pt-1">
                                        <span>Move to Reserve:</span>
                                        <span className="font-semibold text-foreground">Rs. {Number(selectedRecord.move_to_reserve).toLocaleString()}</span>
                                    </div>
                                )}
                                {selectedRecord.closing_balance !== undefined && (
                                    <div className="flex justify-between font-bold text-primary">
                                        <span>Closing Balance:</span>
                                        <span>Rs. {Number(selectedRecord.closing_balance).toLocaleString()}</span>
                                    </div>
                                )}
                            </div>

                            {/* Denominations */}
                            {selectedRecord.denominations && (
                                <div className="p-3 2xl:p-4 rounded-lg border bg-card">
                                    <span className="font-semibold text-foreground block mb-2">Denominations Breakdown</span>
                                    <div className="grid grid-cols-4 gap-2 text-[11px] 2xl:text-xs text-muted-foreground">
                                        <div>5000: <span className="font-bold text-foreground">{selectedRecord.denominations.notes_5000 || 0}</span></div>
                                        <div>1000: <span className="font-bold text-foreground">{selectedRecord.denominations.notes_1000 || 0}</span></div>
                                        <div>500: <span className="font-bold text-foreground">{selectedRecord.denominations.notes_500 || 0}</span></div>
                                        <div>100: <span className="font-bold text-foreground">{selectedRecord.denominations.notes_100 || 0}</span></div>
                                        <div>50: <span className="font-bold text-foreground">{selectedRecord.denominations.notes_50 || 0}</span></div>
                                        <div>20: <span className="font-bold text-foreground">{selectedRecord.denominations.notes_20 || 0}</span></div>
                                        <div>10: <span className="font-bold text-foreground">{selectedRecord.denominations.notes_10 || 0}</span></div>
                                        <div>Coins: <span className="font-bold text-foreground">{selectedRecord.denominations.coins || 0}</span></div>
                                    </div>
                                </div>
                            )}

                            {selectedRecord.closing_notes && (
                                <div className="p-2.5 2xl:p-3.5 rounded-lg border bg-amber-50/40 text-amber-900">
                                    <span className="font-bold block mb-0.5">Closing Notes:</span>
                                    <div>{selectedRecord.closing_notes}</div>
                                </div>
                            )}
                        </div>
                        );
                    })()}

                    <DialogFooter className="flex justify-between items-center sm:justify-between w-full pt-2">
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                className="2xl:h-10 2xl:text-sm 2xl:px-4"
                                onClick={() => selectedRecord && handlePrint(selectedRecord, '80mm')}
                            >
                                <Printer className="w-3.5 h-3.5 2xl:w-4 2xl:h-4 mr-1" />
                                80mm Slip
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="2xl:h-10 2xl:text-sm 2xl:px-4"
                                onClick={() => selectedRecord && handlePrint(selectedRecord, 'a5')}
                            >
                                <FileCheck2 className="w-3.5 h-3.5 2xl:w-4 2xl:h-4 mr-1" />
                                A5 Report
                            </Button>
                        </div>
                        <Button size="sm" className="2xl:h-10 2xl:text-sm 2xl:px-4" onClick={() => setIsDetailOpen(false)}>
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default ReconciliationHistory;
