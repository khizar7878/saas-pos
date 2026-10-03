import { useState, useEffect, useRef, forwardRef, useImperativeHandle, useMemo } from "react";
import { ScanBarcode, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Product } from "@/types/database";

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  products?: Product[];
  onProductSelect?: (product: Product) => void;
}

export interface BarcodeScannerRef {
  focus: () => void;
}

const BarcodeScanner = forwardRef<BarcodeScannerRef, BarcodeScannerProps>(
  ({ onScan, products = [], onProductSelect }, ref) => {
    const [barcode, setBarcode] = useState("");
    const [isSearchMode, setIsSearchMode] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedIndex, setSelectedIndex] = useState(0);
    
    const inputRef = useRef<HTMLInputElement>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    useImperativeHandle(ref, () => ({
      focus: () => {
        // Small timeout to ensure focus works even if called during state updates
        setTimeout(() => {
          inputRef.current?.focus();
        }, 10);
      }
    }));

    // Filter products matching the query (only depends on searchQuery to support closing transition)
    const filteredProducts = useMemo(() => {
      if (!searchQuery.trim()) return [];
      const query = searchQuery.toLowerCase();
      return products.filter((p) => 
        p.name.toLowerCase().includes(query) || 
        (p.sku && p.sku.toLowerCase().includes(query)) ||
        (p.barcode && p.barcode.toLowerCase().includes(query))
      );
    }, [searchQuery, products]);

    // Reset selection index when matches change
    useEffect(() => {
      setSelectedIndex(0);
    }, [filteredProducts.length]);

    // Auto-submit after brief pause (simulates scanner behavior) - only in barcode mode
    useEffect(() => {
      if (!isSearchMode && barcode.trim()) {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(() => {
          onScan(barcode.trim());
          setBarcode("");
        }, 300); // 300ms delay for auto-submit
      }

      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      };
    }, [barcode, onScan, isSearchMode]);

    const handleSelectProduct = (product: Product, index?: number) => {
      if (onProductSelect) {
        onProductSelect(product);
      } else {
        onScan(product.sku || product.barcode || "");
      }
      
      if (index !== undefined) {
        setSelectedIndex(index);
      }

      if (!isSearchMode) {
        setIsSearchMode(false);
        // Delay clearing searchQuery so exit animation has time to run
        setTimeout(() => {
          setSearchQuery("");
        }, 200);
      }
      
      // Maintain focus on scanner input
      setTimeout(() => {
        inputRef.current?.focus();
      }, 10);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (isSearchMode) {
          const isFullySelected = inputRef.current && 
            inputRef.current.selectionStart === 0 && 
            inputRef.current.selectionEnd === inputRef.current.value.length;
          
          if (!searchQuery.trim() || isFullySelected) {
            setIsSearchMode(false);
            // Delay clearing search query to allow closing animation
            setTimeout(() => {
              setSearchQuery("");
              setBarcode("");
            }, 200);
          } else {
            inputRef.current?.select();
          }
        } else {
          setIsSearchMode(true);
          setSearchQuery("");
          setBarcode("");
        }
        return;
      }

      if (isSearchMode) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          if (filteredProducts.length > 0) {
            setSelectedIndex((prev) => (prev + 1) % filteredProducts.length);
          }
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          if (filteredProducts.length > 0) {
            setSelectedIndex((prev) => (prev - 1 + filteredProducts.length) % filteredProducts.length);
          }
        } else if (e.key === "Enter") {
          e.preventDefault();
          if (filteredProducts.length > 0 && filteredProducts[selectedIndex]) {
            handleSelectProduct(filteredProducts[selectedIndex]);
          }
        }
      } else {
        if (e.key === "Enter" && barcode.trim()) {
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
          }
          onScan(barcode.trim());
          setBarcode("");
        }
      }
    };

    const handleBlur = () => {
      // Revert to barcode mode after a short delay to allow clicks in the dropdown to register first
      setTimeout(() => {
        setIsSearchMode(false);
        // Delay clearing query to let exit animation run first
        setTimeout(() => {
          setSearchQuery("");
        }, 200);
      }, 200);
    };

    const isOpen = isSearchMode && searchQuery.trim().length > 0;

    return (
      <Card className={cn("relative overflow-visible transition-all duration-200", isOpen && "rounded-b-none border-b-0 shadow-lg")}>
        <CardContent className="p-3 flex items-center justify-center">
          <div className="relative w-full">
            {isSearchMode ? (
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary animate-pulse" />
            ) : (
              <ScanBarcode className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary" />
            )}
            <Input
              ref={inputRef}
              placeholder={isSearchMode ? "Search product (Esc to barcode)" : "Scan barcode... (Esc to search)"}
              value={isSearchMode ? searchQuery : barcode}
              onChange={(e) => isSearchMode ? setSearchQuery(e.target.value) : setBarcode(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleBlur}
              className="pl-10 font-mono"
              autoFocus
            />
          </div>
        </CardContent>

        <div
          className={cn(
            "absolute left-[-1px] right-[-1px] top-full bg-popover text-popover-foreground border border-border border-t-0 rounded-b-md shadow-lg max-h-60 overflow-y-auto z-50 transition-all duration-200 ease-in-out origin-top transform",
            isOpen 
              ? "opacity-100 scale-y-100 translate-y-0" 
              : "opacity-0 scale-y-95 -translate-y-2 pointer-events-none"
          )}
        >
          {filteredProducts.length > 0 ? (
            <ul className="py-1 divide-y divide-border/40">
              {filteredProducts.map((product, index) => (
                <li
                  key={product.id}
                  ref={(el) => {
                    if (index === selectedIndex) {
                      el?.scrollIntoView({ block: "nearest" });
                    }
                  }}
                  onMouseDown={(e) => {
                    // Prevent blur from firing before selecting item
                    e.preventDefault();
                    handleSelectProduct(product, index);
                  }}
                  className={cn(
                    "px-4 py-2.5 text-sm cursor-pointer flex items-center justify-between transition-all",
                    index === selectedIndex ? "bg-primary text-white font-medium" : "hover:bg-muted/50"
                  )}
                >
                  <div className="flex flex-col text-left">
                    <span className={cn(
                      "font-semibold text-sm",
                      index === selectedIndex ? "text-white" : "text-foreground"
                    )}>
                      {product.name}
                    </span>
                    <span className={cn(
                      "text-xs font-mono mt-0.5",
                      index === selectedIndex ? "text-neutral-200/90" : "text-muted-foreground"
                    )}>
                      {product.sku || "No SKU"}
                    </span>
                  </div>
                  <div className="text-right flex flex-col items-end shrink-0 ml-2">
                    <span className={cn(
                      "text-sm font-bold",
                      index === selectedIndex ? "text-white" : "text-primary"
                    )}>
                      Rs. {product.price.toLocaleString()}
                    </span>
                    <span className={cn(
                      "text-xs mt-0.5",
                      index === selectedIndex ? "text-neutral-200/80" : "text-muted-foreground"
                    )}>
                      {product.stock_quantity} in stock
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-3 py-3 text-sm text-center text-muted-foreground">
              No products found
            </div>
          )}
        </div>
      </Card>
    );
  }
);

BarcodeScanner.displayName = "BarcodeScanner";

export default BarcodeScanner;
