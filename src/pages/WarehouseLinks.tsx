import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  Link as LinkIcon,
  Unlink,
  RefreshCw,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Package,
  XCircle,
} from "lucide-react";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProducts } from "@/hooks/useProducts";
import { supabase } from "@/integrations/supabase/client";
import { warehouseSupabase } from "@/lib/warehouseSupabase";
import { toast } from "sonner";
import { useTenant } from "@/contexts/TenantContext";

const WarehouseLinks = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [selectedRetailProduct, setSelectedRetailProduct] = useState<any>(null);
  
  // Link Dialog Form State
  const [selectedWarehouseProductId, setSelectedWarehouseProductId] = useState<string>("");
  const [selectedVariationId, setSelectedVariationId] = useState<string>("");

  const queryClient = useQueryClient();
  const { data: retailProducts = [], isLoading: loadingRetail, error: retailError } = useProducts();
  const { lexicon } = useTenant();

  // 1. Fetch warehouse products from the central database
  const { data: warehouseProducts = [], isLoading: loadingWarehouseProducts } = useQuery({
    queryKey: ["warehouse_products_linking"],
    queryFn: async () => {
      if (!warehouseSupabase) return [];
      const { data, error } = await warehouseSupabase
        .from("warehouse_products")
        .select("id, name, sku, cost_per_meter")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!warehouseSupabase && isLinkDialogOpen,
  });

  // Get selected warehouse product details
  const selectedWarehouseProduct = warehouseProducts.find(
    (p: any) => p.id === selectedWarehouseProductId
  );

  // 2. Fetch warehouse variations and packaging costs for the selected parent product
  const { data: warehouseVariations = [], isLoading: loadingVariations } = useQuery({
    queryKey: ["warehouse_variations_linking", selectedWarehouseProductId],
    queryFn: async () => {
      if (!warehouseSupabase || !selectedWarehouseProductId) return [];
      
      const [variationsRes, packagingRes] = await Promise.all([
        warehouseSupabase
          .from("warehouse_product_variations")
          .select("id, sku, meters_per_unit, stock_qty, packing_recipe_id")
          .eq("product_id", selectedWarehouseProductId)
          .eq("is_active", true)
          .order("meters_per_unit"),
        warehouseSupabase
          .from("variation_packaging_costs")
          .select("variation_id, total_recipe_cost")
      ]);

      if (variationsRes.error) throw variationsRes.error;

      const pkgMap = new Map(
        (packagingRes.data || []).map((p: any) => [p.variation_id, Number(p.total_recipe_cost || 0)])
      );

      return variationsRes.data.map((v: any) => ({
        ...v,
        packaging_cost: pkgMap.get(v.id) || 0,
      }));
    },
    enabled: !!warehouseSupabase && !!selectedWarehouseProductId && isLinkDialogOpen,
  });

  // Get selected variation details
  const selectedVariation = warehouseVariations.find(
    (v: any) => v.id === selectedVariationId
  );

  // Calculate fabric cost per piece
  const fabricCostPerPiece =
    selectedWarehouseProduct && selectedVariation
      ? Number(selectedWarehouseProduct.cost_per_meter) * Number(selectedVariation.meters_per_unit)
      : 0;

  // Packaging cost per piece
  const packagingCostPerPiece = selectedVariation?.packaging_cost || 0;

  // Total preview cost based on fabric + packaging
  const calculatedCost =
    selectedWarehouseProduct && selectedVariation
      ? fabricCostPerPiece + packagingCostPerPiece
      : null;

  // 3. Mutation to link/unlink a product
  const linkProductMutation = useMutation({
    mutationFn: async ({
      productId,
      warehouseProductId,
      warehouseVariationId,
      costPrice,
    }: {
      productId: string;
      warehouseProductId: string | null;
      warehouseVariationId: string | null;
      costPrice: number | null;
    }) => {
      const { error } = await supabase
        .from("products")
        .update({
          warehouse_product_id: warehouseProductId,
          warehouse_variation_id: warehouseVariationId,
          cost_price: costPrice,
        })
        .eq("id", productId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setIsLinkDialogOpen(false);
      setSelectedRetailProduct(null);
      setSelectedWarehouseProductId("");
      setSelectedVariationId("");
      toast.success("Link updated successfully");
    },
    onError: (error: any) => {
      console.error("Link product error:", error);
      toast.error("Failed to update link: " + error.message);
    },
  });

  // 4. Batch sync costs mutation for all linked products
  const syncCostsMutation = useMutation({
    mutationFn: async (linkedProducts: any[]) => {
      if (!warehouseSupabase || linkedProducts.length === 0) return 0;

      const warehouseProductIds = linkedProducts
        .map((p) => p.warehouse_product_id)
        .filter(Boolean);
      const warehouseVariationIds = linkedProducts
        .map((p) => p.warehouse_variation_id)
        .filter(Boolean);

      // Fetch warehouse parent costs, variation meters, and packaging costs in parallel batches
      const [productsRes, variationsRes, packagingRes] = await Promise.all([
        warehouseSupabase
          .from("warehouse_products")
          .select("id, cost_per_meter")
          .in("id", warehouseProductIds),
        warehouseSupabase
          .from("warehouse_product_variations")
          .select("id, meters_per_unit")
          .in("id", warehouseVariationIds),
        warehouseSupabase
          .from("variation_packaging_costs")
          .select("variation_id, total_recipe_cost")
          .in("variation_id", warehouseVariationIds),
      ]);

      if (productsRes.error) throw productsRes.error;
      if (variationsRes.error) throw variationsRes.error;

      const productCostMap = new Map(
        productsRes.data.map((p) => [p.id, Number(p.cost_per_meter)])
      );
      const variationMetersMap = new Map(
        variationsRes.data.map((v) => [v.id, Number(v.meters_per_unit)])
      );
      const packagingCostMap = new Map(
        (packagingRes.data || []).map((p) => [p.variation_id, Number(p.total_recipe_cost || 0)])
      );

      let successCount = 0;

      // Update retail products sequentially in local database
      for (const retailProduct of linkedProducts) {
        const costPerMeter = productCostMap.get(retailProduct.warehouse_product_id);
        const metersPerUnit = variationMetersMap.get(retailProduct.warehouse_variation_id);
        const pkgCost = packagingCostMap.get(retailProduct.warehouse_variation_id) || 0;

        if (costPerMeter !== undefined && metersPerUnit !== undefined) {
          const newCost = (costPerMeter * metersPerUnit) + pkgCost;
          const { error } = await supabase
            .from("products")
            .update({ cost_price: newCost })
            .eq("id", retailProduct.id);

          if (!error) successCount++;
        }
      }

      return successCount;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success(`Successfully synced cost for ${count} products.`);
    },
    onError: (error: any) => {
      console.error("Sync costs error:", error);
      toast.error("Failed to sync costs: " + error.message);
    },
  });

  const handleOpenLinkDialog = (product: any) => {
    setSelectedRetailProduct(product);
    setSelectedWarehouseProductId(product.warehouse_product_id || "");
    setSelectedVariationId(product.warehouse_variation_id || "");
    setIsLinkDialogOpen(true);
  };

  const handleSaveLink = () => {
    if (!selectedRetailProduct) return;

    if (!selectedWarehouseProductId || !selectedVariationId) {
      toast.error("Please select both a parent product and a variation.");
      return;
    }

    linkProductMutation.mutate({
      productId: selectedRetailProduct.id,
      warehouseProductId: selectedWarehouseProductId,
      warehouseVariationId: selectedVariationId,
      costPrice: calculatedCost,
    });
  };

  const handleUnlink = (product: any) => {
    if (window.confirm(`Are you sure you want to unlink ${product.name}?`)) {
      linkProductMutation.mutate({
        productId: product.id,
        warehouseProductId: null,
        warehouseVariationId: null,
        costPrice: null,
      });
    }
  };

  const handleSyncAllCosts = () => {
    const linked = retailProducts.filter(
      (p: any) => p.warehouse_product_id && p.warehouse_variation_id
    );
    if (linked.length === 0) {
      toast.error("No linked products found to sync.");
      return;
    }
    syncCostsMutation.mutate(linked);
  };

  const filteredProducts = retailProducts.filter(
    (product) =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.sku && product.sku.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Separate linked and unlinked counts
  const linkedCount = retailProducts.filter(
    (p: any) => p.warehouse_product_id && p.warehouse_variation_id
  ).length;

  if (loadingRetail) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (retailError) {
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
          <h1 className="text-xl md:text-2xl font-semibold text-foreground">Warehouse Product Linking</h1>
          <p className="text-muted-foreground text-xs md:text-sm">
            Link retail catalog items to central warehouse parent products & variations ({linkedCount}/{retailProducts.length} linked)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSyncAllCosts}
            disabled={syncCostsMutation.isPending || linkedCount === 0 || !warehouseSupabase}
            className="w-full sm:w-auto"
          >
            {syncCostsMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Sync All Costs
          </Button>
        </div>
      </div>

      {/* Database configuration status banner */}
      {!warehouseSupabase && (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>
            <strong>Configuration Missing</strong> — Warehouse database credentials are not configured in the active environment files. Please set <code>VITE_WAREHOUSE_SUPABASE_URL</code> and <code>VITE_WAREHOUSE_SUPABASE_ANON_KEY</code> to enable syncing.
          </span>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search products by name or ID..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Product list linking table */}
      <div className="flex-1 min-h-0 overflow-auto rounded-xl border border-border bg-card shadow-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-muted-foreground">Product</TableHead>
              <TableHead className="text-muted-foreground">Product ID</TableHead>
              <TableHead className="text-muted-foreground">Category</TableHead>
              <TableHead className="text-muted-foreground">Link Status</TableHead>
              <TableHead className="text-muted-foreground">Calculated Cost</TableHead>
              <TableHead className="text-muted-foreground w-36 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  {searchTerm
                    ? "No products match your search"
                    : "No products in retail database."}
                </TableCell>
              </TableRow>
            ) : (
              filteredProducts.map((product: any) => {
                const isLinked = product.warehouse_product_id && product.warehouse_variation_id;

                return (
                  <TableRow key={product.id} className="hover:bg-muted/50">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Package className="w-5 h-5 text-primary" />
                        </div>
                        <span className="font-medium text-foreground">{product.name}</span>
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
                    <TableCell>
                      {isLinked ? (
                        <Badge className="bg-success/10 text-success border-success/20 hover:bg-success/15 hover:text-success gap-1.5 py-0.5">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Linked
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground border-border gap-1.5 py-0.5">
                          <XCircle className="w-3.5 h-3.5 text-muted-foreground/60" />
                          Not Linked
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-medium text-foreground">
                      {product.cost_price !== null && product.cost_price !== undefined ? (
                        <span className="flex flex-col">
                          <span>Rs. {product.cost_price.toLocaleString()}</span>
                          {isLinked && (
                            <span className="text-[10px] text-success font-normal">Dynamic Cost</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenLinkDialog(product)}
                          disabled={!warehouseSupabase || linkProductMutation.isPending}
                        >
                          <LinkIcon className="w-3.5 h-3.5 mr-1" />
                          {isLinked ? "Change" : "Link"}
                        </Button>
                        {isLinked && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleUnlink(product)}
                            disabled={linkProductMutation.isPending}
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive h-8 px-2"
                          >
                            <Unlink className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Link Dialog */}
      <Dialog
        open={isLinkDialogOpen}
        onOpenChange={(open) => {
          setIsLinkDialogOpen(open);
          if (!open) {
            setSelectedRetailProduct(null);
            setSelectedWarehouseProductId("");
            setSelectedVariationId("");
          }
        }}
      >
        <DialogContent className="sm:max-w-lg mx-4">
          <DialogHeader>
            <DialogTitle>Link to Warehouse Variation</DialogTitle>
            <DialogDescription>
              Select the parent warehouse product and variation for{" "}
              <strong>{selectedRetailProduct?.name}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4 px-1">
            {/* 1. Parent Product Selector */}
            <div className="grid gap-2">
              <label className="text-sm font-medium text-foreground">
                Parent Warehouse Product *
              </label>
              <Select
                value={selectedWarehouseProductId}
                onValueChange={(value) => {
                  setSelectedWarehouseProductId(value);
                  setSelectedVariationId(""); // Reset variation selection on parent change
                }}
                disabled={loadingWarehouseProducts}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loadingWarehouseProducts ? "Loading products..." : "Select product"} />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {warehouseProducts.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} {p.sku ? `(${p.sku})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 2. Variation Selector */}
            <div className="grid gap-2">
              <label className="text-sm font-medium text-foreground">
                Product Variation {lexicon.enable_secondary_metric ? `(${lexicon.secondary_metric_name || "Meters"} per ${lexicon.item_singular})` : `(${lexicon.item_singular})`} *
              </label>
              <Select
                value={selectedVariationId}
                onValueChange={setSelectedVariationId}
                disabled={!selectedWarehouseProductId || loadingVariations}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      !selectedWarehouseProductId
                        ? "Select a parent product first"
                        : loadingVariations
                        ? "Loading variations..."
                        : "Select variation size"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {warehouseVariations.map((v: any) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.sku} ({v.meters_per_unit} Meters)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 3. Cost Preview Display */}
            {selectedWarehouseProduct && selectedVariation && (
              <div className="rounded-lg border border-border bg-muted/40 p-4 mt-2 space-y-2.5">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Cost Breakdown Preview
                </h4>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Warehouse Fabric Cost/Meter:</span>
                  <span className="font-mono">Rs. {Number(selectedWarehouseProduct.cost_per_meter).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Variation Meters/Piece:</span>
                  <span className="font-mono">{selectedVariation.meters_per_unit} M</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Fabric Cost/Piece:</span>
                  <span className="font-mono">Rs. {fabricCostPerPiece.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Packaging Cost/Piece:</span>
                  <span className="font-mono text-primary font-medium">
                    + Rs. {packagingCostPerPiece.toLocaleString()}
                  </span>
                </div>
                <div className="border-t border-border pt-2 flex justify-between font-semibold text-foreground">
                  <span>Dynamic Cost Price per Piece:</span>
                  <span className="text-primary font-mono font-bold">
                    Rs. {calculatedCost?.toLocaleString()}
                  </span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsLinkDialogOpen(false)}
              disabled={linkProductMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveLink}
              disabled={
                !selectedWarehouseProductId ||
                !selectedVariationId ||
                linkProductMutation.isPending
              }
            >
              {linkProductMutation.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Save Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WarehouseLinks;
