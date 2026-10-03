import { useState, useEffect, ReactNode } from "react";
import { ShoppingBag, Tag } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

interface OrderSummaryProps {
  subtotal: number;
  totalTax?: number;
  itemCount: number;
  onCheckout: (discount: number) => void;
  onDiscountChange?: (discount: number) => void;
  renderActions?: (checkoutButton: ReactNode) => ReactNode;
}

const OrderSummary = ({ subtotal, totalTax = 0, itemCount, onCheckout, onDiscountChange, renderActions }: OrderSummaryProps) => {
  const [discountValue, setDiscountValue] = useState<string>("");

  const discount = Math.min(parseFloat(discountValue) || 0, subtotal);
  const total = subtotal - discount;


  // Clear discount when cart is cleared (e.g. after checkout or clearing cart)
  useEffect(() => {
    if (itemCount === 0) {
      setDiscountValue("");
    }
  }, [itemCount]);

  const handleCheckout = () => {
    onCheckout(discount);
  };

  const checkoutButton = (
    <Button
      className="flex-1"
      size="sm"
      disabled={itemCount === 0}
      onClick={handleCheckout}
    >
      <ShoppingBag className="w-4 h-4 mr-1" />
      Checkout
    </Button>
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <ShoppingBag className="w-4 h-4 text-primary" />
          Order Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal (Inclusive of Tax)</span>
            <span className="text-foreground">Rs. {subtotal.toLocaleString()}</span>
          </div>

          {totalTax > 0 && (
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Total Tax (Inclusive)</span>
              <span>Rs. {totalTax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          )}

          {/* Discount Section - Inline */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 shrink-0">
              <Tag className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Discount</span>
            </div>
            <div className="flex-1 flex justify-end">
              <div className="w-24 relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">Rs.</span>
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={discountValue}
                  onChange={(e) => {
                    setDiscountValue(e.target.value);
                    const parsed = Math.min(parseFloat(e.target.value) || 0, subtotal);
                    onDiscountChange?.(parsed);
                  }}
                  className="h-8 pl-8 pr-2 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-sm"
                />
              </div>
            </div>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-sm text-success">
              <span>Discount Applied</span>
              <span>- Rs. {discount.toLocaleString()}</span>
            </div>
          )}

          <Separator />
          <div className="flex justify-between text-lg font-semibold">
            <span className="text-foreground">Total</span>
            <span className="text-primary">Rs. {total.toLocaleString()}</span>
          </div>
        </div>

        {renderActions ? renderActions(checkoutButton) : (
          <div className="w-full">
            {checkoutButton}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default OrderSummary;
