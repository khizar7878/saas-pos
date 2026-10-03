import { useState, useCallback, useRef, useMemo } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { Search, ShoppingCart, Package, Printer, Trash2, Pause, Send, ArrowDownAZ, Clock, Shuffle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import BarcodeScanner from "@/components/sales/BarcodeScanner";
import CustomerDetails, { Customer } from "@/components/sales/CustomerDetails";
import CartItems, { CartItem } from "@/components/sales/CartItems";
import OrderSummary from "@/components/sales/OrderSummary";
import CheckoutDialog from "@/components/sales/CheckoutDialog";
import PrintBillDialog from "@/components/sales/PrintBillDialog";
import UserSelectionDialog from "@/components/sales/UserSelectionDialog";
import GridViewSelector, { GridLayout } from "@/components/sales/GridViewSelector";
import HeldCartTabs, { HeldCart } from "@/components/sales/HeldCartTabs";
import ShortcutBar from "@/components/sales/ShortcutBar";
import { cn } from "@/lib/utils";
import { useProducts } from "@/hooks/useProducts";
import { useCreateSale } from "@/hooks/useSales";
import { useHeldCarts } from "@/hooks/useHeldCarts";
import { Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useStoreSettings } from "@/hooks/useStoreSettings";
import { useBillPrinter } from "@/hooks/useBillPrinter";

const gridLayoutClasses: Record<GridLayout, string> = {
  "2x2": "grid-cols-2",
  "3x3": "grid-cols-3",
  "4x4": "grid-cols-4",
  "2x4": "grid-cols-4",
};

const Sales = () => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [gridLayout, setGridLayout] = useState<GridLayout>("3x3");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [currentDiscount, setCurrentDiscount] = useState(0);
  const [sortMethod, setSortMethod] = useState<"alphabetical" | "recent" | "random">("recent");
  const [randomSeed, setRandomSeed] = useState(0);

  const handleSortToggle = () => {
    if (sortMethod === "alphabetical") {
      setSortMethod("recent");
      toast.info("Sorting by Recently Added");
    } else if (sortMethod === "recent") {
      setSortMethod("random");
      setRandomSeed(Math.random());
      toast.info("Sorting Randomized");
    } else {
      setSortMethod("alphabetical");
      toast.info("Sorting Alphabetically");
    }
  };

  // Ref ensures hotkey callbacks always read the latest discount (avoids stale closure)
  const currentDiscountRef = useRef(0);
  currentDiscountRef.current = currentDiscount;

  // DB-based Held Carts
  const { heldCarts, isLoading: isLoadingHeldCarts, createHeldCart, deleteHeldCart } = useHeldCarts('sales');

  const [selectedCustomer, setSelectedCustomer] = useState<Customer>({
    id: "walk-in",
    name: "Walk-in Customer",
  });
  const [mobileTab, setMobileTab] = useState<"cart" | "summary">("cart");
  const [printBillOpen, setPrintBillOpen] = useState(false);
  const [lastSale, setLastSale] = useState<any>(null);

  // Auto Print State
  const [autoPrint, setAutoPrint] = useState(() => localStorage.getItem("akws-auto-print") === "true");

  const toggleAutoPrint = (checked: boolean) => {
    setAutoPrint(checked);
    localStorage.setItem("akws-auto-print", String(checked));
    if (checked) {
      toast.success("Auto-print enabled");
    } else {
      toast.info("Auto-print disabled");
    }
  };

  const { printBill } = useBillPrinter(); // Hook usage

  const [saleType, setSaleType] = useState<"counter" | "delivery">("counter");
  const { data: storeSettings } = useStoreSettings();
  const {
    data: allProducts = [],
    isLoading: isProductsLoading,
    refetch,
  } = useProducts();
  const createSale = useCreateSale();


  // Refs for shortcuts
  const searchInputRef = useRef<HTMLInputElement>(null);
  const desktopScannerRef = useRef<{ focus: () => void }>(null);
  const mobileScannerRef = useRef<{ focus: () => void }>(null);
  const [isCustomerOpen, setIsCustomerOpen] = useState(false);

  const focusInput = useCallback(() => {
    // Small timeout to allow UI updates/modal closing
    setTimeout(() => {
      if (window.innerWidth >= 768) {
        desktopScannerRef.current?.focus();
      } else {
        mobileScannerRef.current?.focus();
      }
    }, 100);
  }, []);

  // Keyboard Shortcuts
  useHotkeys('f1', (e) => {
    e.preventDefault();
    handleSendCart();
  }, { enableOnFormTags: true });

  useHotkeys('f2', (e) => {
    e.preventDefault();
    handleHoldCart();
  }, { enableOnFormTags: true });

  useHotkeys('f3', (e) => {
    e.preventDefault();
    if (cart.length > 0) setCart([]);
  }, { enableOnFormTags: true });

  useHotkeys('f4', (e) => {
    e.preventDefault();
    searchInputRef.current?.focus();
  }, { enableOnFormTags: true });

  useHotkeys('f5', (e) => {
    e.preventDefault();
    focusInput();
  }, { enableOnFormTags: true });

  useHotkeys('f6', (e) => {
    e.preventDefault();
    setIsCustomerOpen(prev => !prev);
  }, { enableOnFormTags: true });

  useHotkeys('f8', (e) => {
    e.preventDefault();
    toggleAutoPrint(!autoPrint);
  }, { enableOnFormTags: true });

  useHotkeys('f9', (e) => {
    e.preventDefault();
    if (cart.length > 0) handleCheckoutClick(currentDiscountRef.current);
  }, { enableOnFormTags: true });

  const handleShortcutAction = (key: string) => {
    switch (key) {
      case 'F1': handleSendCart(); break;
      case 'F2': handleHoldCart(); break;
      case 'F3': if (cart.length > 0) setCart([]); break;
      case 'F4': searchInputRef.current?.focus(); break;
      case 'F5': focusInput(); break;
      case 'F6': setIsCustomerOpen(prev => !prev); break;
      case 'F7':
        const heldCartsSection = document.getElementById('held-carts-section');
        if (heldCartsSection) {
          heldCartsSection.scrollIntoView({ behavior: 'smooth' });
        }
        break;
      case 'F8': toggleAutoPrint(!autoPrint); break;
      case 'F9': if (cart.length > 0) handleCheckoutClick(currentDiscountRef.current); break;
    }
  };

  const addToCart = (product: any) => {
    if (product.stock_quantity <= 0) {
      toast.error("Item is out of stock!");
      return;
    }

    const cartItemId = product.id;
    const existing = cart.find((item) => item.productId === product.id);

    if (existing && existing.quantity >= product.stock_quantity) {
      toast.error(`Cannot add more. Only ${product.stock_quantity} available.`);
      return;
    }

    if (existing) {
      setCart(
        cart.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      );
    } else {
      setCart([...cart, {
        id: cartItemId,
        productId: product.id,
        productName: product.name,
        price: product.price,
        unitPrice: product.price, // Same as price in simple model
        quantity: 1,
        stockQty: product.stock_quantity,
        sku: product.sku,
        taxRate: product.tax_rate || 0,
        taxAmount: product.tax_rate ? (product.price - (product.price / (1 + product.tax_rate / 100))) : 0,
        metersPerPiece: product.meters_per_piece || 0,
        pctCode: product.pct_code
      }]);
    }
    // Only show toast on desktop (md and above)
    if (window.innerWidth >= 768) {
      toast.success(`Added ${product.name} to cart`);
    }
  };

  const handleBarcodeScan = useCallback((barcode: string) => {
    const product = allProducts.find(
      (p) => p.sku === barcode || (p.barcode && p.barcode === barcode)
    );
    if (product) {
      addToCart(product);
    } else {
      toast.error(`Product not found: ${barcode}`);
    }
  }, [allProducts, cart]);

  const removeFromCart = (id: string) => {
    setCart(cart.filter((item) => item.id !== id));
  };

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(id);
      return;
    }
    setCart(
      cart.map((item) => (item.id === id ? { ...item, quantity } : item))
    );
  };

  const handleHoldCart = async () => {
    if (cart.length === 0) return;

    try {
      const subtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

      createHeldCart.mutate({
        items: [...cart],
        customerName: selectedCustomer.name,
        customerId: selectedCustomer.id,
        subtotal: subtotal,
        pageType: 'sales'
      });

      setCart([]);
      setSelectedCustomer({ id: "walk-in", name: "Walk-in Customer" });
      toast.success("Cart held successfully");

      // Refocus barcode scanner
      focusInput();
    } catch (error) {
      // Error handled by hook
      console.error(error);
    }
  };

  const [userSelectionOpen, setUserSelectionOpen] = useState(false);

  // ... (existing code)

  const handleSendCart = () => {
    if (cart.length === 0) {
      toast.error("Cart is empty");
      return;
    }
    setUserSelectionOpen(true);
  };

  const handleSelectUser = async (userId: string) => {
    try {
      const subtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

      await createHeldCart.mutateAsync({
        items: [...cart],
        customerName: selectedCustomer.name,
        customerId: selectedCustomer.id,
        subtotal: subtotal,
        pageType: 'forwarding',
        assignedTo: userId
      });

      setCart([]);
      setSelectedCustomer({ id: "walk-in", name: "Walk-in Customer" });
      setUserSelectionOpen(false);
      toast.success("Order forwarded successfully");
    } catch (error) {
      console.error(error);
    }
  };

  const subtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const totalTax = cart.reduce((sum, item) => sum + (item.taxAmount || 0) * item.quantity, 0);
  const total = subtotal - currentDiscount;

  const handleRecallCart = (heldCart: HeldCart) => {
    // Check if current cart has items
    if (cart.length > 0) {
      // Check if customer matches
      const currentCustomerId = selectedCustomer.id === "walk-in" ? null : selectedCustomer.id;
      const heldCustomerId = heldCart.customerId === "walk-in" ? null : heldCart.customerId;

      if (currentCustomerId === heldCustomerId) {
        // MERGE: Add held cart items to current cart
        const mergedCart = [...cart];

        heldCart.items.forEach((heldItem: any) => {
          const existingIndex = mergedCart.findIndex(
            item => item.productId === heldItem.productId
          );

          if (existingIndex >= 0) {
            // Item exists, increase quantity
            mergedCart[existingIndex] = {
              ...mergedCart[existingIndex],
              quantity: mergedCart[existingIndex].quantity + heldItem.quantity
            };
          } else {
            // New item, add to cart
            mergedCart.push(heldItem);
          }
        });

        setCart(mergedCart);
        handleDeleteHeldCart(heldCart.id);
        toast.success("Cart merged successfully");
        return;
      } else {
        // Different customer - show error
        toast.error("Cannot merge: Different customer. Please clear current cart first.");
        return;
      }
    }

    setCart(heldCart.items);
    if (heldCart.customerId) {
      setSelectedCustomer({ id: heldCart.customerId, name: heldCart.customerName || "Customer" });
    } else {
      setSelectedCustomer({ id: "walk-in", name: heldCart.customerName || "Walk-in Customer" });
    }

    handleDeleteHeldCart(heldCart.id);
    toast.success("Cart recalled successfully");

    // Refocus barcode scanner
    focusInput();
  };

  const handleDeleteHeldCart = async (cartId: string) => {
    try {
      await deleteHeldCart.mutateAsync(cartId);
      toast.success("Held cart deleted");
    } catch (error) {
      console.error(error);
    }
  };

  const sortedProducts = useMemo(() => {
    let sorted = [...allProducts];
    if (sortMethod === "alphabetical") {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortMethod === "recent") {
      sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else if (sortMethod === "random") {
      sorted.sort(() => Math.random() - 0.5);
    }
    return sorted;
  }, [allProducts, sortMethod, randomSeed]);

  const filteredProducts = sortedProducts.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleCheckoutClick = (discount: number) => {
    setCurrentDiscount(discount);
    setCheckoutOpen(true);
  };

  const handleCheckoutConfirm = async (
    paymentMethod: string,
    amountReceived: number,
    bankAccountId?: string,
    chequeDetails?: { chequeNumber: string; chequeBank: string; chequeDate: string },
    paymentSplits?: any[],
    receivedBy?: string
  ) => {
    try {
      const saleData = await createSale.mutateAsync({
        sale: {
          customer_id: selectedCustomer.id === "walk-in" ? null : selectedCustomer.id,
          customer_name: selectedCustomer.name,
          subtotal,
          discount_amount: currentDiscount,
          total_amount: total,
          payment_method: paymentMethod as any,
          amount_received: amountReceived,
          change_amount: Math.max(0, amountReceived - total),
          deposit_account_id: bankAccountId || null,
          cheque_number: chequeDetails?.chequeNumber || null,
          cheque_bank: chequeDetails?.chequeBank || null,
          cheque_date: chequeDetails?.chequeDate || null,
          sale_type: saleType,
          payment_splits: paymentSplits,
          received_by: receivedBy,
        },
        items: cart.map(item => ({
          product_id: item.productId,
          product_name: item.productName,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          total_price: item.unitPrice * item.quantity,
          tax_percentage: item.taxRate || 0,
          tax_amount: item.taxAmount || 0,
          discount: 0, // Item level discount not yet implemented in UI
          pct_code: item.pctCode || "01011000"
        })),
      });

      // Prepare data for print bill
      const billData = {
        saleNumber: saleData.sale_number,
        customerName: selectedCustomer.name,
        customerPhone: (selectedCustomer as any).phone, // Cast if needed or update type
        items: cart.map(item => ({
          productName: item.productName,
          quantity: item.quantity,
          metersPerUnit: item.metersPerPiece || 0,
          pricePerMeter: item.unitPrice,
          totalPrice: item.unitPrice * item.quantity,
          taxRate: item.taxRate || 0,
          taxAmount: item.taxAmount || 0,
        })),
        subtotal,
        discount: currentDiscount,
        total,
        paymentMethod,
        amountReceived,
        change: Math.max(0, amountReceived - total),
        date: new Date(),
        customerBalance: selectedCustomer.id !== "walk-in"
          ? (selectedCustomer.current_balance || 0) + Math.max(0, total - amountReceived)
          : 0,
        saleType: saleType,
        fbrInvoiceNumber: saleData.fbr_invoice_number,
        fbrQrCode: saleData.fbr_qr_code,
        fbrPosId: storeSettings?.fbr_pos_id,
        paymentSplits: paymentSplits,
      };

      setLastSale(billData);

      // Skip printing for delivery sales
      if (saleType === 'delivery') {
        // No printing for delivery sales
      } else if (autoPrint) {
        printBill(billData); // Silent print
      } else {
        setPrintBillOpen(true); // Open Dialog
      }

      setCart([]);
      setCurrentDiscount(0);
      setSelectedCustomer({ id: "walk-in", name: "Walk-in Customer" });

      // Refocus barcode scanner
      focusInput();
    } catch (error) {
      // Error toast is handled by the mutation
      throw error;
    }
  };

  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  if (isProductsLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }




  return (
    <>
      {/* Desktop Layout */}
      <div className="hidden md:flex h-full gap-4 overflow-hidden p-4">
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <div className="p-4 pb-0">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-6">
                <div>
                  <h1 className="text-xl font-semibold text-foreground mb-1">Sales</h1>
                  <p className="text-sm text-muted-foreground">
                    {filteredProducts.length} items available
                  </p>
                </div>

                <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg border border-border">
                  <Switch
                    id="auto-print"
                    checked={autoPrint}
                    onCheckedChange={toggleAutoPrint}
                  />
                  <Label htmlFor="auto-print" className="text-sm cursor-pointer whitespace-nowrap font-medium">Auto Print</Label>
                </div>

                <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg border border-border">
                  <Switch
                    id="sale-type"
                    checked={saleType === 'delivery'}
                    onCheckedChange={(checked) => setSaleType(checked ? 'delivery' : 'counter')}
                  />
                  <Label htmlFor="sale-type" className="text-sm cursor-pointer whitespace-nowrap font-medium w-[90px]">
                    {saleType === 'delivery' ? 'Delivery Sale' : 'Counter Sale'}
                  </Label>
                </div>


              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 bg-muted/50 border-border"
                  onClick={handleSortToggle}
                  title={`Sort by: ${sortMethod}`}
                >
                  {sortMethod === "alphabetical" && <ArrowDownAZ className="w-4 h-4" />}
                  {sortMethod === "recent" && <Clock className="w-4 h-4" />}
                  {sortMethod === "random" && <Shuffle className="w-4 h-4" />}
                </Button>
                <GridViewSelector
                  currentLayout={gridLayout}
                  onLayoutChange={setGridLayout}
                />
              </div>
            </div>

            <div className="mb-4">
              <ShortcutBar onAction={handleShortcutAction} />
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                placeholder="Search by name or barcode... (F4)"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="flex-1 overflow-auto p-4">
            <div className={cn("grid gap-2", gridLayoutClasses[gridLayout])}>
              {filteredProducts.map((product) => (
                <button
                  key={product.id}
                  onClick={() => addToCart(product)}
                  className="p-2.5 rounded-lg border border-border bg-card hover:border-primary hover:bg-primary/5 hover:shadow-md transition-all duration-300 group text-left select-none active:scale-[0.98] active:shadow-inner flex flex-col h-full relative overflow-hidden"
                >
                  <div className="flex items-start gap-3 mb-2">
                    <div className="w-9 h-9 shrink-0 rounded-md bg-primary/10 flex items-center justify-center pointer-events-none">
                      <ShoppingCart className="w-4 h-4 text-primary" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="font-medium text-foreground text-sm leading-tight mb-1 line-clamp-2 pointer-events-none">
                        {product.name}
                      </h3>
                      <p className="text-muted-foreground text-[10px] font-mono pointer-events-none">
                        {product.sku || "-"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-auto">
                    <p className="text-primary font-bold text-sm md:text-base pointer-events-none">
                      Rs. {product.price.toLocaleString()}
                    </p>

                    <div className="flex items-center flex-wrap gap-1 mt-1.5 pointer-events-none">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">
                        {product.stock_quantity} in stock
                      </Badge>
                      {product.meters_per_piece > 0 && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
                          {product.meters_per_piece}m
                        </Badge>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <HeldCartTabs
            heldCarts={heldCarts}
            onRecallCart={handleRecallCart}
            onDeleteHeldCart={handleDeleteHeldCart}
          />
        </div>

        <div className="w-[30%] min-w-[400px] flex flex-col overflow-hidden">
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 flex flex-col p-4 md:p-5 gap-3 md:gap-4 overflow-auto">
              <div className="flex gap-2 items-stretch">
                <div className="flex-1 min-w-0">
                  <BarcodeScanner ref={desktopScannerRef} onScan={handleBarcodeScan} />
                </div>
                <Button
                  variant="default"
                  onClick={() => setCart([])}
                  disabled={cart.length === 0}
                  title="Clear Cart"
                  className="h-full aspect-square flex-shrink-0 p-0 flex items-center justify-center bg-primary hover:bg-primary group"
                >
                  <Trash2 style={{ width: '32px', height: '32px' }} strokeWidth={1.5} className="text-primary-foreground group-hover:text-destructive transition-colors" />
                </Button>
              </div>
              <CustomerDetails
                selectedCustomer={selectedCustomer}
                onCustomerChange={setSelectedCustomer}
                isOpen={isCustomerOpen}
                onOpenChange={setIsCustomerOpen}
              />
              <CartItems
                items={cart}
                onUpdateQuantity={updateQuantity}
                onRemove={removeFromCart}
              />
            </div>

            <div className="p-3 md:p-4">
              <OrderSummary
                subtotal={subtotal}
                totalTax={totalTax}
                itemCount={cartItemCount}
                onCheckout={handleCheckoutClick}
                onDiscountChange={setCurrentDiscount}
                renderActions={(checkoutButton) => (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleHoldCart}
                      disabled={cart.length === 0}
                      className="flex-shrink-0"
                      title="Hold for later (Private)"
                    >
                      <Pause className="w-4 h-4 mr-1" />
                      Hold
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleSendCart}
                      disabled={cart.length === 0}
                      className="flex-shrink-0"
                      title="Forward to others (Shared)"
                    >
                      <Send className="w-4 h-4 mr-1" />
                      Send
                    </Button>
                    {checkoutButton}
                  </div>
                )}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="md:hidden h-full flex flex-col overflow-hidden">
        <Tabs value={mobileTab} onValueChange={(v) => setMobileTab(v as "cart" | "summary")} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-2 mx-4 mt-2 max-w-[calc(100%-2rem)]">
            <TabsTrigger value="cart" className="flex items-center gap-2 relative">
              <ShoppingCart className="w-4 h-4" />
              Cart
              {cartItemCount > 0 && (
                <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-[10px]">
                  {cartItemCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="summary" className="flex items-center gap-2">
              <Printer className="w-4 h-4" />
              Summary
            </TabsTrigger>
          </TabsList>

          <TabsContent value="cart" className="flex-1 flex flex-col overflow-hidden m-0 data-[state=inactive]:hidden">
            <div className="flex-1 flex flex-col p-4 gap-3 overflow-auto">
              <BarcodeScanner ref={mobileScannerRef} onScan={handleBarcodeScan} />
              <CartItems
                items={cart}
                onUpdateQuantity={updateQuantity}
                onRemove={removeFromCart}
              />
            </div>
          </TabsContent>

          <TabsContent value="summary" className="flex-1 flex flex-col overflow-hidden m-0 data-[state=inactive]:hidden">
            <div className="flex-1 flex flex-col p-4 gap-3 overflow-auto">
              <CustomerDetails
                selectedCustomer={selectedCustomer}
                onCustomerChange={setSelectedCustomer}
                isOpen={isCustomerOpen}
                onOpenChange={setIsCustomerOpen}
              />

              <OrderSummary
                subtotal={subtotal}
                totalTax={totalTax}
                itemCount={cartItemCount}
                onCheckout={handleCheckoutClick}
                onDiscountChange={setCurrentDiscount}
                renderActions={(checkoutButton) => (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleHoldCart}
                      disabled={cart.length === 0}
                      className="flex-shrink-0"
                      title="Hold for later (Private)"
                    >
                      <Pause className="w-4 h-4 mr-1" />
                      Hold
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleSendCart}
                      disabled={cart.length === 0}
                      className="flex-shrink-0"
                      title="Forward to others (Shared)"
                    >
                      <Send className="w-4 h-4 mr-1" />
                      Send
                    </Button>
                    {checkoutButton}
                  </div>
                )}
              />

              <HeldCartTabs
                heldCarts={heldCarts}
                onRecallCart={handleRecallCart}
                onDeleteHeldCart={handleDeleteHeldCart}
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <CheckoutDialog
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        total={total}
        onConfirm={handleCheckoutConfirm}
        isWalkInCustomer={selectedCustomer.id === "walk-in"}
        isProcessing={createSale.isPending}
      />


      {lastSale && (
        <PrintBillDialog
          open={printBillOpen}
          onOpenChange={setPrintBillOpen}
          saleNumber={lastSale.saleNumber}
          customerName={lastSale.customerName}
          customerPhone={lastSale.customerPhone}
          items={lastSale.items}
          subtotal={lastSale.subtotal}
          discount={lastSale.discount}
          total={lastSale.total}
          paymentMethod={lastSale.paymentMethod}
          amountReceived={lastSale.amountReceived}
          change={lastSale.change}
          date={lastSale.date}
          autoPrint={autoPrint}
          saleType={saleType}
          fbrInvoiceNumber={lastSale.fbrInvoiceNumber}
          fbrQrCode={lastSale.fbrQrCode}
          fbrPosId={lastSale.fbrPosId}
        />
      )}

      <UserSelectionDialog
        open={userSelectionOpen}
        onOpenChange={setUserSelectionOpen}
        onSelectUser={handleSelectUser}
        isProcessing={createHeldCart.isPending}
        salesOnly={true}
      />
    </>
  );
};

export default Sales;
