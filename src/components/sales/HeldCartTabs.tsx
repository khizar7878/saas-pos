import { X, ShoppingCart, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

import { CartItem } from "./CartItems";

export interface HeldCart {
  id: string;
  items: CartItem[];
  customerName: string;
  customerId?: string;
  timestamp: Date;
  subtotal: number;
  assignedTo?: string;
}

interface HeldCartTabsProps {
  heldCarts: HeldCart[];
  onRecallCart: (cart: HeldCart) => void;
  onDeleteHeldCart: (cartId: string) => void;
}

const HeldCartTabs = ({
  heldCarts,
  onRecallCart,
  onDeleteHeldCart,
}: HeldCartTabsProps) => {
  if (heldCarts.length === 0) return null;

  return (
    <div className="border-t border-border bg-card/50 p-3">
      <div className="flex items-center gap-2">
        <div className="flex flex-col items-center justify-center gap-1 min-w-[30px]">
          <Clock className="w-5 h-5 text-muted-foreground" />
          <Badge variant="secondary" className="h-5 px-1.5 text-[10px] w-full justify-center">
            {heldCarts.length}
          </Badge>
        </div>

        <ScrollArea className="flex-1 w-full">
          <div className="flex gap-3 pb-2 pt-1 px-2">
            {heldCarts.map((cart) => (
              <div
                key={cart.id}
                className={cn(
                  "flex-shrink-0 w-[200px] p-3 rounded-xl border border-transparent bg-primary",
                  "hover:brightness-110 transition-all duration-300 cursor-pointer group relative text-white shadow-md",
                  "hover:scale-[1.02]",
                  "animate-in fade-in-0 zoom-in-95 duration-300"
                )}
                onClick={() => onRecallCart(cart)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-sm font-bold text-white truncate">
                        {cart.customerName}
                      </span>
                    </div>

                    <div className="space-y-0.5">
                      <p className="text-xs font-medium text-white/80">
                        {cart.items.reduce((sum, item) => sum + item.quantity, 0)} pcs
                      </p>
                      <p className="text-sm font-bold text-white">
                        Rs. {cart.subtotal.toLocaleString()}
                      </p>
                    </div>

                    <p className="text-[10px] text-white/60 mt-2 font-medium">
                      {cart.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>

                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 -mr-1 -mt-1 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteHeldCart(cart.id);
                    }}
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <ScrollBar orientation="horizontal" className="invisible" />
        </ScrollArea>
      </div>
    </div>
  );
};

export default HeldCartTabs;
