import { Trash2, ShoppingCart, Minus, Plus, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";

export interface CartItem {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  price: number;
  unitPrice: number;
  quantity: number;
  stockQty: number;
  taxRate?: number;
  taxAmount?: number;
  metersPerPiece?: number;
  pctCode?: string;
}

// Group items by parent product for display
interface GroupedCartItem {
  productId: string;
  productName: string;
  price: number;
  totalAmount: number;
  items: CartItem[];
}

interface CartItemsProps {
  items: CartItem[];
  onUpdateQuantity: (id: string, quantity: number) => void;
  onRemove: (id: string) => void;
}

const CartQuantityInput = ({ quantity, onUpdate }: { quantity: number, onUpdate: (q: number) => void }) => {
  const [val, setVal] = useState(quantity.toString());

  useEffect(() => {
    setVal(quantity.toString());
  }, [quantity]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVal(e.target.value);
  };

  const handleBlur = () => {
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0) {
      if (num !== quantity) onUpdate(num);
    } else {
      setVal(quantity.toString()); // Reset on invalid
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      const target = e.target as HTMLInputElement;
      target.blur();
    }
  };

  return (
    <Input
      type="number"
      value={val}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className="w-12 h-8 text-center px-1 mx-1 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
    />
  );
};

const CartItems = ({ items, onUpdateQuantity, onRemove }: CartItemsProps) => {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Group items by product
  const groupedItems: GroupedCartItem[] = items.reduce((groups, item) => {
    const existing = groups.find(g => g.productId === item.productId);
    if (existing) {
      existing.items.push(item);
      existing.totalAmount += item.unitPrice * item.quantity;
    } else {
      groups.push({
        productId: item.productId,
        productName: item.productName,
        price: item.price,
        totalAmount: item.unitPrice * item.quantity,
        items: [item],
      });
    }
    return groups;
  }, [] as GroupedCartItem[]);

  const toggleGroup = (productId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(productId)) {
      newExpanded.delete(productId);
    } else {
      newExpanded.add(productId);
    }
    setExpandedGroups(newExpanded);
  };

  const bottomRef = useRef<HTMLDivElement>(null);
  const prevItemsLength = useRef(items.length);

  useEffect(() => {
    // Only scroll if items were added (length increased)
    if (items.length > prevItemsLength.current) {
      // Skip scroll for the first item to prevent page jumping
      if (items.length <= 1) {
        prevItemsLength.current = items.length;
        return;
      }

      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
    }
    prevItemsLength.current = items.length;
  }, [items.length]);

  return (
    <Card className="flex-1 flex flex-col min-h-0">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-primary" />
            Cart Items
          </CardTitle>
          <div className="flex gap-2">
            <Badge variant="outline" className="text-lg px-3 py-1">{items.length} items</Badge>
            <Badge variant="secondary" className="text-lg px-3 py-1">{items.reduce((acc, item) => acc + item.quantity, 0)} pcs</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 p-0 min-h-0">
        <ScrollArea className="h-full px-6 pb-4">
          {items.length === 0 ? (
            <div className="text-center py-8">
              <ShoppingCart className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground text-sm">Cart is empty</p>
              <p className="text-muted-foreground text-xs">
                Click products or scan barcode
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {groupedItems.map((group) => (
                <div key={group.productId} className="rounded-lg border border-border overflow-hidden">
                  {/* Group Header */}
                  <div className="w-full flex items-center justify-between p-3 bg-muted/50 transition-colors text-left">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground text-sm line-clamp-1">
                        {group.productName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Rs. {group.price}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-primary text-sm">
                        Rs. {group.totalAmount.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Item Details */}
                  <div className="p-3 space-y-2 bg-background">
                    {group.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-2 text-sm"
                      >
                        <div className="flex-1 min-w-0 flex items-center gap-2">
                          <span className="text-muted-foreground">
                            Qty:
                          </span>
                          <span className="font-medium ml-1">{item.quantity}</span>

                          <span className="text-xs text-muted-foreground ml-2">
                            = Rs. {(item.unitPrice * item.quantity).toLocaleString()}
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onUpdateQuantity(item.id, item.quantity - 1);
                            }}
                            className="w-8 h-8 rounded bg-muted border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <Minus className="w-3 h-3" />
                          </button>

                          <div onClick={e => e.stopPropagation()}>
                            <CartQuantityInput
                              quantity={item.quantity}
                              onUpdate={(q) => onUpdateQuantity(item.id, q)}
                            />
                          </div>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onUpdateQuantity(item.id, item.quantity + 1);
                            }}
                            className="w-8 h-8 rounded bg-muted border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onRemove(item.id);
                            }}
                            className="w-8 h-8 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors ml-1"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default CartItems;
