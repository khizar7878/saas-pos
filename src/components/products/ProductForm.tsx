import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DialogFooter } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { useTenant } from "@/contexts/TenantContext";

interface ProductFormData {
  name: string;
  sku: string;
  pct_code: string;
  category_id: string;
  cost_price: string;
  price: string;
  tax_rate: string;
  meters_per_piece: string;
  stock_quantity: string;
  min_stock_level: string;
  metadata?: Record<string, any>;
}

interface Category {
  id: string;
  name: string;
}

interface ProductFormProps {
  formData: ProductFormData;
  setFormData: (data: ProductFormData) => void;
  categories: Category[];
  onSubmit: () => void;
  onCancel: () => void;
  isLoading: boolean;
  submitLabel: string;
}

const ProductForm = ({
  formData,
  setFormData,
  categories,
  onSubmit,
  onCancel,
  isLoading,
  submitLabel,
}: ProductFormProps) => {
  const { lexicon, customProductFields } = useTenant();

  return (
    <>
      <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto px-1">
        {/* Product Details */}
        <div className="grid gap-2">
          <Label htmlFor="name">Product Name *</Label>
          <Input
            id="name"
            placeholder="Enter product name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="sku">Product ID *</Label>
            <Input
              id="sku"
              placeholder="10-digit ID"
              value={formData.sku}
              maxLength={10}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                setFormData({ ...formData, sku: val });
              }}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="pct_code">PCT Code</Label>
            <Input
              id="pct_code"
              placeholder="e.g. 1234.5678"
              value={formData.pct_code}
              onChange={(e) => setFormData({ ...formData, pct_code: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="category">Category</Label>
            <Select
              value={formData.category_id}
              onValueChange={(value) => setFormData({ ...formData, category_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="tax_rate">Tax Rate (%)</Label>
          <Input
            id="tax_rate"
            type="number"
            placeholder="0"
            value={formData.tax_rate}
            onChange={(e) => setFormData({ ...formData, tax_rate: e.target.value })}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="price">Selling Price (Inclusive) *</Label>
          <Input
            id="price"
            type="number"
            placeholder="0"
            value={formData.price}
            onChange={(e) => setFormData({ ...formData, price: e.target.value })}
          />
        </div>

        <div className={`grid ${lexicon.enable_secondary_metric ? 'grid-cols-3' : 'grid-cols-2'} gap-4`}>
          <div className="grid gap-2">
            <Label htmlFor="stock">Initial Stock ({lexicon.item_plural})</Label>
            <Input
              id="stock"
              type="number"
              placeholder="0"
              value={formData.stock_quantity}
              onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
            />
          </div>
          {lexicon.enable_secondary_metric && (
            <div className="grid gap-2">
              <Label htmlFor="meters">{lexicon.secondary_metric_name || "Meters"} per {lexicon.item_singular}</Label>
              <Input
                id="meters"
                type="number"
                placeholder="e.g. 4.5"
                step="0.1"
                value={formData.meters_per_piece}
                onChange={(e) => setFormData({ ...formData, meters_per_piece: e.target.value })}
              />
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="min_stock">Low Stock Alert</Label>
            <Input
              id="min_stock"
              type="number"
              placeholder="5"
              value={formData.min_stock_level}
              onChange={(e) => setFormData({ ...formData, min_stock_level: e.target.value })}
            />
          </div>
        </div>

        {/* Dynamic Custom Product Attributes */}
        {customProductFields && customProductFields.length > 0 && (
          <div className="rounded-lg border border-border bg-muted/20 p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Product Specifications & Attributes
              </span>
              <span className="text-[10px] text-muted-foreground bg-background px-1.5 py-0.5 rounded border border-border">
                {customProductFields.length} {customProductFields.length === 1 ? 'field' : 'fields'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {customProductFields.map((field) => {
                const val = formData.metadata?.[field.id] ?? "";

                const handleChange = (newVal: any) => {
                  setFormData({
                    ...formData,
                    metadata: {
                      ...(formData.metadata || {}),
                      [field.id]: newVal,
                    },
                  });
                };

                if (field.type === "select") {
                  return (
                    <div key={field.id} className="grid gap-1.5">
                      <Label htmlFor={`meta_${field.id}`} className="text-xs font-medium">
                        {field.name} {field.required && "*"}
                      </Label>
                      <Select value={String(val)} onValueChange={handleChange}>
                        <SelectTrigger id={`meta_${field.id}`} className="h-9 text-sm">
                          <SelectValue placeholder={`Select ${field.name}`} />
                        </SelectTrigger>
                        <SelectContent>
                          {(field.options || []).map((opt) => (
                            <SelectItem key={opt} value={opt}>
                              {opt}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                }

                if (field.type === "number") {
                  return (
                    <div key={field.id} className="grid gap-1.5">
                      <Label htmlFor={`meta_${field.id}`} className="text-xs font-medium">
                        {field.name} {field.required && "*"}
                      </Label>
                      <Input
                        id={`meta_${field.id}`}
                        type="number"
                        placeholder={field.placeholder || `Enter ${field.name}`}
                        value={val}
                        onChange={(e) => handleChange(e.target.value)}
                        className="h-9 text-sm"
                      />
                    </div>
                  );
                }

                if (field.type === "date") {
                  return (
                    <div key={field.id} className="grid gap-1.5">
                      <Label htmlFor={`meta_${field.id}`} className="text-xs font-medium">
                        {field.name} {field.required && "*"}
                      </Label>
                      <Input
                        id={`meta_${field.id}`}
                        type="date"
                        value={val}
                        onChange={(e) => handleChange(e.target.value)}
                        className="h-9 text-sm"
                      />
                    </div>
                  );
                }

                return (
                  <div key={field.id} className="grid gap-1.5">
                    <Label htmlFor={`meta_${field.id}`} className="text-xs font-medium">
                      {field.name} {field.required && "*"}
                    </Label>
                    <Input
                      id={`meta_${field.id}`}
                      placeholder={field.placeholder || `Enter ${field.name}`}
                      value={val}
                      onChange={(e) => handleChange(e.target.value)}
                      className="h-9 text-sm"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={onSubmit} disabled={isLoading}>
          {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {submitLabel}
        </Button>
      </DialogFooter>
    </>
  );
};

export default ProductForm;
export type { ProductFormData };
