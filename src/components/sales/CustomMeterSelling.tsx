import { useState } from "react";
import { Scissors, Ruler } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface Product {
  id: number;
  name: string;
  pricePerMeter: number;
  metersPerRoll: number;
  stock: number;
  barcode: string;
}

interface CustomMeterSellingProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onAddCustomCut: (product: Product, meters: number) => void;
}

const CustomMeterSelling = ({
  product,
  isOpen,
  onClose,
  onAddCustomCut,
}: CustomMeterSellingProps) => {
  const [meters, setMeters] = useState("");

  const handleAdd = () => {
    if (product && parseFloat(meters) > 0) {
      onAddCustomCut(product, parseFloat(meters));
      setMeters("");
      onClose();
    }
  };

  const customPrice = product ? (parseFloat(meters) || 0) * product.pricePerMeter : 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scissors className="w-5 h-5 text-primary" />
            Custom Cut
          </DialogTitle>
        </DialogHeader>

        {product && (
          <div className="space-y-4 py-2">
            <div className="p-3 rounded-lg bg-muted/50 border border-border">
              <p className="font-medium text-foreground">{product.name}</p>
              <p className="text-sm text-primary">
                Rs. {product.pricePerMeter}/meter
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="meters">Meters Required</Label>
              <div className="relative">
                <Ruler className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="meters"
                  type="number"
                  placeholder="Enter meters..."
                  value={meters}
                  onChange={(e) => setMeters(e.target.value)}
                  className="pl-10"
                  min="0.1"
                  step="0.1"
                  autoFocus
                />
              </div>
            </div>

            {parseFloat(meters) > 0 && (
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total Price</span>
                  <span className="text-lg font-semibold text-primary">
                    Rs. {customPrice.toLocaleString()}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleAdd} disabled={!meters || parseFloat(meters) <= 0}>
            <Scissors className="w-4 h-4 mr-2" />
            Add to Cart
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CustomMeterSelling;
