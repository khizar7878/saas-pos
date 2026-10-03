import { useState } from "react";
import { useShopWarehouseOrders, useDeleteOrderItem, useCancelWarehouseOrder, useUpdateOrderItemQuantity, WarehouseOrderItem } from "@/hooks/useWarehouseOrders";
import { useStoreSettings } from "@/hooks/useStoreSettings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, ShoppingCart, Calendar, Trash2, Ban, Hash, ChevronDown, AlertTriangle, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function PendingOrders() {
  const { data: storeSettings, isLoading: isLoadingSettings } = useStoreSettings();
  const shopLocationId = storeSettings?.location_id;

  const { data: orders = [], isLoading } = useShopWarehouseOrders(shopLocationId, "pending");
  const deleteOrderItem = useDeleteOrderItem();
  const cancelOrder = useCancelWarehouseOrder();
  const updateOrderItemQuantity = useUpdateOrderItemQuantity();

  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    description: "",
    confirmText: "Confirm",
    cancelText: "Cancel",
    onConfirm: () => {}
  });

  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [tempRolls, setTempRolls] = useState<number>(0);
  const [tempMeters, setTempMeters] = useState<number>(0);

  const handleStartEdit = (item: WarehouseOrderItem) => {
    setEditingItemId(item.id);
    setTempRolls(item.rolls_count || 0);
    setTempMeters(item.quantity_meters || 0);
  };

  const handleTempDecrease = (item: WarehouseOrderItem) => {
    if (tempRolls <= 1) return;
    const cutting = item.rolls_count ? item.quantity_meters / item.rolls_count : 0;
    const newRolls = tempRolls - 1;
    setTempRolls(newRolls);
    setTempMeters(Number((newRolls * cutting).toFixed(2)));
  };

  const handleTempIncrease = (item: WarehouseOrderItem) => {
    const cutting = item.rolls_count ? item.quantity_meters / item.rolls_count : 0;
    const newRolls = tempRolls + 1;
    setTempRolls(newRolls);
    setTempMeters(Number((newRolls * cutting).toFixed(2)));
  };

  const handleCancelEdit = () => {
    setEditingItemId(null);
  };

  const handleSaveEdit = (itemId: string) => {
    if (tempRolls <= 0 || tempMeters <= 0) {
      toast.error("Quantity must be greater than zero.");
      return;
    }
    updateOrderItemQuantity.mutate({
      order_item_id: itemId,
      rolls_count: tempRolls,
      quantity_meters: tempMeters
    }, {
      onSuccess: () => {
        setEditingItemId(null);
      }
    });
  };

  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});

  const toggleOrder = (orderId: string) => {
    setExpandedOrders(prev => ({
      ...prev,
      [orderId]: !prev[orderId]
    }));
  };

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

  const activeOrders = orders.filter(o => (o.items?.filter(i => i.status === "pending") || []).length > 0);

  return (
    <div className="h-full flex flex-col overflow-hidden p-4 md:p-6 lg:p-8 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-foreground">Pending Orders</h1>
          <p className="text-muted-foreground text-xs md:text-sm">
            Monitor pending orders booked for Retail Shop # 1 and cancel items or orders before they are processed.
          </p>
        </div>
        {activeOrders.length > 0 && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-xs font-bold rounded-lg h-8 bg-card border-border hover:bg-muted"
              onClick={() => {
                const allExpanded: Record<string, boolean> = {};
                activeOrders.forEach(o => {
                  allExpanded[o.id] = true;
                });
                setExpandedOrders(allExpanded);
              }}
            >
              Expand All
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs font-bold rounded-lg h-8 bg-card border-border hover:bg-muted"
              onClick={() => setExpandedOrders({})}
            >
              Collapse All
            </Button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="text-xs text-muted-foreground">Loading pending orders...</span>
        </div>
      ) : activeOrders.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground py-20">
          <ShoppingCart className="w-12 h-12 text-muted-foreground/30 mb-3" />
          <p className="text-sm font-semibold">No pending orders found</p>
          <p className="text-xs opacity-75 mt-0.5">All booked orders are processed, packed, or completed.</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 p-0.5 items-start">
            {activeOrders.map((order) => {
              const pendingItems = order.items?.filter(i => i.status === "pending") || [];
              if (pendingItems.length === 0) return null;

              const totalRolls = pendingItems.reduce((sum, item) => sum + (item.rolls_count || 0), 0);
              const totalMeters = pendingItems.reduce((sum, item) => sum + (item.quantity_meters || 0), 0);

              const isExpanded = !!expandedOrders[order.id];

              return (
                <Card 
                  key={order.id} 
                  className={cn(
                    "border border-border bg-card shadow-card hover:shadow-card-md transition-all duration-200 flex flex-col relative overflow-visible",
                    isExpanded ? "rounded-t-xl rounded-b-none z-30" : "rounded-xl"
                  )}
                >
                  <CardHeader 
                    className="bg-muted/30 p-4 shrink-0 cursor-pointer select-none hover:bg-muted/50 transition-colors flex flex-col rounded-t-xl"
                    onClick={() => toggleOrder(order.id)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-primary truncate max-w-[280px]" title={order.customer?.city ? `${order.customer.name} - ${order.customer.city}` : order.customer?.name}>
                        {order.customer?.name || "Retail Shop # 1"}
                        {order.customer?.city && <span className="text-muted-foreground font-semibold"> - {order.customer.city}</span>}
                      </span>
                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="h-7 w-7 flex items-center justify-center text-destructive hover:bg-destructive/10 hover:text-destructive active:scale-95 transition-all rounded-full focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Cancel Order"
                          disabled={cancelOrder.isPending}
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmConfig({
                              isOpen: true,
                              title: "Cancel Entire Order",
                              description: `Are you sure you want to cancel the entire order ${order.order_number}?`,
                              confirmText: "Cancel Order",
                              cancelText: "Keep Order",
                              onConfirm: () => {
                                cancelOrder.mutate({ order_id: order.id });
                              }
                            });
                          }}
                        >
                          {cancelOrder.isPending ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Ban className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          type="button"
                          className="h-7 w-7 text-muted-foreground hover:bg-muted hover:text-foreground active:scale-95 transition-all rounded-full p-0 flex items-center justify-center focus:outline-none"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleOrder(order.id);
                          }}
                        >
                          <ChevronDown className={cn(
                            "w-4 h-4 transition-transform duration-300",
                            isExpanded ? "transform rotate-180" : ""
                          )} />
                        </button>
                      </div>
                    </div>
                    
                    <div className="space-y-1 mt-2 text-xs text-muted-foreground font-semibold">
                      <div className="flex items-center gap-1.5 font-mono text-[11px]">
                        <Hash className="w-3.5 h-3.5 text-primary/70 shrink-0" />
                        <span>Order No: {order.order_number}</span>
                      </div>
                      <div className="flex items-center gap-1.5 font-mono text-[11px]">
                        <Calendar className="w-3.5 h-3.5 text-primary/70 shrink-0" />
                        <span>Date: {new Date(order.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div className="flex gap-3 pt-2 text-[10px] text-muted-foreground/80 font-bold border-t border-border/40 mt-2 font-mono">
                      <span>{pendingItems.length} {pendingItems.length === 1 ? 'item' : 'items'}</span>
                      <span>•</span>
                      <span>{totalRolls} pcs</span>
                      <span>•</span>
                      <span>{totalMeters} m</span>
                    </div>
                  </CardHeader>

                  <div 
                    className={cn(
                      "absolute top-full left-[-1px] right-[-1px] z-30 bg-card border border-border border-t-0 rounded-b-xl shadow-lg transition-all duration-200 ease-in-out origin-top",
                      isExpanded ? "scale-y-100 opacity-100 visible" : "scale-y-0 opacity-0 invisible h-0 overflow-hidden"
                    )}
                  >
                    <div className="overflow-hidden">
                      <CardContent 
                        className={cn(
                          "p-4 space-y-3.5 border-t border-border/40",
                          pendingItems.length > 4 ? "max-h-[500px] overflow-y-auto overscroll-y-contain" : "overflow-hidden"
                        )}
                      >
                        {pendingItems.map((item) => {
                          const displayName = item.base_product?.name || "Unknown Product";
                          const displaySku = item.base_product?.sku || "-";
                          const isEditing = editingItemId === item.id;

                          return (
                            <div key={item.id} className="p-3 bg-muted/20 hover:bg-muted/40 border border-border/40 rounded-xl transition-all duration-150 space-y-2.5">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="text-xs font-bold text-foreground leading-snug break-words">{displayName}</div>
                                  <div className="text-[10px] text-muted-foreground font-mono mt-0.5">{displaySku}</div>
                                </div>
                              </div>

                              <div className="flex items-center justify-between text-xs border-t border-b border-border/30 h-9 font-mono font-bold">
                                {isEditing ? (
                                  <div className="flex items-center gap-1 bg-muted/40 px-1 py-0.5 rounded border border-border/40 select-none">
                                    <button
                                      type="button"
                                      className="w-4 h-4 rounded hover:bg-muted flex items-center justify-center font-bold text-sm text-foreground active:scale-90 transition-transform"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleTempDecrease(item);
                                      }}
                                    >
                                      -
                                    </button>
                                    <span className="text-foreground font-bold px-1.5 min-w-[28px] text-center">{tempRolls} PCS</span>
                                    <button
                                      type="button"
                                      className="w-4 h-4 rounded hover:bg-muted flex items-center justify-center font-bold text-sm text-foreground active:scale-90 transition-transform"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleTempIncrease(item);
                                      }}
                                    >
                                      +
                                    </button>
                                  </div>
                                ) : (
                                  <div className="text-foreground">{item.rolls_count} PCS</div>
                                )}
                                <div className="text-muted-foreground">Cutting: {item.rolls_count ? Math.round(item.quantity_meters / item.rolls_count) : 0}m</div>
                                <div className="text-primary">Total: {isEditing ? tempMeters : item.quantity_meters} m</div>
                              </div>

                              {item.packing_details && (
                                <div className="text-[9px] bg-black/5 dark:bg-white/5 p-2 rounded border border-border/30 text-muted-foreground leading-normal font-sans">
                                  <span className="font-semibold text-foreground">Packing Instructions:</span>
                                  <p className="mt-0.5 whitespace-pre-wrap">{item.packing_details}</p>
                                </div>
                              )}

                              <div className="flex gap-2 justify-end pt-1">
                                {isEditing ? (
                                  <>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-8 text-xs font-semibold rounded-lg border-border text-foreground hover:bg-muted active:scale-95 transition-all shadow-sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleCancelEdit();
                                      }}
                                    >
                                      Cancel
                                    </Button>
                                    <Button
                                      size="sm"
                                      className="h-8 text-xs font-semibold rounded-lg active:scale-95 transition-all bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleSaveEdit(item.id);
                                      }}
                                      disabled={updateOrderItemQuantity.isPending}
                                    >
                                      {updateOrderItemQuantity.isPending && (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                                      )}
                                      Save
                                    </Button>
                                  </>
                                ) : (
                                  <>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-8 text-xs font-semibold rounded-lg border-border text-foreground hover:bg-muted active:scale-95 transition-all shadow-sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleStartEdit(item);
                                      }}
                                    >
                                      <Pencil className="w-3 h-3 mr-1" />
                                      Edit Qty
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-8 text-xs font-semibold rounded-lg border-border text-destructive hover:bg-destructive/10 hover:text-destructive active:scale-95 transition-all shadow-sm"
                                      disabled={deleteOrderItem.isPending}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setConfirmConfig({
                                          isOpen: true,
                                          title: "Remove Line Item",
                                          description: `Are you sure you want to remove the item "${displayName}" from this order?`,
                                          confirmText: "Remove Item",
                                          cancelText: "Cancel",
                                          onConfirm: () => {
                                            deleteOrderItem.mutate({ order_item_id: item.id });
                                          }
                                        });
                                      }}
                                    >
                                      {deleteOrderItem.isPending ? (
                                        <Loader2 className="w-3 h-3 animate-spin mr-1" />
                                      ) : (
                                        <Trash2 className="w-3.5 h-3.5 mr-1" />
                                      )}
                                      Remove
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </CardContent>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      <AlertDialog open={confirmConfig.isOpen} onOpenChange={(open) => setConfirmConfig(prev => ({ ...prev, isOpen: open }))}>
        <AlertDialogContent className="max-w-md rounded-2xl p-6 shadow-xl border border-border bg-card">
          <AlertDialogHeader className="space-y-2">
            <AlertDialogTitle className="text-lg font-bold text-foreground">
              {confirmConfig.title}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-muted-foreground leading-relaxed">
              {confirmConfig.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6 flex items-center justify-end gap-3">
            <AlertDialogCancel className="rounded-xl h-9 text-xs font-semibold px-4">
              {confirmConfig.cancelText || "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl h-9 text-xs font-semibold px-4 bg-destructive hover:bg-destructive/90 text-destructive-foreground shadow-sm transition-all"
              onClick={() => {
                confirmConfig.onConfirm();
              }}
            >
              {confirmConfig.confirmText || "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
