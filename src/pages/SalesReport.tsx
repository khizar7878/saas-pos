import { useState, useMemo } from "react";
import { format, startOfMonth, startOfWeek, subDays, endOfMonth, eachDayOfInterval, subMonths } from "date-fns";
import { Calendar as CalendarIcon, Download, Loader2, TrendingUp, TrendingDown, DollarSign, Receipt, Printer, Package } from "lucide-react";
import { useSalesByDateRange, useSalesRealtime } from "@/hooks/useSales";
import { useReturnsByDateRange } from "@/hooks/useReturns";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";

const SalesReport = () => {
    useSalesRealtime();

    // Default to current month
    const [date, setDate] = useState<DateRange | undefined>({
        from: startOfMonth(new Date()),
        to: new Date() // Up to today
    });

    const applyPreset = (preset: 'today' | 'yesterday' | 'thisWeek' | 'thisMonth' | 'lastMonth') => {
        const today = new Date();
        let from = today;
        let to = today;

        switch (preset) {
            case 'today':
                break;
            case 'yesterday':
                from = subDays(today, 1);
                to = subDays(today, 1);
                break;
            case 'thisWeek':
                from = startOfWeek(today, { weekStartsOn: 6 });
                break;
            case 'thisMonth':
                from = startOfMonth(today);
                break;
            case 'lastMonth':
                from = startOfMonth(subMonths(today, 1));
                to = endOfMonth(subMonths(today, 1));
                break;
        }

        setDate({ from, to });
    };

    // Fetch data
    const { data: sales = [], isLoading: isLoadingSales } = useSalesByDateRange(date?.from, date?.to, 'counter');
    const { data: returns = [], isLoading: isLoadingReturns } = useReturnsByDateRange(date?.from, date?.to);

    const isLoading = isLoadingSales || isLoadingReturns;

    const dailySalesData = useMemo(() => {
        if (!date?.from || !date?.to) return [];

        const days = eachDayOfInterval({ start: date.from, end: date.to });

        const salesMap = new Map<string, typeof sales>();
        sales.forEach(s => {
            const d = format(new Date(s.created_at), 'yyyy-MM-dd');
            if (!salesMap.has(d)) salesMap.set(d, []);
            salesMap.get(d)?.push(s);
        });

        const returnsMap = new Map<string, typeof returns>();
        returns.forEach(r => {
            // Exclude credit returns from sales report 
            if ((r as any).return_type === 'credit') return;

            const d = format(new Date(r.created_at), 'yyyy-MM-dd');
            if (!returnsMap.has(d)) returnsMap.set(d, []);
            returnsMap.get(d)?.push(r);
        });

        return days.map(day => {
            const dayKey = format(day, 'yyyy-MM-dd');
            const daySales = salesMap.get(dayKey) || [];
            const dayReturns = returnsMap.get(dayKey) || [];

            // Calculate metrics
            // ... (inside dailySalesData map)
            // Sales Total: Include all sales (status != cancelled)
            const validSales = daySales.filter(s => s.status !== 'cancelled');
            const grossSales = validSales.reduce((sum, s) => sum + s.total_amount, 0);

            // Calculate Units Sold
            const unitsSold = validSales.reduce((sum, sale) => {
                const items = (sale as any).sale_items || [];
                const saleQty = items.reduce((qSum: number, item: any) => qSum + (item.quantity || 0), 0);
                return sum + saleQty;
            }, 0);

            // Returns Total
            const returnsAmount = dayReturns.reduce((sum, r) => sum + r.total_amount, 0);

            return {
                date: day,
                salesCount: validSales.length,
                unitsSold,
                grossSales,
                returnsAmount,
                netSales: grossSales - returnsAmount
            };
        }).reverse(); // Show newest first
    }, [date, sales, returns]);

    // Totals for the period
    const totalGross = dailySalesData.reduce((acc, d) => acc + d.grossSales, 0);
    const totalReturns = dailySalesData.reduce((acc, d) => acc + d.returnsAmount, 0);
    const totalNet = dailySalesData.reduce((acc, d) => acc + d.netSales, 0);
    const totalTransactions = dailySalesData.reduce((acc, d) => acc + d.salesCount, 0);
    const totalUnits = dailySalesData.reduce((acc, d) => acc + d.unitsSold, 0);

    const exportToCSV = () => {
        const headers = ["Date", "Sales Count", "Units Sold", "Gross Sales", "Returns", "Net Sales"];
        const rows = dailySalesData.map(d => [
            format(d.date, "yyyy-MM-dd"),
            d.salesCount,
            d.unitsSold,
            d.grossSales,
            d.returnsAmount,
            d.netSales
        ]);

        const csvContent = "data:text/csv;charset=utf-8,"
            + headers.join(",") + "\n"
            + rows.map(e => e.join(",")).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `sales_report_${format(date?.from || new Date(), "yyyy-MM-dd")}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="p-4 md:p-6 space-y-6 animate-slide-in h-full flex flex-col print-hide-header">
            {/* ... (Header and Filters omitted for brevity, keeping existing) ... */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">Sales Report</h1>
                    <p className="text-muted-foreground">
                        Summary of sales performance grouped by day.
                    </p>
                </div>
            </div>

            {/* Filters Row - Matching SalesSummary Layout */}
            <div className="flex flex-col xl:flex-row items-end justify-between gap-6">
                <div className="flex flex-col gap-2 w-full sm:w-auto flex-none">
                    <div className="w-full sm:w-[360px]">
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant={"outline"}
                                    className={cn(
                                        "w-full justify-start text-left font-normal",
                                        !date && "text-muted-foreground"
                                    )}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {date?.from ? (
                                        date.to ? (
                                            <>
                                                {format(date.from, "LLL dd, y")} -{" "}
                                                {format(date.to, "LLL dd, y")}
                                            </>
                                        ) : (
                                            format(date.from, "LLL dd, y")
                                        )
                                    ) : (
                                        <span>Pick a date</span>
                                    )}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    initialFocus
                                    mode="range"
                                    defaultMonth={date?.from}
                                    selected={date}
                                    onSelect={setDate}
                                    numberOfMonths={2}
                                />
                            </PopoverContent>
                        </Popover>
                    </div>

                    {/* Quick Presets */}
                    <div className="flex gap-1 w-full sm:w-[360px]">
                        <Button variant="outline" size="sm" className="h-7 text-[10px] sm:text-xs rounded-md flex-1 px-1" onClick={() => applyPreset('yesterday')}>Yesterday</Button>
                        <Button variant="outline" size="sm" className="h-7 text-[10px] sm:text-xs rounded-md flex-1 px-1" onClick={() => applyPreset('thisWeek')}>This Week</Button>
                        <Button variant="outline" size="sm" className="h-7 text-[10px] sm:text-xs rounded-md flex-1 px-1" onClick={() => applyPreset('thisMonth')}>This Month</Button>
                        <Button variant="outline" size="sm" className="h-7 text-[10px] sm:text-xs rounded-md flex-1 px-1" onClick={() => applyPreset('lastMonth')}>Last Month</Button>
                    </div>
                </div>

                <div className="flex flex-col gap-2 w-full sm:w-[300px] flex-none items-end space-y-2 sm:space-y-0 sm:flex-row sm:gap-2">
                    <Button variant="outline" onClick={() => window.print()} className="w-full sm:w-auto">
                        <Printer className="w-4 h-4 mr-2" />
                        Print
                    </Button>
                    <Button variant="outline" onClick={exportToCSV} className="w-full sm:w-auto">
                        <Download className="w-4 h-4 mr-2" />
                        Export CSV
                    </Button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
                <div className="rounded-xl border border-border bg-card p-4 flex flex-row items-center justify-between space-y-0">
                    <div className="space-y-1">
                        <p className="text-sm font-medium text-muted-foreground">Gross Sales</p>
                        {isLoading ? (
                            <div className="h-8 flex items-center">
                                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                            </div>
                        ) : (
                            <p className="text-2xl font-bold text-success">Rs. {totalGross.toLocaleString()}</p>
                        )}
                    </div>
                    <div className="h-10 w-10 bg-success/10 rounded-full flex items-center justify-center">
                        <TrendingUp className="h-5 w-5 text-success" />
                    </div>
                </div>
                <div className="rounded-xl border border-border bg-card p-4 flex flex-row items-center justify-between space-y-0">
                    <div className="space-y-1">
                        <p className="text-sm font-medium text-muted-foreground">Returns</p>
                        {isLoading ? (
                            <div className="h-8 flex items-center">
                                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                            </div>
                        ) : (
                            <p className="text-2xl font-bold text-destructive">Rs. {totalReturns.toLocaleString()}</p>
                        )}
                    </div>
                    <div className="h-10 w-10 bg-destructive/10 rounded-full flex items-center justify-center">
                        <TrendingDown className="h-5 w-5 text-destructive" />
                    </div>
                </div>
                <div className="rounded-xl border border-border bg-card p-4 flex flex-row items-center justify-between space-y-0">
                    <div className="space-y-1">
                        <p className="text-sm font-medium text-muted-foreground">Net Sales</p>
                        {isLoading ? (
                            <div className="h-8 flex items-center">
                                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                            </div>
                        ) : (
                            <p className="text-2xl font-bold text-primary">Rs. {totalNet.toLocaleString()}</p>
                        )}
                    </div>
                    <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center">
                        <DollarSign className="h-5 w-5 text-primary" />
                    </div>
                </div>
                <div className="rounded-xl border border-border bg-card p-4 flex flex-row items-center justify-between space-y-0">
                    <div className="space-y-1">
                        <p className="text-sm font-medium text-muted-foreground">Transactions</p>
                        {isLoading ? (
                            <div className="h-8 flex items-center">
                                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                            </div>
                        ) : (
                            <p className="text-2xl font-bold text-foreground">{totalTransactions}</p>
                        )}
                    </div>
                    <div className="h-10 w-10 bg-secondary rounded-full flex items-center justify-center">
                        <Receipt className="h-5 w-5 text-foreground" />
                    </div>
                </div>
                <div className="rounded-xl border border-border bg-card p-4 flex flex-row items-center justify-between space-y-0">
                    <div className="space-y-1">
                        <p className="text-sm font-medium text-muted-foreground">Units Sold</p>
                        {isLoading ? (
                            <div className="h-8 flex items-center">
                                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                            </div>
                        ) : (
                            <p className="text-2xl font-bold text-foreground">{totalUnits}</p>
                        )}
                    </div>
                    <div className="h-10 w-10 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center">
                        <Package className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="rounded-xl border border-border bg-card flex-1 overflow-hidden flex flex-col">
                <div className="overflow-auto flex-1">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="text-muted-foreground">Date</TableHead>
                                <TableHead className="text-muted-foreground text-center">Sales Count</TableHead>
                                <TableHead className="text-muted-foreground text-center">Units Sold</TableHead>
                                <TableHead className="text-muted-foreground text-right">Gross Sales</TableHead>
                                <TableHead className="text-muted-foreground text-right">Returns</TableHead>
                                <TableHead className="text-muted-foreground text-right">Net Sales</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center">
                                        <div className="flex justify-center items-center">
                                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : dailySalesData.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                        No sales data found for selected period.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                dailySalesData.map((item, index) => (
                                    <TableRow key={index} className="hover:bg-muted/50">
                                        <TableCell className="font-medium text-foreground">
                                            {format(item.date, "PPP")}
                                        </TableCell>
                                        <TableCell className="text-center text-foreground">{item.salesCount}</TableCell>
                                        <TableCell className="text-center text-foreground font-semibold">{item.unitsSold}</TableCell>
                                        <TableCell className="text-right text-success">
                                            Rs. {item.grossSales.toLocaleString()}
                                        </TableCell>
                                        <TableCell className="text-right text-destructive">
                                            {item.returnsAmount > 0 ? `- Rs. ${item.returnsAmount.toLocaleString()}` : '-'}
                                        </TableCell>
                                        <TableCell className="text-right font-bold text-primary">
                                            Rs. {item.netSales.toLocaleString()}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    );
};

export default SalesReport;
