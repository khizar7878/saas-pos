import { useState } from "react";
import { Package, Calendar as CalendarIcon, Printer, Search, TrendingUp, TrendingDown, DollarSign, ShoppingCart, Loader2 } from "lucide-react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useProductSales } from "@/hooks/useProductSales";
import { format, subDays, startOfWeek, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DateRange } from "react-day-picker";
import { Card } from "@/components/ui/card";

const ProductSales = () => {
    const [date, setDate] = useState<DateRange | undefined>({
        from: new Date(),
        to: new Date(),
    });
    const [searchTerm, setSearchTerm] = useState("");

    const { data: productSales = [], isLoading } = useProductSales(date);

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

    // Filter products by search term
    const filteredProducts = productSales.filter(product =>
        product.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.product_code.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Calculate summary metrics
    const totalProducts = filteredProducts.length;
    const totalRevenue = filteredProducts.reduce((sum, p) => sum + p.total_revenue, 0);
    const totalQuantity = filteredProducts.reduce((sum, p) => sum + p.total_quantity_sold, 0);
    const totalTransactions = filteredProducts.reduce((sum, p) => sum + p.transaction_count, 0);

    const handlePrint = () => {
        window.print();
    };

    // Removed global loading spinner to make filters and inputs interactive during fetch

    return (
        <div className="p-4 md:p-6 space-y-6 animate-slide-in print-hide-header">
            <div className="flex flex-col gap-4 print:hidden">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">Product Sales Report</h1>
                        <p className="text-muted-foreground">Track sales performance by product</p>
                    </div>
                </div>

                {/* Filters Row */}
                <div className="flex flex-col xl:flex-row items-end justify-between gap-6">
                    <div className="flex flex-col gap-2 w-full sm:w-auto flex-none">
                        <div className="w-full sm:w-[360px]">
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        id="date"
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

                        <div className="flex gap-1 w-full sm:w-[360px]">
                            <Button variant="outline" size="sm" className="h-7 text-[10px] sm:text-xs rounded-md flex-1 px-1" onClick={() => applyPreset('yesterday')}>Yesterday</Button>
                            <Button variant="outline" size="sm" className="h-7 text-[10px] sm:text-xs rounded-md flex-1 px-1" onClick={() => applyPreset('thisWeek')}>This Week</Button>
                            <Button variant="outline" size="sm" className="h-7 text-[10px] sm:text-xs rounded-md flex-1 px-1" onClick={() => applyPreset('thisMonth')}>This Month</Button>
                            <Button variant="outline" size="sm" className="h-7 text-[10px] sm:text-xs rounded-md flex-1 px-1" onClick={() => applyPreset('lastMonth')}>Last Month</Button>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2 w-full sm:w-auto flex-none items-end min-h-[40px] justify-end">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handlePrint}
                            className="w-full sm:w-auto"
                        >
                            <Printer className="w-4 h-4 mr-2" />
                            Print Report
                        </Button>
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Products Sold</p>
                                {isLoading ? (
                                    <div className="h-8 flex items-center">
                                        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                                    </div>
                                ) : (
                                    <p className="text-2xl font-bold">{totalProducts}</p>
                                )}
                            </div>
                            <Package className="w-8 h-8 text-primary opacity-50" />
                        </div>
                    </Card>

                    <Card className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Total Revenue</p>
                                {isLoading ? (
                                    <div className="h-8 flex items-center">
                                        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                                    </div>
                                ) : (
                                    <p className="text-2xl font-bold">Rs. {totalRevenue.toLocaleString()}</p>
                                )}
                            </div>
                            <DollarSign className="w-8 h-8 text-success opacity-50" />
                        </div>
                    </Card>

                    <Card className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Quantity Sold</p>
                                {isLoading ? (
                                    <div className="h-8 flex items-center">
                                        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                                    </div>
                                ) : (
                                    <p className="text-2xl font-bold">{totalQuantity}</p>
                                )}
                            </div>
                            <TrendingUp className="w-8 h-8 text-info opacity-50" />
                        </div>
                    </Card>

                    <Card className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Transactions</p>
                                {isLoading ? (
                                    <div className="h-8 flex items-center">
                                        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                                    </div>
                                ) : (
                                    <p className="text-2xl font-bold">{totalTransactions}</p>
                                )}
                            </div>
                            <ShoppingCart className="w-8 h-8 text-warning opacity-50" />
                        </div>
                    </Card>
                </div>

                {/* Search */}
                <div className="relative w-full sm:w-[360px]">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                        placeholder="Search by product name or code..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                    />
                </div>
            </div>

            {/* Print Header (hidden on screen) */}
            <div className="hidden print:block mb-6">
                <h1 className="text-2xl font-bold">Product Sales Report</h1>
                <p className="text-sm text-muted-foreground">
                    {date?.from && date?.to && (
                        <>Period: {format(date.from, "LLL dd, y")} - {format(date.to, "LLL dd, y")}</>
                    )}
                </p>
            </div>

            {/* Products Table */}
            <div className="border rounded-lg overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[100px]">Code</TableHead>
                            <TableHead>Product Name</TableHead>
                            <TableHead className="text-right">Qty Sold</TableHead>
                            <TableHead className="text-right">Revenue</TableHead>
                            <TableHead className="text-right">Transactions</TableHead>
                            <TableHead className="text-right">Avg Price</TableHead>
                            <TableHead className="text-right print:hidden">Current Stock</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                                    <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-2" />
                                    <p>Loading product database...</p>
                                </TableCell>
                            </TableRow>
                        ) : filteredProducts.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                    No product sales found for the selected period
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredProducts.map((product, index) => (
                                <TableRow key={product.product_id}>
                                    <TableCell className="font-medium">{product.product_code}</TableCell>
                                    <TableCell>{product.product_name}</TableCell>
                                    <TableCell className="text-right">{product.total_quantity_sold}</TableCell>
                                    <TableCell className="text-right font-medium">
                                        Rs. {product.total_revenue.toLocaleString()}
                                    </TableCell>
                                    <TableCell className="text-right">{product.transaction_count}</TableCell>
                                    <TableCell className="text-right">
                                        Rs. {product.avg_price_per_piece.toFixed(2)}
                                    </TableCell>
                                    <TableCell className="text-right print:hidden">
                                        <span className={cn(
                                            product.current_stock < 5 && "text-destructive font-medium"
                                        )}>
                                            {product.current_stock}
                                        </span>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Summary Footer (for print) */}
            <div className="hidden print:block mt-6 pt-4 border-t">
                <div className="grid grid-cols-4 gap-4 text-sm">
                    <div>
                        <p className="text-muted-foreground">Products Sold</p>
                        <p className="font-bold">{totalProducts}</p>
                    </div>
                    <div>
                        <p className="text-muted-foreground">Total Revenue</p>
                        <p className="font-bold">Rs. {totalRevenue.toLocaleString()}</p>
                    </div>
                    <div>
                        <p className="text-muted-foreground">Quantity Sold</p>
                        <p className="font-bold">{totalQuantity}</p>
                    </div>
                    <div>
                        <p className="text-muted-foreground">Transactions</p>
                        <p className="font-bold">{totalTransactions}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProductSales;
