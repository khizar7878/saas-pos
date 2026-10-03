import { useState, useEffect, useRef } from "react";
import { useWarehouseProducts, useWarehouseProductVariations, useCreateWarehouseOrder } from "@/hooks/useWarehouseOrders";
import { useStoreSettings } from "@/hooks/useStoreSettings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { toast } from "sonner";
import { Loader2, Plus, Minus, Trash2, ShoppingCart, AlertTriangle, Check, ChevronsUpDown, Package, Scissors, Calculator, FileText, Send } from "lucide-react";
import { cn } from "@/lib/utils";

interface DraftItem {
  key: string;
  base_product_id: string;
  productName: string;
  sku: string;
  quantity_meters: number;
  rolls_count: number;
  packing_details: string;
  meters_per_unit: number;
}

export default function BookOrder() {
  const { data: storeSettings, isLoading: isLoadingSettings } = useStoreSettings();
  const shopLocationId = storeSettings?.location_id;

  const { data: baseProducts = [], isLoading: isLoadingBase } = useWarehouseProducts();
  const createOrder = useCreateWarehouseOrder();

  // Element refs for keyboard navigation
  const productRef = useRef<HTMLButtonElement>(null);
  const variationRef = useRef<HTMLButtonElement>(null);
  const quantityRef = useRef<HTMLInputElement>(null);
  const packingRef = useRef<HTMLTextAreaElement>(null);

  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedVariationId, setSelectedVariationId] = useState("");
  const [quantity, setQuantity] = useState<number>(1);
  const [openProductPopover, setOpenProductPopover] = useState(false);
  const [packingDetails, setPackingDetails] = useState("");

  const { data: variations = [], isLoading: isLoadingVariations } = useWarehouseProductVariations(selectedProductId || null);

  useEffect(() => {
    if (variations.length > 0 && !selectedVariationId) {
      setSelectedVariationId(variations[0].id);
    }
  }, [variations, selectedVariationId]);

  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);

  const handleProductChange = (val: string) => {
    setSelectedProductId(val);
    setSelectedVariationId("");
    setQuantity(1);
    setOpenProductPopover(false);
    setTimeout(() => {
      variationRef.current?.focus();
    }, 100);
  };

  const handleVariationChange = (val: string) => {
    setSelectedVariationId(val);
  };

  const handleAddItem = () => {
    if (!selectedProductId || !selectedVariationId || quantity <= 0) {
      toast.error("Please select a product, a variation (cutting), and enter a positive quantity.");
      return;
    }

    const matchedProd = baseProducts.find(p => p.id === selectedProductId);
    if (!matchedProd) return;

    const selectedVar = variations.find(v => v.id === selectedVariationId);
    if (!selectedVar) {
      toast.error("Invalid variation selected.");
      return;
    }

    const meters = quantity * selectedVar.meters_per_unit;

    const newItem: DraftItem = {
      key: `${selectedProductId}:${selectedVariationId}:${Date.now()}`,
      base_product_id: selectedProductId,
      productName: matchedProd.name,
      sku: selectedVar.sku,
      quantity_meters: meters,
      rolls_count: quantity,
      packing_details: packingDetails.trim(),
      meters_per_unit: selectedVar.meters_per_unit
    };

    setDraftItems(prev => [...prev, newItem]);
    
    setSelectedProductId("");
    setSelectedVariationId("");
    setQuantity(1);
    setPackingDetails("");

    setTimeout(() => {
      productRef.current?.focus();
    }, 100);
  };

  const handleDeleteItem = (key: string) => {
    setDraftItems(prev => prev.filter(item => item.key !== key));
  };

  const handleSubmitOrder = () => {
    if (!shopLocationId) {
      toast.error("Active shop location not resolved.");
      return;
    }

    if (draftItems.length === 0) {
      toast.error("Please add at least one product to the order book.");
      return;
    }

    createOrder.mutate(
      {
        customer_id: shopLocationId,
        items: draftItems.map(item => ({
          base_product_id: item.base_product_id,
          quantity_meters: item.quantity_meters,
          rolls_count: item.rolls_count,
          packing_details: item.packing_details
        }))
      },
      {
        onSuccess: () => {
          setDraftItems([]);
        }
      }
    );
  };

  useEffect(() => {
    // Focus product trigger button when store settings finish loading (matching ak-warehouse)
    if (!isLoadingSettings && shopLocationId) {
      const timer = setTimeout(() => {
        productRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isLoadingSettings, shopLocationId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Alt + P: Focus Product selector & open popover
      if (e.altKey && e.code === 'KeyP') {
        e.preventDefault();
        productRef.current?.focus();
        setOpenProductPopover(true);
      }
      // 2. Alt + V: Focus Cutting selector
      if (e.altKey && e.code === 'KeyV') {
        e.preventDefault();
        variationRef.current?.focus();
      }
      // 3. Alt + Q: Focus Quantity input
      if (e.altKey && e.code === 'KeyQ') {
        e.preventDefault();
        quantityRef.current?.focus();
        quantityRef.current?.select();
      }
      // 4. Alt + K: Focus Packing Details input
      if (e.altKey && e.code === 'KeyK') {
        e.preventDefault();
        packingRef.current?.focus();
      }
      // 5. Alt + A: Add Item to draft
      if (e.altKey && e.code === 'KeyA') {
        e.preventDefault();
        handleAddItem();
      }
      // 6. Alt + Enter or Alt + S: Book order
      if ((e.altKey && (e.code === 'Enter' || e.code === 'NumpadEnter')) || (e.altKey && e.code === 'KeyS')) {
        e.preventDefault();
        handleSubmitOrder();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedProductId, selectedVariationId, quantity, packingDetails, draftItems, baseProducts, variations, shopLocationId]);

  const isSubmitting = createOrder.isPending;

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
    <div className="h-full flex flex-col overflow-hidden p-3 md:p-6 lg:p-8 space-y-3 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col 2xl:flex-row 2xl:items-center justify-between gap-3.5 border-b border-border pb-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground whitespace-nowrap">
            Book Order
          </h1>
          <p className="text-muted-foreground text-xs md:text-sm mt-0.5">
            Generate and book warehouse fabric orders for Retail Shop # 1.
          </p>
        </div>

        {/* Prominent Shortcut Bar matching Sales page ShortcutBar design */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 shrink-0 py-0.5">
          {[
            { key: "Alt+P", label: "Product", icon: Package, action: () => { productRef.current?.focus(); setOpenProductPopover(true); } },
            { key: "Alt+V", label: "Cutting", icon: Scissors, action: () => { variationRef.current?.focus(); } },
            { key: "Alt+Q", label: "Quantity", icon: Calculator, action: () => { quantityRef.current?.focus(); quantityRef.current?.select(); } },
            { key: "Alt+K", label: "Notes", icon: FileText, action: () => { packingRef.current?.focus(); } },
            { key: "Alt+A", label: "Add Item", icon: Plus, action: () => handleAddItem() },
            { key: "Alt+Enter", label: "Book Order", icon: Send, primary: true, action: () => handleSubmitOrder() }
          ].map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.key}
                type="button"
                onClick={s.action}
                className={cn(
                  "flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-md border border-primary/15 bg-primary/[0.03] group transition-all duration-150 shrink-0",
                  "hover:bg-primary hover:text-primary-foreground hover:border-primary",
                  "text-[11px] font-semibold text-primary/90",
                  "focus:outline-none focus:ring-1 focus:ring-ring",
                  s.primary && "border-primary/20 bg-primary/10 text-primary font-bold hover:bg-primary hover:text-primary-foreground"
                )}
                title={`${s.label} (${s.key})`}
              >
                <span className={cn(
                  "bg-primary/10 text-primary px-1.5 py-0.5 rounded text-[9px] border border-primary/20 min-w-[24px] text-center font-mono transition-colors",
                  "group-hover:bg-primary-foreground group-hover:text-primary group-hover:border-primary-foreground",
                  s.primary && "bg-primary text-primary-foreground border-primary group-hover:bg-primary-foreground group-hover:text-primary group-hover:border-primary-foreground"
                )}>
                  {s.key}
                </span>
                <span className="text-[10px] sm:text-[11px] 2xl:text-xs">{s.label}</span>
                <Icon className="w-3 h-3 opacity-85 group-hover:opacity-100 group-hover:text-primary-foreground" />
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-6 flex-1 min-h-0 overflow-hidden p-1.5 -m-1.5">
        {/* Order Builder Input Card */}
        <div className="lg:col-span-1 flex flex-col space-y-2.5 md:space-y-3 overflow-y-auto pr-1 pb-1 h-full">
          <Card className="rounded-xl border border-border bg-card shadow-card hover:shadow-card-md transition-all duration-200 lg:flex-1 flex flex-col">
            <CardHeader className="p-3 md:p-3.5 pb-2 border-b border-border/50">
              <CardTitle className="text-sm font-semibold text-primary flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-primary" /> Add Order Item
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 md:p-3.5 pt-2 flex-1 flex flex-col min-h-0 gap-3">
              <div className="space-y-2.5 md:space-y-3 flex-1 flex flex-col min-h-0">
                {/* Product selector */}
                <div className="space-y-1 md:space-y-1.5">
                  <Label htmlFor="product" className="text-xs font-semibold">
                    Product <span className="text-destructive">*</span>
                  </Label>
                  <Popover open={openProductPopover} onOpenChange={setOpenProductPopover}>
                    <PopoverTrigger asChild>
                      <button
                        id="product"
                        ref={productRef}
                        type="button"
                        className="flex h-9 w-full items-center justify-between rounded-lg border border-border bg-background px-3 text-xs font-normal text-foreground hover:bg-primary/5 hover:text-primary hover:border-primary/30 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <span className="truncate text-left">
                          {selectedProductId
                            ? baseProducts.find((prod) => prod.id === selectedProductId)?.name || "Select Product"
                            : "Select Product"}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      style={{ width: "var(--radix-popover-trigger-width)" }}
                      className="p-0 shadow-lg border border-border/70 rounded-lg bg-popover"
                      align="start"
                      side="bottom"
                      avoidCollisions={false}
                    >
                      <Command shouldFilter={true}>
                        <CommandInput placeholder="Search product..." className="h-9 border-0 focus:ring-0 focus:border-0 text-xs" />
                        <CommandList className="max-h-52 overflow-y-auto">
                          <CommandEmpty className="text-xs text-muted-foreground text-center py-4">No product found.</CommandEmpty>
                          {isLoadingBase ? (
                            <div className="flex items-center justify-center py-4">
                              <Loader2 className="w-4 h-4 animate-spin text-primary" />
                            </div>
                          ) : baseProducts.length === 0 ? (
                            <div className="p-2 text-center text-xs text-muted-foreground">No products available</div>
                          ) : (
                            <CommandGroup className="p-1">
                              {baseProducts.map((prod) => (
                                <CommandItem
                                  key={prod.id}
                                  value={prod.name}
                                  onSelect={() => handleProductChange(prod.id)}
                                  className="cursor-pointer p-2 rounded-md text-xs flex justify-between items-center"
                                >
                                  <div className="flex items-center gap-2">
                                    <Check
                                      className={cn(
                                        "h-4 w-4 shrink-0 text-primary",
                                        selectedProductId === prod.id ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    <span>{prod.name}</span>
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          )}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Cutting (Variation) & Quantity */}
                <div className="space-y-2.5 md:space-y-3">
                  <div className="space-y-1 md:space-y-1.5">
                    <Label htmlFor="variation" className="text-xs font-semibold">
                      Cutting (Variation) <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={selectedVariationId}
                      onValueChange={handleVariationChange}
                      disabled={!selectedProductId}
                    >
                      <SelectTrigger
                        id="variation"
                        ref={variationRef}
                        className="h-9 rounded-lg border-border focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                      >
                        <SelectValue
                          placeholder={
                            !selectedProductId
                              ? "Select Product First"
                              : "Select Cutting..."
                          }
                        />
                      </SelectTrigger>
                      <SelectContent
                        onCloseAutoFocus={(e) => {
                          e.preventDefault();
                          setTimeout(() => {
                            quantityRef.current?.focus();
                            quantityRef.current?.select();
                          }, 10);
                        }}
                      >
                        {isLoadingVariations ? (
                          <div className="p-2 text-center text-xs text-muted-foreground">Loading variations...</div>
                        ) : variations.length === 0 ? (
                          <div className="p-2 text-center text-xs text-muted-foreground">No variations found</div>
                        ) : (
                          variations.map((v) => (
                            <SelectItem key={v.id} value={v.id}>
                              {v.sku} ({v.meters_per_unit}m)
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1 md:space-y-1.5">
                    <Label htmlFor="item-qty" className="text-xs font-semibold">
                      Quantity (PCS/Units) <span className="text-destructive">*</span>
                    </Label>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 rounded-lg border-border"
                        disabled={!selectedProductId || quantity <= 1}
                        onClick={() => setQuantity(prev => Math.max(1, prev - 1))}
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                      <Input
                        id="item-qty"
                        ref={quantityRef}
                        type="number"
                        min="1"
                        className="h-9 rounded-lg border-border text-center flex-1"
                        disabled={!selectedProductId}
                        value={quantity}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          if (!isNaN(val) && val > 0) {
                            setQuantity(val);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            packingRef.current?.focus();
                          }
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 rounded-lg border-border"
                        disabled={!selectedProductId}
                        onClick={() => setQuantity(prev => prev + 1)}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Notes Details */}
                <div className="space-y-1.5 flex-1 flex flex-col min-h-[60px]">
                  <Label htmlFor="packing" className="text-xs font-semibold shrink-0">
                    Notes
                  </Label>
                  <Textarea
                    id="packing"
                    ref={packingRef}
                    placeholder="e.g. Custom packaging instructions, notes..."
                    className="flex-1 min-h-[55px] rounded-lg border-border resize-none text-base focus-visible:ring-1 py-2 px-3 bg-background"
                    disabled={!selectedProductId}
                    value={packingDetails}
                    onChange={(e) => setPackingDetails(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleAddItem();
                      }
                    }}
                  />
                </div>
              </div>

              <Button
                type="button"
                className="w-full h-9 rounded-lg font-semibold active:scale-[0.99] mt-3 shrink-0"
                disabled={!selectedProductId || !selectedVariationId}
                onClick={handleAddItem}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Item to Book
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Draft Items List Table Card */}
        <Card className="rounded-xl border border-border bg-card shadow-card hover:shadow-card-md transition-all duration-200 lg:col-span-2 flex flex-col justify-between overflow-hidden">
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle className="text-lg font-medium text-foreground">Order Book Draft</CardTitle>
            <CardDescription className="text-xs">
              Review draft products and packaging details before booking.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 flex-1 flex flex-col justify-between overflow-hidden">
            {draftItems.length === 0 ? (
              <div className="py-20 text-center text-muted-foreground my-auto">
                <ShoppingCart className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-sm font-semibold">Your draft order is empty</p>
                <p className="text-xs opacity-75 mt-0.5">Configure items on the left panel to build the order.</p>
              </div>
            ) : (
              <div className="flex-1 flex flex-col justify-between overflow-hidden min-h-0">
                {/* Desktop View Table */}
                <div className="hidden md:block border border-border rounded-xl flex-1 overflow-y-auto mb-4 min-h-0 shadow-inner bg-muted/5">
                  <Table>
                    <TableHeader className="bg-muted/40 sticky top-0 z-10 bg-background shadow-[0_1px_0_0_rgba(0,0,0,0.05)] border-b border-border">
                      <TableRow>
                        <TableHead className="text-xs font-bold pl-6 text-muted-foreground">Product Details</TableHead>
                        <TableHead className="text-xs font-bold text-muted-foreground">SKU</TableHead>
                        <TableHead className="text-xs font-bold text-right text-muted-foreground">PCS</TableHead>
                        <TableHead className="text-xs font-bold text-right text-muted-foreground">Meters</TableHead>
                        <TableHead className="text-xs font-bold pl-4 text-muted-foreground">Packing Details</TableHead>
                        <TableHead className="w-12 pr-6"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {draftItems.map((item) => (
                        <TableRow key={item.key} className="hover:bg-muted/25">
                           <TableCell className="text-xs font-medium text-foreground pl-6">{item.productName}</TableCell>
                           <TableCell className="text-xs text-muted-foreground font-mono">{item.sku}</TableCell>
                           <TableCell className="text-xs font-medium text-right font-mono">{item.rolls_count}</TableCell>
                           <TableCell className="text-xs font-semibold text-right text-primary font-mono">{item.quantity_meters} m</TableCell>
                           <TableCell className="text-xs text-foreground/80 pl-4 truncate max-w-[180px]">
                             {item.packing_details || <span className="italic opacity-60">Standard Packing</span>}
                           </TableCell>
                           <TableCell className="pr-6 text-right">
                             <Button
                               variant="ghost"
                               size="icon"
                               className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive rounded-lg"
                               onClick={() => handleDeleteItem(item.key)}
                             >
                               <Trash2 className="w-4 h-4" />
                             </Button>
                           </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile View Cards */}
                <div className="md:hidden space-y-3 flex-1 overflow-y-auto mb-4 min-h-0">
                  {draftItems.map((item) => (
                    <div key={item.key} className="p-4 rounded-xl border border-border bg-card shadow-sm space-y-2 relative">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive rounded-lg"
                        onClick={() => handleDeleteItem(item.key)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                      <div className="space-y-0.5">
                        <div className="text-xs font-bold text-foreground pr-8">{item.productName}</div>
                        <div className="text-[9px] text-muted-foreground font-mono">{item.sku}</div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-border/40 text-xs">
                        <div>
                          <span className="text-muted-foreground">PCS:</span>{" "}
                          <span className="font-semibold text-foreground font-mono">{item.rolls_count}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Meters:</span>{" "}
                          <span className="font-semibold text-primary font-mono">{item.quantity_meters} m</span>
                        </div>
                      </div>
                      {item.packing_details && (
                        <div className="text-[9px] bg-muted/40 p-2 rounded-lg border border-border/50 text-foreground mt-1">
                          <span className="font-semibold">Packing:</span> {item.packing_details}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="bg-muted/30 p-4 rounded-xl border border-border flex flex-col md:flex-row items-center justify-between gap-4 mt-auto shadow-sm">
                  <div className="flex gap-4 text-xs font-semibold text-muted-foreground">
                    <div>Total Items: <span className="font-bold text-foreground">{draftItems.length}</span></div>
                    <div>Total PCS: <span className="font-bold text-foreground">{draftItems.reduce((s, i) => s + i.rolls_count, 0)}</span></div>
                    <div>Total Meters: <span className="font-bold text-primary">{draftItems.reduce((s, i) => s + i.quantity_meters, 0)} m</span></div>
                  </div>
                  <Button
                    onClick={handleSubmitOrder}
                    className="h-10 px-8 rounded-lg font-semibold shadow-sm w-full md:w-auto transition-all active:scale-[0.99]"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Booking Order...
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4 mr-2" />
                        Book Order
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
