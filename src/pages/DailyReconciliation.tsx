import React, { useState, useEffect, useMemo, useRef } from 'react';
import { format, subDays } from 'date-fns';
import {
    Wallet,
    CreditCard,
    Building2,
    DollarSign,
    Plus,
    Trash2,
    Printer,
    Save,
    CheckCircle2,
    AlertTriangle,
    Coins,
    RefreshCw,
    ArrowUpRight,
    ArrowDownLeft,
    Calendar as CalendarIcon,
    Scale,
    Receipt,
    TrendingUp,
    FileCheck2,
    Layers,
    Coffee,
    CalendarRange,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
    useDayReconciliation,
    useAddDailyExpense,
    useDeleteDailyExpense,
    useAddIbftEntry,
    useDeleteIbftEntry,
    useAddCardEntry,
    useDeleteCardEntry,
    useSaveDailyReconciliation,
    useUngroupDailyReconciliation,
} from '@/hooks/useReconciliation';
import { ReconciliationCashDenominations } from '@/types/reconciliation';
import { printReconciliationReport } from '@/utils/printReconciliationReport';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import { toast } from 'sonner';

const INITIAL_DENOMINATIONS: ReconciliationCashDenominations = {
    notes_5000: 0,
    notes_1000: 0,
    notes_500: 0,
    notes_100: 0,
    notes_50: 0,
    notes_20: 0,
    notes_10: 0,
    coins: 0,
};

