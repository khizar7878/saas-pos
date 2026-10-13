import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Boxes,
  Plus,
  Trash2,
  Sparkles,
  Loader2,
  Check,
  Package,
  Layers,
} from "lucide-react";
import {
  useProductVariants,
  useAddProductVariant,
  useUpdateProductVariant,
  useDeleteProductVariant,
  useBatchCreateVariants,
} from "@/hooks/useProductVariants";
import { Product, ProductVariant } from "@/types/database";
import { toast } from "sonner";
import { useTenant } from "@/contexts/TenantContext";

interface ProductVariantsDialogProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ProductVariantsDialog = ({
  product,
  isOpen,
  onClose,
}: ProductVariantsDialogProps) => {
  const { lexicon } = useTenant();
  const [activeTab, setActiveTab] = useState<string>("list");

  // Single variant form state
  const [title, setTitle] = useState("");
  const [size, setSize] = useState("");
  const [colorName, setColorName] = useState("");
  const [colorHex, setColorHex] = useState("#295975");
  const [sku, setSku] = useState("");
  const [barcode, setBarcode] = useState("");
  const [price, setPrice] = useState("");
  const [stockQuantity, setStockQuantity] = useState("0");

  // Matrix Generator state
  const [matrixSizes, setMatrixSizes] = useState("S, M, L, XL");
  const [matrixColors, setMatrixColors] = useState("Black, White, Navy");
  const [matrixInitialStock, setMatrixInitialStock] = useState("10");

  const { data: variants = [], isLoading } = useProductVariants(product?.id);
  const addVariant = useAddProductVariant();
  const updateVariant = useUpdateProductVariant();
  const deleteVariant = useDeleteProductVariant();
  const batchCreateVariants = useBatchCreateVariants();

  if (!product) return null;

  const handleAddSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;

    const variantTitle =
      title.trim() ||
      [size.trim(), colorName.trim()].filter(Boolean).join(" / ") ||
      "Standard Variant";

    await addVariant.mutateAsync({
      product_id: product.id,
      title: variantTitle,
      size: size.trim() || undefined,
      color_name: colorName.trim() || undefined,
      color_hex: colorHex || undefined,
      sku: sku.trim() || undefined,
      barcode: barcode.trim() || undefined,
      price: price ? parseFloat(price) : undefined,
      stock_quantity: parseInt(stockQuantity) || 0,
    });

    // Reset single form
    setTitle("");
    setSize("");
    setColorName("");
    setSku("");
    setBarcode("");
    setPrice("");
    setStockQuantity("0");
    setActiveTab("list");
  };

  const handleGenerateMatrix = async () => {
    if (!product) return;

    const sizes = matrixSizes
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const colors = matrixColors
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);

    if (sizes.length === 0 && colors.length === 0) {
      toast.error("Please enter at least one size or color");
      return;
    }

    const combinations: Array<{
      title: string;
      size?: string;
      color_name?: string;
      sku: string;
      stock_quantity: number;
    }> = [];

    const baseSku = product.sku || product.name.slice(0, 4).toUpperCase();
    const stock = parseInt(matrixInitialStock) || 0;

    if (sizes.length > 0 && colors.length > 0) {
      for (const s of sizes) {
        for (const c of colors) {
          const comboSku = `${baseSku}-${s.replace(/\s+/g, "")}-${c.slice(0, 3).toUpperCase()}`;
          combinations.push({
            title: `${s} / ${c}`,
            size: s,
            color_name: c,
            sku: comboSku,
            stock_quantity: stock,
          });
        }
      }
    } else if (sizes.length > 0) {
      for (const s of sizes) {
        combinations.push({
          title: `Size ${s}`,
          size: s,
          sku: `${baseSku}-${s.replace(/\s+/g, "")}`,
          stock_quantity: stock,
        });
      }
    } else {
      for (const c of colors) {
        combinations.push({
          title: c,
          color_name: c,
          sku: `${baseSku}-${c.slice(0, 3).toUpperCase()}`,
          stock_quantity: stock,
        });
      }
    }

    await batchCreateVariants.mutateAsync({
      productId: product.id,
      variants: combinations,
    });

    setActiveTab("list");
  };

  const handleStockUpdate = async (variant: ProductVariant, newQty: number) => {
    await updateVariant.mutateAsync({
      id: variant.id,
      productId: product.id,
      stock_quantity: Math.max(0, newQty),
    });
  };

  const totalVariantStock = variants.reduce(
    (sum, v) => sum + (v.stock_quantity || 0),
    0
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-6">
        <DialogHeader className="border-b pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Boxes className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold flex items-center gap-2">
                  {product.name}
                  <Badge variant="outline" className="font-mono text-xs">
                    Base: {product.sku || "No SKU"}
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Multi-Axis Variant Matrix (Sizes, Colors, Options & Individual SKUs)
                </DialogDescription>
              </div>
            </div>

            <div className="flex items-center gap-4 text-right">
              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                  Total Variant Stock
                </span>
                <span className="text-base font-bold text-foreground">
                  {totalVariantStock} {lexicon.item_plural}
                </span>
              </div>
            </div>
          </div>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex-1 flex flex-col min-h-0 pt-2"
        >
          <TabsList className="grid grid-cols-3 mb-3">
            <TabsTrigger value="list" className="gap-1.5 text-xs">
              <Layers className="w-3.5 h-3.5" />
              Active Variants ({variants.length})
            </TabsTrigger>
            <TabsTrigger value="matrix" className="gap-1.5 text-xs">
              <Sparkles className="w-3.5 h-3.5" />
              Matrix Generator
            </TabsTrigger>
            <TabsTrigger value="single" className="gap-1.5 text-xs">
              <Plus className="w-3.5 h-3.5" />
              Add Single Variant
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: ACTIVE VARIANTS LIST */}
          <TabsContent value="list" className="flex-1 min-h-0 overflow-y-auto m-0">
            {isLoading ? (
              <div className="py-12 flex justify-center items-center">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : variants.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-border rounded-xl space-y-3">
                <Package className="w-10 h-10 mx-auto text-muted-foreground/50" />
                <div className="space-y-1">
                  <p className="font-medium text-sm text-foreground">
                    No variants created yet
                  </p>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    Use the <strong>Matrix Generator</strong> to create size/color combinations in seconds, or add individual options manually.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setActiveTab("matrix")}
                  className="gap-1.5 text-xs"
                >
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  Launch Matrix Generator
                </Button>
              </div>
            ) : (
              <div className="rounded-xl border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Variant</TableHead>
                      <TableHead className="text-xs">SKU</TableHead>
                      <TableHead className="text-xs">Price</TableHead>
                      <TableHead className="text-xs">Stock</TableHead>
                      <TableHead className="text-xs text-right w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {variants.map((v) => (
                      <TableRow key={v.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {v.color_hex && (
                              <span
                                className="w-3.5 h-3.5 rounded-full border border-border shrink-0"
                                style={{ backgroundColor: v.color_hex }}
                              />
                            )}
                            <div>
                              <span className="font-medium text-xs text-foreground block">
                                {v.title || v.color_name || "Variant"}
                              </span>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                {v.size && (
                                  <Badge
                                    variant="secondary"
                                    className="text-[9px] px-1 py-0 h-3.5"
                                  >
                                    Size: {v.size}
                                  </Badge>
                                )}
                                {v.color_name && (
                                  <Badge
                                    variant="outline"
                                    className="text-[9px] px-1 py-0 h-3.5"
                                  >
                                    {v.color_name}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {v.sku || "-"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {v.price ? (
                            <span className="font-medium text-foreground">
                              Rs. {v.price.toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-[11px]">
                              Base (Rs. {product.price.toLocaleString()})
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              defaultValue={v.stock_quantity}
                              onBlur={(e) => {
                                const val = parseInt(e.target.value) || 0;
                                if (val !== v.stock_quantity) {
                                  handleStockUpdate(v, val);
                                }
                              }}
                              className="w-16 h-7 text-center font-mono text-xs border rounded-md bg-background focus:ring-1 focus:ring-primary"
                            />
                            <span className="text-[10px] text-muted-foreground">
                              {lexicon.primary_unit}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              deleteVariant.mutate({
                                id: v.id,
                                productId: product.id,
                              })
                            }
                            className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          {/* TAB 2: MATRIX GENERATOR */}
          <TabsContent value="matrix" className="m-0 space-y-4">
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
              <div className="flex items-center gap-2 text-foreground font-semibold text-sm">
                <Sparkles className="w-4 h-4 text-primary" />
                <span>Multi-Axis Combinatorial Generator</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Enter comma-separated sizes and colors. The system will automatically compute the Cartesian product (Sizes $\times$ Colors), generate unique SKUs, and allocate starting inventory.
              </p>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <Label className="text-xs">Sizes (Comma-separated)</Label>
                  <Input
                    value={matrixSizes}
                    onChange={(e) => setMatrixSizes(e.target.value)}
                    placeholder="e.g. S, M, L, XL or 38, 40, 42, 44"
                    className="h-9 text-xs bg-background"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Colors / Options (Comma-separated)</Label>
                  <Input
                    value={matrixColors}
                    onChange={(e) => setMatrixColors(e.target.value)}
                    placeholder="e.g. Black, White, Navy, Olive"
                    className="h-9 text-xs bg-background"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Initial Stock per Variant ({lexicon.item_plural})</Label>
                  <Input
                    type="number"
                    value={matrixInitialStock}
                    onChange={(e) => setMatrixInitialStock(e.target.value)}
                    placeholder="10"
                    className="h-9 text-xs bg-background"
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    onClick={handleGenerateMatrix}
                    disabled={batchCreateVariants.isPending}
                    className="w-full h-9 text-xs gap-1.5 font-semibold"
                  >
                    {batchCreateVariants.isPending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    Generate Variant Matrix Now
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* TAB 3: SINGLE VARIANT */}
          <TabsContent value="single" className="m-0">
            <form onSubmit={handleAddSingle} className="space-y-3 pt-1">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Variant Title (Optional)</Label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Large / Off-White"
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Size Dimension</Label>
                  <Input
                    value={size}
                    onChange={(e) => setSize(e.target.value)}
                    placeholder="e.g. L, 42, 128GB"
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Color / Spec Name</Label>
                  <Input
                    value={colorName}
                    onChange={(e) => setColorName(e.target.value)}
                    placeholder="e.g. Navy Blue"
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Color Swatch Hex</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={colorHex}
                      onChange={(e) => setColorHex(e.target.value)}
                      className="w-9 h-9 p-0.5 rounded border border-border cursor-pointer bg-background"
                    />
                    <Input
                      value={colorHex}
                      onChange={(e) => setColorHex(e.target.value)}
                      className="h-9 text-xs font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Specific Variant SKU</Label>
                  <Input
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    placeholder="Leave empty to auto-generate"
                    className="h-9 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Barcode (Optional)</Label>
                  <Input
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    placeholder="Scannable barcode"
                    className="h-9 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Variant Price Override (Rs.)</Label>
                  <Input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder={`Default: Rs. ${product.price}`}
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Initial Stock ({lexicon.item_plural})</Label>
                  <Input
                    type="number"
                    value={stockQuantity}
                    onChange={(e) => setStockQuantity(e.target.value)}
                    placeholder="0"
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <Button
                  type="submit"
                  disabled={addVariant.isPending}
                  className="gap-1.5 text-xs font-semibold"
                >
                  {addVariant.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" />
                  )}
                  Save Variant
                </Button>
              </div>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
