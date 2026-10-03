import { useState } from "react";
import { Pause, Play, X, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface CartItem {
  id: number;
  name: string;
  price: number;
  quantity: number;
  stock?: number;
  metersPerRoll?: number;
  pricePerMeter?: number;
  isCustomCut?: boolean;
  customMeters?: number;
}

interface HeldCart {
  id: string;
  items: CartItem[];
  customerName: string;
  timestamp: Date;
  subtotal: number;
}

interface HoldCartManagerProps {
  currentCart: CartItem[];
  customerName: string;
  onHoldCart: () => void;
  heldCarts: HeldCart[];
  onRecallCart: (cart: HeldCart) => void;
  onDeleteHeldCart: (cartId: string) => void;
  disabled?: boolean;
}

const HoldCartManager = ({
  currentCart,
  customerName,
  onHoldCart,
  heldCarts,
  onRecallCart,
  onDeleteHeldCart,
  disabled,
}: HoldCartManagerProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleRecall = (cart: HeldCart) => {
    onRecallCart(cart);
    setIsOpen(false);
  };

  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={onHoldCart}
        disabled={disabled || currentCart.length === 0}
        className="flex-1"
      >
        <Pause className="w-4 h-4 mr-1" />
        Hold
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 relative"
            disabled={heldCarts.length === 0}
          >
            <Play className="w-4 h-4 mr-1" />
            Recall
            {heldCarts.length > 0 && (
              <Badge
                variant="secondary"
                className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs"
              >
                {heldCarts.length}
              </Badge>
            )}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Held Carts
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-3">
              {heldCarts.map((cart) => (
                <Card key={cart.id} className="relative">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-foreground">
                          {cart.customerName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {cart.items.reduce((sum, item) => sum + item.quantity, 0)} pcs • Rs.{" "}
                          {cart.subtotal.toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {cart.timestamp.toLocaleTimeString()}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => handleRecall(cart)}
                        >
                          <Play className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => onDeleteHeldCart(cart.id)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HoldCartManager;
export type { HeldCart };
