import { useState } from "react";
import { 
  Truck, 
  ChevronDown, 
  ChevronUp, 
  CalendarDays, 
  Package, 
  QrCode, 
  CheckCircle2, 
  Loader2, 
  Search, 
  Hash
} from "lucide-react";
import { useInTransitVouchers, useMarkVoucherReceived } from "@/hooks/useStockReceiving";
import { useStoreSettings } from "@/hooks/useStoreSettings";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";

export default function DispatchedOrders() {
  const { data: storeSettings } = useStoreSettings();
  const shopLocationId = storeSettings?.location_id;

  const { data: vouchers = [], isLoading } = useInTransitVouchers(shopLocationId);
  const markVoucherReceived = useMarkVoucherReceived();
  const [expandedVoucherId, setExpandedVoucherId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [receivingVoucherId, setReceivingVoucherId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedVoucherId(expandedVoucherId === id ? null : id);
  };

  const handleMarkReceived = (voucherId: string) => {
    setReceivingVoucherId(voucherId);
    markVoucherReceived.mutate(
      { voucherId },
      {
        onSettled: () => setReceivingVoucherId(null),
      }
    );
  };

  const filteredVouchers = vouchers.filter((v) => {
    const query = searchQuery.toLowerCase();
    const voucherNum = v.voucher_number.toLowerCase();
    const transport = v.transport_company_name.toLowerCase();
    const bilty = v.bilty_number?.toLowerCase() || "";
    const customer = v.customer?.name.toLowerCase() || "";
    
    return (
      voucherNum.includes(query) ||
      transport.includes(query) ||
      bilty.includes(query) ||
      customer.includes(query)
    );
  });

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container space-y-6 p-6 max-w-6xl h-full flex flex-col overflow-hidden animate-slide-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Truck className="w-8 h-8 text-primary" />
            Dispatched Orders
          </h1>
          <p className="text-muted-foreground text-sm mt-1.5">
            View, inspect, and mark dispatched orders received for Retail Shop # 1.
          </p>
        </div>
        
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search vouchers, bilty, shops..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-10 w-full bg-card/50 backdrop-blur-sm border-border hover:border-primary/30 focus-visible:ring-primary transition-all duration-200"
          />
        </div>
      </div>

      <ScrollArea className="flex-1 -mx-2 px-2 mt-4">
        {filteredVouchers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-border/80 rounded-2xl bg-card/20 backdrop-blur-[2px]">
            <Truck className="w-16 h-16 text-muted-foreground/30 mb-4 stroke-[1.5]" />
            <p className="text-muted-foreground font-medium text-lg">No dispatched orders found</p>
            <p className="text-muted-foreground text-sm max-w-sm mt-1 px-4">
              {searchQuery ? "No transfers match your search query." : "All dispatched vouchers have been successfully received."}
            </p>
          </div>
        ) : (
          <div className="space-y-4 pb-8">
            {filteredVouchers.map((voucher) => {
              const isExpanded = expandedVoucherId === voucher.id;
              const isReceivingThis = receivingVoucherId === voucher.id;
              const formattedDate = voucher.created_at 
                ? format(new Date(voucher.created_at), "PPP p")
                : "-";

              const itemsList = (voucher as any).items || [];
              const totalRolls = itemsList.reduce((sum: number, it: any) => sum + (it.order_item?.rolls_count || 0), 0);
              const totalMeters = itemsList.reduce((sum: number, it: any) => sum + Number(it.order_item?.quantity_meters || 0), 0);

              return (
                <Card 
                  key={voucher.id}
                  className={`overflow-hidden border-border/60 hover:border-primary/20 transition-all duration-300 shadow-sm hover:shadow bg-card/40 backdrop-blur-md relative ${isExpanded ? 'ring-1 ring-primary/20 bg-card/60' : ''}`}
                >
                  <CardHeader 
                    onClick={() => toggleExpand(voucher.id)}
                    className="p-5 md:p-6 cursor-pointer select-none hover:bg-muted/30 transition-colors duration-200 flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary border border-primary/10">
                        <Truck className="w-6 h-6" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h3 className="font-bold text-foreground text-base md:text-lg tracking-tight">
                            {voucher.voucher_number}
                          </h3>
                          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 font-medium">
                            In Transit
                          </Badge>
                          <span className="text-xs text-muted-foreground">•</span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <CalendarDays className="w-3.5 h-3.5" />
                            {formattedDate}
                          </span>
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1 font-medium text-foreground">
                            Destination: {voucher.customer?.name || "Retail Shop # 1"}
                          </span>
                          <span className="hidden sm:inline">•</span>
                          <span className="flex items-center gap-1">
                            Transport: {voucher.transport_company_name}
                          </span>
                          {voucher.bilty_number && (
                            <>
                              <span className="hidden sm:inline">•</span>
                              <span className="flex items-center gap-1">
                                Bilty: {voucher.bilty_number}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 self-end md:self-center">
                      <div className="text-right hidden sm:block">
                        <p className="text-sm font-semibold text-foreground">{totalRolls} Rolls</p>
                        <p className="text-xs text-muted-foreground">{totalMeters.toLocaleString()} Meters</p>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Button 
                          size="sm" 
                          disabled={isReceivingThis}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkReceived(voucher.id);
                          }}
                          className="gap-1.5 font-medium hover:scale-[1.02] active:scale-[0.98] transition-transform duration-200"
                        >
                          {isReceivingThis ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Receiving...
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-4 h-4" />
                              Mark as Received
                            </>
                          )}
                        </Button>
                        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      </div>
                    </div>
                  </CardHeader>

                  {isExpanded && (
                    <CardContent className="px-5 pb-5 md:px-6 md:pb-6 pt-0 border-t border-border/40 bg-muted/20">
                      <div className="mt-4">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1">
                          <Package className="w-3.5 h-3.5 text-primary" />
                          Expected Items List ({itemsList.length})
                        </h4>

                        <div className="overflow-x-auto rounded-lg border border-border bg-card">
                          <table className="min-w-full divide-y divide-border text-sm">
                            <thead className="bg-muted/40">
                              <tr className="border-b border-border">
                                <th scope="col" className="px-4 py-3 text-left font-medium text-muted-foreground">Product</th>
                                <th scope="col" className="px-4 py-3 text-left font-medium text-muted-foreground">Lot Number</th>
                                <th scope="col" className="px-4 py-3 text-left font-medium text-muted-foreground">Grade</th>
                                <th scope="col" className="px-4 py-3 text-right font-medium text-muted-foreground">Expected Rolls</th>
                                <th scope="col" className="px-4 py-3 text-right font-medium text-muted-foreground">Expected Meters</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border bg-card">
                              {itemsList.map((item: any) => {
                                const orderItem = item.order_item || {};
                                const product = orderItem.base_product || {};
                                const lotNum = orderItem.processed_lot?.lot_number || "-";
                                const grade = orderItem.selected_grade || "A";

                                return (
                                  <tr key={item.id} className="hover:bg-muted/10 transition-colors">
                                    <td className="px-4 py-3">
                                      <div className="font-semibold text-foreground">{product.name || "Unknown Product"}</div>
                                      <div className="text-xs text-muted-foreground font-mono flex items-center gap-1 mt-0.5">
                                        <QrCode className="w-3 h-3 text-muted-foreground/60" />
                                        {product.sku || "-"}
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 font-mono font-medium text-foreground">
                                      <span className="bg-muted px-1.5 py-0.5 rounded border border-border text-xs flex items-center gap-1 w-fit">
                                        <Hash className="w-3 h-3 text-muted-foreground/60" />
                                        {lotNum}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3">
                                      <Badge 
                                        variant="outline" 
                                        className={`font-semibold text-xs ${
                                          grade === 'A' ? 'bg-green-500/10 text-green-600 border-green-500/20' : 
                                          grade === 'B' ? 'bg-blue-500/10 text-blue-600 border-blue-500/20' : 
                                          'bg-amber-500/10 text-amber-600 border-amber-500/20'
                                        }`}
                                      >
                                        Grade {grade}
                                      </Badge>
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono font-semibold text-foreground">
                                      {orderItem.rolls_count}
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono font-semibold text-foreground">
                                      {Number(orderItem.quantity_meters).toLocaleString()}m
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
