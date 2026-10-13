import { useState } from "react";
import { format, startOfMonth, startOfWeek, subDays, endOfMonth, subMonths } from "date-fns";
import { Calendar as CalendarIcon, Download, Loader2, Printer, PackageSearch } from "lucide-react";
import { useReceivedStockByDateRange } from "@/hooks/useStockReceiving";
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
import { useTenant } from "@/contexts/TenantContext";

const ReceivedStockReport = () => {
    const { lexicon } = useTenant();
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
    const { data: receipts = [], isLoading } = useReceivedStockByDateRange(date?.from, date?.to);

    const totalSuits = receipts.reduce((sum, r) => sum + r.total_rolls, 0);
    const totalMeters = receipts.reduce((sum, r) => sum + r.total_meters, 0);
    const totalReceipts = receipts.length;

    const exportToCSV = () => {
        const headers = ["Date", "Receipt Number", "Item Details", "Total Suits", "Total Meters", "Notes"];
        const rows = receipts.map((r: any) => {
            const itemsDet = r.stock_receipt_items?.map((i: any) => `${i.product?.name || 'Unknown'} x ${i.rolls_received}`).join(" | ") || "";
            return [
                format(new Date(r.created_at), "yyyy-MM-dd HH:mm"),
                r.receipt_number,
                `"${itemsDet}"`,
                r.total_rolls,
                r.total_meters,
                `"${r.notes || ''}"`
            ];
        });

        const csvContent = "data:text/csv;charset=utf-8,"
            + headers.join(",") + "\n"
            + rows.map(e => e.join(",")).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `received_stock_report_${format(date?.from || new Date(), "yyyy-MM-dd")}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="p-4 md:p-6 space-y-6 animate-slide-in h-full flex flex-col print-hide-header">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">Received Stock Report</h1>
                    <p className="text-muted-foreground">
                        View details of stock receipts and items received.
                    </p>
                </div>
            </div>

            {/* Filters Row */}
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

            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-3">
                 <div className="rounded-xl border border-border bg-card p-4 flex flex-row items-center justify-between space-y-0">
                    <div className="space-y-1">
                        <p className="text-sm font-medium text-muted-foreground">Total Receipts</p>
                        {isLoading ? (
                            <div className="h-8 flex items-center">
                                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                            </div>
                        ) : (
                            <p className="text-2xl font-bold text-foreground">{totalReceipts}</p>
                        )}
                    </div>
                    <div className="h-10 w-10 bg-secondary rounded-full flex items-center justify-center">
                        <PackageSearch className="h-5 w-5 text-foreground" />
                    </div>
                </div>
                <div className="rounded-xl border border-border bg-card p-4 flex flex-row items-center justify-between space-y-0">
                    <div className="space-y-1">
                        <p className="text-sm font-medium text-muted-foreground">Total {lexicon.item_plural}</p>
                        {isLoading ? (
                            <div className="h-8 flex items-center">
                                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                            </div>
                        ) : (
                            <p className="text-2xl font-bold text-foreground">{totalSuits}</p>
                        )}
                    </div>
                    <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center">
                       <span className="font-bold text-primary">{lexicon.item_singular.charAt(0).toUpperCase()}</span>
                    </div>
                </div>
                {lexicon.enable_secondary_metric && (
                    <div className="rounded-xl border border-border bg-card p-4 flex flex-row items-center justify-between space-y-0">
                        <div className="space-y-1">
                            <p className="text-sm font-medium text-muted-foreground">Total {lexicon.secondary_metric_name || "Meters"}</p>
                            {isLoading ? (
                                <div className="h-8 flex items-center">
                                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                                </div>
                            ) : (
                                <p className="text-2xl font-bold text-foreground">{totalMeters.toLocaleString()}{lexicon.secondary_metric_symbol || "m"}</p>
                            )}
                        </div>
                        <div className="h-10 w-10 bg-success/10 rounded-full flex items-center justify-center">
                            <span className="font-bold text-success">{(lexicon.secondary_metric_symbol || "m").charAt(0).toUpperCase()}</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Table */}
            <div className="rounded-xl border border-border bg-card flex-1 overflow-hidden flex flex-col">
                <div className="overflow-auto flex-1">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="text-muted-foreground min-w-[120px]">Date</TableHead>
                                <TableHead className="text-muted-foreground min-w-[150px]">Receipt #</TableHead>
                                <TableHead className="text-muted-foreground w-[40%]">Item Details</TableHead>
                                <TableHead className="text-muted-foreground text-center">No. of {lexicon.item_plural}</TableHead>
                                {lexicon.enable_secondary_metric && (
                                    <TableHead className="text-muted-foreground text-right">QTY ({lexicon.secondary_metric_name || "Meters"})</TableHead>
                                )}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={lexicon.enable_secondary_metric ? 5 : 4} className="h-24 text-center">
                                        <div className="flex justify-center items-center">
                                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : receipts.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={lexicon.enable_secondary_metric ? 5 : 4} className="h-24 text-center text-muted-foreground">
                                        No stock receipts found for selected period.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                receipts.map((r: any) => (
                                    <TableRow key={r.id} className="hover:bg-muted/50">
                                        <TableCell className="font-medium text-foreground align-top">
                                            {format(new Date(r.created_at), "MMM d, yyyy")}
                                        </TableCell>
                                        <TableCell className="align-top font-mono text-sm">
                                            {r.receipt_number}
                                        </TableCell>
                                        <TableCell className="align-top">
                                            <div className="flex flex-col gap-1">
                                                {r.stock_receipt_items?.map((item: any) => (
                                                    <div key={item.id} className="text-sm">
                                                        <span className="font-medium">{item.product?.name || 'Unknown Item'}</span>
                                                        <span className="text-muted-foreground ml-2">x {item.rolls_received}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center text-foreground font-semibold align-top">
                                            {r.total_rolls}
                                        </TableCell>
                                        {lexicon.enable_secondary_metric && (
                                            <TableCell className="text-right text-foreground font-semibold align-top">
                                                {r.total_meters.toLocaleString()}{lexicon.secondary_metric_symbol || "m"}
                                            </TableCell>
                                        )}
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

export default ReceivedStockReport;
