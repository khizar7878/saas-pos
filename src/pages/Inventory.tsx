import { useState } from "react";
import { Search, Package, TrendingUp, TrendingDown, Loader2 } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useProducts } from "@/hooks/useProducts";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";

const Inventory = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [isAdjustDialogOpen, setIsAdjustDialogOpen] = useState(false);

  // Adjust dialog state
  const [selectedProductId, setSelectedProductId] = useState("");
  const [adjustType, setAdjustType] = useState<"add" | "remove">("add");
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const queryClient = useQueryClient();
  const { data: products = [], isLoading, error } = useProducts();

  const filteredItems = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const lowStockCount = products.filter(
    (p) => (p.stock_quantity ?? 0) <= (p.min_stock_level ?? 0)
  ).length;
  const totalSuits = products.reduce((sum, p) => sum + (p.stock_quantity ?? 0), 0);

  const handleOpenAdjust = () => {
    setSelectedProductId("");
    setAdjustType("add");
    setAdjustQty("");
    setAdjustReason("");
    setIsAdjustDialogOpen(true);
  };

  const handleSaveAdjustment = async () => {
    const qty = parseInt(adjustQty);
    if (!selectedProductId) {
      toast.error("Please select a product.");
      return;
    }
    if (!qty || qty <= 0) {
      toast.error("Please enter a valid quantity.");
      return;
    }

    const product = products.find((p) => p.id === selectedProductId);
    if (!product) return;

    const delta = adjustType === "add" ? qty : -qty;
    const newQty = Math.max(0, (product.stock_quantity ?? 0) + delta);

    setIsSaving(true);
    const { error } = await supabase
      .from("products")
      .update({ stock_quantity: newQty })
      .eq("id", selectedProductId);

    setIsSaving(false);

    if (error) {
      toast.error("Failed to adjust stock: " + error.message);
    } else {
      await queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success(
        `${product.name}: stock ${adjustType === "add" ? "increased" : "decreased"} to ${newQty}`
      );
      setIsAdjustDialogOpen(false);
    }
  };

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
        <p className="text-destructive">Failed to load inventory. Please try again.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden p-4 md:p-6 lg:p-8 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-foreground">Stock Levels</h1>
          <p className="text-muted-foreground text-xs md:text-sm">
            Track and manage stock levels
          </p>
        </div>
        <Button size="sm" className="w-full sm:w-auto" onClick={handleOpenAdjust}>
          Adjust Stock
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-3 md:gap-4 grid-cols-3">
        <div className="rounded-xl border border-border bg-card shadow-card p-3 md:p-5">
          <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Package className="w-4 h-4 md:w-5 md:h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs md:text-sm text-muted-foreground">Total Suits</p>
              <p className="text-sm md:text-xl font-semibold text-foreground">
                {totalSuits.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card shadow-card p-3 md:p-5">
          <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
              <TrendingDown className="w-4 h-4 md:w-5 md:h-5 text-destructive" />
            </div>
            <div>
              <p className="text-xs md:text-sm text-muted-foreground">Low Stock</p>
              <p className="text-sm md:text-xl font-semibold text-foreground">{lowStockCount}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card shadow-card p-3 md:p-5">
          <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-success/10 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-success" />
            </div>
            <div>
              <p className="text-xs md:text-sm text-muted-foreground">Products</p>
              <p className="text-sm md:text-xl font-semibold text-foreground">{products.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search inventory..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Inventory — Mobile Cards / Desktop Table */}
      <div className="flex-1 min-h-0 overflow-auto">
        {/* Mobile Cards */}
        <div className="md:hidden space-y-3">
          {filteredItems.map((item) => {
            const isLowStock = (item.stock_quantity ?? 0) <= (item.min_stock_level ?? 0);
            return (
              <div
                key={item.id}
                className="rounded-xl border border-border bg-card shadow-card p-4 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-foreground">{item.name}</span>
                  <Badge
                    variant="outline"
                    className={
                      isLowStock
                        ? "bg-destructive/10 text-destructive border-destructive/20"
                        : "bg-success/10 text-success border-success/20"
                    }
                  >
                    {isLowStock ? "Low" : "OK"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground font-mono">{item.sku || "—"}</p>
                <div className="flex items-center justify-between pt-2 border-t border-border text-xs">
                  <div>
                    <span className="text-muted-foreground">Stock: </span>
                    <span className="font-semibold">{item.stock_quantity ?? 0}</span>
                    <span className="text-muted-foreground"> / Min: {item.min_stock_level ?? 0}</span>
                  </div>
                  {item.updated_at && (
                    <span className="text-muted-foreground">
                      {format(new Date(item.updated_at), "dd MMM yy")}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          {filteredItems.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              {searchTerm ? "No products match your search." : "No products found."}
            </p>
          )}
        </div>

        {/* Desktop Table */}
        <div className="hidden md:flex md:flex-col flex-1 min-h-0 rounded-xl border border-border bg-card shadow-card overflow-hidden">
          <div className="overflow-auto flex-1">
            <Table>
              <TableHeader className="sticky top-0 bg-card">
                <TableRow>
                  <TableHead className="text-muted-foreground">Product</TableHead>
                  <TableHead className="text-muted-foreground">Product ID</TableHead>
                  <TableHead className="text-muted-foreground">Category</TableHead>
                  <TableHead className="text-muted-foreground">Current Stock</TableHead>
                  <TableHead className="text-muted-foreground">Min Stock</TableHead>
                  <TableHead className="text-muted-foreground">Status</TableHead>
                  <TableHead className="text-muted-foreground">Last Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      {searchTerm ? "No products match your search." : "No products found."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredItems.map((item) => {
                    const isLowStock = (item.stock_quantity ?? 0) <= (item.min_stock_level ?? 0);
                    return (
                      <TableRow key={item.id} className="hover:bg-muted/50">
                        <TableCell className="font-medium text-foreground">{item.name}</TableCell>
                        <TableCell className="text-muted-foreground font-mono text-sm">
                          {item.sku || "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {item.product_categories?.name ?? "—"}
                        </TableCell>
                        <TableCell className="font-semibold text-foreground">
                          {item.stock_quantity ?? 0}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {item.min_stock_level ?? 0}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              isLowStock
                                ? "bg-destructive/10 text-destructive border-destructive/20"
                                : "bg-success/10 text-success border-success/20"
                            }
                          >
                            {isLowStock ? "Low Stock" : "In Stock"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {item.updated_at
                            ? format(new Date(item.updated_at), "dd MMM yy, HH:mm")
                            : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* Adjust Stock Dialog */}
      <Dialog open={isAdjustDialogOpen} onOpenChange={setIsAdjustDialogOpen}>
        <DialogContent className="sm:max-w-md mx-4">
          <DialogHeader>
            <DialogTitle>Adjust Stock</DialogTitle>
            <DialogDescription>Add or remove stock from a product.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Product</Label>
              <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select product" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}{" "}
                      <span className="text-muted-foreground ml-1">
                        (Stock: {p.stock_quantity ?? 0})
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Type</Label>
                <Select
                  value={adjustType}
                  onValueChange={(v) => setAdjustType(v as "add" | "remove")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="add">Add Stock</SelectItem>
                    <SelectItem value="remove">Remove Stock</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  placeholder="0"
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(e.target.value)}
                  className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="reason">Reason (Optional)</Label>
              <Textarea
                id="reason"
                placeholder="Reason for adjustment..."
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setIsAdjustDialogOpen(false)}
              className="w-full sm:w-auto"
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveAdjustment}
              className="w-full sm:w-auto"
              disabled={isSaving}
            >
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Adjustment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Inventory;