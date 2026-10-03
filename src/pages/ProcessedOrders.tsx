import { useState, useMemo } from "react";
import { useShopWarehouseOrders } from "@/hooks/useWarehouseOrders";
import { useStoreSettings } from "@/hooks/useStoreSettings";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, Search, PackageCheck, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

const gradeBadgeColors: Record<string, string> = {
  "A": "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  "B": "bg-amber-500/10 text-amber-600 border-amber-500/20",
  "fresh_cut": "bg-primary/10 text-primary border-primary/20",
  "cut_piece": "bg-destructive/10 text-destructive border-destructive/20",
  "mill_cut_piece": "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
  "unsettled": "bg-amber-500/10 text-amber-600 border-amber-500/20",
  "rags": "bg-slate-500/10 text-slate-600 border-slate-500/20"
};

const gradeDisplayNames: Record<string, string> = {
  "A": "Grade A",
  "B": "Grade B",
  "fresh_cut": "Fresh Cut Pieces",
  "cut_piece": "Cut Pieces",
  "mill_cut_piece": "Mill Cut Pieces",
  "unsettled": "Unsettled",
  "rags": "Rags"
};

export default function ProcessedOrders() {
  const { data: storeSettings, isLoading: isLoadingSettings } = useStoreSettings();
  const shopLocationId = storeSettings?.location_id;

  const { data: orders = [], isLoading } = useShopWarehouseOrders(shopLocationId);
  const [searchTerm, setSearchTerm] = useState("");

  const processedItems = useMemo(() => {
    const itemsList: any[] = [];
    orders.forEach(order => {
      const items = order.items || [];
      items.forEach(item => {
        if (item.status === "processed") {
          itemsList.push({
            ...item,
            orderNumber: order.order_number,
            customerName: order.customer?.city 
               ? `${order.customer.name} - ${order.customer.city}` 
               : order.customer?.name || "Retail Shop # 1",
            orderDate: order.created_at
          });
        }
      });
    });
    return itemsList;
  }, [orders]);

  const filteredItems = processedItems.filter(item => {
    const lotNum = item.processed_lot?.lot_number || "";
    const prodName = item.base_product?.name || "";
    const sku = item.base_product?.sku || "";

    return (
      item.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lotNum.toLowerCase().includes(searchTerm.toLowerCase()) ||
      prodName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sku.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  if (isLoadingSettings) {
    return (
      <div className="h-full flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="text-xs text-muted-foreground mt-2">Loading store settings...</span>
      </div>
    );
  }

  if (!shopLocationId) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto">
        <div className="p-4 bg-warning/10 rounded-full mb-4">
          <AlertTriangle className="w-10 h-10 text-warning" />
        </div>
        <h2 className="text-lg font-bold text-foreground">Location Resolving Required</h2>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
          The location "Retail Shop # 1" could not be resolved from Supabase locations table.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden p-4 md:p-6 lg:p-8 space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-foreground">Processed Orders</h1>
          <p className="text-muted-foreground text-xs md:text-sm">
            View order items that have been processed and allocated stock by the warehouse.
          </p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search processed items by Lot#, Client Name, Order# or SKU..."
          className="pl-10 h-10 rounded-lg text-sm border-border"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="flex-1 min-h-0 overflow-auto rounded-xl border border-border bg-card shadow-card">
        {isLoading ? (
          <div className="h-full flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="text-xs text-muted-foreground">Loading processed orders...</span>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground py-20">
            <PackageCheck className="w-12 h-12 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-semibold">No processed items found</p>
            <p className="text-xs opacity-75 mt-0.5">Order items will appear here once they are processed by the warehouse.</p>
          </div>
        ) : (
          <>
            <div className="hidden md:block">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="text-xs font-bold pl-6 text-muted-foreground">Order Details</TableHead>
                    <TableHead className="text-xs font-bold text-muted-foreground">Client</TableHead>
                    <TableHead className="text-xs font-bold text-muted-foreground">Product Name</TableHead>
                    <TableHead className="text-xs font-bold text-muted-foreground">Allocated Lot</TableHead>
                    <TableHead className="text-xs font-bold text-muted-foreground">Grade</TableHead>
                    <TableHead className="text-xs font-bold text-right text-muted-foreground">Picked PCS</TableHead>
                    <TableHead className="text-xs font-bold text-right pr-6 text-muted-foreground">Picked Meters</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item) => {
                    const displayName = item.base_product?.name || "Unknown Product";
                    const displaySku = item.base_product?.sku || "-";

                    return (
                      <TableRow key={item.id} className="hover:bg-muted/30">
                        <TableCell className="pl-6">
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-primary font-mono">{item.orderNumber}</span>
                            <span className="text-[9px] text-muted-foreground font-mono mt-0.5">
                              {new Date(item.orderDate).toLocaleDateString()}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs font-medium text-foreground">{item.customerName}</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-xs font-semibold text-foreground">{displayName}</span>
                            <span className="text-[9px] text-muted-foreground font-mono mt-0.5">{displaySku}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium text-xs text-foreground font-mono">
                          {item.processed_lot?.lot_number}
                        </TableCell>
                        <TableCell>
                           <Badge variant="outline" className={cn(
                             "text-[8px] font-bold py-0 h-5 px-2",
                             gradeBadgeColors[item.selected_grade] || "bg-muted text-muted-foreground"
                           )}>
                             {gradeDisplayNames[item.selected_grade] || item.selected_grade}
                           </Badge>
                        </TableCell>
                        <TableCell className="text-right text-xs font-medium text-foreground font-mono">
                          {item.rolls_count} pcs
                        </TableCell>
                        <TableCell className="text-right pr-6 text-xs font-semibold text-primary font-mono">
                          {item.quantity_meters} m
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="md:hidden divide-y divide-border/50">
              {filteredItems.map((item) => {
                const displayName = item.base_product?.name || "Unknown Product";
                const displaySku = item.base_product?.sku || "-";

                return (
                  <div key={item.id} className="p-4 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-primary font-mono">{item.orderNumber}</span>
                      <Badge variant="outline" className={cn(
                        "text-[8px] font-bold py-0 h-5 px-2",
                        gradeBadgeColors[item.selected_grade] || "bg-muted text-muted-foreground"
                      )}>
                        {gradeDisplayNames[item.selected_grade] || item.selected_grade}
                      </Badge>
                    </div>

                    <div className="space-y-1">
                      <div className="text-xs font-semibold text-foreground">{displayName}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">{displaySku}</div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground pt-1.5 border-t border-border/40 font-mono">
                      <div>Client: <span className="font-medium text-foreground">{item.customerName}</span></div>
                      <div>Lot: <span className="font-medium text-foreground">{item.processed_lot?.lot_number}</span></div>
                      <div>PCS: <span className="font-semibold text-foreground">{item.rolls_count} pcs</span></div>
                      <div>Meters: <span className="font-semibold text-primary">{item.quantity_meters} m</span></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
