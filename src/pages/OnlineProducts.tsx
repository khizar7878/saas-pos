import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Store, Search, Edit, Upload, Sparkles, Image as ImageIcon, Trash2, Tag, Coins, Ruler, Calendar, CheckCircle2, X, Layers } from "lucide-react";
import { toast } from "sonner";
import { useTenant } from "@/contexts/TenantContext";

export default function OnlineProducts() {
  const { lexicon } = useTenant();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [onlyOnlineFilter, setOnlyOnlineFilter] = useState(false);

  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Form State
  const [onlineTitle, setOnlineTitle] = useState("");
  const [onlineDescription, setOnlineDescription] = useState("");
  const [pricePerSuit, setPricePerSuit] = useState(0);
  const [metersPerSuit, setMetersPerSuit] = useState(4.0);
  const [fabricType, setFabricType] = useState("Cotton");
  const [season, setSeason] = useState("All Season");
  const [panaInches, setPanaInches] = useState(54);
  const [isFeatured, setIsFeatured] = useState(false);
  const [isBestseller, setIsBestseller] = useState(false);
  const [isNewArrival, setIsNewArrival] = useState(true);
  const [images, setImages] = useState<string[]>([]);

  // Color Variants State
  const [productVariants, setProductVariants] = useState<any[]>([]);
  const [loadingVariants, setLoadingVariants] = useState(false);
  const [newColorName, setNewColorName] = useState("");
  const [newColorHex, setNewColorHex] = useState("#295975");
  const [newVariantImageUrl, setNewVariantImageUrl] = useState("");

  const fetchVariants = async (productId: string) => {
    try {
      setLoadingVariants(true);
      const { data, error } = await supabase
        .from("product_variants")
        .select("*")
        .eq("product_id", productId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setProductVariants(data || []);
    } catch (err: any) {
      console.error("Error loading product variants:", err);
    } finally {
      setLoadingVariants(false);
    }
  };

  const handleAddVariant = async () => {
    if (!selectedProduct || !newColorName.trim()) {
      toast.error("Please enter a color name (e.g. Off White, Navy Blue).");
      return;
    }

    try {
      const payload = {
        product_id: selectedProduct.id,
        color_name: newColorName.trim(),
        color_hex: newColorHex.trim() || "#295975",
        variant_image_url: newVariantImageUrl.trim() || null,
      };

      const { error } = await supabase.from("product_variants").insert([payload]);
      if (error) throw error;

      toast.success(`Color swatch "${newColorName}" added!`);
      setNewColorName("");
      setNewVariantImageUrl("");
      fetchVariants(selectedProduct.id);
    } catch (err: any) {
      toast.error(err.message || "Failed to add color swatch");
    }
  };

  const handleDeleteVariant = async (variantId: string) => {
    try {
      const { error } = await supabase.from("product_variants").delete().eq("id", variantId);
      if (error) throw error;

      toast.success("Color swatch removed");
      if (selectedProduct) fetchVariants(selectedProduct.id);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete swatch");
    }
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("products")
        .select("*, product_categories(name)")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setProducts(data || []);
    } catch (err: any) {
      console.error("Error fetching products:", err);
      toast.error(err.message || "Failed to load products");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleToggleOnline = async (product: any, currentStatus: boolean) => {
    try {
      const nextStatus = !currentStatus;
      const { error } = await supabase
        .from("products")
        .update({
          is_online: nextStatus,
          meters_per_suit: product.meters_per_suit || 4.0,
          price_per_suit: product.price_per_suit || (product.price_per_meter * 4.0),
        })
        .eq("id", product.id);

      if (error) throw error;

      toast.success(`${product.name} is now ${nextStatus ? "Published Online" : "Unpublished"}`);
      fetchProducts();
    } catch (err: any) {
      toast.error(err.message || "Failed to update online status");
    }
  };

  const handleOpenEdit = (prod: any) => {
    setSelectedProduct(prod);
    setOnlineTitle(prod.online_title || prod.name);
    setOnlineDescription(prod.online_description || "");
    setPricePerSuit(Number(prod.price_per_suit) || Number(prod.price) || 0);
    setMetersPerSuit(Number(prod.meters_per_suit) || Number(prod.meters_per_piece) || 4.0);
    setFabricType(prod.fabric_type || "Cotton");
    setSeason(prod.season || "All Season");
    setPanaInches(prod.pana_inches || 54);
    setIsFeatured(prod.is_featured || false);
    setIsBestseller(prod.is_bestseller || false);
    setIsNewArrival(prod.is_new_arrival !== false);
    setImages(prod.images || []);
    setNewColorName("");
    setNewColorHex("#295975");
    setNewVariantImageUrl("");
    setIsEditDialogOpen(true);
    fetchVariants(prod.id);
  };

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];

    try {
      setUploadingImage(true);
      const fileExt = file.name.split(".").pop();
      const fileName = `products/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from("online-store-media")
        .upload(fileName, file);

      if (error) throw error;

      if (data) {
        const { data: publicUrlData } = supabase.storage
          .from("online-store-media")
          .getPublicUrl(fileName);

        const newUrl = publicUrlData.publicUrl;
        setImages((prev) => [...prev, newUrl]);
        toast.success("Image uploaded!");
      }
    } catch (err: any) {
      console.error("Image upload failed:", err);
      toast.error(err.message || "Image upload failed");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemoveImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveOnlineProduct = async () => {
    if (!selectedProduct) return;
    try {
      const { error } = await supabase
        .from("products")
        .update({
          is_online: true,
          online_title: onlineTitle,
          online_description: onlineDescription,
          price_per_suit: pricePerSuit,
          meters_per_suit: metersPerSuit,
          fabric_type: fabricType,
          season: season,
          pana_inches: panaInches,
          is_featured: isFeatured,
          is_bestseller: isBestseller,
          is_new_arrival: isNewArrival,
          images: images,
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedProduct.id);

      if (error) throw error;

      toast.success("Online Product settings saved!");
      setIsEditDialogOpen(false);
      fetchProducts();
    } catch (err: any) {
      toast.error(err.message || "Failed to save online details");
    }
  };

  const filteredProducts = products.filter((p) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      (p.name ? p.name.toLowerCase().includes(query) : false) ||
      (p.sku ? p.sku.toLowerCase().includes(query) : false);
    const matchesOnline = !onlyOnlineFilter || p.is_online;
    return matchesSearch && matchesOnline;
  });

  return (
    <div className="p-6 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 text-primary rounded-xl">
              <Store className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Online Store Product Catalog</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Toggle which retail products appear on <strong className="text-foreground">ak-online</strong>, set suit pricing & upload fabric photos.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products by SKU or Name..."
            className="pl-9 text-sm"
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <Switch
              checked={onlyOnlineFilter}
              onCheckedChange={setOnlyOnlineFilter}
            />
            <span>Show Published Only</span>
          </div>
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                {lexicon.enable_secondary_metric && (
                  <TableHead>{lexicon.item_singular} {lexicon.secondary_metric_name || "Meterage"}</TableHead>
                )}
                <TableHead>{lexicon.item_singular} Price (PKR)</TableHead>
                <TableHead>Live Online</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={lexicon.enable_secondary_metric ? 5 : 4} className="text-center py-8 text-muted-foreground">
                    Loading products...
                  </TableCell>
                </TableRow>
              ) : filteredProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={lexicon.enable_secondary_metric ? 5 : 4} className="text-center py-8 text-muted-foreground">
                    No products found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredProducts.map((p) => {
                  const meters = Number(p.meters_per_piece) || Number(p.meters_per_suit) || 4.0;
                  const suitPriceNum = Number(p.price_per_suit);
                  const rawSuitPrice = (!isNaN(suitPriceNum) && suitPriceNum > 0) ? suitPriceNum : (Number(p.price) || 0);
                  const calculatedSuitPrice = isNaN(rawSuitPrice) ? 0 : rawSuitPrice;
                  return (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="font-semibold text-xs">{p.online_title || p.name}</div>
                        <div className="text-[11px] text-muted-foreground">{p.product_categories?.name || "Uncategorized"}</div>
                      </TableCell>

                      {lexicon.enable_secondary_metric && (
                        <TableCell className="text-xs font-bold text-primary">
                          {meters} {lexicon.secondary_metric_symbol || "Meters"}
                        </TableCell>
                      )}

                      <TableCell className="font-bold text-sm text-emerald-600">
                        Rs. {calculatedSuitPrice.toLocaleString()}
                      </TableCell>

                      <TableCell>
                        <Switch
                          checked={!!p.is_online}
                          onCheckedChange={() => handleToggleOnline(p, !!p.is_online)}
                        />
                      </TableCell>

                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenEdit(p)}
                          className="gap-1 text-xs"
                        >
                          <Edit className="w-3.5 h-3.5" /> Edit Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Details Modal */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-3xl p-0 border-0 rounded-3xl overflow-hidden bg-transparent shadow-2xl">
          {selectedProduct && (
            <div className="bg-[#295975] text-white rounded-3xl overflow-hidden shadow-2xl transition-all duration-300">
              
              {/* Modal Top Header */}
              <div className="bg-[#295975] text-white p-6 relative rounded-t-3xl border-b border-white/10">
                <button
                  onClick={() => setIsEditDialogOpen(false)}
                  className="absolute top-5 right-5 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
                
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-white/10 text-white">
                    <Sparkles className="w-5 h-5 text-amber-300" />
                  </div>
                  <div>
                    <h3 className="font-bold text-xl text-white">
                      Configure Online Product Listing
                    </h3>
                    <p className="text-xs text-white/80 mt-0.5">
                      Set storefront titles, suit pricing, fabric dimensions, color swatches & photos for {selectedProduct.name}.
                    </p>
                  </div>
                </div>
              </div>

              {/* Modal Body Container with White Background */}
              <div className="p-6 bg-white dark:bg-slate-900 rounded-b-3xl space-y-6 text-xs text-slate-800 dark:text-slate-100 max-h-[80vh] overflow-y-auto">
                
                {/* SECTION 1: Listing Details & Suit Pricing */}
                <div className="bg-slate-50 dark:bg-slate-900/60 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-4 shadow-xs">
                  <div className="flex items-center gap-2 border-b border-slate-200/60 dark:border-slate-800 pb-3">
                    <Layers className="w-4 h-4 text-[#295975]" />
                    <h4 className="font-bold uppercase tracking-wider text-xs text-[#295975]">
                      1. Listing Information & Suit Pricing
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                        Online Display Title *
                      </label>
                      <div className="relative">
                        <Tag className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                        <Input
                          value={onlineTitle}
                          onChange={(e) => setOnlineTitle(e.target.value)}
                          placeholder="e.g. Executive 8-Pound Pure Boski Suit"
                          className="pl-10 h-10 text-xs sm:text-sm rounded-xl border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#295975]/30 focus:border-[#295975]"
                        />
                      </div>
                    </div>

                    <div className={lexicon.enable_secondary_metric ? "" : "sm:col-span-2"}>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                        Price Per {lexicon.item_singular} (PKR) *
                      </label>
                      <div className="relative">
                        <Coins className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                        <Input
                          type="number"
                          value={pricePerSuit}
                          onChange={(e) => setPricePerSuit(Number(e.target.value))}
                          className="pl-10 h-10 text-xs sm:text-sm font-bold text-emerald-700 rounded-xl border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#295975]/30 focus:border-[#295975]"
                        />
                      </div>
                    </div>

                    {lexicon.enable_secondary_metric && (
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                          {lexicon.secondary_metric_name || "Meters"} Per {lexicon.item_singular} *
                        </label>
                        <div className="relative">
                          <Ruler className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                          <Input
                            type="number"
                            step="0.25"
                            value={metersPerSuit}
                            onChange={(e) => setMetersPerSuit(Number(e.target.value))}
                            className="pl-10 h-10 text-xs sm:text-sm font-bold text-[#295975] rounded-xl border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#295975]/30 focus:border-[#295975]"
                          />
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                        Fabric Type
                      </label>
                      <select
                        value={fabricType}
                        onChange={(e) => setFabricType(e.target.value)}
                        className="w-full h-10 px-3.5 text-xs sm:text-sm rounded-xl border border-slate-200 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#295975]/30 focus:border-[#295975]"
                      >
                        {["Wash & Wear", "Boski", "Cotton", "Latha", "Karandi", "Linen", "Wool", "Silk"].map((f) => (
                          <option key={f} value={f}>{f}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                        Season Tag
                      </label>
                      <select
                        value={season}
                        onChange={(e) => setSeason(e.target.value)}
                        className="w-full h-10 px-3.5 text-xs sm:text-sm rounded-xl border border-slate-200 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#295975]/30 focus:border-[#295975]"
                      >
                        {["All Season", "Summer", "Winter", "Festive"].map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                        Fabric Width (Pana Inches)
                      </label>
                      <Input
                        type="number"
                        value={panaInches}
                        onChange={(e) => setPanaInches(Number(e.target.value))}
                        placeholder="54, 58, 36"
                        className="h-10 text-xs sm:text-sm rounded-xl border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#295975]/30 focus:border-[#295975]"
                      />
                    </div>
                  </div>
                </div>

                {/* SECTION 2: Online Description & Merchandising Badges */}
                <div className="bg-slate-50 dark:bg-slate-900/60 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-4 shadow-xs">
                  <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-500" />
                      <h4 className="font-bold uppercase tracking-wider text-xs text-[#295975]">
                        2. Storefront Highlights & Description
                      </h4>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                      Online Description / Features
                    </label>
                    <textarea
                      rows={3}
                      value={onlineDescription}
                      onChange={(e) => setOnlineDescription(e.target.value)}
                      placeholder="Describe texture, weave, luster, washing instructions..."
                      className="w-full p-3 text-xs sm:text-sm rounded-xl border border-slate-200 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#295975]/30 focus:border-[#295975]"
                    />
                  </div>

                  <div className="flex items-center gap-8 pt-1">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <Switch checked={isFeatured} onCheckedChange={setIsFeatured} />
                      <span className="font-bold text-xs text-slate-700 dark:text-slate-200">Featured on Homepage</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <Switch checked={isBestseller} onCheckedChange={setIsBestseller} />
                      <span className="font-bold text-xs text-slate-700 dark:text-slate-200">Best Seller Tag</span>
                    </label>
                  </div>
                </div>

                {/* SECTION 3: Fabric Color Variations & Swatches */}
                <div className="bg-slate-50 dark:bg-slate-900/60 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-4 shadow-xs">
                  <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-[#295975]" />
                      <h4 className="font-bold uppercase tracking-wider text-xs text-[#295975]">
                        3. Fabric Color Variations & Swatches
                      </h4>
                    </div>
                    {productVariants.length > 0 && (
                      <Badge className="bg-[#295975] text-white font-bold text-[10px] rounded-full px-2.5 py-0.5">
                        {productVariants.length} Active Color(s)
                      </Badge>
                    )}
                  </div>

                  {/* Saved Swatches */}
                  {loadingVariants ? (
                    <div className="text-slate-400 italic py-1">Loading color swatches...</div>
                  ) : productVariants.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-36 overflow-y-auto pr-1">
                      {productVariants.map((v) => (
                        <div
                          key={v.id}
                          className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-800 shadow-xs"
                        >
                          <div className="flex items-center gap-2.5">
                            <span
                              className="w-5 h-5 rounded-full border border-slate-300 shadow-xs shrink-0"
                              style={{ backgroundColor: v.color_hex || '#295975' }}
                            />
                            <div>
                              <strong className="block text-slate-800 dark:text-slate-100 font-bold text-xs">{v.color_name}</strong>
                              <span className="text-[10px] text-slate-400">
                                {v.variant_image_url ? 'Custom photo linked' : 'Uses main fabric photo'}
                              </span>
                            </div>
                          </div>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteVariant(v.id)}
                            className="text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 h-7 w-7 p-0 rounded-lg"
                            title="Delete Swatch"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3.5 text-center border border-dashed rounded-xl text-slate-400 text-xs bg-white dark:bg-slate-800">
                      No color swatches created yet for this product. Quick-select a color preset below!
                    </div>
                  )}

                  {/* Add Swatch Box */}
                  <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200/80 dark:border-slate-700 space-y-3">
                    <span className="block font-bold text-xs uppercase tracking-wider text-[#295975]">
                      + Add New Color Swatch
                    </span>

                    {/* Presets */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                        Quick Select Popular Colors:
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { name: "Pure White", hex: "#FFFFFF" },
                          { name: "Off White", hex: "#F5F5DC" },
                          { name: "Cream", hex: "#E8D8C8" },
                          { name: "Navy Blue", hex: "#1B2A4A" },
                          { name: "Royal Blue", hex: "#1E3A8A" },
                          { name: "Sky Blue", hex: "#7DD3FC" },
                          { name: "Jet Black", hex: "#18181B" },
                          { name: "Charcoal Grey", hex: "#3F3F46" },
                          { name: "Silver Grey", hex: "#9CA3AF" },
                          { name: "Camel", hex: "#C19A6B" },
                          { name: "Olive Green", hex: "#4B5320" },
                          { name: "Emerald", hex: "#047857" },
                          { name: "Maroon", hex: "#800020" },
                          { name: "Plum", hex: "#581C87" },
                        ].map((preset) => (
                          <button
                            key={preset.name}
                            type="button"
                            onClick={() => {
                              setNewColorName(preset.name);
                              setNewColorHex(preset.hex);
                            }}
                            className={`px-3 py-1.5 rounded-full text-xs font-bold border flex items-center gap-1.5 transition-all ${
                              newColorName === preset.name
                                ? "border-[#295975] bg-[#295975]/10 text-[#295975] ring-2 ring-[#295975]/30 shadow-xs"
                                : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-[#295975]"
                            }`}
                          >
                            <span
                              className="w-3.5 h-3.5 rounded-full border border-slate-300 shadow-xs"
                              style={{ backgroundColor: preset.hex }}
                            />
                            <span>{preset.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Input Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">Color Name *</label>
                        <Input
                          value={newColorName}
                          onChange={(e) => setNewColorName(e.target.value)}
                          placeholder="e.g. Off White, Navy"
                          className="h-10 text-xs rounded-xl border-slate-200 focus:ring-2 focus:ring-[#295975]/30 focus:border-[#295975]"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">Color Picker / Hex</label>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-10 h-10 rounded-xl border border-slate-300 shadow-xs flex items-center justify-center shrink-0 overflow-hidden"
                            style={{ backgroundColor: newColorHex }}
                          >
                            <input
                              type="color"
                              value={newColorHex}
                              onChange={(e) => setNewColorHex(e.target.value)}
                              className="w-14 h-14 scale-150 cursor-pointer opacity-0"
                              title="Click to pick custom color"
                            />
                          </div>
                          <Input
                            value={newColorHex}
                            onChange={(e) => setNewColorHex(e.target.value)}
                            className="h-10 text-xs font-mono rounded-xl border-slate-200 focus:ring-2 focus:ring-[#295975]/30 focus:border-[#295975]"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                          Variant Image URL <span className="text-slate-400 font-normal">(Optional)</span>
                        </label>
                        <Input
                          value={newVariantImageUrl}
                          onChange={(e) => setNewVariantImageUrl(e.target.value)}
                          placeholder="https://... (Optional)"
                          className="h-10 text-xs rounded-xl border-slate-200 focus:ring-2 focus:ring-[#295975]/30 focus:border-[#295975]"
                        />
                      </div>
                    </div>

                    <Button
                      onClick={handleAddVariant}
                      className="w-full h-10 bg-[#295975] text-white font-bold text-xs rounded-xl gap-2 hover:bg-[#295975]/90 transition-all shadow-sm"
                    >
                      <Sparkles className="w-4 h-4 text-amber-300" /> Save & Add Color Swatch
                    </Button>
                  </div>
                </div>

                {/* SECTION 4: Product Fabric Photos */}
                <div className="bg-slate-50 dark:bg-slate-900/60 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3 shadow-xs">
                  <div className="flex items-center gap-2 border-b border-slate-200/60 dark:border-slate-800 pb-3">
                    <ImageIcon className="w-4 h-4 text-[#295975]" />
                    <h4 className="font-bold uppercase tracking-wider text-xs text-[#295975]">
                      4. Product Fabric Photo Gallery
                    </h4>
                  </div>
                  
                  <div className="grid grid-cols-4 gap-3 pt-1">
                    {images.map((url, idx) => (
                      <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 group shadow-xs">
                        <img src={url} alt="Product view" className="w-full h-full object-cover" />
                        <button
                          onClick={() => handleRemoveImage(idx)}
                          className="absolute top-1.5 right-1.5 p-1.5 bg-rose-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}

                    <label className="aspect-square border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-white dark:hover:bg-slate-800 transition-colors text-slate-500">
                      <Upload className="w-5 h-5 mb-1 text-[#295975]" />
                      <span className="text-[11px] font-bold text-[#295975]">{uploadingImage ? "Uploading..." : "+ Add Photo"}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleUploadImage}
                        disabled={uploadingImage}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                {/* Submit / Save Bar */}
                <div className="pt-3 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-end gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setIsEditDialogOpen(false)}
                    className="h-11 px-5 rounded-xl text-xs font-bold border-slate-300 text-slate-700 dark:text-slate-300 hover:bg-slate-100"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSaveOnlineProduct}
                    className="h-11 px-6 rounded-xl bg-[#295975] text-white font-bold text-xs hover:bg-[#295975]/90 transition-all flex items-center gap-2 shadow-md"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Save & Publish Changes
                  </Button>
                </div>

              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
