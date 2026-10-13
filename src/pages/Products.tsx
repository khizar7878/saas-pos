import { useState, useCallback } from "react";
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Package,
  MoreVertical,
  Loader2,
  Layers,
  Save,
  Minus,
  X,
  CheckCircle2,
  ArrowRight,
  AlertCircle,
  Boxes,
} from "lucide-react";
import ProductForm, { ProductFormData } from "@/components/products/ProductForm";
import { ProductVariantsDialog } from "@/components/products/ProductVariantsDialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useProducts,
  useProductCategories,
  useAddProduct,
  useUpdateProduct,
  useDeleteProduct,
} from "@/hooks/useProducts";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useTenant } from "@/contexts/TenantContext";

const Products = () => {
  const { lexicon } = useTenant();
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [isVariantDialogOpen, setIsVariantDialogOpen] = useState(false);
  const [selectedVariantProduct, setSelectedVariantProduct] = useState<any>(null);

  const openVariantDialog = (product: any) => {
    setSelectedVariantProduct(product);
    setIsVariantDialogOpen(true);
  };

  // Edit Stocks mode
  const [isEditStocksMode, setIsEditStocksMode] = useState(false);
  const [stockAdjustments, setStockAdjustments] = useState<Record<string, number>>({});
  const [isSavingStocks, setIsSavingStocks] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  const queryClient = useQueryClient();

  // Form state
  const [formData, setFormData] = useState<ProductFormData>({
    name: "",
    sku: "",
    pct_code: "",
    category_id: "",
    cost_price: "",
    price: "",
    tax_rate: "",
    meters_per_piece: "",
    stock_quantity: "",
    min_stock_level: "",
    metadata: {},
  });

  // Database hooks
  const { data: products = [], isLoading, error } = useProducts();
  const { data: categories = [] } = useProductCategories();

  const addProduct = useAddProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();

  const resetForm = useCallback(() => {
    setFormData({
      name: "",
      sku: "",
      pct_code: "",
      category_id: "",
      cost_price: "",
      price: "",
      tax_rate: "",
      meters_per_piece: "",
      stock_quantity: "",
      min_stock_level: "",
      metadata: {},
    });
  }, []);

  const handleCancel = useCallback(() => {
    setIsAddDialogOpen(false);
    setIsEditDialogOpen(false);
    resetForm();
  }, [resetForm]);

  // ---------- Edit Stocks ----------
  const handleEnterEditStocksMode = () => {
    setStockAdjustments({});
    setIsEditStocksMode(true);
  };

  const handleCancelEditStocks = () => {
    setIsEditStocksMode(false);
    setStockAdjustments({});
  };

  const adjustStock = (productId: string, delta: number) => {
    setStockAdjustments((prev) => {
      const current = prev[productId] ?? 0;
      return { ...prev, [productId]: current + delta };
    });
  };

  const setStockAdjustmentDirect = (productId: string, value: number) => {
    setStockAdjustments((prev) => ({ ...prev, [productId]: value }));
  };

  // Open Summary Confirmation Modal
  const handleOpenConfirmModal = () => {
    const entries = Object.entries(stockAdjustments).filter(([, delta]) => delta !== 0);

    if (entries.length === 0) {
      toast.info("No stock changes to save.");
      setIsEditStocksMode(false);
      return;
    }

    setIsConfirmModalOpen(true);
  };

  // Execute database updates after user confirms in summary modal
  const executeSaveStocks = async () => {
    const entries = Object.entries(stockAdjustments).filter(([, delta]) => delta !== 0);
    if (entries.length === 0) return;

    setIsSavingStocks(true);
    let successCount = 0;
    let failCount = 0;

    for (const [productId, delta] of entries) {
      const product = products.find((p) => p.id === productId);
      if (!product) continue;

      const newQty = Math.max(0, (product.stock_quantity ?? 0) + delta);
      const { error } = await supabase
        .from("products")
        .update({ stock_quantity: newQty })
        .eq("id", productId);

      if (error) {
        console.error(`Failed to update stock for ${product.name}:`, error);
        failCount++;
      } else {
        successCount++;
      }
    }

    await queryClient.invalidateQueries({ queryKey: ["products"] });
    setIsSavingStocks(false);
    setIsConfirmModalOpen(false);
    setIsEditStocksMode(false);
    setStockAdjustments({});

    if (failCount === 0) {
      toast.success(`Stock updated for ${successCount} product${successCount !== 1 ? "s" : ""}.`);
    } else {
      toast.warning(`${successCount} updated, ${failCount} failed.`);
    }
  };

  // Computed summary data for modified products
  const modifiedItemsList = Object.entries(stockAdjustments)
    .filter(([, delta]) => delta !== 0)
    .map(([productId, delta]) => {
      const product = products.find((p) => p.id === productId);
      const currentQty = product?.stock_quantity ?? 0;
      const newQty = Math.max(0, currentQty + delta);
      const metersPerPiece = Number(product?.meters_per_piece) || 0;
      const metersDelta = delta * metersPerPiece;
      return {
        product,
        currentQty,
        delta,
        newQty,
        metersPerPiece,
        metersDelta,
      };
    })
    .filter((item) => item.product !== undefined);

  const totalNetSuitDelta = modifiedItemsList.reduce((sum, item) => sum + item.delta, 0);
  const totalMetersDelta = modifiedItemsList.reduce((sum, item) => sum + item.metersDelta, 0);

  // ---------- Products CRUD ----------
  const handleAddProduct = async () => {
    if (!formData.name || !formData.price) {
      toast.error("Please fill in required fields (Name and Selling Price)");
      return;
    }

    try {
      const skuToUse =
        formData.sku || Math.floor(1000000000 + Math.random() * 9000000000).toString();

      await addProduct.mutateAsync({
        name: formData.name,
        sku: skuToUse,
        pct_code: formData.pct_code || null,
        category_id: formData.category_id || null,
        cost_price: formData.cost_price ? parseFloat(formData.cost_price) : null,
        price: parseFloat(formData.price),
        tax_rate: formData.tax_rate ? parseFloat(formData.tax_rate) : 0,
        meters_per_piece: formData.meters_per_piece ? parseFloat(formData.meters_per_piece) : 0,
        stock_quantity: formData.stock_quantity ? parseInt(formData.stock_quantity) : 0,
        min_stock_level: formData.min_stock_level ? parseInt(formData.min_stock_level) : 5,
        metadata: formData.metadata || {},
      });

      setIsAddDialogOpen(false);
      resetForm();
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleEditProduct = async () => {
    if (!editingProduct || !formData.name || !formData.price) {
      toast.error("Please fill in required fields");
      return;
    }

    try {
      await updateProduct.mutateAsync({
        id: editingProduct.id,
        name: formData.name,
        sku: formData.sku || null,
        pct_code: formData.pct_code || null,
        category_id: formData.category_id || null,
        cost_price: formData.cost_price ? parseFloat(formData.cost_price) : null,
        price: parseFloat(formData.price),
        tax_rate: formData.tax_rate ? parseFloat(formData.tax_rate) : 0,
        meters_per_piece: formData.meters_per_piece ? parseFloat(formData.meters_per_piece) : 0,
        stock_quantity: formData.stock_quantity ? parseInt(formData.stock_quantity) : 0,
        min_stock_level: formData.min_stock_level ? parseInt(formData.min_stock_level) : 5,
        metadata: formData.metadata || {},
      });
      setIsEditDialogOpen(false);
      setEditingProduct(null);
      resetForm();
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleDeleteProduct = async (product: any) => {
    if (product.stock_quantity && product.stock_quantity > 0) {
      toast.error("Cannot delete a product with existing stock.");
      return;
    }

    if (window.confirm("Are you sure you want to delete this product?")) {
      try {
        await deleteProduct.mutateAsync(product.id);
      } catch (error) {
        // Error handled in hook
      }
    }
  };

  const openEditDialog = (product: any) => {
    setEditingProduct(product);
    setFormData({
      name: product.name || "",
      sku: product.sku || "",
      pct_code: product.pct_code || "",
      category_id: product.category_id || "",
      cost_price: product.cost_price?.toString() || "",
      price: product.price?.toString() || "",
      tax_rate: product.tax_rate?.toString() || "",
      meters_per_piece: product.meters_per_piece?.toString() || "",
      stock_quantity: product.stock_quantity?.toString() || "",
      min_stock_level: product.min_stock_level?.toString() || "",
      metadata: product.metadata || {},
    });
    setIsEditDialogOpen(true);
  };

  const filteredProducts = products.filter(
    (product) =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.sku && product.sku.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-destructive">Failed to load products. Please try again.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden p-4 md:p-6 lg:p-8 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-foreground">Products</h1>
          <p className="text-muted-foreground text-xs md:text-sm">
            Manage your {lexicon.item_plural.toLowerCase()} catalog ({products.length} {lexicon.item_plural.toLowerCase()})
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Edit Stocks / Save button */}
          {isEditStocksMode ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancelEditStocks}
                disabled={isSavingStocks}
              >
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleOpenConfirmModal}
                disabled={isSavingStocks}
                className="flex-1 sm:flex-none font-semibold"
              >
                {isSavingStocks ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Save Stocks {modifiedItemsList.length > 0 ? `(${modifiedItemsList.length})` : ""}
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={handleEnterEditStocksMode}
              className="flex-1 sm:flex-none"
            >
              <Layers className="w-4 h-4 mr-2" />
              Edit Stocks
            </Button>
          )}

          {/* Add Product */}
          <Dialog
            open={isAddDialogOpen}
            onOpenChange={(open) => {
              setIsAddDialogOpen(open);
              if (!open) resetForm();
            }}
          >
            <DialogTrigger asChild>
              <Button size="sm" className="flex-1 sm:flex-none" disabled={isEditStocksMode}>
                <Plus className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Add </span>{lexicon.item_singular}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New {lexicon.item_singular}</DialogTitle>
                <DialogDescription>Enter the {lexicon.item_singular.toLowerCase()} details.</DialogDescription>
              </DialogHeader>
              <ProductForm
                formData={formData}
                setFormData={setFormData}
                categories={categories}
                onSubmit={handleAddProduct}
                onCancel={handleCancel}
                isLoading={addProduct.isPending}
                submitLabel="Add Product"
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Edit Stocks Banner */}
      {isEditStocksMode && (
        <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm text-primary">
          <Layers className="w-4 h-4 flex-shrink-0" />
          <span>
            <strong>Stock Edit Mode</strong> — use the + / − controls to adjust quantities.
            Positive values add to stock, negative values subtract. Click{" "}
            <strong>Save Stocks</strong> when done.
          </span>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search products..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Products Table */}
      <div className="flex-1 min-h-0 overflow-auto rounded-xl border border-border bg-card shadow-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-muted-foreground">Product</TableHead>
              <TableHead className="text-muted-foreground">Product ID</TableHead>
              <TableHead className="text-muted-foreground">Category</TableHead>
              <TableHead className="text-muted-foreground">Price/{lexicon.item_singular}</TableHead>
              {lexicon.enable_secondary_metric && (
                <TableHead className="text-muted-foreground">
                  {lexicon.secondary_metric_name || "Meters"}/{lexicon.item_singular}
                </TableHead>
              )}
              <TableHead className="text-muted-foreground">
                {isEditStocksMode ? "Adjust Stock" : `Stock (${lexicon.item_plural})`}
              </TableHead>
              <TableHead className="text-muted-foreground w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={lexicon.enable_secondary_metric ? 7 : 6} className="text-center text-muted-foreground py-8">
                  {searchTerm
                    ? "No products match your search"
                    : "No products yet. Add your first product above."}
                </TableCell>
              </TableRow>
            ) : (
              filteredProducts.map((product) => {
                const adjustment = stockAdjustments[product.id] ?? 0;
                const previewQty = Math.max(0, (product.stock_quantity ?? 0) + adjustment);

                return (
                  <TableRow key={product.id} className="hover:bg-muted/50">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Package className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">{product.name}</span>
                            {product.has_variants && (
                              <Badge
                                variant="outline"
                                className="cursor-pointer bg-primary/10 text-primary border-primary/30 hover:bg-primary/20 gap-1 text-[10px] py-0 px-1.5 font-medium transition-colors"
                                onClick={() => openVariantDialog(product)}
                                title="Manage product variants"
                              >
                                <Boxes className="w-2.5 h-2.5" /> Variants
                              </Badge>
                            )}
                          </div>
                          {product.metadata && typeof product.metadata === 'object' && Object.keys(product.metadata).length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {Object.entries(product.metadata).slice(0, 4).map(([k, v]) => {
                                if (v === null || v === undefined || v === "") return null;
                                return (
                                  <span
                                    key={k}
                                    className="inline-flex items-center text-[10px] bg-muted/80 text-muted-foreground px-1.5 py-0.5 rounded border border-border/60"
                                  >
                                    <span className="font-semibold capitalize mr-1">{k.replace(/_/g, ' ')}:</span> {String(v)}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-sm">
                      {product.sku || "-"}
                    </TableCell>
                    <TableCell>
                      {product.product_categories?.name ? (
                        <Badge variant="secondary">{product.product_categories.name}</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="font-medium text-foreground">
                      Rs. {product.price.toLocaleString()}
                    </TableCell>
                    {lexicon.enable_secondary_metric && (
                      <TableCell className="text-muted-foreground">
                        {product.meters_per_piece || "-"} {lexicon.secondary_metric_symbol || "m"}
                      </TableCell>
                    )}
                    <TableCell>
                      {isEditStocksMode ? (
                        /* Inline stock adjustment controls */
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => adjustStock(product.id, -1)}
                            className="w-7 h-7 rounded-md bg-background border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <input
                            type="number"
                            value={adjustment === 0 ? "" : adjustment}
                            placeholder="0"
                            onChange={(e) => {
                              const val = e.target.value;
                              setStockAdjustmentDirect(
                                product.id,
                                val === "" ? 0 : parseInt(val) || 0
                              );
                            }}
                            className="w-14 h-7 text-center text-sm font-mono border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <button
                            onClick={() => adjustStock(product.id, 1)}
                            className="w-7 h-7 rounded-md bg-background border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                          {/* Preview badge */}
                          <Badge
                            variant="outline"
                            className={
                              adjustment < 0
                                ? "bg-destructive/10 text-destructive border-destructive/20 ml-1"
                                : adjustment > 0
                                  ? "bg-success/10 text-success border-success/20 ml-1"
                                  : "ml-1 opacity-50"
                            }
                          >
                            → {previewQty}
                          </Badge>
                        </div>
                      ) : (
                        <Badge
                          variant="outline"
                          className={
                            product.stock_quantity <= product.min_stock_level
                              ? "bg-destructive/10 text-destructive border-destructive/20"
                              : "bg-success/10 text-success border-success/20"
                          }
                        >
                          {product.stock_quantity ?? 0}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            disabled={isEditStocksMode}
                          >
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDialog(product)}>
                            <Edit className="w-4 h-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openVariantDialog(product)}>
                            <Boxes className="w-4 h-4 mr-2 text-primary" />
                            Manage Variants
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => handleDeleteProduct(product)}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit Dialog */}
      <Dialog
        open={isEditDialogOpen}
        onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) {
            setEditingProduct(null);
            resetForm();
          }
        }}
      >
        <DialogContent className="sm:max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Product</DialogTitle>
            <DialogDescription>Update the product details.</DialogDescription>
          </DialogHeader>
          <ProductForm
            formData={formData}
            setFormData={setFormData}
            categories={categories}
            onSubmit={() => handleEditProduct()}
            onCancel={handleCancel}
            isLoading={updateProduct.isPending}
            submitLabel="Save Changes"
          />
        </DialogContent>
      </Dialog>

      {/* Stock Changes Summary Confirmation Modal */}
      <Dialog open={isConfirmModalOpen} onOpenChange={setIsConfirmModalOpen}>
        <DialogContent className="sm:max-w-xl mx-4 max-h-[90vh] flex flex-col p-6">
          <DialogHeader className="pb-3 border-b border-border">
            <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-foreground">
              <Layers className="w-5 h-5 text-primary" />
              <span>Review Stock Changes</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Verify your proposed stock adjustments before applying them to inventory.
            </DialogDescription>
          </DialogHeader>

          {/* Metric Highlights */}
          <div className={`grid ${lexicon.enable_secondary_metric ? 'grid-cols-3' : 'grid-cols-2'} gap-3 my-4`}>
            <div className="bg-muted/50 border border-border/80 rounded-xl p-3 text-center">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block mb-0.5">Modified Items</span>
              <span className="text-base sm:text-lg font-bold text-foreground">{modifiedItemsList.length} {lexicon.item_plural}</span>
            </div>

            <div className="bg-muted/50 border border-border/80 rounded-xl p-3 text-center">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block mb-0.5">Net {lexicon.item_singular} Change</span>
              <span className={`text-base sm:text-lg font-bold ${totalNetSuitDelta >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                {totalNetSuitDelta > 0 ? `+${totalNetSuitDelta}` : totalNetSuitDelta} {lexicon.item_plural}
              </span>
            </div>

            {lexicon.enable_secondary_metric && (
              <div className="bg-muted/50 border border-border/80 rounded-xl p-3 text-center">
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block mb-0.5">{lexicon.secondary_metric_name || "Meters"} Impact</span>
                <span className={`text-base sm:text-lg font-bold ${totalMetersDelta >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                  {totalMetersDelta > 0 ? `+${totalMetersDelta.toFixed(1)}` : totalMetersDelta.toFixed(1)} {lexicon.secondary_metric_symbol || "m"}
                </span>
              </div>
            )}
          </div>

          {/* Items Summary Table */}
          <div className="flex-1 overflow-y-auto max-h-72 border border-border rounded-xl divide-y divide-border/60">
            {modifiedItemsList.map(({ product, currentQty, delta, newQty, metersDelta }) => (
              <div key={product!.id} className="p-3 flex items-center justify-between gap-3 hover:bg-muted/30 transition-colors text-xs">
                <div className="space-y-0.5 max-w-[45%]">
                  <h4 className="font-semibold text-foreground line-clamp-1">{product!.name}</h4>
                  <span className="text-[11px] font-mono text-muted-foreground">SKU: {product!.sku || "-"}</span>
                </div>

                <div className="flex items-center gap-3 text-right">
                  <div className="text-muted-foreground text-xs">
                    <span className="line-through mr-1 opacity-70">{currentQty}</span>
                    <ArrowRight className="w-3 h-3 inline text-muted-foreground mx-1" />
                    <strong className="text-foreground text-sm font-bold">{newQty}</strong>
                  </div>

                  <Badge variant="outline" className={`font-mono text-xs font-bold px-2 py-0.5 ${delta > 0 ? "border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10" : "border-destructive/30 text-destructive bg-destructive/10"}`}>
                    {delta > 0 ? `+${delta}` : delta}
                  </Badge>

                  {lexicon.enable_secondary_metric && metersDelta !== 0 && (
                    <span className="text-[11px] text-muted-foreground hidden sm:inline-block w-16 text-right font-medium">
                      ({metersDelta > 0 ? `+${metersDelta.toFixed(1)}` : metersDelta.toFixed(1)}{lexicon.secondary_metric_symbol || "m"})
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsConfirmModalOpen(false)}
              disabled={isSavingStocks}
            >
              Back to Editing
            </Button>

            <Button
              size="sm"
              onClick={executeSaveStocks}
              disabled={isSavingStocks}
              className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
            >
              {isSavingStocks ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  <span>Saving Changes...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  <span>Confirm & Apply Changes</span>
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Product Variants Management Dialog */}
      <ProductVariantsDialog
        product={selectedVariantProduct}
        isOpen={isVariantDialogOpen}
        onClose={() => {
          setIsVariantDialogOpen(false);
          setSelectedVariantProduct(null);
        }}
      />
    </div>
  );
};

export default Products;
