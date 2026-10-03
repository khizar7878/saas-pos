import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Search, Printer, Download, QrCode, Loader2, Plus, Minus, Eye, Barcode as BarcodeIcon, Settings2, X, ChevronUp, Trash2, ShoppingCart } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
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
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useProducts } from "@/hooks/useProducts";
import JsBarcode from "jsbarcode";
import QRCode from "qrcode";
import { Product } from "@/types/database";


// TSC TTP 244 PRO compatible label sizes (max 4" / 101.6mm width)
const LABEL_PRESETS = {
  "2x1": { width: 2, height: 1, fontSize: "8px", name: "2\" × 1\"", labelsPerRow: 2 },
  "4x1": { width: 4, height: 1, fontSize: "10px", name: "4\" × 1\" (Full Width)", labelsPerRow: 1 },
  "4x2": { width: 4, height: 2, fontSize: "11px", name: "4\" × 2\" (Full Width)", labelsPerRow: 1 },
} as const;

type LabelSize = keyof typeof LABEL_PRESETS;
type PrintType = "barcode" | "qrcode";

const getSingleLineFontSize = (name: string, maxPx = 30, minPx = 9) => {
  const len = name ? name.length : 1;
  const calculated = Math.floor(370 / (len * 0.68));
  return Math.max(minPx, Math.min(maxPx, calculated));
};

// Helper to remove redundant cutting meters from product name in 4x1 barcode labels
const cleanProductName = (name: string): string => {
  if (!name) return "";
  let cleaned = name;
  // 1. Remove parenthesized or bracketed meters, e.g. (4 MTR), (4.5 MTR), (5 METERS), (4.5M), [5 MTR]
  cleaned = cleaned.replace(/\s*[\(\[]\s*\d+(?:\.\d+)?\s*(?:mtrs?|meters?|metres?|m)\.?\s*[\)\]]/gi, "");
  // 2. Remove trailing meters without parens, e.g. " 5 MTR", " - 4.5 MTR", " 5M", " 5 METERS" at end of string
  cleaned = cleaned.replace(/[\s\-_–—,:]+\b\d+(?:\.\d+)?\s*(?:mtrs?|meters?|metres?|m)\.?\s*$/gi, "");
  const trimmed = cleaned.trim();
  return trimmed || name.trim();
};

