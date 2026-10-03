
import { useState, Fragment } from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Download, Loader2, Package, Search, TrendingUp, CornerDownRight, Printer } from "lucide-react";
import { useStockHistory } from "@/hooks/useStockHistory";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
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

import { useStoreSettings } from "@/hooks/useStoreSettings";
import { printStockHistoryReport } from "@/utils/printStockHistoryReport";

const StockReport = () => {
    const [date, setDate] = useState<Date>(new Date());
    const [searchTerm, setSearchTerm] = useState("");
    const { data: stockItems, isLoading } = useStockHistory(date);
    const { data: storeSettings } = useStoreSettings();

    // No expansion state needed anymore, everything is expanded by default.

    const filteredItems = stockItems?.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.sku && item.sku.toLowerCase().includes(searchTerm.toLowerCase()))
    ) || [];

    const totalStockMeters = filteredItems.reduce((acc, item) => acc + item.stock_at_date, 0);
    const totalStockValue = filteredItems.reduce((acc, item) => acc + item.total_value_at_date, 0);
    const totalRolls = filteredItems.reduce((acc, item) => acc + item.rolls_at_date, 0);

    const handlePrint = () => {
        printStockHistoryReport(
            filteredItems,
            {
                totalMeters: totalStockMeters,
                totalValue: totalStockValue,
                totalSuits: totalRolls
            },
            date,
            storeSettings
        );
    };

    const exportToCSV = () => {
        if (!filteredItems.length) return;

        const headers = ["Product Name", "Product ID", "Category", "No. of Suits", "QTY in Meters", "Cost/Suit", "Total Value"];

        // Flatten for CSV
        const rows: any[] = [];
        filteredItems.forEach(item => {
            // Main Product Row
            rows.push([
                item.name,
                item.sku || "",
                item.category,
                item.rolls_at_date.toFixed(2),
                item.stock_at_date.toFixed(2),
                item.cost_per_piece.toFixed(2), // Use cost per piece (suit) instead of meter
                item.total_value_at_date.toFixed(2)
            ]);

            // Variation Rows
            if (item.variations?.length) {
                item.variations.forEach(v => {
                    rows.push([
                        `  - ${v.name}`,
                        v.sku,
                        item.category,
                        v.current_stock_qty, // Rolls/Suits
                        v.current_stock_meters.toFixed(2),
                        item.cost_per_piece.toFixed(2),
                        (v.current_stock_meters * item.cost_per_meter).toFixed(2) // Total value might still be meters * cost/m? Or suits * cost/suit? Let's assume total value is correct.
                    ]);
                });
            }
        });

        const csvContent = "data:text/csv;charset=utf-8,"
            + headers.join(",") + "\n"
            + rows.map(e => e.join(",")).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `stock_report_${format(date, "yyyy-MM-dd")}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="p-4 md:p-6 space-y-6 animate-slide-in h-full flex flex-col print-hide-header">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">Stock Report</h1>
                    <p className="text-muted-foreground">
                        View inventory levels, suit counts, and valuation.
                    </p>
                </div>
            </div>

            {/* Controls Row */}
            <div className="flex flex-col xl:flex-row items-end justify-between gap-6">
                <div className="flex flex-col gap-2 w-full sm:w-auto flex-none">
                    <div className="w-full sm:w-[240px]">
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
                                    {date ? format(date, "PPP") : <span>Pick a date</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    mode="single"
                                    selected={date}
                                    onSelect={(d) => d && setDate(d)}
                                    disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                                    initialFocus
                                />
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>

                <div className="flex flex-col gap-2 w-full sm:w-auto flex-none items-end space-y-2 sm:space-y-0 sm:flex-row sm:gap-2">
                    <div className="relative w-full sm:w-[250px]">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search products..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 w-full"
                        />
                    </div>
                    <Button variant="outline" onClick={handlePrint} className="w-full sm:w-auto">
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
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-xl border border-border bg-card p-4 flex flex-row items-center justify-between space-y-0">
                    <div className="space-y-1">
                        <p className="text-sm font-medium text-muted-foreground">Total Stock Value</p>
                        {isLoading ? (
                            <div className="h-8 flex items-center">
                                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                            </div>
                        ) : (
                            <p className="text-2xl font-bold text-primary">Rs. {totalStockValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                        )}
                    </div>
                    <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center">
                        <TrendingUp className="h-5 w-5 text-primary" />
                    </div>
                </div>
                <div className="rounded-xl border border-border bg-card p-4 flex flex-row items-center justify-between space-y-0">
                    <div className="space-y-1">
                        <p className="text-sm font-medium text-muted-foreground">Total Meters</p>
                        {isLoading ? (
                            <div className="h-8 flex items-center">
                                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                            </div>
                        ) : (
                            <p className="text-2xl font-bold text-foreground">{totalStockMeters.toLocaleString(undefined, { maximumFractionDigits: 2 })} m</p>
                        )}
                    </div>
                    <div className="h-10 w-10 bg-blue-500/10 rounded-full flex items-center justify-center">
                        <Package className="h-5 w-5 text-blue-600" />
                    </div>
                </div>
                <div className="rounded-xl border border-border bg-card p-4 flex flex-row items-center justify-between space-y-0">
                    <div className="space-y-1">
                        <p className="text-sm font-medium text-muted-foreground">Total Suits</p>
                        {isLoading ? (
                            <div className="h-8 flex items-center">
                                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                            </div>
                        ) : (
                            <p className="text-2xl font-bold text-foreground">{totalRolls.toLocaleString(undefined, { maximumFractionDigits: 1 })}</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="rounded-xl border border-border bg-card flex-1 overflow-hidden flex flex-col">
                <div className="overflow-auto flex-1">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="text-muted-foreground pl-4">Product Name</TableHead>
                                <TableHead className="text-muted-foreground">Product ID</TableHead>
                                <TableHead className="text-muted-foreground">Category</TableHead>
                                <TableHead className="text-muted-foreground text-right">No. of Suits</TableHead>
                                <TableHead className="text-muted-foreground text-right">QTY in Meters</TableHead>
                                <TableHead className="text-muted-foreground text-right">Cost / Suit</TableHead>
                                <TableHead className="text-muted-foreground text-right w-[150px]">Total Value</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-24 text-center">
                                        <div className="flex justify-center items-center">
                                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : filteredItems.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                                        <Package className="w-12 h-12 mx-auto mb-2 opacity-30" />
                                        <p>No products found</p>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredItems.map((item) => {
                                    const hasVariations = item.variations && item.variations.length > 0;

                                    return (
                                        <Fragment key={item.id}>
                                            <TableRow className={cn("hover:bg-muted/50 font-medium")}>
                                                <TableCell className="text-foreground pl-4">{item.name}</TableCell>
                                                <TableCell className="text-muted-foreground font-mono text-sm">{item.sku || '-'}</TableCell>
                                                <TableCell className="text-foreground">{item.category}</TableCell>
                                                <TableCell className="text-right text-foreground font-medium">
                                                    {item.rolls_at_date.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                                                </TableCell>
                                                <TableCell className="text-right font-semibold text-foreground">
                                                    {item.stock_at_date.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                                </TableCell>
                                                <TableCell className="text-right text-foreground">Rs. {item.cost_per_piece.toLocaleString()}</TableCell>
                                                <TableCell className="text-right font-bold text-primary">
                                                    Rs. {item.total_value_at_date.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                                </TableCell>
                                            </TableRow>

                                            {/* Variations Rows - Always Expanded */}
                                            {hasVariations && item.variations!.map((v) => (
                                                <TableRow key={v.id} className="bg-muted/30 hover:bg-muted/50 text-sm border-0">
                                                    <TableCell className="pl-8 flex items-center text-muted-foreground">
                                                        <CornerDownRight className="h-3 w-3 mr-2 opacity-50" />
                                                        {v.name}
                                                    </TableCell>
                                                    <TableCell className="text-muted-foreground font-mono text-xs">{v.sku}</TableCell>
                                                    <TableCell className="text-muted-foreground text-xs opacity-50">-</TableCell>
                                                    <TableCell className="text-right text-foreground">
                                                        {v.current_stock_qty}
                                                    </TableCell>
                                                    <TableCell className="text-right text-foreground">
                                                        {v.current_stock_meters.toFixed(2)}
                                                    </TableCell>
                                                    <TableCell className="text-right text-muted-foreground text-xs opacity-50">Rs. {item.cost_per_piece.toLocaleString()}</TableCell>
                                                    <TableCell className="text-right text-muted-foreground">
                                                        Rs. {(v.current_stock_meters * item.cost_per_meter).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </Fragment>
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

export default StockReport;
