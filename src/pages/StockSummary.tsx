
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Search, Package, TrendingUp, Download, Printer } from "lucide-react";
import { useStoreSettings } from "@/hooks/useStoreSettings";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { printStockReport } from "@/utils/printStockReport";
import { useTenant } from "@/contexts/TenantContext";

const StockSummary = () => {
    const { lexicon } = useTenant();
    const [searchTerm, setSearchTerm] = useState("");
    const { data: storeSettings } = useStoreSettings();

    const { data: products = [], isLoading } = useQuery({
        queryKey: ['products-stock-summary'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('products')
                .select(`
                    id, 
                    name, 
                    sku, 
                    stock_quantity, 
                    cost_price, 
                    price, 
                    meters_per_piece,
                    product_categories(name)
                `)
                .order('name');

            if (error) throw error;
            return data;
        }
    });

    const filteredProducts = useMemo(() => {
        return products.filter(p =>
            p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (p.sku || "").toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [products, searchTerm]);

    const stats = useMemo(() => {
        return filteredProducts.reduce((acc, p) => {
            const stock = p.stock_quantity || 0; // Suits
            const meters = stock * (p.meters_per_piece || 0);
            const cost = p.cost_price || 0;
            const value = stock * cost;

            return {
                totalSuits: acc.totalSuits + stock,
                totalMeters: acc.totalMeters + meters,
                totalValue: acc.totalValue + value
            };
        }, { totalSuits: 0, totalMeters: 0, totalValue: 0 });
    }, [filteredProducts]);

    return (
        <div className="p-4 md:p-6 space-y-6 animate-slide-in h-full flex flex-col">
            {/* Print Header */}
            {/* Print Header Removed - Using Professional Report */}\n

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">Stock Summary</h1>
                    <p className="text-muted-foreground">Real-time inventory overview.</p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    <div className="relative w-full sm:w-[250px]">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search products..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 w-full"
                        />
                    </div>
                    <Button variant="outline" onClick={() => printStockReport(filteredProducts, stats, storeSettings)}>
                        <Printer className="w-4 h-4 mr-2" />
                        Print
                    </Button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className={`grid gap-3 ${lexicon.enable_secondary_metric ? 'md:grid-cols-2' : 'md:grid-cols-1'}`}>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total {lexicon.item_plural}</CardTitle>
                        <Package className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalSuits.toLocaleString(undefined, { maximumFractionDigits: 1 })}</div>
                    </CardContent>
                </Card>
                {lexicon.enable_secondary_metric && (
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total {lexicon.secondary_metric_name || "Meters"}</CardTitle>
                            <Package className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {stats.totalMeters.toLocaleString(undefined, { maximumFractionDigits: 2 })} {lexicon.secondary_metric_symbol || "m"}
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>

            <div className="rounded-xl border border-border bg-card flex-1 overflow-hidden flex flex-col">
                <div className="overflow-auto flex-1">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Product Name</TableHead>
                                <TableHead>SKU</TableHead>
                                <TableHead>Category</TableHead>
                                <TableHead className="text-right">Stock ({lexicon.item_plural})</TableHead>
                                {lexicon.enable_secondary_metric && (
                                    <TableHead className="text-right">QTY in {lexicon.secondary_metric_name || "Meters"}</TableHead>
                                )}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredProducts.map((product) => (
                                <TableRow key={product.id}>
                                    <TableCell className="font-medium">{product.name}</TableCell>
                                    <TableCell>{product.sku}</TableCell>
                                    <TableCell>{Array.isArray(product.product_categories) ? product.product_categories[0]?.name : (product.product_categories as any)?.name || '-'}</TableCell>
                                    <TableCell className="text-right">{product.stock_quantity}</TableCell>
                                    {lexicon.enable_secondary_metric && (
                                        <TableCell className="text-right">{(product.stock_quantity * (product.meters_per_piece || 0)).toFixed(2)}</TableCell>
                                    )}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div >
    );
};

export default StockSummary;