// Helper for editable quantity input - styled like CartItems.tsx
const BarcodeQuantityInput = ({ value, onChange, className }: { value: number, onChange: (val: number) => void, className?: string }) => {
  const [localVal, setLocalVal] = useState(value.toString());

  useEffect(() => {
    setLocalVal(value.toString());
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    setLocalVal(newVal);
  };

  const handleBlur = () => {
    const p = parseInt(localVal);
    if (isNaN(p) || p < 1) {
      setLocalVal(value.toString());
    } else {
      if (p !== value) onChange(p);
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
      value={localVal}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={cn("w-12 h-8 text-center px-1 mx-1 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none", className)}
    />
  );
};

interface SelectedItemsPanelProps {
  selectedProducts: Record<string, number>;
  products: Product[];
  updateQuantity: (id: string, delta: number) => void;
  setQuantity: (id: string, qty: number) => void;
  toggleProduct: (id: string, force?: boolean) => void;
  clearSelection: () => void;
  totalLabels: number;
}


const SelectedItemsPanel = ({
  selectedProducts,
  products,
  updateQuantity,
  setQuantity,
  toggleProduct,
  clearSelection,
  totalLabels
}: SelectedItemsPanelProps) => {
  const selectedCount = Object.keys(selectedProducts).length;

  return (
    <div className="flex flex-col h-full bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-4 py-3 border-b border-border flex justify-between items-center bg-muted/20 shrink-0">
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm">Print Cart</h3>
          <Badge variant="secondary" className="text-[10px] ml-1">{selectedCount}</Badge>
        </div>
        {selectedCount > 0 && (
          <Button variant="ghost" size="sm" onClick={clearSelection} className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 px-2">
            Clear All
          </Button>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-3 min-h-0 bg-muted/5">
        {selectedCount === 0 ? (
          <div className="text-center py-8 text-muted-foreground flex flex-col items-center gap-2 opacity-60 h-full justify-center">
            <BarcodeIcon className="w-12 h-12 opacity-30 mb-2" />
            <p className="text-sm font-medium">Your cart is empty</p>
            <p className="text-xs">Click products below to add them</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {Object.entries(selectedProducts).map(([id, qty]) => {
              const product = products.find(p => p.id === id);
              const productName = product?.name || "Loading Item...";
              const productSku = product?.sku || id;

              return (
                <div key={id} className="flex flex-col gap-2 p-3 rounded-lg border border-border bg-card shadow-sm text-sm group transition-all hover:border-primary/50">
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate text-xs text-primary" title={productName}>{productName}</div>
                      <div className="text-[10px] text-muted-foreground font-mono truncate mt-0.5">{productSku}</div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-5 w-5 -mt-1 -mr-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0" onClick={() => toggleProduct(id, false)}>
                      <X className="w-3 h-3" />
                    </Button>
                  </div>

                  <div className="flex items-center justify-between mt-1">
                    <div className="text-[10px] text-muted-foreground font-medium">Qty:</div>
                    <div className="flex items-center">
                      <button
                        onClick={() => updateQuantity(id, -1)}
                        className="w-8 h-8 rounded bg-muted border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Minus className="w-3 h-3" />
                      </button>

                      <BarcodeQuantityInput
                        value={qty}
                        onChange={(q) => setQuantity(id, q)}
                        className="w-12 h-8 text-center px-1 mx-1 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none rounded-md border-input"
                      />

                      <button
                        onClick={() => updateQuantity(id, 1)}
                        className="w-8 h-8 rounded bg-muted border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 bg-muted/20 border-t border-border flex justify-between items-center text-sm font-medium shrink-0">
        <span className="text-muted-foreground text-xs">Total Labels</span>
        <span className="text-lg font-bold text-primary">{totalLabels}</span>
      </div>
    </div>
  );
};


const Barcodes = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<Record<string, number>>({});
  const [labelSize, setLabelSize] = useState<LabelSize>("2x1");
  const [printType, setPrintType] = useState<PrintType>("barcode");
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewData, setPreviewData] = useState<{ rows: any[], preset: any } | null>(null);
  const [isMobileSettingsOpen, setIsMobileSettingsOpen] = useState(false);

  const [containerSize, setContainerSize] = useState({ width: 360, height: 210 });
  const containerObserverRef = useRef<ResizeObserver | null>(null);

  const previewContainerRef = useCallback((node: HTMLDivElement | null) => {
    if (containerObserverRef.current) {
      containerObserverRef.current.disconnect();
      containerObserverRef.current = null;
    }
    if (node) {
      const rect = node.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setContainerSize({ width: rect.width, height: rect.height });
      }
      const ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          if (width > 0 && height > 0) {
            setContainerSize({ width, height });
          }
        }
      });
      ro.observe(node);
      containerObserverRef.current = ro;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (containerObserverRef.current) {
        containerObserverRef.current.disconnect();
      }
    };
  }, []);

  const { data: products = [], isLoading } = useProducts();

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const selectedCount = Object.keys(selectedProducts).length;
  const totalLabels = Object.values(selectedProducts).reduce((sum, qty) => sum + qty, 0);

  // Modified: Adds to cart if not present, increments if present
  const addToCart = (id: string) => {
    setSelectedProducts((prev) => {
      const newQty = (prev[id] || 0) + 1;
      return { ...prev, [id]: newQty };
    });
  };

  const toggleProduct = (id: string, forceState?: boolean) => {
    setSelectedProducts((prev) => {
      // Only used for removal now
      const { [id]: _, ...rest } = prev;
      return rest;
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setSelectedProducts((prev) => {
      if (!(id in prev)) return prev;
      const newQty = Math.max(1, Math.min(1000, (prev[id] || 1) + delta));
      return { ...prev, [id]: newQty };
    });
  };

  const setQuantity = (id: string, qty: number) => {
    setSelectedProducts((prev) => {
      if (!(id in prev)) return prev;
      const newQty = Math.max(1, Math.min(1000, qty));
      return { ...prev, [id]: newQty };
    });
  };

  const clearSelection = () => setSelectedProducts({});

  const generateBarcodeSVG = (sku: string): string => {
    const canvas = document.createElement("canvas");
    try {
      JsBarcode(canvas, sku, {
        format: "CODE128", width: 2, height: 35, displayValue: false, margin: 0,
      });
      return canvas.toDataURL("image/png");
    } catch (e) { return ""; }
  };

  const generateQRCode = async (text: string): Promise<string> => {
    try {
      return await QRCode.toDataURL(text, { margin: 0, width: 100, errorCorrectionLevel: 'M' });
    } catch (err) { console.error(err); return ""; }
  };

  const handlePrint = async () => {
    if (selectedCount === 0) {
      toast.error("Please select at least one product");
      return;
    }

    const preset = LABEL_PRESETS[labelSize];
    const labelWidthIn = preset.width;
    const labelHeightIn = preset.height;
    const labelsPerRow = preset.labelsPerRow;
    const pageWidthIn = 4;

    const labelPromises = Object.entries(selectedProducts).flatMap(([id, qty]) => {
      const product = products.find((p) => p.id === id);
      if (!product || !product.sku) return [];
      return Array(qty).fill(null).map(async () => {
        const barcodeImg = printType === "barcode" ? generateBarcodeSVG(product.sku!) : await generateQRCode(product.sku!);
        return {
          name: product.name,
          sku: product.sku,
          meters: product.meters_per_piece,
          barcodeImg
        };
      });
    });

    const allLabelData = await Promise.all(labelPromises);
    const rows: any[] = [];
    for (let i = 0; i < allLabelData.length; i += labelsPerRow) {
      rows.push(allLabelData.slice(i, i + labelsPerRow));
    }

    const printWindow = window.open("", "_blank", "width=800,height=600");
    if (printWindow) {
      const tableRowsHtml = rows.map((row) => {
        const cells = row.map((label: any) => {
          if (printType === "barcode") {
            if (labelWidthIn === 4 && labelHeightIn === 1) {
              const displayName = cleanProductName(label.name);
              const nameFontSize = getSingleLineFontSize(displayName, 30, 12);
              return `<td style="width: ${labelWidthIn}in; height: ${labelHeightIn}in; position: relative; overflow: hidden; padding: 0; box-sizing: border-box;">
                        <!-- Top Row: Product Name -->
                        <div style="position: absolute; left: 0.05in; top: 0; width: 3.9in; height: 0.48in; display: flex; align-items: center; justify-content: center; text-align: center; box-sizing: border-box; padding: 2px;">
                            <div style="width: 100%; font-weight: bold; overflow: hidden; white-space: nowrap; line-height: 1.1; font-size: ${nameFontSize}px;">${displayName}</div>
                        </div>
                        
                        <!-- Solid Horizontal Separator Line -->
                        <div style="position: absolute; left: 0; top: 0.48in; width: ${labelWidthIn}in; height: 1px; border-top: 1.5px solid black;"></div>
                        
                        <!-- Bottom Row Left Column: Cutting (QR-style black pill badge) -->
                        <div style="position: absolute; left: 0.05in; top: 0.48in; width: 1.9in; height: 0.52in; display: flex; align-items: center; justify-content: center; box-sizing: border-box; padding: 2px;">
                            <div style="background-color: black !important; color: white !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; border-radius: 4px; padding: 2px 10px; font-size: clamp(14px, 18px, 22px); font-weight: bold; display: inline-block; box-sizing: border-box; letter-spacing: 0.5px;">${label.meters} MTR</div>
                        </div>
                        
                        <!-- Solid Vertical Separator in Bottom Row -->
                        <div style="position: absolute; left: 2.0in; top: 0.48in; height: 0.52in; width: 1px; border-left: 1.5px solid black;"></div>
                        
                        <!-- Bottom Row Right Column: Barcode Image (No SKU below) -->
                        <div style="position: absolute; right: 0.05in; top: 0.48in; width: 1.9in; height: 0.52in; display: flex; align-items: center; justify-content: center; padding: 3px; box-sizing: border-box;">
                            <img src="${label.barcodeImg}" style="max-width: 100%; max-height: 100%; object-fit: contain;" />
                        </div>
                    </td>`;
            } else {
              return `<td style="width: ${labelWidthIn}in; height: ${labelHeightIn}in; padding: 0.02in; vertical-align: middle; overflow: hidden; container-type: inline-size;">
                        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; gap: 1px;">
                            <div style="font-weight: bold; text-align: center; width: 100%; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; line-height: 1.0; font-size: clamp(6px, 11cqw, 14px); margin-bottom: 3px;">${label.name}</div>
                            <div style="padding: 0 0.15in; width: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                                <img src="${label.barcodeImg}" style="max-width: 100%; height: auto; max-height: 100%; margin: 0; object-fit: contain;" />
                                <div style="font-size: 11px; font-weight: normal; font-family: monospace; margin: 0; padding: 0; line-height: 1; margin-top: 2px;">${label.sku}</div>
                            </div>
                        </div>
                    </td>`;
            }
          } else {
            // 4x1 QR Specific Layout (70/30 Split, Absolute Positioning for Print Stability)
            if (labelWidthIn === 4 && labelHeightIn === 1) {
              return `<td style="width: ${labelWidthIn}in; height: ${labelHeightIn}in; position: relative; overflow: hidden; padding: 0;">
                        <div style="position: absolute; left: 0.05in; top: 0; width: 2.75in; height: 1in; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; border-right: 1px dashed #ccc;">
                            <div style="width: 100%; font-weight: bold; overflow: hidden; line-height: 1.1; font-size: clamp(12px, 18px, 24px); margin-bottom: 2px;">${label.name}</div>
                            <div style="font-size: clamp(12px, 18px, 24px); font-weight: bold;">${label.meters}m</div>
                        </div>
                        <div style="position: absolute; right: 0.05in; top: 0; width: 1.1in; height: 1in; display: flex; align-items: center; justify-content: center; padding: 0.1in;">
                            <img src="${label.barcodeImg}" style="max-width: 100%; max-height: 100%; object-fit: contain;" />
                        </div>
                    </td>`;
            } else {
              // Default/Other QR Layout
              return `<td style="width: ${labelWidthIn}in; height: ${labelHeightIn}in; padding: 0.1in; vertical-align: middle; overflow: hidden; container-type: inline-size;">
                        <div style="display: flex; height: 100%; align-items: center; justify-content: space-between; gap: 0.1in;">
                            <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center; height: 100%; text-align: left; overflow: hidden;">
                                <div style="width: 100%; font-weight: bold; overflow: hidden; line-height: 1.1; font-size: clamp(10px, 5cqw, 18px); margin-bottom: 4px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">${label.name}</div>
                                <div style="font-size: clamp(10px, 4cqw, 14px); font-weight: bold;">${label.meters}m</div>
                            </div>
                            <div style="height: 100%; flex-shrink: 0; aspect-ratio: 1; display: flex; align-items: center; justify-content: center;">
                                <img src="${label.barcodeImg}" style="height: 100%; width: auto; object-fit: contain;" />
                            </div>
                        </div>
                    </td>`;
            }
          }
        }).join('');
        return `<tr>${cells}</tr>`;
      }).join('');

      const pageOrientation = labelsPerRow > 1 ? 'landscape' : 'portrait';
      printWindow.document.write(`<!DOCTYPE html><html><head><title>Labels</title><style>@page{size:${pageWidthIn}in auto ${pageOrientation};margin:0 !important;padding:0 !important;}*{box-sizing:border-box;-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important;color-adjust:exact !important;}html,body{font-family:Arial,sans-serif;margin:0 !important;padding:0 !important;width:${pageWidthIn}in;-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important;color-adjust:exact !important;}table{width:${pageWidthIn}in;table-layout:fixed;border-collapse:collapse;}td{overflow:hidden;}</style></head><body><table cellpadding="0" cellspacing="0">${tableRowsHtml}</table></body></html>`);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 500);
    }
  };


  useEffect(() => {
    const timer = setTimeout(() => {
      if (!selectedCount && !showPreviewModal) return;
      const generatePreview = async () => {
        const preset = LABEL_PRESETS[labelSize];
        const labelsPerRow = preset.labelsPerRow;
        const labelPromises = Object.entries(selectedProducts).flatMap(([id, qty]) => {
          const product = products.find((p) => p.id === id);
          if (!product || !product.sku) return [];
          return Array(qty).fill(null).map(async () => {
            const barcodeImg = printType === "barcode" ? generateBarcodeSVG(product.sku!) : await generateQRCode(product.sku!);
            return { name: product.name, sku: product.sku, price: product.price, meters: product.meters_per_piece, barcodeImg };
          });
        });
        const allLabelData = await Promise.all(labelPromises);
        const rows: any[] = [];
        for (let i = 0; i < allLabelData.length; i += labelsPerRow) rows.push(allLabelData.slice(i, i + labelsPerRow));
        setPreviewData({ rows, preset });
      };
      generatePreview();
    }, 300);
    return () => clearTimeout(timer);
  }, [selectedProducts, labelSize, printType, products]);


  const VisualLabelSelector = () => (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
      {Object.entries(LABEL_PRESETS).map(([key, preset]) => {
        const isActive = labelSize === key;
        const aspectRatio = preset.width / preset.height;
        return (
          <button
            key={key}
            onClick={() => setLabelSize(key as LabelSize)}
            className={cn(
              "relative flex flex-col items-center justify-center p-2 rounded-lg border-2 transition-all group",
              isActive
                ? "border-primary bg-primary/10"
                : "border-muted bg-card hover:border-primary/50 hover:bg-primary/5"
            )}
          >
            <div
              className={cn(
                "border-2 mb-2 transition-colors",
                isActive
                  ? "border-primary/50 bg-primary/20"
                  : "border-muted-foreground/20 bg-muted/30 group-hover:border-primary/50 group-hover:bg-primary/10"
              )}
              style={{
                width: '40px',
                height: `${40 / aspectRatio}px`,
              }}
            />
            <span className={cn(
              "text-[10px] font-medium leading-tight text-center transition-colors",
              isActive
                ? "text-primary font-bold"
                : "text-muted-foreground group-hover:text-primary"
            )}>
              {preset.name}
            </span>
          </button>
        );
      })}
    </div>
  );

  const SettingsPanel = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-sm font-medium">Print Type</Label>
        <RadioGroup value={printType} onValueChange={(v) => setPrintType(v as PrintType)} className="grid grid-cols-2 gap-2">
          <Label htmlFor="type-barcode-d" className={cn("flex items-center justify-center gap-2 rounded-xl border-2 bg-transparent p-2 hover:bg-accent hover:text-accent-foreground cursor-pointer transition-all", printType === "barcode" ? "border-primary bg-primary/5 text-primary" : "border-muted")}>
            <RadioGroupItem value="barcode" id="type-barcode-d" className="sr-only" />
            <BarcodeIcon className="h-4 w-4" />
            <span className="text-xs font-semibold">Barcode</span>
          </Label>
          <Label htmlFor="type-qrcode-d" className={cn("flex items-center justify-center gap-2 rounded-xl border-2 bg-transparent p-2 hover:bg-accent hover:text-accent-foreground cursor-pointer transition-all", printType === "qrcode" ? "border-primary bg-primary/5 text-primary" : "border-muted")}>
            <RadioGroupItem value="qrcode" id="type-qrcode-d" className="sr-only" />
            <QrCode className="h-4 w-4" />
            <span className="text-xs font-semibold">QR Code</span>
          </Label>
        </RadioGroup>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <Label className="text-sm font-medium">Label Size</Label>
          <Badge variant="outline" className="text-[10px] font-normal">TSC TTP 244</Badge>
        </div>
        <VisualLabelSelector />
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-theme(spacing.16))] flex flex-col gap-4 p-4 lg:p-6 overflow-hidden">

      {/* HEADER (Top Level) */}
      <div className="shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Label Printing</h1>
          <p className="text-sm text-muted-foreground">Select products and generate barcodes or QR codes</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0">

        {/* LEFT PANEL: Settings, Preview, Product List */}
        <div className="flex-1 flex flex-col min-h-0 gap-4 overflow-hidden">

          {/* TOP ROW: Settings & Live Preview (Side-by-Side) */}
          <div className="shrink-0 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-card rounded-2xl border border-border shadow-sm p-4 h-[280px] overflow-y-auto">
              <h3 className="font-semibold mb-3 flex items-center gap-2 text-sm">
                <Settings2 className="w-4 h-4 text-primary" />
                Label Settings
              </h3>
              <SettingsPanel />
            </div>

            <div className="bg-card rounded-2xl border border-border shadow-sm p-4 flex flex-col h-[280px]">
              <h3 className="font-semibold mb-3 flex items-center gap-2 text-sm">
                <Eye className="w-4 h-4 text-primary" />
                Live Preview
              </h3>
              <div ref={previewContainerRef} className="flex-1 bg-muted/30 rounded-xl border-2 border-dashed border-border flex items-center justify-center relative overflow-hidden group">
                {previewData && previewData.rows.length > 0 && previewData.rows[0].length > 0 ? (
                  (() => {
                    const label = previewData.rows[0][0];
                    const { preset } = previewData;
                    const labelWidth = preset.width * 100;
                    const labelHeight = preset.height * 100;
                    const availableWidth = Math.max(containerSize.width - 24, 100);
                    const availableHeight = Math.max(containerSize.height - 24, 80);
                    const scaleX = availableWidth / labelWidth;
                    const scaleY = availableHeight / labelHeight;
                    const baseScale = Math.max(0.4, Math.min(scaleX, scaleY, 1));
                    const hoverScale = baseScale * 1.08;
                    return (
                      <div 
                        className="flex items-center justify-center"
                        style={{
                          width: `${labelWidth * baseScale}px`,
                          height: `${labelHeight * baseScale}px`,
                          flexShrink: 0,
                        }}
                      >
                        <div 
                          className="transition-transform duration-200 shadow-md rounded-md overflow-hidden bg-white origin-center"
                          style={{
                            width: `${labelWidth}px`,
                            height: `${labelHeight}px`,
                            transform: `scale(var(--preview-scale, ${baseScale}))`,
                            '--preview-scale': baseScale,
                            flexShrink: 0,
                          } as React.CSSProperties}
                          onMouseEnter={(e) => e.currentTarget.style.setProperty('--preview-scale', String(hoverScale))}
                          onMouseLeave={(e) => e.currentTarget.style.setProperty('--preview-scale', String(baseScale))}
                        >
                          <div className="bg-white border border-gray-200 overflow-hidden h-full w-full relative"
                            style={{
                              containerType: 'inline-size'
                            }}>
                          {printType === "barcode" ? (
                            preset.width === 4 && preset.height === 1 ? (
                              (() => {
                                const displayName = cleanProductName(label.name);
                                return (
                                  <div style={{ position: 'absolute', left: '0', top: '0', width: '100%', height: '100%', boxSizing: 'border-box' }}>
                                    {/* Top Row: Product Name */}
                                    <div style={{ position: 'absolute', left: '5px', top: '0', width: '390px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', boxSizing: 'border-box', padding: '2px' }}>
                                      <div style={{ width: '100%', fontWeight: 'bold', overflow: 'hidden', whiteSpace: 'nowrap', lineHeight: 1.1, fontSize: `${getSingleLineFontSize(displayName, 26, 9)}px` }}>{displayName}</div>
                                    </div>
                                    
                                    {/* Solid Horizontal Separator Line */}
                                    <div style={{ position: 'absolute', left: '0', top: '48px', right: '0', height: '1px', borderTop: '1.5px solid black' }}></div>
                                    
                                    {/* Bottom Row Left Column: Cutting Black Pill Badge */}
                                    <div style={{ position: 'absolute', left: '5px', top: '48px', width: '190px', height: '52px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', padding: '2px' }}>
                                      <div style={{ backgroundColor: 'black', color: 'white', borderRadius: '4px', padding: '2px 10px', fontSize: 'clamp(12px, 10cqw, 18px)', fontWeight: 'bold', display: 'inline-block', boxSizing: 'border-box', letterSpacing: '0.5px' }}>{label.meters} MTR</div>
                                    </div>
                                    
                                    {/* Solid Vertical Separator in Bottom Row */}
                                    <div style={{ position: 'absolute', left: '200px', top: '48px', height: '52px', width: '1px', borderLeft: '1.5px solid black' }}></div>
                                    
                                    {/* Bottom Row Right Column: Barcode Image (No SKU) */}
                                    <div style={{ position: 'absolute', right: '5px', top: '48px', width: '190px', height: '52px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px', boxSizing: 'border-box' }}>
                                      <img src={label.barcodeImg} alt="Barcode" style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
                                    </div>
                                  </div>
                                );
                              })()
                            ) : (
                              <div style={{ position: 'absolute', left: '0', top: '0', width: '100%', height: '100%', boxSizing: 'border-box' }}>
                                <div style={{ position: 'absolute', left: '0', top: '0', right: '0', bottom: '0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1px', boxSizing: 'border-box', padding: '4px' }}>
                                  <div style={{ fontWeight: 'bold', textAlign: 'center', width: '100%', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: 1.0, fontSize: 'clamp(8px, 11cqw, 16px)', marginBottom: '3px' }}>{label.name}</div>
                                  <div style={{ padding: '0 15px', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' }}>
                                    <img src={label.barcodeImg} alt="Barcode" className="max-w-[100%] h-auto" style={{ maxHeight: '100%', objectFit: 'contain', margin: 0 }} />
                                    <div style={{ fontSize: '11px', fontWeight: 'normal', fontFamily: 'monospace', margin: 0, padding: 0, lineHeight: 1, marginTop: '2px' }}>{label.sku}</div>
                                  </div>
                                </div>
                              </div>
                            )
                          ) : (
                            <div className="flex h-full items-center">
                              <div style={{ width: '60%', paddingRight: '2px', display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
                                <div style={{ width: '100%', fontWeight: 'bold', overflow: 'hidden', lineHeight: 1.1, fontSize: 'clamp(10px, 16cqw, 20px)', marginBottom: '4px' }}>{label.name}</div>
                                <div style={{ fontSize: 'clamp(10px, 8cqw, 16px)', fontWeight: 'bold' }}>{label.meters}m</div>
                              </div>
                              <div style={{ width: '40%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2px', height: '100%' }}>
                                <img src={label.barcodeImg} alt="QR" className="max-w-full max-h-full w-auto h-auto object-contain" />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()
              ) : (
                  <div className="text-center p-4">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mx-auto mb-2">
                      <Printer className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <p className="text-xs text-muted-foreground">Select products to see preview</p>
                  </div>
                )}
                {selectedCount > 0 && (
                  <Button variant="secondary" size="sm" className="absolute bottom-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm" onClick={() => setShowPreviewModal(true)}>
                    Expand
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* BOTTOM ROW: Product List */}
          <div className="flex-1 flex flex-col min-h-0 bg-card rounded-2xl border border-border shadow-sm overflow-hidden">

            {/* Header */}
            <div className="p-3 border-b border-border space-y-2 shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search to add products..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 bg-muted/30" />
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-auto">
              {/* Mobile Cards */}
              <div className="lg:hidden p-4 space-y-3 pb-24">
                {filteredProducts.map((product) => {
                  const isSelected = product.id in selectedProducts;
                  const qty = selectedProducts[product.id] || 0;
                  return (
                    <div key={product.id} className={cn("group rounded-xl border p-4 transition-all duration-300 active:scale-[0.98]", isSelected ? "border-primary bg-primary/5" : "border-border bg-card",)} onClick={() => addToCart(product.id)} >
                      <div className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className={cn("font-medium truncate", isSelected ? "text-primary" : "text-foreground")}>{product.name}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                            <span className="font-mono bg-muted px-1 rounded">{product.sku}</span>
                            <span>•</span>
                            <span>{product.meters_per_piece}m</span>
                          </div>
                        </div>
                        {isSelected && (
                          <Badge className="bg-primary text-primary-foreground">{qty}</Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Table */}
              <div className="hidden lg:block">
                <Table>
                  <TableHeader className="bg-muted/50 sticky top-0 z-10">
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Details</TableHead>
                      <TableHead className="w-24 text-right">QTY</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.map((product) => {
                      const isSelected = product.id in selectedProducts;
                      const qty = selectedProducts[product.id] || 0;
                      return (
                        <TableRow key={product.id} className={cn("cursor-pointer transition-colors hover:bg-muted/50 select-none", isSelected && "bg-primary/5 hover:bg-primary/10")} onClick={() => addToCart(product.id)}>
                          <TableCell>
                            <div className="font-medium text-sm">{product.name}</div>
                            <div className="text-xs text-muted-foreground mt-1 font-mono">{product.sku}</div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="font-normal">{product.meters_per_piece}m</Badge>
                              <span className="text-sm text-muted-foreground">Rs. {product.price.toLocaleString()}/m</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {isSelected ? (
                              <Badge variant="default" className="ml-auto inline-flex">{qty}</Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm font-medium mr-2">0</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </div>


        {/* RIGHT PANEL - Print Cart (Vertical Stack) */}
        <div className="hidden lg:flex flex-col w-[35%] shrink-0 gap-4 h-full">
          <SelectedItemsPanel
            selectedProducts={selectedProducts}
            products={products}
            updateQuantity={updateQuantity}
            setQuantity={setQuantity}
            toggleProduct={toggleProduct}
            clearSelection={clearSelection}
            totalLabels={totalLabels}
          />

          <Button className="w-full shrink-0" size="lg" disabled={selectedCount === 0} onClick={handlePrint}>
            <Printer className="w-6 h-6 mr-2" />
            Print Now
          </Button>
        </div>
      </div>

      {/* MOBILE BOTTOM ACTION BAR */}
      <div className="lg:hidden fixed bottom-6 left-4 right-4 z-50">
        <div className="bg-foreground/95 backdrop-blur-md text-background rounded-full p-2 pl-5 shadow-xl flex items-center justify-between border border-white/10">
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Selected</span>
            <span className="font-bold">{totalLabels} Labels</span>
          </div>
          <div className="flex items-center gap-2">
            <Drawer open={isMobileSettingsOpen} onOpenChange={setIsMobileSettingsOpen}>
              <DrawerTrigger asChild>
                <Button variant="secondary" size="icon" className="rounded-full h-10 w-10">
                  <Settings2 className="w-5 h-5" />
                </Button>
              </DrawerTrigger>
              <DrawerContent>
                <DrawerHeader className="text-left">
                  <DrawerTitle>Print Settings</DrawerTitle>
                  <DrawerDescription>Configure label size and type.</DrawerDescription>
                </DrawerHeader>
                <div className="p-4 pt-0">
                  <div className="max-h-[300px] overflow-y-auto p-1">
                    <SelectedItemsPanel
                      selectedProducts={selectedProducts}
                      products={products}
                      updateQuantity={updateQuantity}
                      setQuantity={setQuantity}
                      toggleProduct={toggleProduct}
                      clearSelection={clearSelection}
                      totalLabels={totalLabels}
                    />
                  </div>
                  <div className="mt-4">
                    <SettingsPanel />
                  </div>

                  <Button className="w-full mt-6" size="lg" onClick={() => { setIsMobileSettingsOpen(false); handlePrint(); }}>
                    <Printer className="w-5 h-5 mr-2" />
                    Print Now
                  </Button>
                </div>
              </DrawerContent>
            </Drawer>

            <Button size="lg" className="rounded-full px-6 bg-primary text-primary-foreground hover:bg-primary/90" onClick={handlePrint} disabled={selectedCount === 0}>
              Print
            </Button>
          </div>
        </div>
      </div>

      {/* Full Preview Modal */}
      <Dialog open={showPreviewModal} onOpenChange={setShowPreviewModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Print Preview - {printType === "barcode" ? "Standard Barcode" : "QR Code"}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-auto py-4">
            <div className="mb-4 text-center text-sm text-muted-foreground">Scale: 100px = 1 inch | Roll Width: 4 inches</div>
            <div className="mx-auto bg-muted/50 border-2 border-dashed border-muted-foreground/30 rounded-lg p-2" style={{ width: '416px' }}>
              {previewData && (() => {
                const { rows, preset } = previewData;
                const labelWidthPx = preset.width * 100;
                const labelHeightPx = preset.height * 100;
                return rows.map((row, rowIndex) => (
                  <div key={rowIndex} className="relative">
                    <div className="absolute -left-8 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-mono">R{rowIndex + 1}</div>
                    <div className="flex" style={{ gap: '0px' }}>
                      {row.map((label: any, labelIndex: number) => (
                        <div key={labelIndex} className="bg-white border border-gray-200 overflow-hidden" style={{ width: `${labelWidthPx}px`, height: `${labelHeightPx}px`, padding: '0', display: 'block', position: 'relative', containerType: 'inline-size' }}>
                          {printType === "barcode" ? (
                            preset.width === 4 && preset.height === 1 ? (
                              (() => {
                                const displayName = cleanProductName(label.name);
                                return (
                                  <div style={{ position: 'absolute', left: '0', top: '0', width: '100%', height: '100%', boxSizing: 'border-box' }}>
                                    {/* Top Row: Product Name */}
                                    <div style={{ position: 'absolute', left: '5px', top: '0', width: '390px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', boxSizing: 'border-box', padding: '2px' }}>
                                      <div style={{ width: '100%', fontWeight: 'bold', overflow: 'hidden', whiteSpace: 'nowrap', lineHeight: 1.1, fontSize: `${getSingleLineFontSize(displayName, 26, 9)}px` }}>{displayName}</div>
                                    </div>
                                    
                                    {/* Solid Horizontal Separator Line */}
                                    <div style={{ position: 'absolute', left: '0', top: '48px', right: '0', height: '1px', borderTop: '1.5px solid black' }}></div>
                                    
                                    {/* Bottom Row Left Column: Cutting Black Pill Badge */}
                                    <div style={{ position: 'absolute', left: '5px', top: '48px', width: '190px', height: '52px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', padding: '2px' }}>
                                      <div style={{ backgroundColor: 'black', color: 'white', borderRadius: '4px', padding: '2px 10px', fontSize: 'clamp(12px, 10cqw, 18px)', fontWeight: 'bold', display: 'inline-block', boxSizing: 'border-box', letterSpacing: '0.5px' }}>{label.meters} MTR</div>
                                    </div>
                                    
                                    {/* Solid Vertical Separator in Bottom Row */}
                                    <div style={{ position: 'absolute', left: '200px', top: '48px', height: '52px', width: '1px', borderLeft: '1.5px solid black' }}></div>
                                    
                                    {/* Bottom Row Right Column: Barcode Image (No SKU) */}
                                    <div style={{ position: 'absolute', right: '5px', top: '48px', width: '190px', height: '52px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px', boxSizing: 'border-box' }}>
                                      <img src={label.barcodeImg} alt="Barcode" style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
                                    </div>
                                  </div>
                                );
                              })()
                            ) : (
                              <div style={{ position: 'absolute', left: '0', top: '0', width: '100%', height: '100%', boxSizing: 'border-box' }}>
                                <div style={{ position: 'absolute', left: '4px', top: '4px', right: '4px', bottom: '4px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1px', boxSizing: 'border-box', padding: '2px' }}>
                                  <div style={{ fontWeight: 'bold', textAlign: 'center', width: '100%', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: 1.1, fontSize: 'clamp(10px, 11cqw, 18px)' }}>{label.name}</div>
                                  <div className="flex flex-col items-center" style={{ gap: '0px' }}>
                                    <img src={label.barcodeImg} alt="Barcode" className="max-w-[95%] h-auto" style={{ maxHeight: '55%', objectFit: 'contain', margin: 0 }} />
                                    <div style={{ fontSize: '9px', fontWeight: 'normal', fontFamily: 'monospace', margin: 0, padding: 0 }}>{label.sku}</div>
                                  </div>
                                </div>
                              </div>
                            )
                          ) : (
                            <div className="flex h-full items-center">
                              <div style={{ width: '60%', paddingRight: '2px', display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
                                <div style={{ width: '100%', fontWeight: 'bold', overflow: 'hidden', lineHeight: 1.1, fontSize: 'clamp(10px, 16cqw, 20px)', marginBottom: '4px' }}>{label.name}</div>
                                <div style={{ fontSize: 'clamp(10px, 8cqw, 16px)', fontWeight: 'bold' }}>{label.meters}m</div>
                              </div>
                              <div style={{ width: '40%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2px', height: '100%' }}>
                                <img src={label.barcodeImg} alt="QR" className="max-w-full max-h-full w-auto h-auto object-contain" />
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    {rowIndex < rows.length - 1 && <div className="border-t border-dashed border-primary/50 my-1 relative"><span className="absolute right-0 -top-2 text-[8px] text-primary bg-background px-1">cut</span></div>}
                  </div>
                ));
              })()}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreviewModal(false)}>Close</Button>
            <Button onClick={() => { setShowPreviewModal(false); handlePrint(); }}><Printer className="w-4 h-4 mr-2" />Print Labels</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Barcodes;
