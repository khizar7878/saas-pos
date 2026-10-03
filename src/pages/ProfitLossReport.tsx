import { useState, useMemo } from "react";
import { format, startOfMonth, startOfWeek, subDays, endOfMonth, eachDayOfInterval, subMonths } from "date-fns";
import { Calendar as CalendarIcon, Download, Loader2, TrendingUp, TrendingDown, DollarSign, Printer } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";

const ProfitLossReport = () => {
    const [date, setDate] = useState<DateRange | undefined>({
        from: startOfMonth(new Date()),
        to: new Date()
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

    // Fetch All Data needed for P&L
    const { data: pnlData, isLoading } = useQuery({
        queryKey: ['pnl-report', date?.from, date?.to],
        queryFn: async () => {
            if (!date?.from || !date?.to) return null;

            const fromStr = date.from.toISOString();
            const toStr = date.to.toISOString();

            // 1. Fetch Sales (Revenue)
            const { data: sales } = await supabase
                .from('sales')
                .select('*')
                .gte('created_at', fromStr)
                .lte('created_at', toStr)
                .neq('status', 'cancelled');

            // 2. Fetch Sale Items (for COGS) - We need product cost
            // Note: cost_per_meter is in products table
            const { data: saleItems } = await supabase
                .from('sale_items')
                .select(`
                    *,
                    product:products(cost_per_meter),
                    sale:sales(created_at, status)
                `)
                .gte('created_at', fromStr)
                .lte('created_at', toStr);

            // 3. Fetch Returns (Revenue Deduction)
            const { data: returns } = await supabase
                .from('returns')
                .select('*')
                .gte('created_at', fromStr)
                .lte('created_at', toStr);

            // 4. Fetch Return Items (COGS Reversal)
            const { data: returnItems } = await supabase
                .from('return_items')
                .select(`
                    *,
                    product:products(cost_per_meter),
                    return_doc:returns(created_at)
                `)
                .gte('created_at', fromStr)
                .lte('created_at', toStr);

            // 5. Fetch Expenses
            const { data: expenses } = await supabase
                .from('daily_expenses' as any)
                .select('*')
                .gte('expense_date', fromStr)
                .lte('expense_date', toStr);

            return { sales, saleItems, returns, returnItems, expenses };
        },
        enabled: !!date?.from && !!date?.to
    });

    const dailyPnL = useMemo(() => {
        if (!date?.from || !date?.to || !pnlData) return [];

        const days = eachDayOfInterval({ start: date.from, end: date.to });

        return days.map(day => {
            const dayStr = format(day, 'yyyy-MM-dd');

            // 1. Revenue (Net Sales)
            const daySales = pnlData.sales?.filter(s => format(new Date(s.created_at), 'yyyy-MM-dd') === dayStr) || [];
            const grossSales = daySales.reduce((sum, s) => sum + s.total_amount, 0);

            const dayReturns = pnlData.returns?.filter(r => format(new Date(r.created_at), 'yyyy-MM-dd') === dayStr) || [];
            const returnsAmount = dayReturns.reduce((sum, r) => sum + r.total_amount, 0);

            const netRevenue = grossSales - returnsAmount;

            // 2. COGS (Cost of sold - Cost of returned)
            // Filter sale items for valid sales on this day
            const daySaleItems = pnlData.saleItems?.filter(item =>
                format(new Date(item.created_at), 'yyyy-MM-dd') === dayStr &&
                item.sale?.status !== 'cancelled'
            ) || [];

            const cogsSales = daySaleItems.reduce((sum, item) => {
                const cost = item.product?.cost_per_meter || 0;
                return sum + (item.quantity_meters * cost);
            }, 0);

            // Filter return items for this day
            const dayReturnItems = pnlData.returnItems?.filter(item =>
                format(new Date(item.created_at), 'yyyy-MM-dd') === dayStr
            ) || [];

            const cogsReturns = dayReturnItems.reduce((sum, item) => {
                const cost = item.product?.cost_per_meter || 0;
                return sum + (item.quantity_meters * cost);
            }, 0);

            const netCOGS = cogsSales - cogsReturns;

            // 3. Gross Profit
            const grossProfit = netRevenue - netCOGS;

            // 4. Expenses
            const dayExpenses = pnlData.expenses?.filter(e => format(new Date(e.expense_date), 'yyyy-MM-dd') === dayStr) || [];
            const totalExpenses = dayExpenses.reduce((sum, e) => sum + e.amount, 0);

            // 5. Net Profit
            const netProfit = grossProfit - totalExpenses;

            return {
                date: day,
                revenue: netRevenue,
                cogs: netCOGS,
                grossProfit,
                expenses: totalExpenses,
                netProfit
            };
        }).reverse();
    }, [date, pnlData]);

    // Totals
    const totals = dailyPnL.reduce((acc, d) => ({
        revenue: acc.revenue + d.revenue,
        cogs: acc.cogs + d.cogs,
        grossProfit: acc.grossProfit + d.grossProfit,
        expenses: acc.expenses + d.expenses,
        netProfit: acc.netProfit + d.netProfit
    }), { revenue: 0, cogs: 0, grossProfit: 0, expenses: 0, netProfit: 0 });

    const exportToCSV = () => {
        const headers = ["Date", "Revenue (Net Sales)", "COGS", "Gross Profit", "Expenses", "Net Profit"];
        const rows = dailyPnL.map(d => [
            format(d.date, "yyyy-MM-dd"),
            d.revenue.toFixed(2),
            d.cogs.toFixed(2),
            d.grossProfit.toFixed(2),
            d.expenses.toFixed(2),
            d.netProfit.toFixed(2)
        ]);
        // Add Totals Row
        rows.push(["TOTAL", totals.revenue.toFixed(2), totals.cogs.toFixed(2), totals.grossProfit.toFixed(2), totals.expenses.toFixed(2), totals.netProfit.toFixed(2)]);

        const csvContent = "data:text/csv;charset=utf-8,"
            + headers.join(",") + "\n"
            + rows.map(e => e.join(",")).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `profit_loss_${format(date?.from || new Date(), "yyyy-MM-dd")}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="p-4 md:p-6 space-y-6 animate-slide-in h-full flex flex-col print-hide-header">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">Income Statement (P&L)</h1>
                    <p className="text-muted-foreground">
                        Daily breakdown of Revenue, Costs, and Net Profit.
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
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-border bg-card p-4 flex flex-row items-center justify-between space-y-0">
                    <div className="space-y-1">
                        <p className="text-sm font-medium text-muted-foreground">Total Revenue</p>
                        {isLoading ? (
                            <div className="h-8 flex items-center">
                                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                            </div>
                        ) : (
                            <p className="text-2xl font-bold text-success">Rs. {totals.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                        )}
                    </div>
                </div>
                <div className="rounded-xl border border-border bg-card p-4 flex flex-row items-center justify-between space-y-0">
                    <div className="space-y-1">
                        <p className="text-sm font-medium text-muted-foreground">Gross Profit</p>
                        {isLoading ? (
                            <div className="h-8 flex items-center">
                                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                            </div>
                        ) : (
                            <p className="text-2xl font-bold text-primary">Rs. {totals.grossProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                        )}
                    </div>
                </div>
                <div className="rounded-xl border border-border bg-card p-4 flex flex-row items-center justify-between space-y-0">
                    <div className="space-y-1">
                        <p className="text-sm font-medium text-muted-foreground">Total Expenses</p>
                        {isLoading ? (
                            <div className="h-8 flex items-center">
                                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                            </div>
                        ) : (
                            <p className="text-2xl font-bold text-destructive">Rs. {totals.expenses.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                        )}
                    </div>
                </div>
                <Card className={cn("p-4 flex flex-row items-center justify-between space-y-0", totals.netProfit >= 0 ? "bg-success/10 border-success/20" : "bg-destructive/10 border-destructive/20")}>
                    <div className="space-y-1">
                        <p className="text-sm font-medium text-muted-foreground">Net Profit</p>
                        {isLoading ? (
                            <div className="h-8 flex items-center">
                                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                            </div>
                        ) : (
                            <p className={cn("text-2xl font-bold", totals.netProfit >= 0 ? "text-success" : "text-destructive")}>
                                Rs. {totals.netProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </p>
                        )}
                    </div>
                    {totals.netProfit >= 0 ? (
                        <TrendingUp className="h-8 w-8 text-success opacity-50" />
                    ) : (
                        <TrendingDown className="h-8 w-8 text-destructive opacity-50" />
                    )}
                </Card>
            </div>

            {/* Table */}
            <div className="rounded-xl border border-border bg-card flex-1 overflow-hidden flex flex-col">
                <div className="overflow-auto flex-1">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="text-muted-foreground">Date</TableHead>
                                <TableHead className="text-muted-foreground text-right w-[15%]">Revenue</TableHead>
                                <TableHead className="text-muted-foreground text-right w-[15%]">COGS</TableHead>
                                <TableHead className="text-muted-foreground text-right w-[15%]">Gross Profit</TableHead>
                                <TableHead className="text-muted-foreground text-right w-[15%]">Expenses</TableHead>
                                <TableHead className="text-muted-foreground text-right w-[15%]">Net Profit</TableHead>
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
                            ) : dailyPnL.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                        No data found for selected period.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                dailyPnL.map((item, index) => (
                                    <TableRow key={index} className="hover:bg-muted/50">
                                        <TableCell className="font-medium text-foreground">
                                            {format(item.date, "PPP")}
                                        </TableCell>
                                        <TableCell className="text-right text-foreground">
                                            Rs. {item.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                        </TableCell>
                                        <TableCell className="text-right text-muted-foreground">
                                            Rs. {item.cogs.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                        </TableCell>
                                        <TableCell className="text-right text-foreground font-medium">
                                            Rs. {item.grossProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                        </TableCell>
                                        <TableCell className="text-right text-destructive">
                                            Rs. {item.expenses.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                        </TableCell>
                                        <TableCell className={cn("text-right font-bold", item.netProfit >= 0 ? "text-success" : "text-destructive")}>
                                            Rs. {item.netProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
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

export default ProfitLossReport;
