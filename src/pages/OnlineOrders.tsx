import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Globe,
  Search,
  CheckCircle2,
  XCircle,
  Truck,
  Eye,
  Building2,
  FileCheck,
  PackageCheck,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Package,
  UserCheck,
  PhoneCall,
  MapPin,
  Clock,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import TcsLiveTrackingModal from "@/components/tracking/TcsLiveTrackingModal";
import { useTenant } from "@/contexts/TenantContext";

interface OnlineOrder {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  shipping_address: string;
  city: string;
  notes?: string;
  subtotal: number;
  shipping_cost: number;
  total_amount: number;
  payment_method: string;
  payment_status: string;
  payment_proof_url?: string;
  order_status: string;
  consignment_number?: string;
  pos_sale_id?: string;
  created_at: string;
  items?: any[];
}

export default function OnlineOrders() {
  const { lexicon } = useTenant();
  const [orders, setOrders] = useState<OnlineOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [selectedOrder, setSelectedOrder] = useState<OnlineOrder | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  // Ship Modal State
  const [isShipModalOpen, setIsShipModalOpen] = useState(false);
  const [shippingOrder, setShippingOrder] = useState<OnlineOrder | null>(null);
  const [consignmentInput, setConsignmentInput] = useState("");

  // Live TCS Tracking Modal State
  const [tcsTrackingCn, setTcsTrackingCn] = useState<string | null>(null);
  const [tcsModalOpen, setTcsModalOpen] = useState(false);

  const [expandedOrderIds, setExpandedOrderIds] = useState<Set<string>>(new Set());

  const toggleExpandOrder = (orderId: string) => {
    setExpandedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  };

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("online_orders")
        .select("*, items:online_order_items(*, product:products(name, sku, stock_quantity, tax_rate, pct_code))")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (err: any) {
      console.error("Error fetching online orders:", err);
      toast.error(err.message || "Failed to load online orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();

    // Subscribe to realtime updates for online orders
    const channel = supabase
      .channel("public:online_orders")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "online_orders" },
        () => fetchOrders()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleUpdateStatus = async (orderId: string, newStatus: string, newPaymentStatus?: string) => {
    try {
      const updates: any = { order_status: newStatus, updated_at: new Date().toISOString() };
      if (newPaymentStatus) {
        updates.payment_status = newPaymentStatus;
      }

      const { error } = await supabase
        .from("online_orders")
        .update(updates)
        .eq("id", orderId);

      if (error) throw error;

      toast.success(`Order updated to status: ${newStatus}`);
      fetchOrders();
      if (selectedOrder?.id === orderId) {
        setSelectedOrder((prev) => (prev ? { ...prev, ...updates } : null));
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update order status");
    }
  };

  const handleCancelOrder = async (orderId: string, orderNumber: string) => {
    if (window.confirm(`Are you sure you want to cancel order ${orderNumber}?`)) {
      await handleUpdateStatus(orderId, "cancelled");
    }
  };

  const handleShipOrderSubmit = async () => {
    if (!shippingOrder) return;
    if (!consignmentInput.trim()) {
      toast.error("Please enter a Consignment Number / Tracking ID");
      return;
    }

    try {
      const updates = {
        order_status: "shipped",
        consignment_number: consignmentInput.trim(),
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("online_orders")
        .update(updates)
        .eq("id", shippingOrder.id);

      if (error) throw error;

      toast.success(`Order ${shippingOrder.order_number} marked as shipped! Consignment #: ${consignmentInput.trim()}`);
      setIsShipModalOpen(false);
      setShippingOrder(null);
      setConsignmentInput("");
      fetchOrders();
    } catch (err: any) {
      toast.error(err.message || "Failed to mark order as shipped");
    }
  };



  const filteredOrders = orders.filter((o) => {
    const matchesQuery =
      o.order_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.customer_phone.includes(searchQuery);

    const matchesStatus =
      statusFilter === "all" || o.order_status.toLowerCase() === statusFilter.toLowerCase();

    return matchesQuery && matchesStatus;
  });

  return (
    <div className="p-6 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 text-primary rounded-xl">
              <Globe className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Online Web Store Orders</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Review incoming e-commerce web orders, verify IBFT receipts, and approve orders into retail sales.
          </p>
        </div>

        <Button onClick={fetchOrders} variant="outline" size="sm" className="gap-2">
          <RefreshCw className="w-4 h-4" /> Refresh Orders
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase">Total Web Orders</CardTitle>
          </CardHeader>
          <CardContent className="py-2">
            <div className="text-2xl font-bold">{orders.length}</div>
          </CardContent>
        </Card>

        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader className="py-3">
            <CardTitle className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase">
              Pending Verification
            </CardTitle>
          </CardHeader>
          <CardContent className="py-2">
            <div className="text-2xl font-bold text-amber-600">
              {orders.filter((o) => o.order_status === "pending").length}
            </div>
          </CardContent>
        </Card>

        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardHeader className="py-3">
            <CardTitle className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase">
              Confirmed / Approved
            </CardTitle>
          </CardHeader>
          <CardContent className="py-2">
            <div className="text-2xl font-bold text-emerald-600">
              {orders.filter((o) => o.order_status === "confirmed" || o.order_status === "processing").length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase">Dispatched & Delivered</CardTitle>
          </CardHeader>
          <CardContent className="py-2">
            <div className="text-2xl font-bold">
              {orders.filter((o) => o.order_status === "shipped" || o.order_status === "delivered").length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Order # (AK000001), Customer Name, or Phone..."
            className="pl-9 text-sm"
          />
        </div>

        <div className="flex items-center gap-2">
          {["all", "pending", "confirmed", "shipped", "delivered", "cancelled"].map((st) => (
            <Button
              key={st}
              variant={statusFilter === st ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(st)}
              className="capitalize text-xs"
            >
              {st}
            </Button>
          ))}
        </div>
      </div>

      {/* Orders Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 p-2"></TableHead>
                <TableHead className="w-[170px] whitespace-nowrap">Order #</TableHead>
                <TableHead className="w-[130px] whitespace-nowrap">Date</TableHead>
                <TableHead className="min-w-[240px]">Customer Details</TableHead>
                <TableHead className="w-[110px] whitespace-nowrap">Amount</TableHead>
                <TableHead className="w-[130px] whitespace-nowrap">IBFT Proof</TableHead>
                <TableHead className="w-[100px] whitespace-nowrap">Status</TableHead>
                <TableHead className="w-[160px] whitespace-nowrap text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Loading online orders...
                  </TableCell>
                </TableRow>
              ) : filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No online orders found matching filter criteria.
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrders.map((ord) => {
                  const isExpanded = expandedOrderIds.has(ord.id);
                  const itemCount = ord.items?.length || 0;

                  return (
                    <Collapsible
                      key={ord.id}
                      open={isExpanded}
                      onOpenChange={() => toggleExpandOrder(ord.id)}
                      asChild
                    >
                      <React.Fragment>
                        <TableRow
                          className={`cursor-pointer hover:bg-muted/50 transition-colors ${
                            isExpanded ? "bg-muted/30 font-medium" : ""
                          }`}
                          onClick={() => toggleExpandOrder(ord.id)}
                        >
                          <TableCell className="w-10 p-2 text-center">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleExpandOrder(ord.id);
                              }}
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 fill-none text-primary transition-transform duration-200" />
                              ) : (
                                <ChevronRight className="w-4 h-4 fill-none text-muted-foreground transition-transform duration-200" />
                              )}
                            </Button>
                          </TableCell>

                          <TableCell className="font-mono font-bold text-primary whitespace-nowrap">
                            <div className="flex items-center gap-1.5 whitespace-nowrap">
                              <span>{ord.order_number}</span>
                              {itemCount > 0 && (
                                <span className="text-[10px] font-sans font-medium px-1.5 py-0.5 rounded-full bg-primary/10 text-primary shrink-0">
                                  {itemCount} {itemCount === 1 ? "item" : "items"}
                                </span>
                              )}
                            </div>
                            {ord.consignment_number && (
                               <button
                                 type="button"
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   setTcsTrackingCn(ord.consignment_number || null);
                                   setTcsModalOpen(true);
                                 }}
                                 className="inline-flex items-center gap-1 text-[10px] font-mono text-primary font-bold bg-primary/10 hover:bg-primary/20 px-2 py-0.5 rounded-md border border-primary/20 transition-all mt-1 whitespace-nowrap"
                                 title="Click to track live TCS status"
                               >
                                 <Truck className="w-3 h-3 text-primary shrink-0" /> CN: {ord.consignment_number}
                               </button>
                             )}
                            {ord.pos_sale_id && (
                              <span className="block text-[10px] text-emerald-600 font-semibold mt-0.5">POS Linked</span>
                            )}
                          </TableCell>

                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(ord.created_at).toLocaleDateString("en-PK", {
                              day: "numeric",
                              month: "short",
                            })}{" "}
                            <span className="text-[11px] block text-muted-foreground/80">
                              {new Date(ord.created_at).toLocaleTimeString("en-PK", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </TableCell>

                          <TableCell className="text-xs max-w-sm">
                            <div className="font-semibold text-xs text-foreground">{ord.customer_name}</div>
                            <div className="text-[11px] text-muted-foreground">{ord.customer_phone}</div>
                            <div className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                              {ord.shipping_address}, <span className="font-semibold text-foreground">{ord.city}</span>
                            </div>
                          </TableCell>

                          <TableCell className="font-bold text-sm whitespace-nowrap">
                            Rs. {ord.total_amount.toLocaleString()}
                          </TableCell>

                          <TableCell onClick={(e) => e.stopPropagation()}>
                            {ord.payment_proof_url ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedOrder(ord);
                                  setIsReceiptModalOpen(true);
                                }}
                                className="gap-1.5 text-xs text-emerald-600 border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/40"
                              >
                                <Eye className="w-3.5 h-3.5 fill-none text-emerald-600" /> View Receipt
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">No Screenshot</span>
                            )}
                          </TableCell>

                          <TableCell>
                            <Badge
                              variant={
                                ord.order_status === "confirmed"
                                  ? "default"
                                  : ord.order_status === "pending"
                                  ? "secondary"
                                  : "outline"
                              }
                              className="capitalize text-xs"
                            >
                              {ord.order_status}
                            </Badge>
                          </TableCell>

                          <TableCell className="text-right whitespace-nowrap space-x-1.5" onClick={(e) => e.stopPropagation()}>
                            {ord.order_status === "pending" && (
                              <Button
                                size="sm"
                                onClick={() => handleUpdateStatus(ord.id, "confirmed", "verified")}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 text-xs"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 fill-none" /> Approve
                              </Button>
                            )}

                            {ord.order_status === "confirmed" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setShippingOrder(ord);
                                  setConsignmentInput(ord.consignment_number || "");
                                  setIsShipModalOpen(true);
                                }}
                                className="gap-1 text-xs border-primary/30 text-primary hover:bg-primary/10 hover:text-primary hover:border-primary/60 transition-colors"
                              >
                                <Truck className="w-3.5 h-3.5 fill-none text-primary" /> Ship
                              </Button>
                            )}

                            {ord.order_status === "shipped" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleUpdateStatus(ord.id, "delivered")}
                                className="gap-1 text-xs text-emerald-600 border-emerald-500/30 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors"
                              >
                                <PackageCheck className="w-3.5 h-3.5 fill-none text-emerald-600" /> Deliver
                              </Button>
                            )}

                            {ord.order_status !== "cancelled" && ord.order_status !== "delivered" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleCancelOrder(ord.id, ord.order_number)}
                                className="gap-1 text-xs text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive transition-colors"
                                title="Cancel Order"
                              >
                                <XCircle className="w-3.5 h-3.5 fill-none text-destructive" /> Cancel
                              </Button>
                            )}

                            {ord.order_status === "cancelled" && (
                              <span className="text-xs text-muted-foreground italic">Cancelled</span>
                            )}
                          </TableCell>
                        </TableRow>

                        {/* Expanded Sub-Panel using CSS Grid 0fr -> 1fr smooth transition */}
                        <TableRow
                          className={`bg-slate-50/80 dark:bg-slate-900/50 transition-colors ${
                            isExpanded ? "border-b border-border/80" : "border-none"
                          }`}
                        >
                          <TableCell colSpan={8} className="p-0">
                            <div
                              className={`grid transition-all duration-300 ease-in-out ${
                                isExpanded
                                  ? "grid-rows-[1fr] opacity-100 p-4"
                                  : "grid-rows-[0fr] opacity-0 p-0 pointer-events-none"
                              }`}
                            >
                              <div className="overflow-hidden">
                                <div className="bg-background border border-border rounded-xl p-4 space-y-4 shadow-xs">
                                  <div className="flex items-center justify-between border-b pb-2">
                                    <h4 className="font-semibold text-sm flex items-center gap-2 text-primary">
                                      <Package className="w-4 h-4" /> Ordered Fabric Items ({itemCount})
                                    </h4>
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                                    {/* Ordered items table */}
                                    <div className="md:col-span-2 space-y-2">
                                      {ord.items && ord.items.length > 0 ? (
                                        <div className="divide-y divide-border border rounded-lg overflow-hidden bg-card">
                                          {ord.items.map((it: any) => {
                                            const mPerSuit = Number(it.product?.meters_per_piece) || Number(it.meters_per_suit) || 4.5;
                                            const totMeters = (it.suits_quantity || 1) * mPerSuit;
                                            return (
                                              <div
                                                key={it.id}
                                                className="p-3 flex items-center justify-between gap-4 hover:bg-muted/30 transition-colors"
                                              >
                                                <div className="space-y-1">
                                                  <div className="font-semibold text-sm text-foreground">
                                                    {it.product?.name || "Fabric Suit"}
                                                  </div>
                                                  {it.product?.sku && (
                                                    <div className="text-[11px] font-mono text-muted-foreground">
                                                      SKU: {it.product.sku}
                                                    </div>
                                                  )}
                                                  <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                                                    <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-md font-medium">
                                                      {it.suits_quantity || 1} {lexicon.item_singular}
                                                    </span>
                                                    {it.selected_color && (
                                                      <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-md font-semibold text-xs border border-emerald-500/20">
                                                        🎨 Color: {it.selected_color}
                                                      </span>
                                                    )}
                                                    {lexicon.enable_secondary_metric && (
                                                      <>
                                                        <span>•</span>
                                                        <span>
                                                          {mPerSuit}{lexicon.secondary_metric_symbol || 'm'} / {lexicon.item_singular.toLowerCase()} ({totMeters}{lexicon.secondary_metric_symbol || 'm'} total)
                                                        </span>
                                                      </>
                                                    )}
                                                  </div>
                                                </div>
                                                <div className="text-right">
                                                  <div className="font-bold text-sm text-foreground">
                                                    Rs. {(it.total_price || 0).toLocaleString()}
                                                  </div>
                                                  {it.price_per_suit && (
                                                    <div className="text-[11px] text-muted-foreground">
                                                      @ Rs. {it.price_per_suit.toLocaleString()} / {lexicon.item_singular.toLowerCase()}
                                                    </div>
                                                  )}
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      ) : (
                                        <div className="p-4 text-center text-muted-foreground border rounded-lg italic">
                                          No item breakdown recorded for this order.
                                        </div>
                                      )}
                                    </div>

                                    {/* Order Financial Breakdown & Details */}
                                    <div className="space-y-3 bg-muted/40 p-3 rounded-lg border border-border/60">
                                      <h5 className="font-semibold text-xs text-foreground uppercase tracking-wider">
                                        Summary Breakdown
                                      </h5>
                                      <div className="space-y-1.5 text-xs">
                                        <div className="flex justify-between text-muted-foreground">
                                          <span>Subtotal:</span>
                                          <span className="font-medium text-foreground">
                                            Rs. {(ord.subtotal || ord.total_amount).toLocaleString()}
                                          </span>
                                        </div>
                                        <div className="flex justify-between text-muted-foreground">
                                          <span>Shipping Fee:</span>
                                          <span className="font-medium text-foreground">
                                            {ord.shipping_cost > 0
                                              ? `Rs. ${ord.shipping_cost.toLocaleString()}`
                                              : "FREE"}
                                          </span>
                                        </div>
                                        <div className="flex justify-between text-sm font-bold pt-1.5 border-t border-border">
                                          <span>Total Amount:</span>
                                          <span className="text-primary">Rs. {ord.total_amount.toLocaleString()}</span>
                                        </div>
                                      </div>

                                      {/* Delivery Address & Contact Box */}
                                      <div className="pt-2 border-t border-border space-y-1">
                                        <span className="font-semibold text-[10px] text-muted-foreground block uppercase tracking-wider">
                                          Delivery Address & Contact:
                                        </span>
                                        <div className="p-2.5 bg-background border border-border/80 rounded-lg text-xs space-y-1">
                                          <div className="font-semibold text-foreground">{ord.customer_name} ({ord.customer_phone})</div>
                                          <div className="text-muted-foreground leading-relaxed">
                                            {ord.shipping_address}, <span className="font-semibold text-foreground">{ord.city}</span>
                                          </div>
                                          {ord.customer_email && (
                                            <div className="text-[11px] text-muted-foreground">Email: {ord.customer_email}</div>
                                          )}
                                        </div>
                                      </div>

                                      {ord.notes && (
                                        <div className="pt-2 border-t border-border">
                                          <span className="font-semibold text-[11px] text-muted-foreground block mb-1">
                                            Customer Order Notes:
                                          </span>
                                          <div className="p-2 bg-background border border-border rounded text-[11px] italic text-foreground">
                                            "{ord.notes}"
                                          </div>
                                        </div>
                                      )}

                                      <div className="pt-2 border-t border-border flex flex-col gap-1.5">
                                        <div className="flex items-center justify-between text-xs">
                                          <span className="text-muted-foreground">Payment:</span>
                                          <Badge variant="outline" className="uppercase font-mono text-[10px]">
                                            {ord.payment_method || "IBFT"} ({ord.payment_status || "pending"})
                                          </Badge>
                                        </div>
                                         {ord.consignment_number && (
                                           <div className="flex items-center justify-between text-xs pt-1.5 border-t border-border/50">
                                             <span className="text-muted-foreground">Consignment #:</span>
                                             <div className="flex items-center gap-2">
                                               <span className="font-mono font-bold text-primary">{ord.consignment_number}</span>
                                               <Button
                                                 variant="outline"
                                                 size="sm"
                                                 onClick={(e) => {
                                                   e.stopPropagation();
                                                   setTcsTrackingCn(ord.consignment_number || null);
                                                   setTcsModalOpen(true);
                                                 }}
                                                 className="h-6 text-[10px] px-2 gap-1 border-primary/30 text-primary hover:bg-primary/10"
                                               >
                                                 <Truck className="w-3 h-3" /> Track Live
                                               </Button>
                                             </div>
                                           </div>
                                         )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      </React.Fragment>
                    </Collapsible>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal 1: Receipt Proof Viewer */}
      <Dialog open={isReceiptModalOpen} onOpenChange={setIsReceiptModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-emerald-600" />
              IBFT Payment Receipt Proof
            </DialogTitle>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-4">
              <div className="text-xs space-y-1 bg-muted p-3 rounded-lg">
                <div><strong>Order #:</strong> {selectedOrder.order_number}</div>
                <div><strong>Customer:</strong> {selectedOrder.customer_name} ({selectedOrder.customer_phone})</div>
                <div><strong>Amount:</strong> Rs. {selectedOrder.total_amount.toLocaleString()}</div>
              </div>

              {selectedOrder.payment_proof_url ? (
                <div className="rounded-xl overflow-hidden border border-border bg-slate-950 p-2">
                  <img
                    src={selectedOrder.payment_proof_url}
                    alt="Receipt Screenshot"
                    className="w-full max-h-96 object-contain mx-auto"
                  />
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No screenshot uploaded.</p>
              )}

              {selectedOrder.order_status === "pending" && (
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      handleUpdateStatus(selectedOrder.id, "cancelled", "rejected");
                      setIsReceiptModalOpen(false);
                    }}
                    className="text-destructive border-destructive/40"
                  >
                    Reject Receipt
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      setIsReceiptModalOpen(false);
                      handleUpdateStatus(selectedOrder.id, "confirmed", "verified");
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    Approve
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal 2: Full Order Details */}
      <Dialog open={isDetailsModalOpen} onOpenChange={setIsDetailsModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Order Details - {selectedOrder?.order_number}</DialogTitle>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-muted p-3 rounded-lg">
                <div><span className="text-muted-foreground">Name:</span> <strong>{selectedOrder.customer_name}</strong></div>
                <div><span className="text-muted-foreground">Phone:</span> <strong>{selectedOrder.customer_phone}</strong></div>
                <div><span className="text-muted-foreground">City:</span> <strong>{selectedOrder.city}</strong></div>
                <div><span className="text-muted-foreground">Status:</span> <strong className="capitalize">{selectedOrder.order_status}</strong></div>
                <div className="col-span-2"><span className="text-muted-foreground">Shipping Address:</span> <strong>{selectedOrder.shipping_address}</strong></div>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Ordered {lexicon.item_singular} Items</h4>
                <div className="space-y-2 border border-border rounded-lg p-3">
                  {selectedOrder.items?.map((it: any) => (
                    <div key={it.id} className="flex justify-between border-b border-border/50 pb-1.5 last:pb-0 last:border-none">
                      <div>
                        <div className="font-medium text-foreground">{it.product?.name || `${lexicon.item_singular}`}</div>
                        <div className="text-[10px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                          <span>{it.suits_quantity} {lexicon.item_singular}(s){lexicon.enable_secondary_metric ? ` • ${it.total_meters} ${lexicon.secondary_metric_symbol || "Meters"}` : ""}</span>
                          {it.selected_color && (
                            <span className="font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-xs">
                              [{it.selected_color}]
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="font-bold">Rs. {it.total_price?.toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-between font-bold text-sm pt-2 border-t border-border">
                <span>Grand Total</span>
                <span className="text-primary">Rs. {selectedOrder.total_amount?.toLocaleString()}</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal 3: Ship Order & Consignment Entry */}
      <Dialog open={isShipModalOpen} onOpenChange={setIsShipModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <Truck className="w-5 h-5" /> Mark Order as Shipped
            </DialogTitle>
          </DialogHeader>

          {shippingOrder && (
            <div className="space-y-4 pt-2">
              <div className="text-xs space-y-1.5 bg-muted p-3.5 rounded-lg border border-border">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Order #:</span>
                  <strong className="font-mono text-primary">{shippingOrder.order_number}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Customer:</span>
                  <strong>{shippingOrder.customer_name} ({shippingOrder.customer_phone})</strong>
                </div>
                <div className="pt-1.5 border-t border-border/60">
                  <span className="text-muted-foreground block font-medium mb-0.5">Full Shipping Address:</span>
                  <div className="p-2 bg-background border border-border/80 rounded font-sans text-foreground text-xs leading-relaxed select-all">
                    {shippingOrder.shipping_address}, <span className="font-semibold text-primary">{shippingOrder.city}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Consignment Number / Courier Tracking ID</label>
                <Input
                  placeholder="e.g. TCS-984120, Leopard-44129"
                  value={consignmentInput}
                  onChange={(e) => setConsignmentInput(e.target.value)}
                  className="font-mono text-xs"
                  autoFocus
                />
                <p className="text-[11px] text-muted-foreground">Enter the courier tracking / consignment number for customer order tracking.</p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <Button variant="outline" size="sm" onClick={() => setIsShipModalOpen(false)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleShipOrderSubmit} className="bg-primary text-primary-foreground gap-1">
                  <Truck className="w-3.5 h-3.5" /> Save & Mark Shipped
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <TcsLiveTrackingModal
        open={tcsModalOpen}
        onOpenChange={setTcsModalOpen}
        consignmentNumber={tcsTrackingCn}
      />
    </div>
  );
}