export const DailyReconciliation: React.FC = () => {
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const { data: storeSettings } = useStoreSettings();

    // Day Grouping state
    const [isGroupMode, setIsGroupMode] = useState<boolean>(false);
    const [groupStartDate, setGroupStartDate] = useState<Date>(() => subDays(new Date(), 1));
    const [groupEndDate, setGroupEndDate] = useState<Date>(() => new Date());

    // Generate consecutive dates array if in group mode
    const customGroupDatesStr = useMemo(() => {
        if (!isGroupMode) return undefined;
        const start = groupStartDate < groupEndDate ? groupStartDate : groupEndDate;
        const end = groupStartDate < groupEndDate ? groupEndDate : groupStartDate;
        const dates: string[] = [];
        let curr = new Date(start);
        while (curr <= end) {
            dates.push(format(curr, 'yyyy-MM-dd'));
            curr = new Date(curr.getTime() + 24 * 60 * 60 * 1000);
        }
        return dates;
    }, [isGroupMode, groupStartDate, groupEndDate]);

    // Denominations & Float state
    const [openingCash, setOpeningCash] = useState<number>(0);
    const [denominations, setDenominations] = useState<ReconciliationCashDenominations>(INITIAL_DENOMINATIONS);
    const [closingNotes, setClosingNotes] = useState<string>('');
    const [moveToReserve, setMoveToReserve] = useState<number>(0);
    const [cashInReserve, setCashInReserve] = useState<number>(0);
    const [saleAdjustments, setSaleAdjustments] = useState<number>(0);

    // Streamlined Quick Add States & Input Refs
    const [expenseDetail, setExpenseDetail] = useState<string>('');
    const [expenseAmount, setExpenseAmount] = useState<string>('');
    const expenseDetailRef = useRef<HTMLInputElement>(null);
    const expenseAmountRef = useRef<HTMLInputElement>(null);

    const [ibftAmount, setIbftAmount] = useState<string>('');
    const ibftAmountRef = useRef<HTMLInputElement>(null);

    const [cardAmount, setCardAmount] = useState<string>('');
    const cardAmountRef = useRef<HTMLInputElement>(null);

    // Query & Mutations
    const { data, isLoading, refetch } = useDayReconciliation(selectedDate, customGroupDatesStr);
    const addExpense = useAddDailyExpense();
    const deleteExpense = useDeleteDailyExpense();
    const addIbft = useAddIbftEntry();
    const deleteIbft = useDeleteIbftEntry();
    const addCard = useAddCardEntry();
    const deleteCard = useDeleteCardEntry();
    const saveReconciliation = useSaveDailyReconciliation();
    const ungroupMutation = useUngroupDailyReconciliation();

    // Pre-fill saved closing record or auto-carryover from previous day
    useEffect(() => {
        if (data?.savedRecord) {
            if (data.savedRecord.is_grouped) {
                setIsGroupMode(true);
                if (data.savedRecord.start_date) {
                    setGroupStartDate(new Date(data.savedRecord.start_date + 'T00:00:00'));
                }
                if (data.savedRecord.end_date) {
                    setGroupEndDate(new Date(data.savedRecord.end_date + 'T00:00:00'));
                }
            }
            setOpeningCash(Number(data.savedRecord.opening_cash) || 0);
            setMoveToReserve(Number(data.savedRecord.move_to_reserve) || 0);
            setCashInReserve(Number(data.savedRecord.cash_in_reserve) || 0);
            setSaleAdjustments(Number(data.savedRecord.sale_adjustments) || 0);
            if (data.savedRecord.denominations) {
                setDenominations({
                    ...INITIAL_DENOMINATIONS,
                    ...data.savedRecord.denominations,
                });
            }
            setClosingNotes(data.savedRecord.closing_notes || '');
        } else {
            // Unsaved draft: automatically carry over previous day's closing balance into opening balance
            const carriedOpening = data?.previousRecord ? Number(data.previousRecord.closing_balance) || 0 : 0;
            setOpeningCash(carriedOpening);
            setMoveToReserve(0);
            setCashInReserve(0);
            setSaleAdjustments(0);
            setDenominations(INITIAL_DENOMINATIONS);
            setClosingNotes('');
        }
    }, [data?.savedRecord, data?.previousRecord, data?.dateStr]);

    // Physical Cash Calculation from Denominations
    const physicalCash = useMemo(() => {
        return (
            (Number(denominations.notes_5000) || 0) * 5000 +
            (Number(denominations.notes_1000) || 0) * 1000 +
            (Number(denominations.notes_500) || 0) * 500 +
            (Number(denominations.notes_100) || 0) * 100 +
            (Number(denominations.notes_50) || 0) * 50 +
            (Number(denominations.notes_20) || 0) * 20 +
            (Number(denominations.notes_10) || 0) * 10 +
            (Number(denominations.coins) || 0)
        );
    }, [denominations]);

    // Expected Cash Drawer Calculation
    const expectedCash = useMemo(() => {
        const cashSales = data?.metrics.system_cash_sales || 0;
        const cashReturns = data?.metrics.system_cash_returns || 0;
        const cashExpenses = data?.metrics.cash_expenses || 0;
        return openingCash + cashSales + saleAdjustments - cashReturns - cashExpenses;
    }, [openingCash, saleAdjustments, data?.metrics]);

    const totalPhysicalCash = physicalCash + cashInReserve;
    const cashVariance = totalPhysicalCash - expectedCash;

    // Closing Balance to carryover as next day's opening balance
    const closingBalance = useMemo(() => {
        return Math.max(0, physicalCash - moveToReserve);
    }, [physicalCash, moveToReserve]);

    // Net Cash collections derived from sales (Physical cash adjusted for opening balance and expenses)
    const netCashFromSales = useMemo(() => {
        const cashExpenses = data?.metrics.cash_expenses || 0;
        return totalPhysicalCash - openingCash + cashExpenses;
    }, [totalPhysicalCash, openingCash, data?.metrics?.cash_expenses]);

    // Grand Totals for Summary Tab
    const totalRecordedCollections = useMemo(() => {
        return netCashFromSales + (data?.metrics.manual_ibft_total || 0) + (data?.metrics.manual_card_total || 0);
    }, [netCashFromSales, data?.metrics?.manual_ibft_total, data?.metrics?.manual_card_total]);

    const netSystemRecordedSales = useMemo(() => {
        return Math.max(0, (data?.metrics.system_counter_sales_total || 0) - (data?.metrics.system_cash_returns || 0) + saleAdjustments);
    }, [data?.metrics.system_counter_sales_total, data?.metrics.system_cash_returns, saleAdjustments]);
    const netSystemCounterSales = netSystemRecordedSales; // alias

    const grandSalesVariance = useMemo(() => {
        return totalRecordedCollections - netSystemRecordedSales;
    }, [totalRecordedCollections, netSystemRecordedSales]);

    // High Speed Submit Handlers
    const handleQuickAddExpense = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const amt = parseFloat(expenseAmount);
        const detail = expenseDetail.trim();
        if (!detail) {
            toast.error('Please enter expense detail');
            expenseDetailRef.current?.focus();
            return;
        }
        if (isNaN(amt) || amt <= 0) {
            toast.error('Please enter a valid amount');
            expenseAmountRef.current?.focus();
            return;
        }

        // Instantly clear inputs & refocus for zero-latency typing
        setExpenseDetail('');
        setExpenseAmount('');
        expenseDetailRef.current?.focus();

        addExpense.mutate({
            expense_date: effectiveEndDate,
            description: detail,
            amount: amt,
            payment_method: 'cash',
        });
    };

    const handleGoToPreviousWorkingDay = () => {
        const offDays = data?.weeklyOffDays || storeSettings?.weekly_off_days || ['friday'];
        let target = subDays(selectedDate, 1);
        let safety = 0;
        while (safety < 7) {
            const dayName = format(target, 'EEEE').toLowerCase();
            if (!offDays.includes(dayName)) {
                break;
            }
            target = subDays(target, 1);
            safety++;
        }
        setSelectedDate(target);
    };

    const effectiveIsGrouped = isGroupMode || Boolean(data?.savedRecord?.is_grouped);
    const effectiveStartDate = effectiveIsGrouped
        ? (data?.savedRecord?.start_date || data?.startDateStr || (customGroupDatesStr ? customGroupDatesStr[0] : format(groupStartDate, 'yyyy-MM-dd')))
        : (data?.dateStr || format(selectedDate, 'yyyy-MM-dd'));
    const effectiveEndDate = effectiveIsGrouped
        ? (data?.savedRecord?.end_date || data?.endDateStr || (customGroupDatesStr ? customGroupDatesStr[customGroupDatesStr.length - 1] : format(groupEndDate, 'yyyy-MM-dd')))
        : (data?.dateStr || format(selectedDate, 'yyyy-MM-dd'));
    const effectiveGroupedDates = effectiveIsGrouped
        ? (data?.savedRecord?.grouped_dates || data?.effectiveDates || customGroupDatesStr || [effectiveEndDate])
        : [effectiveEndDate];

    const handleQuickAddIbft = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const amt = parseFloat(ibftAmount);
        if (isNaN(amt) || amt <= 0) {
            toast.error('Please enter a valid amount');
            ibftAmountRef.current?.focus();
            return;
        }

        // Instantly clear input & refocus for zero-latency typing
        setIbftAmount('');
        ibftAmountRef.current?.focus();

        addIbft.mutate({
            entry_date: effectiveEndDate,
            amount: amt,
        });
    };

    const handleQuickAddCard = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const amt = parseFloat(cardAmount);
        if (isNaN(amt) || amt <= 0) {
            toast.error('Please enter a valid amount');
            cardAmountRef.current?.focus();
            return;
        }

        // Instantly clear input & refocus for zero-latency typing
        setCardAmount('');
        cardAmountRef.current?.focus();

        addCard.mutate({
            entry_date: effectiveEndDate,
            amount: amt,
        });
    };

    const handleSaveClosing = async () => {
        if (!data) return;

        await saveReconciliation.mutateAsync({
            reconciliation_date: effectiveEndDate,
            is_grouped: effectiveIsGrouped,
            start_date: effectiveStartDate,
            end_date: effectiveEndDate,
            grouped_dates: effectiveGroupedDates,
            system_counter_sales_total: data.metrics.system_counter_sales_total,
            system_cash_sales: data.metrics.system_cash_sales,
            system_card_sales: data.metrics.system_card_sales,
            system_ibft_sales: data.metrics.system_ibft_sales,
            system_cash_returns: data.metrics.system_cash_returns,
            total_expenses: data.metrics.total_expenses,
            cash_expenses: data.metrics.cash_expenses,
            ibft_expenses: data.metrics.ibft_expenses,
            card_expenses: data.metrics.card_expenses,
            manual_ibft_total: data.metrics.manual_ibft_total,
            ibft_variance: data.metrics.ibft_variance,
            manual_card_total: data.metrics.manual_card_total,
            card_variance: data.metrics.card_variance,
            opening_cash: openingCash,
            expected_cash: expectedCash,
            actual_cash: physicalCash,
            cash_variance: cashVariance,
            denominations,
            move_to_reserve: moveToReserve,
            closing_balance: closingBalance,
            cash_in_reserve: cashInReserve,
            sale_adjustments: saleAdjustments,
            closing_notes: closingNotes.trim() || data.savedRecord?.closing_notes || undefined,
        });
    };

    const handlePrint = (formatType: '80mm' | 'a5') => {
        if (!data) return;
        printReconciliationReport(
            {
                record: {
                    reconciliation_date: effectiveEndDate,
                    is_grouped: effectiveIsGrouped,
                    start_date: effectiveStartDate,
                    end_date: effectiveEndDate,
                    grouped_dates: effectiveGroupedDates,
                    system_counter_sales_total: data.metrics.system_counter_sales_total,
                    system_cash_sales: data.metrics.system_cash_sales,
                    system_card_sales: data.metrics.system_card_sales,
                    system_ibft_sales: data.metrics.system_ibft_sales,
                    system_cash_returns: data.metrics.system_cash_returns,
                    total_expenses: data.metrics.total_expenses,
                    cash_expenses: data.metrics.cash_expenses,
                    ibft_expenses: data.metrics.ibft_expenses,
                    card_expenses: data.metrics.card_expenses,
                    manual_ibft_total: data.metrics.manual_ibft_total,
                    ibft_variance: data.metrics.ibft_variance,
                    manual_card_total: data.metrics.manual_card_total,
                    card_variance: data.metrics.card_variance,
                    opening_cash: openingCash,
                    expected_cash: expectedCash,
                    actual_cash: physicalCash,
                    cash_variance: cashVariance,
                    denominations,
                    move_to_reserve: moveToReserve,
                    closing_balance: closingBalance,
                    cash_in_reserve: cashInReserve,
                    sale_adjustments: saleAdjustments,
                    closing_notes: closingNotes,
                },
                expenses: data.expenses,
                storeName: storeSettings?.store_name || "AK RETAIL POS",
                storeAddress: storeSettings?.address || "",
                storePhone: storeSettings?.phone || "",
            },
            formatType
        );
    };

    return (
        <div className="h-full flex flex-col p-4 md:p-6 2xl:p-8 2xl:max-w-[1750px] 2xl:mx-auto w-full overflow-hidden">
            {/* Header & Date Controls - Designed Symmetrically with Sales Summary */}
            <div className="flex-none flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 pb-3 2xl:pb-4 border-b">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl 2xl:text-3xl font-bold tracking-tight text-foreground">
                            {effectiveIsGrouped ? "Grouped Reconciliation" : "Daily Reconciliation"}
                        </h1>
                        {data?.savedRecord ? (
                            <Badge variant="outline" className="bg-success/10 text-success border-success/30 flex items-center gap-1.5 py-0.5 2xl:py-1 2xl:px-3 2xl:text-sm">
                                <CheckCircle2 className="w-3.5 h-3.5 2xl:w-4 2xl:h-4" />
                                Saved to Records
                            </Badge>
                        ) : (
                            <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 flex items-center gap-1.5 py-0.5 2xl:py-1 2xl:px-3 2xl:text-sm">
                                <AlertTriangle className="w-3.5 h-3.5 2xl:w-4 2xl:h-4" />
                                Unsaved Draft
                            </Badge>
                        )}
                        {effectiveIsGrouped && (
                            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 flex items-center gap-1.5 py-0.5 2xl:py-1 2xl:px-3 2xl:text-sm font-semibold">
                                <Layers className="w-3.5 h-3.5 2xl:w-4 2xl:h-4" />
                                Grouped ({effectiveGroupedDates.length} Days)
                            </Badge>
                        )}
                    </div>
                    <p className="text-xs 2xl:text-sm text-muted-foreground mt-0.5">
                        {effectiveIsGrouped
                            ? `Multi-day combined audit closeout covering ${format(new Date(effectiveStartDate + 'T00:00:00'), "dd MMM")} to ${format(new Date(effectiveEndDate + 'T00:00:00'), "dd MMM yyyy")}.`
                            : "End-of-day record keeping & audit closeout matching System Sales against physical cash and digital deposits."
                        }
                    </p>
                </div>

                {/* Date Controls & Mode Toggle */}
                <div className="flex flex-wrap items-center gap-2">
                    {/* Mode Toggle Button: Single Day vs Group Days */}
                    {!data?.savedRecord?.is_grouped && (
                        <Button
                            variant={isGroupMode ? "default" : "outline"}
                            size="sm"
                            onClick={() => {
                                if (isGroupMode) {
                                    setIsGroupMode(false);
                                } else {
                                    setIsGroupMode(true);
                                    setGroupStartDate(subDays(selectedDate, 1));
                                    setGroupEndDate(selectedDate);
                                }
                            }}
                            className="h-9 2xl:h-10 text-xs 2xl:text-sm font-semibold gap-1.5 px-3"
                        >
                            <Layers className="w-3.5 h-3.5 2xl:w-4 2xl:h-4" />
                            {isGroupMode ? "Single Day Mode" : "Group Days"}
                        </Button>
                    )}

                    {/* Date Pickers */}
                    {isGroupMode ? (
                        <div className="flex items-center gap-1.5 bg-muted/40 p-1 rounded-lg border">
                            <div className="flex items-center gap-1">
                                <span className="text-[11px] 2xl:text-xs text-muted-foreground font-semibold px-1">From:</span>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-8 2xl:h-9 text-xs 2xl:text-sm font-normal px-2.5"
                                        >
                                            <CalendarIcon className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
                                            {format(groupStartDate, "dd MMM yyyy")}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                            mode="single"
                                            selected={groupStartDate}
                                            onSelect={(d) => d && setGroupStartDate(d)}
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>

                            <div className="flex items-center gap-1">
                                <span className="text-[11px] 2xl:text-xs text-muted-foreground font-semibold px-1">To:</span>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-8 2xl:h-9 text-xs 2xl:text-sm font-normal px-2.5"
                                        >
                                            <CalendarIcon className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
                                            {format(groupEndDate, "dd MMM yyyy")}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="end">
                                        <Calendar
                                            mode="single"
                                            selected={groupEndDate}
                                            onSelect={(d) => d && setGroupEndDate(d)}
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </div>
                    ) : (
                        <div className="w-[180px] sm:w-[200px] 2xl:w-[230px]">
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className="w-full justify-start text-left font-normal h-9 2xl:h-10 text-xs 2xl:text-sm"
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                                        {format(selectedDate, "dd MMMM yyyy")}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="end">
                                    <Calendar
                                        mode="single"
                                        selected={selectedDate}
                                        onSelect={(d) => d && setSelectedDate(d)}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                    )}

                    <div className="flex items-center gap-1">
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-9 2xl:h-10 text-xs 2xl:text-sm rounded-md px-2.5 2xl:px-3.5"
                            onClick={() => {
                                setSelectedDate(new Date());
                                if (isGroupMode) {
                                    setGroupStartDate(subDays(new Date(), 1));
                                    setGroupEndDate(new Date());
                                }
                            }}
                        >
                            Today
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-9 2xl:h-10 text-xs 2xl:text-sm rounded-md px-2.5 2xl:px-3.5"
                            onClick={handleGoToPreviousWorkingDay}
                            title="Go to previous trading day (skipping weekly off days)"
                        >
                            Prev Working Day
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => refetch()}
                            disabled={isLoading}
                            title="Refresh data"
                            className="h-9 2xl:h-10 px-2.5 2xl:px-3.5"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 2xl:w-4 2xl:h-4 ${isLoading ? 'animate-spin' : ''}`} />
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePrint('80mm')}
                            className="h-9 2xl:h-10 text-xs 2xl:text-sm px-2.5 2xl:px-3.5"
                            title="Print 80mm Thermal Receipt"
                        >
                            <Printer className="w-3.5 h-3.5 2xl:w-4 2xl:h-4 mr-1" />
                            80mm
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePrint('a5')}
                            className="h-9 2xl:h-10 text-xs 2xl:text-sm px-2.5 2xl:px-3.5"
                            title="Print A5 Executive Report"
                        >
                            <FileCheck2 className="w-3.5 h-3.5 2xl:w-4 2xl:h-4 mr-1" />
                            A5 Report
                        </Button>
                    </div>
                </div>
            </div>

            {/* Scheduled Weekly Off Day Banner */}
            {data?.isScheduledOffDay && !data?.savedRecord && !effectiveIsGrouped && (
                <div className="flex-none flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 2xl:p-4 rounded-xl border bg-blue-50/70 border-blue-200 text-blue-900 my-2 2xl:my-2.5 gap-2">
                    <div className="flex items-center gap-2.5">
                        <Coffee className="w-5 h-5 text-blue-600 flex-shrink-0" />
                        <div>
                            <span className="font-bold text-xs 2xl:text-sm">
                                Scheduled Weekly Off Day ({format(selectedDate, 'EEEE')}) &mdash; Retail Store Closed
                            </span>
                            <p className="text-[11px] 2xl:text-xs text-blue-800/80">
                                This day is configured as an off day in Store Settings. Previous closing float carries over automatically to the next working day.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <Button
                            variant="outline"
                            size="sm"
                            className="bg-white hover:bg-blue-50 text-xs 2xl:text-sm h-8 2xl:h-9 border-blue-300 font-semibold"
                            onClick={() => {
                                setIsGroupMode(true);
                                setGroupStartDate(subDays(selectedDate, 1));
                                setGroupEndDate(selectedDate);
                            }}
                        >
                            <Layers className="w-3.5 h-3.5 mr-1 text-primary" />
                            Group with Yesterday
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="bg-white hover:bg-blue-50 text-xs 2xl:text-sm h-8 2xl:h-9 border-blue-300 font-semibold"
                            onClick={handleGoToPreviousWorkingDay}
                        >
                            Go to Prev Working Day
                        </Button>
                    </div>
                </div>
            )}

            {/* Group Period Banner */}
            {effectiveIsGrouped && (
                <div className="flex-none flex flex-wrap items-center justify-between p-2.5 2xl:p-3 rounded-xl border bg-primary/5 border-primary/20 text-foreground my-2 2xl:my-2.5 gap-2">
                    <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 2xl:w-5 2xl:h-5 text-primary flex-shrink-0" />
                        <span className="text-xs 2xl:text-sm font-bold">
                            Grouped Period ({effectiveGroupedDates.length} Days):
                            <span className="ml-1 text-primary font-black">
                                {format(new Date(effectiveStartDate + 'T00:00:00'), "dd MMM yyyy")} &mdash; {format(new Date(effectiveEndDate + 'T00:00:00'), "dd MMM yyyy")}
                            </span>
                        </span>
                        <Badge variant="outline" className="text-[10px] 2xl:text-xs bg-background py-0.5 px-2">
                            Sales & Expenses Combined
                        </Badge>
                    </div>
                    {data?.savedRecord?.is_grouped ? (
                        <Button
                            variant="ghost"
                            size="sm"
                            disabled={ungroupMutation.isPending}
                            onClick={async () => {
                                if (confirm(`Are you sure you want to uncouple this grouped reconciliation (${format(new Date(effectiveStartDate + 'T00:00:00'), "dd MMM")} – ${format(new Date(effectiveEndDate + 'T00:00:00'), "dd MMM")})?`)) {
                                    await ungroupMutation.mutateAsync({ id: data.savedRecord.id });
                                    setIsGroupMode(false);
                                }
                            }}
                            className="text-xs 2xl:text-sm text-destructive hover:bg-destructive/10 h-7 2xl:h-8"
                        >
                            <Trash2 className="w-3.5 h-3.5 mr-1" /> Ungroup Days
                        </Button>
                    ) : (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsGroupMode(false)}
                            className="text-xs 2xl:text-sm text-muted-foreground hover:text-foreground h-7 2xl:h-8"
                        >
                            Cancel Grouping
                        </Button>
                    )}
                </div>
            )}

            {/* 4 Top KPI Cards - Ordered in exact synchronization with tabs below (Expenses -> IBFT -> Card -> Cash) */}
            <div className="flex-none grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 2xl:gap-4 my-3 2xl:my-4">
                {/* 1. Daily Expenses Card (Matches Tab 1: Daily Expenses) */}
                <div className="rounded-xl border border-border bg-card p-3.5 2xl:p-4">
                    <div className="flex items-center justify-between text-muted-foreground mb-1">
                        <div className="flex items-center gap-1.5 text-xs 2xl:text-sm font-medium">
                            <DollarSign className="w-4 h-4 2xl:w-5 2xl:h-5 text-primary" />
                            <span>Daily Expenses</span>
                        </div>
                        <span className="text-[11px] 2xl:text-xs font-semibold px-2 py-0.5 2xl:px-2.5 2xl:py-1 rounded-md bg-muted text-muted-foreground">
                            {data?.expenses.length || 0} entries
                        </span>
                    </div>
                    <p className="text-xl md:text-2xl 2xl:text-3xl font-bold text-amber-600">
                        Rs. {(data?.metrics.total_expenses || 0).toLocaleString()}
                    </p>
                    <p className="text-[11px] 2xl:text-xs text-muted-foreground mt-0.5">
                        Cash: Rs. {(data?.metrics.cash_expenses || 0).toLocaleString()}
                    </p>
                </div>

                {/* 2. IBFT Transfers Card (Matches Tab 2: IBFT and Card) */}
                <div className="rounded-xl border border-border bg-card p-3.5 2xl:p-4">
                    <div className="flex items-center justify-between text-muted-foreground mb-1">
                        <div className="flex items-center gap-1.5 text-xs 2xl:text-sm font-medium">
                            <Building2 className="w-4 h-4 2xl:w-5 2xl:h-5 text-primary" />
                            <span>IBFT Transfers</span>
                        </div>
                        <span
                            className={cn(
                                "text-[11px] 2xl:text-xs font-semibold px-2 py-0.5 2xl:px-2.5 2xl:py-1 rounded-md",
                                (data?.metrics.ibft_variance || 0) === 0
                                    ? "bg-success/10 text-success"
                                    : (data?.metrics.ibft_variance || 0) > 0
                                    ? "bg-blue-500/10 text-blue-600"
                                    : "bg-destructive/10 text-destructive"
                            )}
                        >
                            {(data?.metrics.ibft_variance || 0) === 0
                                ? "Matched"
                                : `${(data?.metrics.ibft_variance || 0) > 0 ? '+' : ''}${(data?.metrics.ibft_variance || 0).toLocaleString()}`}
                        </span>
                    </div>
                    <p className="text-xl md:text-2xl 2xl:text-3xl font-bold text-foreground">
                        Rs. {(data?.metrics.manual_ibft_total || 0).toLocaleString()}
                    </p>
                    <p className="text-[11px] 2xl:text-xs text-muted-foreground mt-0.5">
                        Target: Rs. {(data?.metrics.system_ibft_sales || 0).toLocaleString()}
                    </p>
                </div>

                {/* 3. Card Payments Card (Matches Tab 2: IBFT and Card) */}
                <div className="rounded-xl border border-border bg-card p-3.5 2xl:p-4">
                    <div className="flex items-center justify-between text-muted-foreground mb-1">
                        <div className="flex items-center gap-1.5 text-xs 2xl:text-sm font-medium">
                            <CreditCard className="w-4 h-4 2xl:w-5 2xl:h-5 text-primary" />
                            <span>Card Payments</span>
                        </div>
                        <span
                            className={cn(
                                "text-[11px] 2xl:text-xs font-semibold px-2 py-0.5 2xl:px-2.5 2xl:py-1 rounded-md",
                                (data?.metrics.card_variance || 0) === 0
                                    ? "bg-success/10 text-success"
                                    : (data?.metrics.card_variance || 0) > 0
                                    ? "bg-blue-500/10 text-blue-600"
                                    : "bg-destructive/10 text-destructive"
                            )}
                        >
                            {(data?.metrics.card_variance || 0) === 0
                                ? "Matched"
                                : `${(data?.metrics.card_variance || 0) > 0 ? '+' : ''}${(data?.metrics.card_variance || 0).toLocaleString()}`}
                        </span>
                    </div>
                    <p className="text-xl md:text-2xl 2xl:text-3xl font-bold text-foreground">
                        Rs. {(data?.metrics.manual_card_total || 0).toLocaleString()}
                    </p>
                    <p className="text-[11px] 2xl:text-xs text-muted-foreground mt-0.5">
                        Target: Rs. {(data?.metrics.system_card_sales || 0).toLocaleString()}
                    </p>
                </div>

                {/* 4. Cash in Drawer Card (Matches Tab 3: Cash Reconciliation) */}
                <div className="rounded-xl border border-border bg-card p-3.5 2xl:p-4">
                    <div className="flex items-center justify-between text-muted-foreground mb-1">
                        <div className="flex items-center gap-1.5 text-xs 2xl:text-sm font-medium">
                            <Wallet className="w-4 h-4 2xl:w-5 2xl:h-5 text-primary" />
                            <span>Cash in Drawer</span>
                        </div>
                        <span
                            className={cn(
                                "text-[11px] 2xl:text-xs font-semibold px-2 py-0.5 2xl:px-2.5 2xl:py-1 rounded-md",
                                cashVariance === 0
                                    ? "bg-success/10 text-success"
                                    : cashVariance > 0
                                    ? "bg-blue-500/10 text-blue-600"
                                    : "bg-destructive/10 text-destructive"
                            )}
                        >
                            {cashVariance === 0 ? "Balanced" : `${cashVariance > 0 ? '+' : ''}${cashVariance.toLocaleString()}`}
                        </span>
                    </div>
                    <p className="text-xl md:text-2xl 2xl:text-3xl font-bold text-foreground">
                        Rs. {physicalCash.toLocaleString()}
                    </p>
                    <p className="text-[11px] 2xl:text-xs text-muted-foreground mt-0.5">
                        Expected: Rs. {expectedCash.toLocaleString()}
                        {cashInReserve > 0 ? ` (Reserve: Rs. ${cashInReserve.toLocaleString()})` : ''}
                    </p>
                </div>
            </div>

            {/* Restructured Tabs: 1. Daily Expenses, 2. IBFT and Card, 3. Cash Reconciliation, 4. Summary */}
            <Tabs defaultValue="expenses" className="flex-1 min-h-0 flex flex-col overflow-hidden">
                <TabsList className="flex-none grid grid-cols-4 w-full h-10 2xl:h-12 p-1 bg-muted/80 rounded-xl mb-3 2xl:mb-4">
                    <TabsTrigger value="expenses" className="rounded-lg text-xs md:text-sm 2xl:text-base font-semibold flex items-center justify-center gap-2">
                        <DollarSign className="w-4 h-4 2xl:w-5 2xl:h-5" />
                        Daily Expenses
                    </TabsTrigger>
                    <TabsTrigger value="ibft_card" className="rounded-lg text-xs md:text-sm 2xl:text-base font-semibold flex items-center justify-center gap-2">
                        <Building2 className="w-4 h-4 2xl:w-5 2xl:h-5" />
                        IBFT and Card
                    </TabsTrigger>
                    <TabsTrigger value="cash" className="rounded-lg text-xs md:text-sm 2xl:text-base font-semibold flex items-center justify-center gap-2">
                        <Coins className="w-4 h-4 2xl:w-5 2xl:h-5" />
                        Cash Reconciliation
                    </TabsTrigger>
                    <TabsTrigger value="summary" className="rounded-lg text-xs md:text-sm 2xl:text-base font-semibold flex items-center justify-center gap-2">
                        <Scale className="w-4 h-4 2xl:w-5 2xl:h-5" />
                        Summary & Close
                    </TabsTrigger>
                </TabsList>

                {/* TAB 1: DAILY EXPENSES */}
                <TabsContent
                    value="expenses"
                    className="flex-1 min-h-0 data-[state=inactive]:hidden data-[state=active]:flex data-[state=active]:flex-col space-y-3 2xl:space-y-4 overflow-hidden focus-visible:outline-none mt-0"
                >
                    {/* Simplified High-Speed Inline Entry: Detail + Amount -> Press Enter */}
                    <form onSubmit={handleQuickAddExpense} className="flex-none flex items-center gap-2 bg-card p-2.5 2xl:p-3.5 rounded-xl border">
                        <div className="flex-1">
                            <Input
                                ref={expenseDetailRef}
                                placeholder="Enter Detail of Expense (e.g. Staff tea, cleaning supplies)..."
                                value={expenseDetail}
                                onChange={(e) => setExpenseDetail(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !expenseAmount) {
                                        e.preventDefault();
                                        expenseAmountRef.current?.focus();
                                    }
                                }}
                                className="h-9 2xl:h-11 text-sm 2xl:text-base font-medium"
                                autoFocus
                            />
                        </div>
                        <div className="w-36 sm:w-44 2xl:w-52">
                            <Input
                                ref={expenseAmountRef}
                                type="number"
                                min="0"
                                placeholder="Amount (Rs.)"
                                value={expenseAmount}
                                onChange={(e) => setExpenseAmount(e.target.value)}
                                className="h-9 2xl:h-11 text-sm 2xl:text-base font-bold"
                            />
                        </div>
                        <Button
                            type="submit"
                            size="sm"
                            disabled={addExpense.isPending}
                            className="h-9 2xl:h-11 text-xs 2xl:text-sm px-4 2xl:px-6 font-semibold"
                        >
                            <Plus className="w-3.5 h-3.5 2xl:w-4 2xl:h-4 mr-1" />
                            Add (Enter)
                        </Button>
                    </form>

                    {/* Scrollable Expenses Ledger */}
                    <div className="flex-1 min-h-0 rounded-xl border border-border bg-card overflow-y-auto [&>div]:overflow-visible">
                        <Table>
                            <TableHeader className="sticky top-0 bg-card z-10 shadow-sm">
                                <TableRow>
                                    <TableHead className="font-semibold text-foreground text-sm 2xl:text-base py-2.5 2xl:py-3.5">Detail of Expense</TableHead>
                                    <TableHead className="w-32 2xl:w-36 font-semibold text-foreground text-sm 2xl:text-base py-2.5 2xl:py-3.5">Time</TableHead>
                                    <TableHead className="text-right w-44 2xl:w-52 font-semibold text-foreground text-sm 2xl:text-base py-2.5 2xl:py-3.5">Amount</TableHead>
                                    <TableHead className="w-12 py-2.5 2xl:py-3.5"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data?.expenses.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-12 text-sm 2xl:text-base text-muted-foreground">
                                            No expenses recorded for this date. Type the detail and amount above and press Enter.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    data?.expenses.map((expense) => (
                                        <TableRow key={expense.id} className="hover:bg-muted/40 transition-colors">
                                            <TableCell className="font-medium text-[15px] 2xl:text-base text-foreground py-2.5 2xl:py-3">
                                                <span>{expense.description}</span>
                                                {effectiveIsGrouped && expense.expense_date && (
                                                    <Badge variant="outline" className="ml-2 text-[10px] 2xl:text-xs font-normal py-0 px-1.5 bg-muted/60">
                                                        {format(new Date(expense.expense_date + 'T00:00:00'), 'dd MMM')}
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-xs 2xl:text-sm py-2.5 2xl:py-3">
                                                {format(new Date(expense.created_at), 'hh:mm a')}
                                            </TableCell>
                                            <TableCell className="text-right font-bold text-[15px] 2xl:text-base text-amber-700 tabular-nums py-2.5 2xl:py-3">
                                                Rs. {Number(expense.amount).toLocaleString()}
                                            </TableCell>
                                            <TableCell className="py-2.5 2xl:py-3">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7 2xl:h-8 2xl:w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                    onClick={() =>
                                                        deleteExpense.mutate({
                                                            id: expense.id,
                                                            dateStr: data?.dateStr || '',
                                                        })
                                                    }
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </TabsContent>

                {/* TAB 2: IBFT AND CARD (MERGED TAB) */}
                <TabsContent
                    value="ibft_card"
                    className="flex-1 min-h-0 data-[state=inactive]:hidden data-[state=active]:grid data-[state=active]:grid-cols-1 lg:data-[state=active]:grid-cols-2 gap-4 2xl:gap-6 overflow-hidden focus-visible:outline-none mt-0"
                >
                    {/* LEFT COLUMN: IBFT */}
                    <div className="flex-1 min-h-0 flex flex-col space-y-2.5 2xl:space-y-3.5 overflow-hidden rounded-xl border border-border bg-card p-3 2xl:p-4">
                        <div className="flex-none flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Building2 className="w-4 h-4 2xl:w-5 2xl:h-5 text-primary" />
                                <span className="font-bold text-sm 2xl:text-base">IBFT Transactions</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs 2xl:text-sm">
                                <span className="text-muted-foreground">Target: Rs. {(data?.metrics.system_ibft_sales || 0).toLocaleString()}</span>
                                <Badge
                                    variant="outline"
                                    className={cn(
                                        "text-[10px] 2xl:text-xs font-semibold py-0.5 2xl:py-1 px-2 2xl:px-2.5",
                                        (data?.metrics.ibft_variance || 0) === 0 ? "bg-success/10 text-success border-success/30" : "bg-destructive/10 text-destructive"
                                    )}
                                >
                                    {(data?.metrics.ibft_variance || 0) === 0 ? "Matched" : `Var: ${(data?.metrics.ibft_variance || 0).toLocaleString()}`}
                                </Badge>
                            </div>
                        </div>

                        {/* Inline Fast Add IBFT */}
                        <form onSubmit={handleQuickAddIbft} className="flex-none flex items-center gap-2">
                            <div className="relative flex-1">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs 2xl:text-sm font-semibold text-muted-foreground">Rs.</span>
                                <Input
                                    ref={ibftAmountRef}
                                    type="number"
                                    min="0"
                                    placeholder="Enter IBFT Amount & Press Enter..."
                                    value={ibftAmount}
                                    onChange={(e) => setIbftAmount(e.target.value)}
                                    className="h-8 2xl:h-10 pl-8 2xl:pl-9 text-xs 2xl:text-sm font-bold"
                                    autoFocus
                                />
                            </div>
                            <Button type="submit" size="sm" disabled={addIbft.isPending} className="h-8 2xl:h-10 text-xs 2xl:text-sm px-3 2xl:px-4 font-semibold">
                                <Plus className="w-3.5 h-3.5 2xl:w-4 2xl:h-4 mr-1" /> Add
                            </Button>
                        </form>

                        {/* Scrollable IBFT Table */}
                        <div className="flex-1 min-h-0 border rounded-lg overflow-y-auto [&>div]:overflow-visible">
                            <Table>
                                <TableHeader className="sticky top-0 bg-card z-10 shadow-sm">
                                    <TableRow className="text-xs 2xl:text-sm">
                                        <TableHead className="w-12">#</TableHead>
                                        <TableHead className="w-28 2xl:w-32 text-muted-foreground">Time</TableHead>
                                        <TableHead className="text-right">Amount</TableHead>
                                        <TableHead className="w-10"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {data?.ibftEntries.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center py-8 text-xs 2xl:text-sm text-muted-foreground">
                                                No manual IBFT entries recorded. Type amount above and press Enter.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        data?.ibftEntries.map((entry, idx) => (
                                            <TableRow key={entry.id} className="text-xs 2xl:text-sm hover:bg-muted/40">
                                                <TableCell className="font-mono text-muted-foreground py-2 2xl:py-2.5 text-[11px] 2xl:text-xs">
                                                    #{data.ibftEntries.length - idx}
                                                </TableCell>
                                                <TableCell className="text-muted-foreground text-[11px] 2xl:text-xs py-2 2xl:py-2.5">
                                                    {format(new Date(entry.created_at), 'hh:mm a')}
                                                </TableCell>
                                                <TableCell className="text-right font-bold text-foreground py-2 2xl:py-2.5">
                                                    Rs. {Number(entry.amount).toLocaleString()}
                                                </TableCell>
                                                <TableCell className="py-2 2xl:py-2.5">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6 2xl:h-7 2xl:w-7 text-muted-foreground hover:text-destructive"
                                                        onClick={() =>
                                                            deleteIbft.mutate({
                                                                id: entry.id,
                                                                dateStr: data?.dateStr || '',
                                                            })
                                                        }
                                                    >
                                                        <Trash2 className="w-3 h-3 2xl:w-3.5 2xl:h-3.5" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: CARD */}
                    <div className="flex-1 min-h-0 flex flex-col space-y-2.5 2xl:space-y-3.5 overflow-hidden rounded-xl border border-border bg-card p-3 2xl:p-4">
                        <div className="flex-none flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <CreditCard className="w-4 h-4 2xl:w-5 2xl:h-5 text-primary" />
                                <span className="font-bold text-sm 2xl:text-base">Card Payments</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs 2xl:text-sm">
                                <span className="text-muted-foreground">Target: Rs. {(data?.metrics.system_card_sales || 0).toLocaleString()}</span>
                                <Badge
                                    variant="outline"
                                    className={cn(
                                        "text-[10px] 2xl:text-xs font-semibold py-0.5 2xl:py-1 px-2 2xl:px-2.5",
                                        (data?.metrics.card_variance || 0) === 0 ? "bg-success/10 text-success border-success/30" : "bg-destructive/10 text-destructive"
                                    )}
                                >
                                    {(data?.metrics.card_variance || 0) === 0 ? "Matched" : `Var: ${(data?.metrics.card_variance || 0).toLocaleString()}`}
                                </Badge>
                            </div>
                        </div>

                        {/* Inline Fast Add Card */}
                        <form onSubmit={handleQuickAddCard} className="flex-none flex items-center gap-2">
                            <div className="relative flex-1">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs 2xl:text-sm font-semibold text-muted-foreground">Rs.</span>
                                <Input
                                    ref={cardAmountRef}
                                    type="number"
                                    min="0"
                                    placeholder="Enter Card Slip Amount & Press Enter..."
                                    value={cardAmount}
                                    onChange={(e) => setCardAmount(e.target.value)}
                                    className="h-8 2xl:h-10 pl-8 2xl:pl-9 text-xs 2xl:text-sm font-bold"
                                />
                            </div>
                            <Button type="submit" size="sm" disabled={addCard.isPending} className="h-8 2xl:h-10 text-xs 2xl:text-sm px-3 2xl:px-4 font-semibold">
                                <Plus className="w-3.5 h-3.5 2xl:w-4 2xl:h-4 mr-1" /> Add
                            </Button>
                        </form>

                        {/* Scrollable Card Table */}
                        <div className="flex-1 min-h-0 border rounded-lg overflow-y-auto [&>div]:overflow-visible">
                            <Table>
                                <TableHeader className="sticky top-0 bg-card z-10 shadow-sm">
                                    <TableRow className="text-xs 2xl:text-sm">
                                        <TableHead className="w-12">#</TableHead>
                                        <TableHead className="w-28 2xl:w-32 text-muted-foreground">Time</TableHead>
                                        <TableHead className="text-right">Amount</TableHead>
                                        <TableHead className="w-10"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {data?.cardEntries.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center py-8 text-xs 2xl:text-sm text-muted-foreground">
                                                No manual card slips recorded. Type amount above and press Enter.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        data?.cardEntries.map((entry, idx) => (
                                            <TableRow key={entry.id} className="text-xs 2xl:text-sm hover:bg-muted/40">
                                                <TableCell className="font-mono text-muted-foreground py-2 2xl:py-2.5 text-[11px] 2xl:text-xs">
                                                    #{data.cardEntries.length - idx}
                                                </TableCell>
                                                <TableCell className="text-muted-foreground text-[11px] 2xl:text-xs py-2 2xl:py-2.5">
                                                    {format(new Date(entry.created_at), 'hh:mm a')}
                                                </TableCell>
                                                <TableCell className="text-right font-bold text-foreground py-2 2xl:py-2.5">
                                                    Rs. {Number(entry.amount).toLocaleString()}
                                                </TableCell>
                                                <TableCell className="py-2 2xl:py-2.5">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6 2xl:h-7 2xl:w-7 text-muted-foreground hover:text-destructive"
                                                        onClick={() =>
                                                            deleteCard.mutate({
                                                                id: entry.id,
                                                                dateStr: data?.dateStr || '',
                                                            })
                                                        }
                                                    >
                                                        <Trash2 className="w-3 h-3 2xl:w-3.5 2xl:h-3.5" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </TabsContent>

                {/* TAB 3: CASH RECONCILIATION */}
                <TabsContent
                    value="cash"
                    className="flex-1 min-h-0 data-[state=inactive]:hidden data-[state=active]:grid data-[state=active]:grid-cols-1 lg:data-[state=active]:grid-cols-2 gap-4 2xl:gap-6 overflow-hidden focus-visible:outline-none mt-0"
                >
                    {/* Left Column: Physical Denominations (Vertical List of Rows) */}
                    <div className="flex-1 min-h-0 flex flex-col justify-between rounded-xl border border-border bg-card p-3.5 2xl:p-5 overflow-hidden">
                        <div className="flex-none flex items-center justify-between pb-2 border-b">
                            <div className="flex items-center gap-2">
                                <Coins className="w-4 h-4 2xl:w-5 2xl:h-5 text-primary" />
                                <span className="font-bold text-sm 2xl:text-base">Physical Currency Denominations</span>
                            </div>
                            <span className="font-bold text-sm 2xl:text-base text-primary">
                                Cash in Drawer: Rs. {physicalCash.toLocaleString()}
                            </span>
                        </div>

                        <div className="flex-1 min-h-0 flex flex-col justify-between py-2 overflow-y-auto space-y-1 2xl:space-y-1.5">
                            {[
                                { key: 'notes_5000', label: '5,000 Notes', mult: 5000 },
                                { key: 'notes_1000', label: '1,000 Notes', mult: 1000 },
                                { key: 'notes_500', label: '500 Notes', mult: 500 },
                                { key: 'notes_100', label: '100 Notes', mult: 100 },
                                { key: 'notes_50', label: '50 Notes', mult: 50 },
                                { key: 'notes_20', label: '20 Notes', mult: 20 },
                                { key: 'notes_10', label: '10 Notes', mult: 10 },
                            ].map((d) => {
                                const count = (denominations as any)[d.key] || 0;
                                return (
                                    <div key={d.key} className="flex items-center justify-between px-3 py-1.5 2xl:px-4 2xl:py-2 rounded-lg border bg-muted/20 hover:bg-muted/30 transition-colors">
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-xs 2xl:text-sm text-foreground w-24 2xl:w-32">{d.label}</span>
                                            <span className="text-[11px] 2xl:text-xs text-muted-foreground font-mono">× {d.mult.toLocaleString()}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <Input
                                                type="number"
                                                min="0"
                                                value={count === 0 ? '' : count}
                                                placeholder="0"
                                                onChange={(e) => {
                                                    const val = parseInt(e.target.value) || 0;
                                                    setDenominations((prev) => ({ ...prev, [d.key]: val }));
                                                }}
                                                className="h-7 2xl:h-9 w-20 2xl:w-28 text-center font-bold text-xs 2xl:text-sm bg-background"
                                            />
                                            <span className="text-xs 2xl:text-sm font-bold text-foreground w-24 2xl:w-32 text-right tabular-nums">
                                                Rs. {(count * d.mult).toLocaleString()}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                            <div className="flex items-center justify-between px-3 py-1.5 2xl:px-4 2xl:py-2 rounded-lg border bg-muted/20 hover:bg-muted/30 transition-colors">
                                <div className="flex items-center gap-2">
                                    <span className="font-semibold text-xs 2xl:text-sm text-foreground w-24 2xl:w-32">Loose Coins</span>
                                    <span className="text-[11px] 2xl:text-xs text-muted-foreground font-mono">PKR Total</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Input
                                        type="number"
                                        min="0"
                                        value={denominations.coins === 0 ? '' : denominations.coins}
                                        placeholder="0"
                                        onChange={(e) => {
                                            const val = parseFloat(e.target.value) || 0;
                                            setDenominations((prev) => ({ ...prev, coins: val }));
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleSaveClosing();
                                            }
                                        }}
                                        className="h-7 2xl:h-9 w-20 2xl:w-28 text-center font-bold text-xs 2xl:text-sm bg-background"
                                    />
                                    <span className="text-xs 2xl:text-sm font-bold text-foreground w-24 2xl:w-32 text-right tabular-nums">
                                        Rs. {(denominations.coins || 0).toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Cash Drawer Flow Formula */}
                    <div className="flex-1 min-h-0 flex flex-col justify-between rounded-xl border border-border bg-card p-3.5 2xl:p-5 overflow-hidden">
                        <div className="flex-none flex items-center justify-between pb-2 border-b">
                            <div className="flex items-center gap-2">
                                <Wallet className="w-4 h-4 2xl:w-5 2xl:h-5 text-primary" />
                                <span className="font-bold text-sm 2xl:text-base">Cash Drawer Flow Formula</span>
                            </div>
                            <span className="text-xs 2xl:text-sm text-muted-foreground">System Sales & Till Audit</span>
                        </div>

                        <div className="flex-1 min-h-0 flex flex-col justify-between py-2 space-y-2 overflow-y-auto">
                            <div className="space-y-1.5 2xl:space-y-2 text-xs 2xl:text-sm">
                                <div className="flex items-center justify-between bg-muted/40 p-2.5 2xl:p-3 rounded-lg border">
                                    <div>
                                        <span className="font-medium text-foreground">(+) Opening Balance</span>
                                        {data?.previousRecord && (
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                <span className="text-[10px] 2xl:text-xs text-muted-foreground">
                                                    From {format(new Date(data.previousRecord.reconciliation_date + 'T00:00:00'), 'EEE, dd MMM')}: Rs. {Number(data.previousRecord.closing_balance || 0).toLocaleString()}
                                                </span>
                                                {openingCash !== Number(data.previousRecord.closing_balance || 0) && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setOpeningCash(Number(data.previousRecord?.closing_balance || 0))}
                                                        className="text-[10px] 2xl:text-xs text-primary font-bold hover:underline ml-1"
                                                        title="Click to copy closing balance from previous trading day"
                                                    >
                                                        [↺ Sync]
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <Input
                                        type="number"
                                        min="0"
                                        value={openingCash === 0 ? '' : openingCash}
                                        placeholder="0"
                                        onChange={(e) => setOpeningCash(parseFloat(e.target.value) || 0)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleSaveClosing();
                                            }
                                        }}
                                        className="h-7 2xl:h-9 w-28 2xl:w-36 text-right text-xs 2xl:text-sm font-bold"
                                    />
                                </div>
                                <div className="flex items-center justify-between bg-muted/40 p-2.5 2xl:p-3 rounded-lg border">
                                    <div>
                                        <span className="font-medium text-foreground">Cash in Reserve</span>
                                        <span className="text-[10px] 2xl:text-xs text-muted-foreground block">Reserve location balance</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-xs 2xl:text-sm text-muted-foreground">Rs.</span>
                                        <Input
                                            type="number"
                                            min="0"
                                            value={cashInReserve === 0 ? '' : cashInReserve}
                                            placeholder="0"
                                            onChange={(e) => setCashInReserve(parseFloat(e.target.value) || 0)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    handleSaveClosing();
                                                }
                                            }}
                                            className="h-7 2xl:h-9 w-28 2xl:w-36 text-right text-xs 2xl:text-sm font-bold bg-background"
                                        />
                                    </div>
                                </div>
                                <div className="flex items-center justify-between bg-muted/40 p-2.5 2xl:p-3 rounded-lg border">
                                    <div>
                                        <span className="font-medium text-foreground">(+/-) Sale Adjustments</span>
                                        <span className="text-[10px] 2xl:text-xs text-muted-foreground block">Manual adjustments for sales without invoice (+/-)</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-xs 2xl:text-sm text-muted-foreground">Rs.</span>
                                        <Input
                                            type="number"
                                            value={saleAdjustments === 0 ? '' : saleAdjustments}
                                            placeholder="0"
                                            onChange={(e) => setSaleAdjustments(parseFloat(e.target.value) || 0)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    handleSaveClosing();
                                                }
                                            }}
                                            className="h-7 2xl:h-9 w-28 2xl:w-36 text-right text-xs 2xl:text-sm font-bold bg-background"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="border-t pt-2 space-y-1.5 2xl:space-y-2">
                                <div className="flex items-center justify-between text-xs 2xl:text-sm font-semibold">
                                    <span className="text-muted-foreground">Expected Drawer Cash:</span>
                                    <span className="text-sm 2xl:text-base font-bold text-foreground">Rs. {expectedCash.toLocaleString()}</span>
                                </div>
                                <div className="flex items-center justify-between text-xs 2xl:text-sm font-semibold">
                                    <span className="text-muted-foreground">Cash in Reserve:</span>
                                    <span className="text-sm 2xl:text-base font-bold text-foreground">Rs. {cashInReserve.toLocaleString()}</span>
                                </div>
                                <div className="flex items-center justify-between text-xs 2xl:text-sm font-semibold">
                                    <span className="text-primary font-bold">Cash in Drawer:</span>
                                    <span className="text-sm 2xl:text-base font-extrabold text-primary">Rs. {physicalCash.toLocaleString()}</span>
                                </div>
                                <div className="flex items-center justify-between text-xs 2xl:text-sm font-bold border-t pt-1 text-foreground">
                                    <span>Total Physical Cash:</span>
                                    <span className="text-sm 2xl:text-base font-extrabold text-foreground">Rs. {(physicalCash + cashInReserve).toLocaleString()}</span>
                                </div>
                                <div
                                    className={cn(
                                        "p-2 2xl:p-3 rounded-xl border text-center font-bold text-xs 2xl:text-sm tracking-wide",
                                        cashVariance === 0
                                            ? "bg-emerald-50/80 border-emerald-200 text-emerald-800"
                                            : cashVariance > 0
                                            ? "bg-blue-50/80 border-blue-200 text-blue-800"
                                            : "bg-rose-50/80 border-rose-200 text-rose-800"
                                    )}
                                >
                                    <span>{cashVariance === 0 ? "Drawer Perfectly Balanced (Rs. 0)" : `Drawer Variance: ${cashVariance > 0 ? '+' : ''}Rs. ${cashVariance.toLocaleString()}`}</span>
                                </div>

                                {/* Move to Reserve Drawer & Next Day Float Section */}
                                <div className="p-2.5 2xl:p-3.5 rounded-lg border bg-muted/20 space-y-2">
                                    <div className="flex items-center justify-between text-xs 2xl:text-sm">
                                        <span className="font-medium text-foreground">(-) Move to Reserve Drawer</span>
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-xs 2xl:text-sm text-muted-foreground">Rs.</span>
                                            <Input
                                                type="number"
                                                min="0"
                                                value={moveToReserve === 0 ? '' : moveToReserve}
                                                placeholder="0"
                                                onChange={(e) => setMoveToReserve(parseFloat(e.target.value) || 0)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        handleSaveClosing();
                                                    }
                                                }}
                                                className="h-7 2xl:h-9 w-28 2xl:w-36 text-right text-xs 2xl:text-sm font-bold bg-background"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between text-xs 2xl:text-sm pt-1 border-t border-border/50">
                                        <div>
                                            <span className="font-bold text-foreground">Closing Balance:</span>
                                            <span className="text-[10px] 2xl:text-xs text-muted-foreground block">Carried over as next day's opening balance</span>
                                        </div>
                                        <span className="text-sm 2xl:text-base font-extrabold text-primary tabular-nums">
                                            Rs. {closingBalance.toLocaleString()}
                                        </span>
                                    </div>
                                </div>

                                <Button
                                    onClick={handleSaveClosing}
                                    disabled={saveReconciliation.isPending}
                                    className="w-full h-8 2xl:h-11 font-semibold text-xs 2xl:text-sm flex items-center justify-center gap-2 shadow-sm mt-1"
                                >
                                    {saveReconciliation.isPending ? (
                                        <>
                                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                            Saving Cash Details...
                                        </>
                                    ) : data?.savedRecord ? (
                                        <>
                                            <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                                            Update Cash Details in Database
                                        </>
                                    ) : (
                                        <>
                                            <Save className="w-4 h-4" />
                                            Save Cash Details to Database
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>
                </TabsContent>

                {/* TAB 4: NEW SUMMARY TAB (WITH SAVE CLOSING BUTTON) */}
                <TabsContent
                    value="summary"
                    className="flex-1 min-h-0 data-[state=inactive]:hidden data-[state=active]:flex data-[state=active]:flex-col space-y-3 2xl:space-y-4 overflow-hidden focus-visible:outline-none mt-0"
                >
                    <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-4 2xl:gap-6 overflow-hidden">
                        {/* Left Summary: Totals Comparison Grid (7 cols) */}
                        <div className="lg:col-span-7 flex flex-col min-h-0 rounded-xl border border-border bg-card p-4 2xl:p-6 overflow-y-auto space-y-4 2xl:space-y-6">
                            <div>
                                <h3 className="font-bold text-sm 2xl:text-base text-foreground">Grand Financial Closeout Summary</h3>
                                <p className="text-xs 2xl:text-sm text-muted-foreground">
                                    Consolidated totals of physical cash, IBFT, and card compared against total recorded sales.
                                </p>
                            </div>

                            {/* Comparison Side by Side */}
                            <div className="grid grid-cols-2 gap-3 2xl:gap-4">
                                {/* Recorded Collections */}
                                <div className="p-3 2xl:p-4 rounded-xl border bg-muted/20 space-y-1.5 2xl:space-y-2 flex flex-col justify-between">
                                    <div>
                                        <span className="text-xs 2xl:text-sm font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                                            1. Manual / Physical Totals
                                        </span>
                                        <div className="space-y-1 2xl:space-y-1.5 text-xs 2xl:text-sm">
                                            <div className="flex justify-between">
                                                <span>Cash in Drawer:</span>
                                                <span className="font-semibold">Rs. {physicalCash.toLocaleString()}</span>
                                            </div>
                                            {cashInReserve > 0 && (
                                                <div className="flex justify-between">
                                                    <span>Cash in Reserve:</span>
                                                    <span className="font-semibold">Rs. {cashInReserve.toLocaleString()}</span>
                                                </div>
                                            )}
                                            <div className="flex justify-between font-bold border-t pt-0.5 text-foreground">
                                                <span>Total Physical Cash:</span>
                                                <span>Rs. {totalPhysicalCash.toLocaleString()}</span>
                                            </div>
                                            {openingCash > 0 && (
                                                <div className="flex justify-between text-rose-600 font-medium">
                                                    <span>(-) Opening Balance:</span>
                                                    <span className="font-bold">-Rs. {openingCash.toLocaleString()}</span>
                                                </div>
                                            )}
                                            {(data?.metrics.cash_expenses || 0) > 0 && (
                                                <div className="flex justify-between text-amber-700 font-medium">
                                                    <span>(+) Cash Expenses:</span>
                                                    <span className="font-bold">+Rs. {(data?.metrics.cash_expenses || 0).toLocaleString()}</span>
                                                </div>
                                            )}
                                            <div className="flex justify-between font-semibold border-t pt-0.5 text-foreground">
                                                <span>(=) Net Cash from Sales:</span>
                                                <span className="font-bold">Rs. {netCashFromSales.toLocaleString()}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>Recorded IBFT Transfers:</span>
                                                <span className="font-semibold">Rs. {(data?.metrics.manual_ibft_total || 0).toLocaleString()}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>Recorded Card Slips:</span>
                                                <span className="font-semibold">Rs. {(data?.metrics.manual_card_total || 0).toLocaleString()}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex justify-between text-xs 2xl:text-sm font-bold border-t pt-1.5 text-foreground">
                                        <span>Total Recorded Collections:</span>
                                        <span className="text-sm 2xl:text-base font-extrabold text-primary">Rs. {totalRecordedCollections.toLocaleString()}</span>
                                    </div>
                                </div>

                                {/* System Recorded Sales */}
                                <div className="p-3 2xl:p-4 rounded-xl border bg-muted/20 space-y-1.5 2xl:space-y-2 flex flex-col justify-between">
                                    <div>
                                        <span className="text-xs 2xl:text-sm font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                                            2. System Recorded Sales
                                        </span>
                                        <div className="space-y-1 2xl:space-y-1.5 text-xs 2xl:text-sm">
                                            <div className="flex justify-between">
                                                <span>Cash Sales Total:</span>
                                                <span className="font-semibold">Rs. {(data?.metrics.system_cash_sales || 0).toLocaleString()}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>IBFT Sales:</span>
                                                <span className="font-semibold">Rs. {(data?.metrics.system_ibft_sales || 0).toLocaleString()}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>Card Sales:</span>
                                                <span className="font-semibold">Rs. {(data?.metrics.system_card_sales || 0).toLocaleString()}</span>
                                            </div>
                                            <div className="flex justify-between text-muted-foreground border-t pt-1 font-medium">
                                                <span>Gross Sales Total:</span>
                                                <span className="font-semibold">Rs. {(data?.metrics.system_counter_sales_total || 0).toLocaleString()}</span>
                                            </div>
                                            {(data?.metrics.system_cash_returns || 0) > 0 && (
                                                <div className="flex justify-between text-rose-600 font-medium">
                                                    <span>(-) Customer Returns:</span>
                                                    <span className="font-bold">-Rs. {(data?.metrics.system_cash_returns || 0).toLocaleString()}</span>
                                                </div>
                                            )}
                                            {saleAdjustments !== 0 && (
                                                <div className={`flex justify-between font-medium ${saleAdjustments >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                                                    <span>(+/-) Sale Adjustments:</span>
                                                    <span className="font-bold">{saleAdjustments >= 0 ? '+' : '-'}Rs. {Math.abs(saleAdjustments).toLocaleString()}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex justify-between text-xs 2xl:text-sm font-bold border-t pt-1.5 text-foreground">
                                        <span>Net System Recorded Sales:</span>
                                        <span className="text-sm 2xl:text-base font-extrabold text-foreground">Rs. {netSystemRecordedSales.toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Overall Variance Callout */}
                            <div
                                className={cn(
                                    "p-3 2xl:p-4 rounded-xl border flex items-center justify-between",
                                    grandSalesVariance === 0
                                        ? "bg-emerald-50/70 border-emerald-200 text-emerald-800"
                                        : grandSalesVariance > 0
                                        ? "bg-blue-50/70 border-blue-200 text-blue-800"
                                        : "bg-rose-50/70 border-rose-200 text-rose-800"
                                )}
                            >
                                <div>
                                    <span className="text-xs 2xl:text-sm font-bold uppercase tracking-wider block">
                                        {grandSalesVariance === 0
                                            ? "Overall Grand Collections Match System Sales"
                                            : grandSalesVariance > 0
                                            ? "Overall Net Surplus (Over System Sales)"
                                            : "Overall Net Deficit (Short of System Sales)"}
                                    </span>
                                    <span className="text-[11px] 2xl:text-xs opacity-80">
                                        Total Collections Recorded ({totalRecordedCollections.toLocaleString()}) − Net System Recorded Sales ({netSystemRecordedSales.toLocaleString()})
                                    </span>
                                </div>
                                <div className="text-xl 2xl:text-2xl font-black">
                                    {grandSalesVariance >= 0 ? '+' : ''}Rs. {grandSalesVariance.toLocaleString()}
                                </div>
                            </div>

                            {/* Daily Expenses Breakdown Preview */}
                            <div className="border rounded-xl p-3 2xl:p-4 bg-card space-y-2">
                                <div className="flex items-center justify-between text-xs 2xl:text-sm font-bold">
                                    <span>Daily Expenses Breakdown ({data?.expenses.length || 0} entries)</span>
                                    <span className="text-amber-700">Total Outflow: Rs. {(data?.metrics.total_expenses || 0).toLocaleString()}</span>
                                </div>
                                {data?.expenses.length === 0 ? (
                                    <p className="text-xs 2xl:text-sm text-muted-foreground">No expenses recorded today.</p>
                                ) : (
                                    <div className="space-y-1 max-h-32 2xl:max-h-48 overflow-y-auto">
                                        {data?.expenses.map((e) => (
                                            <div key={e.id} className="flex justify-between text-[11px] 2xl:text-xs py-0.5 border-b border-muted/50 last:border-0">
                                                <span className="text-foreground">{e.description}</span>
                                                <span className="font-semibold text-amber-700">Rs. {Number(e.amount).toLocaleString()}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right Summary: Remarks & Action to Save Closing Record (5 cols) */}
                        <div className="lg:col-span-5 flex flex-col justify-between min-h-0 rounded-xl border border-border bg-card p-4 2xl:p-6 overflow-hidden">
                            <div className="space-y-3 2xl:space-y-4">
                                <div>
                                    <h3 className="font-bold text-sm 2xl:text-base text-foreground">End-of-Day Record Keeping</h3>
                                    <p className="text-xs 2xl:text-sm text-muted-foreground">
                                        Persist today's reconciliation snapshot to the database for audit review. Non-binding and editable anytime.
                                    </p>
                                </div>

                                <div className="p-2.5 2xl:p-3.5 rounded-lg border bg-muted/30 flex items-center justify-between text-xs 2xl:text-sm">
                                    <div>
                                        <span className="text-muted-foreground block text-[11px] 2xl:text-xs">Closing Balance:</span>
                                        <span className="font-bold text-primary text-sm 2xl:text-base">Rs. {closingBalance.toLocaleString()}</span>
                                    </div>
                                    {moveToReserve > 0 && (
                                        <div className="text-right">
                                            <span className="text-muted-foreground block text-[11px] 2xl:text-xs">Transferred to Safe:</span>
                                            <span className="font-semibold text-foreground">Rs. {moveToReserve.toLocaleString()}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-1 2xl:space-y-2">
                                    <Label className="text-xs 2xl:text-sm font-semibold text-foreground">
                                        Closing Notes / Manager Remarks
                                    </Label>
                                    <Textarea
                                        placeholder="Record any notes regarding drawer shortages, safe deposits, or explanations..."
                                        value={closingNotes}
                                        onChange={(e) => setClosingNotes(e.target.value)}
                                        rows={4}
                                        className="text-xs 2xl:text-sm resize-none 2xl:min-h-[120px]"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2 pt-3 border-t">
                                <Button
                                    variant="default"
                                    size="lg"
                                    onClick={handleSaveClosing}
                                    disabled={saveReconciliation.isPending}
                                    className="w-full text-sm 2xl:text-base font-bold bg-primary hover:bg-primary/90 text-primary-foreground h-11 2xl:h-12"
                                >
                                    <Save className="w-4 h-4 mr-2" />
                                    {saveReconciliation.isPending ? 'Saving...' : 'Save Closing Record'}
                                </Button>

                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handlePrint('80mm')}
                                        className="flex-1 text-xs 2xl:text-sm h-9 2xl:h-11"
                                    >
                                        <Printer className="w-3.5 h-3.5 mr-1.5" />
                                        Print 80mm Slip
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handlePrint('a5')}
                                        className="flex-1 text-xs 2xl:text-sm h-9 2xl:h-11"
                                    >
                                        <FileCheck2 className="w-3.5 h-3.5 mr-1.5" />
                                        Print A5 Report
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default DailyReconciliation;
