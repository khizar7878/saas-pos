import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, Boxes, Package, Check } from "lucide-react";
import { useProductVariants } from "@/hooks/useProductVariants";
import { Product, ProductVariant } from "@/types/database";
import { useTenant } from "@/contexts/TenantContext";

interface PosVariantSelectorModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onSelectVariant: (product: Product, variant: ProductVariant) => void;
}

export const PosVariantSelectorModal = ({
  product,
  isOpen,
  onClose,
  onSelectVariant,
}: PosVariantSelectorModalProps) => {
  const { lexicon } = useTenant();
  const { data: variants = [], isLoading } = useProductVariants(product?.id);

  if (!product) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl max-h-[80vh] flex flex-col p-5">
        <DialogHeader className="border-b pb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                {product.name}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Select a variant (Size / Color / Spec) to add to cart
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto py-3">
          {isLoading ? (
            <div className="py-12 flex justify-center items-center">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : variants.length === 0 ? (
            <div className="text-center py-8 text-xs text-muted-foreground space-y-2">
              <Package className="w-8 h-8 mx-auto text-muted-foreground/40" />
              <p>No active variants found for this product.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {variants.map((v) => {
                const isOutOfStock = v.stock_quantity <= 0;
                const displayPrice = v.price ?? product.price;

                return (
                  <button
                    key={v.id}
                    type="button"
                    disabled={isOutOfStock}
                    onClick={() => {
                      onSelectVariant(product, v);
                      onClose();
                    }}
                    className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all select-none relative ${
                      isOutOfStock
                        ? "opacity-50 border-border bg-muted/20 cursor-not-allowed"
                        : "border-border hover:border-primary hover:bg-primary/5 active:scale-[0.98] shadow-sm bg-card"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 w-full mb-1">
                      {v.color_hex && (
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-border/80 shrink-0 shadow-xs"
                          style={{ backgroundColor: v.color_hex }}
                        />
                      )}
                      <span className="font-semibold text-xs text-foreground truncate flex-1">
                        {v.title || v.color_name || "Variant"}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1 mb-2">
                      {v.size && (
                        <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 font-mono">
                          {v.size}
                        </Badge>
                      )}
                      {v.color_name && (
                        <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
                          {v.color_name}
                        </Badge>
                      )}
                    </div>

                    <div className="mt-auto w-full flex items-center justify-between pt-1 border-t border-border/50 text-[11px]">
                      <span className="font-bold text-foreground">
                        Rs. {displayPrice.toLocaleString()}
                      </span>
                      <span
                        className={`font-mono text-[10px] ${
                          isOutOfStock ? "text-destructive font-medium" : "text-muted-foreground"
                        }`}
                      >
                        {isOutOfStock ? "Out of Stock" : `${v.stock_quantity} ${lexicon.primary_unit}`}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
