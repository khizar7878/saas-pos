import { useRef, useState, useEffect, useCallback } from "react";
import { Package, Plus, Minus, Trash2, PackagePlus, ScanBarcode, Loader2, Check, X, Printer } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useProducts } from "@/hooks/useProducts";
import { useReceiveStock } from "@/hooks/useStockReceiving";
import { Product } from "@/types/database";
import { printStockReceipt } from "@/components/stock/StockReceiptPrint";
import { useTenant } from "@/contexts/TenantContext";

interface ReceivingItem {
  id: string;
  productId: string;
  name: string;
  sku: string;
  quantity: number;
  metersPerPiece: number;
}

interface ScannedProduct {
  product: Product;
  quantity: number;
}

const StockReceiving = () => {
  const [receivingCart, setReceivingCart] = useState<ReceivingItem[]>([]);
  const [notes, setNotes] = useState("");
  const [barcode, setBarcode] = useState("");
  const [scannedProduct, setScannedProduct] = useState<ScannedProduct | null>(null);
  const [lastReceipt, setLastReceipt] = useState<any>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const quantityInputRef = useRef<HTMLInputElement>(null);
  const barcodeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { data: products = [], isLoading } = useProducts();
  const receiveStock = useReceiveStock();
  const { lexicon } = useTenant();


  useEffect(() => {
    barcodeInputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (scannedProduct) {
      setTimeout(() => {
        quantityInputRef.current?.focus();
        quantityInputRef.current?.select();
      }, 100);
    }
  }, [scannedProduct?.product.id]);

  const handleBarcodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setBarcode(value);

    if (barcodeTimeoutRef.current) {
      clearTimeout(barcodeTimeoutRef.current);
    }

    if (value.trim()) {
      barcodeTimeoutRef.current = setTimeout(() => {
        handleBarcodeScan(value.trim());
      }, 300);
    }
  };

  const handleBarcodeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && barcode.trim()) {
      if (barcodeTimeoutRef.current) {
        clearTimeout(barcodeTimeoutRef.current);
      }
      handleBarcodeScan(barcode.trim());
    }
  };

  const handleBarcodeScan = useCallback((scannedBarcode: string) => {
    const product = products.find(
      (p) => p.sku?.toLowerCase() === scannedBarcode.toLowerCase()
    );

    if (product) {
      setScannedProduct({ product, quantity: 1 });
      setBarcode("");
      toast.success(`Found: ${product.name} (${product.meters_per_piece}m)`);
    } else {
      toast.error(`Product not found: ${scannedBarcode}`);
      setBarcode("");
      setTimeout(() => {
        barcodeInputRef.current?.focus();
      }, 0);
    }
  }, [products]);

  const confirmScannedProduct = () => {
    if (!scannedProduct || scannedProduct.quantity <= 0) return;

    const { product, quantity } = scannedProduct;
    const existing = receivingCart.find((item) => item.productId === product.id);

    if (existing) {
      setReceivingCart(
        receivingCart.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        )
      );
    } else {
      setReceivingCart([...receivingCart, {
        id: `${Date.now()}-${product.id}`,
        productId: product.id,
        name: product.name,
        sku: product.sku || '',
        quantity: quantity,
        metersPerPiece: product.meters_per_piece,
      }]);
    }

    toast.success(`Added ${quantity} piece(s) of ${product.name}`);
    setScannedProduct(null);
    setTimeout(() => {
      barcodeInputRef.current?.focus();
    }, 0);
  };

  const cancelScannedProduct = () => {
    setScannedProduct(null);
    setTimeout(() => {
      barcodeInputRef.current?.focus();
    }, 0);
  };

  const handleQuantityKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      confirmScannedProduct();
    } else if (e.key === "Escape") {
      cancelScannedProduct();
    }
  };

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromReceiving(id);
      return;
    }
    setReceivingCart(
      receivingCart.map((item) => (item.id === id ? { ...item, quantity } : item))
    );
  };

  const removeFromReceiving = (id: string) => {
    setReceivingCart(receivingCart.filter((item) => item.id !== id));
  };

  const handleReceiveStock = async () => {
    if (receivingCart.length === 0) {
      toast.error("Please add items to receive");
      return;
    }

    try {
      const receipt = await receiveStock.mutateAsync({
        items: receivingCart.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          metersPerPiece: item.metersPerPiece,
        })),
        notes: notes || undefined,
      });

      // Prepare receipt data for printing with full item details
      const receiptForPrint = {
        ...receipt,
        items: receivingCart // Use the cart items which have names/skus
      };

      setLastReceipt(receiptForPrint);
      setReceivingCart([]);
      setNotes("");
      setShowSuccessModal(true);
    } catch (error) {
      // handled
    }
  };

  const totalquantity = receivingCart.reduce((sum, item) => sum + item.quantity, 0);
  const totalMeters = receivingCart.reduce((sum, item) => sum + (item.quantity * item.metersPerPiece), 0);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col md:flex-row gap-4 p-4 md:p-6 overflow-hidden">
      {/* Left Panel - Barcode Scanner & Scanned Product */}
      <div className="flex-1 rounded-xl border border-border bg-card shadow-sm flex flex-col min-w-0 overflow-hidden">
        <div className="p-4 md:p-6 border-b border-border">
          <h1 className="text-xl md:text-2xl font-semibold text-foreground mb-1">Stock Receiving</h1>
          <p className="text-sm text-muted-foreground">
            Scan barcodes to add items to receiving
          </p>
        </div>

        <div className="flex-1 p-4 md:p-6 space-y-6 overflow-auto">
          {/* Barcode Scanner Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <ScanBarcode className="w-4 h-4 text-primary" />
                Barcode Scanner
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Input
                ref={barcodeInputRef}
                placeholder="Scan or enter barcode..."
                value={barcode}
                onChange={handleBarcodeChange}
                onKeyDown={handleBarcodeKeyDown}
                className="font-mono text-lg h-12"
                disabled={!!scannedProduct}
              />
            </CardContent>
          </Card>

          {/* Scanned Product Card */}
          {scannedProduct && (
            <Card className="border-primary/50 bg-primary/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Package className="w-4 h-4 text-primary" />
                  Scanned Product
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-4">
                  {/* Product Icon */}
                  <div className="w-16 h-16 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Package className="w-8 h-8 text-primary" />
                  </div>

                  {/* Product Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground text-lg mb-1">
                      {scannedProduct.product.name}
                    </h3>
                    <p className="text-muted-foreground text-sm font-mono mb-2">
                      {scannedProduct.product.sku}
                    </p>
                    <div className="flex items-center gap-2">
                      {lexicon.enable_secondary_metric && scannedProduct.product.meters_per_piece && (
                        <Badge variant="secondary">
                          {scannedProduct.product.meters_per_piece}{lexicon.secondary_metric_symbol || "m"}/{lexicon.item_singular}
                        </Badge>
                      )}
                      <Badge variant="outline">
                        {scannedProduct.product.stock_quantity} in stock
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Quantity Input */}
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-foreground whitespace-nowrap">
                    Quantity ({lexicon.item_plural.toLowerCase()}):
                  </label>
                  <Input
                    ref={quantityInputRef}
                    type="number"
                    min="1"
                    value={scannedProduct.quantity || ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setScannedProduct({
                        ...scannedProduct,
                        quantity: val === "" ? 0 : parseInt(val)
                      });
                    }}
                    onKeyDown={handleQuantityKeyDown}
                    className="w-24 text-center font-mono text-lg h-12 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <Button onClick={confirmScannedProduct} size="lg" className="gap-2">
                    <Check className="w-4 h-4" />
                    Add
                  </Button>
                  <Button onClick={cancelScannedProduct} variant="outline" size="lg" className="gap-2">
                    <X className="w-4 h-4" />
                    Cancel
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Press Enter to confirm or Escape to cancel
                </p>
              </CardContent>
            </Card>
          )}

          {/* Empty State */}
          {!scannedProduct && (
            <div className="flex-1 flex items-center justify-center py-12">
              <div className="text-center">
                <ScanBarcode className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground text-lg mb-1">Ready to scan</p>
                <p className="text-muted-foreground text-sm">
                  Scan a product barcode to begin receiving
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Receiving Cart */}
      <div className="hidden md:flex w-[420px] rounded-xl border border-border bg-card shadow-sm flex-col overflow-hidden">
        <div className="flex-1 flex flex-col p-5 gap-4 overflow-auto">
          {/* Receiving Items */}
          <Card className="flex-1 flex flex-col min-h-0">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <PackagePlus className="w-4 h-4 text-primary" />
                  Received Items
                </CardTitle>
                <Badge variant="secondary">{receivingCart.length} items</Badge>
              </div>
            </CardHeader>
            <CardContent className="flex-1 p-0 min-h-0">
              <ScrollArea className="h-full px-6 pb-4">
                {receivingCart.length === 0 ? (
                  <div className="text-center py-8">
                    <PackagePlus className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                    <p className="text-muted-foreground text-sm">No items to receive</p>
                    <p className="text-muted-foreground text-xs">
                      Scan barcodes to add items
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {receivingCart.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border border-border/50"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground text-sm line-clamp-1">
                            {item.name}
                          </p>
                          <p className="text-xs text-muted-foreground font-mono">
                            {item.sku}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {item.quantity} {lexicon.item_plural.toLowerCase()}
                            {lexicon.enable_secondary_metric && item.metersPerPiece ? ` × ${item.metersPerPiece}${lexicon.secondary_metric_symbol || 'm'} = ${(item.quantity * item.metersPerPiece).toFixed(2)}${lexicon.secondary_metric_symbol || 'm'}` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            className="w-7 h-7 rounded-md bg-background border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-8 text-center text-sm font-medium">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            className="w-7 h-7 rounded-md bg-background border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => removeFromReceiving(item.id)}
                            className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors ml-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Notes */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Notes (Optional)</label>
            <Textarea
              placeholder="Add notes for this receipt..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="resize-none"
              rows={2}
            />
          </div>
        </div>

        {/* Summary - Fixed at bottom */}
        <div className="border-t border-border p-4 space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total {lexicon.item_plural}</span>
              <span className="text-foreground font-medium">{totalquantity}</span>
            </div>
            {lexicon.enable_secondary_metric && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total {lexicon.secondary_metric_name || "Meters"}</span>
                <span className="text-foreground font-medium">{totalMeters.toLocaleString()}{lexicon.secondary_metric_symbol || "m"}</span>
              </div>
            )}
          </div>
          <Button
            className="w-full"
            onClick={handleReceiveStock}
            disabled={receivingCart.length === 0 || receiveStock.isPending}
          >
            {receiveStock.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <PackagePlus className="w-4 h-4 mr-2" />
            )}
            Receive Stock
          </Button>
        </div>
      </div>

      {/* Mobile Floating Cart Button & Summary */}
      <div className="md:hidden fixed bottom-20 left-4 right-4 z-40">
        {receivingCart.length > 0 && (
          <div className="rounded-xl border border-border bg-card shadow-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">{receivingCart.length} items</p>
                <p className="text-xs text-muted-foreground">
                  {totalquantity} {lexicon.item_plural.toLowerCase()}
                  {lexicon.enable_secondary_metric ? ` • ${totalMeters}${lexicon.secondary_metric_symbol || 'm'}` : ''}
                </p>
              </div>
              <Button
                size="sm"
                onClick={handleReceiveStock}
                disabled={receiveStock.isPending}
              >
                {receiveStock.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <PackagePlus className="w-4 h-4 mr-2" />
                )}
                Receive
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Success/Print Modal */}
      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="w-5 h-5 text-green-500" />
              Stock Received Successfully
            </DialogTitle>
            <DialogDescription>
              Receipt #{lastReceipt?.receipt_number} has been created.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowSuccessModal(false)}>
              Close
            </Button>
            <Button onClick={() => lastReceipt && printStockReceipt(lastReceipt)}>
              <Printer className="w-4 h-4 mr-2" />
              Print Receipt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default StockReceiving;