import React, { useState, useRef, useEffect, MouseEvent } from "react";
import { cn } from "@/lib/utils";
import {
  Printer, Type, Barcode as BarcodeIcon, QrCode, Square,
  Circle, Minus, Plus, Trash2, Settings2, Move, AlignCenter, AlignLeft, AlignRight, AlignJustify, ZoomIn, ZoomOut, Eye, Tag
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Search, Loader2, ChevronsUpDown, ShoppingBag } from "lucide-react";
import CustomerDetails, { Customer } from "@/components/sales/CustomerDetails";
import JsBarcode from "jsbarcode";
import QRCode from "qrcode";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

export interface OnlineOrder {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone?: string | null;
  shipping_address?: string | null;
  city?: string | null;
  created_at?: string;
}

const PX_PER_INCH = 100;

const LABEL_PRESETS = {
  "2x1": { width: 2, height: 1, name: "2\" × 1\"", labelsPerRow: 2 },
  "4x1": { width: 4, height: 1, name: "4\" × 1\"", labelsPerRow: 1 },
  "4x2": { width: 4, height: 2, name: "4\" × 2\"", labelsPerRow: 1 },
} as const;

type LabelSize = keyof typeof LABEL_PRESETS;
type ElementType = "text" | "barcode" | "qrcode" | "rect" | "circle";

interface LabelElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  value?: string;
  fontSize?: number;
  fontWeight?: "normal" | "bold";
  fontFamily?: string;
  textAlign?: "left" | "center" | "right" | "justify";
  borderWidth?: number;
  borderRadius?: number;
  displayValue?: boolean;
  imgData?: string; // Cache for barcode/QR
}

interface SnapLine {
  id: string;
  axis: "x" | "y";
  pos: number;
}

const CustomLabels = () => {
  const [labelSize, setLabelSize] = useState<LabelSize>("2x1");
  const [elements, setElements] = useState<LabelElement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [snapLines, setSnapLines] = useState<SnapLine[]>([]);
  const [zoom, setZoom] = useState(2);
  const [printQuantity, setPrintQuantity] = useState(1);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [labelMode, setLabelMode] = useState<"custom" | "preset">("custom");
  const [presetTemplate, setPresetTemplate] = useState("address");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedOnlineOrder, setSelectedOnlineOrder] = useState<OnlineOrder | null>(null);
  const [onlineOrders, setOnlineOrders] = useState<OnlineOrder[]>([]);
  const [orderSearchQuery, setOrderSearchQuery] = useState("");
  const [isFetchingOrders, setIsFetchingOrders] = useState(false);
  const [openOrderPopover, setOpenOrderPopover] = useState(false);
  const [priceTagName, setPriceTagName] = useState("");
  const [priceTagPrice, setPriceTagPrice] = useState("");
  
  const [activeTool, setActiveTool] = useState<ElementType | null>(null);
  const [isDrawingElementId, setIsDrawingElementId] = useState<string | null>(null);
  const [drawStartPoint, setDrawStartPoint] = useState<{ x: number, y: number } | null>(null);

  const [editingElementId, setEditingElementId] = useState<string | null>(null);

  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const [initialResizeState, setInitialResizeState] = useState<{x: number, y: number, w: number, h: number, ptrX: number, ptrY: number} | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);

  const canvasWidth = LABEL_PRESETS[labelSize].width * PX_PER_INCH;
  const canvasHeight = LABEL_PRESETS[labelSize].height * PX_PER_INCH;

  const selectedElement = elements.find(e => e.id === selectedId);

  // Generate Barcode/QR
  const generateImg = async (type: ElementType, value: string, displayValue?: boolean): Promise<string> => {
    if (type === "barcode") {
      const canvas = document.createElement("canvas");
      try {
        JsBarcode(canvas, value || "123456", {
          format: "CODE128", displayValue: !!displayValue, margin: 0, width: 2, height: 40, fontSize: 16
        });
        return canvas.toDataURL("image/png");
      } catch (e) { return ""; }
    } else if (type === "qrcode") {
      try {
        return await QRCode.toDataURL(value || "123456", { margin: 0, width: 100, errorCorrectionLevel: 'M' });
      } catch (e) { return ""; }
    }
    return "";
  };

  const updateElementImg = async (id: string, type: ElementType, value: string, displayValue?: boolean) => {
    if (type !== "barcode" && type !== "qrcode") return;
    const imgData = await generateImg(type, value, displayValue);
    setElements(prev => prev.map(e => e.id === id ? { ...e, imgData } : e));
  };

  const handleCanvasPointerDown = (e: React.PointerEvent) => {
    if (!activeTool) return;
    e.stopPropagation();

    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!canvasRect) return;

    const startX = (e.clientX - canvasRect.left) / zoom;
    const startY = (e.clientY - canvasRect.top) / zoom;

    const id = Math.random().toString(36).substr(2, 9);
    
    const newElement: LabelElement = {
      id,
      type: activeTool,
      x: startX,
      y: startY,
      width: 0,
      height: 0,
      value: activeTool === "text" ? "Double click to edit" : activeTool === "barcode" || activeTool === "qrcode" ? "12345678" : undefined,
      fontSize: 14,
      fontWeight: "normal",
      fontFamily: "Arial",
      textAlign: "center",
      displayValue: false,
      borderWidth: activeTool === "rect" || activeTool === "circle" ? 2 : 0,
      borderRadius: activeTool === "circle" ? 50 : 0
    };

    setElements(prev => [...prev, newElement]);
    setIsDrawingElementId(id);
    setDrawStartPoint({ x: startX, y: startY });
    setSelectedId(id);

    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const updateSelected = (updates: Partial<LabelElement>) => {
    if (!selectedId) return;
    setElements(elements.map(e => {
      if (e.id === selectedId) {
        const updated = { ...e, ...updates };
        if ((updates.value !== undefined || updates.displayValue !== undefined) && (updated.type === "barcode" || updated.type === "qrcode")) {
          // Fire and forget image update
          updateElementImg(selectedId, updated.type, updated.value || "", updated.displayValue);
        }
        return updated;
      }
      return e;
    }));
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    setElements(elements.filter(e => e.id !== selectedId));
    setSelectedId(null);
  };

  // --- DRAG & SNAP LOGIC ---
  const SNAP_THRESHOLD = 5;

  const handlePointerDown = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    setSelectedId(id);
    const target = e.currentTarget as HTMLElement;
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!canvasRect) return;

    const el = elements.find(el => el.id === id);
    if (!el) return;

    // Calculate offset from mouse to top-left of element
    const offsetX = (e.clientX - canvasRect.left) / zoom - el.x;
    const offsetY = (e.clientY - canvasRect.top) / zoom - el.y;

    setDragOffset({ x: offsetX, y: offsetY });
    setIsDragging(true);
    
    // Capture pointer to track outside canvas
    target.setPointerCapture(e.pointerId);
  };

  const handleResizeStart = (e: React.PointerEvent, handle: string) => {
    e.stopPropagation();
    if (!selectedId) return;
    const el = elements.find(el => el.id === selectedId);
    if (!el) return;

    setIsResizing(true);
    setResizeHandle(handle);
    setInitialResizeState({
      x: el.x, y: el.y, w: el.width, h: el.height,
      ptrX: e.clientX, ptrY: e.clientY
    });
    
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isDrawingElementId && drawStartPoint && canvasRef.current) {
      const canvasRect = canvasRef.current.getBoundingClientRect();
      const currentX = (e.clientX - canvasRect.left) / zoom;
      const currentY = (e.clientY - canvasRect.top) / zoom;

      const newW = Math.abs(currentX - drawStartPoint.x);
      const newH = Math.abs(currentY - drawStartPoint.y);
      const newX = Math.min(currentX, drawStartPoint.x);
      const newY = Math.min(currentY, drawStartPoint.y);

      setElements(prev => prev.map(el => 
        el.id === isDrawingElementId ? { ...el, x: newX, y: newY, width: newW, height: newH } : el
      ));
      return;
    }

    if (isResizing && selectedId && initialResizeState && resizeHandle) {
      const deltaX = (e.clientX - initialResizeState.ptrX) / zoom;
      const deltaY = (e.clientY - initialResizeState.ptrY) / zoom;
      
      let newX = initialResizeState.x;
      let newY = initialResizeState.y;
      let newW = initialResizeState.w;
      let newH = initialResizeState.h;

      if (resizeHandle.includes('left')) {
        newX = initialResizeState.x + deltaX;
        newW = initialResizeState.w - deltaX;
      }
      if (resizeHandle.includes('right')) {
        newW = initialResizeState.w + deltaX;
      }
      if (resizeHandle.includes('top')) {
        newY = initialResizeState.y + deltaY;
        newH = initialResizeState.h - deltaY;
      }
      if (resizeHandle.includes('bottom')) {
        newH = initialResizeState.h + deltaY;
      }

      // Enforce minimum dimensions
      const minSize = 10;
      if (newW < minSize) {
        if (resizeHandle.includes('left')) newX -= (minSize - newW);
        newW = minSize;
      }
      if (newH < minSize) {
        if (resizeHandle.includes('top')) newY -= (minSize - newH);
        newH = minSize;
      }

      updateSelected({ x: Math.round(newX), y: Math.round(newY), width: Math.round(newW), height: Math.round(newH) });
      return;
    }

    if (!isDragging || !selectedId || !canvasRef.current) return;

    const canvasRect = canvasRef.current.getBoundingClientRect();
    let newX = (e.clientX - canvasRect.left) / zoom - dragOffset.x;
    let newY = (e.clientY - canvasRect.top) / zoom - dragOffset.y;

    const el = elements.find(el => el.id === selectedId);
    if (!el) return;

    const activeSnapLines: SnapLine[] = [];

    // Snapping Logic
    // Center points of dragging element
    const elCenterX = newX + el.width / 2;
    const elCenterY = newY + el.height / 2;
    const elRight = newX + el.width;
    const elBottom = newY + el.height;

    // 1. Snap to Canvas
    const canvasCenterX = canvasWidth / 2;
    const canvasCenterY = canvasHeight / 2;

    if (Math.abs(elCenterX - canvasCenterX) < SNAP_THRESHOLD) {
      newX = canvasCenterX - el.width / 2;
      activeSnapLines.push({ id: 'cx', axis: 'x', pos: canvasCenterX });
    }
    if (Math.abs(elCenterY - canvasCenterY) < SNAP_THRESHOLD) {
      newY = canvasCenterY - el.height / 2;
      activeSnapLines.push({ id: 'cy', axis: 'y', pos: canvasCenterY });
    }
    // Snap to Canvas Edges
    if (Math.abs(newX) < SNAP_THRESHOLD) { newX = 0; activeSnapLines.push({ id: 'cl', axis: 'x', pos: 0 }); }
    if (Math.abs(newY) < SNAP_THRESHOLD) { newY = 0; activeSnapLines.push({ id: 'ct', axis: 'y', pos: 0 }); }
    if (Math.abs(elRight - canvasWidth) < SNAP_THRESHOLD) { newX = canvasWidth - el.width; activeSnapLines.push({ id: 'cr', axis: 'x', pos: canvasWidth }); }
    if (Math.abs(elBottom - canvasHeight) < SNAP_THRESHOLD) { newY = canvasHeight - el.height; activeSnapLines.push({ id: 'cb', axis: 'y', pos: canvasHeight }); }

    // 2. Snap to Other Elements
    elements.forEach(other => {
      if (other.id === selectedId) return;

      const otherCenterX = other.x + other.width / 2;
      const otherCenterY = other.y + other.height / 2;
      const otherRight = other.x + other.width;
      const otherBottom = other.y + other.height;

      // X-Axis Snapping
      if (Math.abs(newX - other.x) < SNAP_THRESHOLD) { newX = other.x; activeSnapLines.push({ id: `x-l-${other.id}`, axis: 'x', pos: other.x }); }
      else if (Math.abs(elRight - right(other)) < SNAP_THRESHOLD) { newX = right(other) - el.width; activeSnapLines.push({ id: `x-r-${other.id}`, axis: 'x', pos: right(other) }); }
      else if (Math.abs(elCenterX - otherCenterX) < SNAP_THRESHOLD) { newX = otherCenterX - el.width / 2; activeSnapLines.push({ id: `x-c-${other.id}`, axis: 'x', pos: otherCenterX }); }
      else if (Math.abs(newX - right(other)) < SNAP_THRESHOLD) { newX = right(other); activeSnapLines.push({ id: `x-lr-${other.id}`, axis: 'x', pos: right(other) }); }
      else if (Math.abs(elRight - other.x) < SNAP_THRESHOLD) { newX = other.x - el.width; activeSnapLines.push({ id: `x-rl-${other.id}`, axis: 'x', pos: other.x }); }

      // Y-Axis Snapping
      if (Math.abs(newY - other.y) < SNAP_THRESHOLD) { newY = other.y; activeSnapLines.push({ id: `y-t-${other.id}`, axis: 'y', pos: other.y }); }
      else if (Math.abs(elBottom - bottom(other)) < SNAP_THRESHOLD) { newY = bottom(other) - el.height; activeSnapLines.push({ id: `y-b-${other.id}`, axis: 'y', pos: bottom(other) }); }
      else if (Math.abs(elCenterY - otherCenterY) < SNAP_THRESHOLD) { newY = otherCenterY - el.height / 2; activeSnapLines.push({ id: `y-c-${other.id}`, axis: 'y', pos: otherCenterY }); }
      else if (Math.abs(newY - bottom(other)) < SNAP_THRESHOLD) { newY = bottom(other); activeSnapLines.push({ id: `y-tb-${other.id}`, axis: 'y', pos: bottom(other) }); }
      else if (Math.abs(elBottom - other.y) < SNAP_THRESHOLD) { newY = other.y - el.height; activeSnapLines.push({ id: `y-bt-${other.id}`, axis: 'y', pos: other.y }); }
    });

    setSnapLines(activeSnapLines);
    updateSelected({ x: Math.round(newX), y: Math.round(newY) });
  };

  const handlePointerUp = async (e: React.PointerEvent) => {
    if (isDrawingElementId) {
      const el = elements.find(el => el.id === isDrawingElementId);
      if (el) {
        let finalEl = el;
        if (el.width < 10 || el.height < 10) {
          const defaultW = el.type === "barcode" ? 120 : el.type === "qrcode" ? 60 : el.type === "circle" ? 40 : 80;
          const defaultH = el.type === "barcode" ? 40 : el.type === "qrcode" ? 60 : el.type === "circle" ? 40 : 30;
          finalEl = { ...el, width: defaultW, height: defaultH };
          setElements(prev => prev.map(e => e.id === isDrawingElementId ? finalEl : e));
        }

        if (finalEl.type === "barcode" || finalEl.type === "qrcode") {
          const imgData = await generateImg(finalEl.type, finalEl.value!, finalEl.displayValue);
          setElements(prev => prev.map(e => e.id === isDrawingElementId ? { ...e, imgData } : e));
        }
      }
      setIsDrawingElementId(null);
      setDrawStartPoint(null);
      setActiveTool(null);
    }

    setIsDragging(false);
    setIsResizing(false);
    setResizeHandle(null);
    setInitialResizeState(null);
    setSnapLines([]);
    const target = e.currentTarget as HTMLElement;
    if (target.hasPointerCapture(e.pointerId)) {
      target.releasePointerCapture(e.pointerId);
    }
  };

  const right = (el: LabelElement) => el.x + el.width;
  const bottom = (el: LabelElement) => el.y + el.height;

  // --- PRESET LOGIC ---
  const fetchOnlineOrders = async (query?: string) => {
    try {
      setIsFetchingOrders(true);
      let req = supabase
        .from("online_orders")
        .select("id, order_number, customer_name, customer_phone, shipping_address, city, created_at")
        .order("created_at", { ascending: false })
        .limit(50);

      if (query && query.trim()) {
        const q = `%${query.trim()}%`;
        req = req.or(`order_number.ilike.${q},customer_name.ilike.${q},customer_phone.ilike.${q}`);
      }

      const { data, error } = await req;
      if (error) throw error;
      setOnlineOrders(data || []);
    } catch (err: any) {
      console.error("Error fetching online orders:", err);
    } finally {
      setIsFetchingOrders(false);
    }
  };

  useEffect(() => {
    if (presetTemplate === "online-address" && labelMode === "preset") {
      fetchOnlineOrders();
    }
  }, [presetTemplate, labelMode]);

  const handleOnlineOrderSelect = (order: OnlineOrder) => {
    setSelectedOnlineOrder(order);
    if (!order) return;

    setLabelMode("preset");
    setLabelSize("4x2");

    const newElements: LabelElement[] = [
      {
        id: crypto.randomUUID(),
        type: "text",
        x: 20,
        y: 20,
        width: 360,
        height: 35,
        value: order.customer_name || "Customer Name",
        fontSize: 24,
        fontWeight: "bold",
        fontFamily: "Arial",
        textAlign: "left",
      },
      {
        id: crypto.randomUUID(),
        type: "text",
        x: 20,
        y: 60,
        width: 360,
        height: 60,
        value: order.shipping_address || "Address not provided",
        fontSize: 16,
        fontWeight: "normal",
        fontFamily: "Arial",
        textAlign: "left",
      },
      {
        id: crypto.randomUUID(),
        type: "text",
        x: 20,
        y: 130,
        width: 170,
        height: 30,
        value: order.customer_phone ? `Ph: ${order.customer_phone}` : "Ph: N/A",
        fontSize: 16,
        fontWeight: "bold",
        fontFamily: "Arial",
        textAlign: "left",
      },
      {
        id: crypto.randomUUID(),
        type: "text",
        x: 200,
        y: 130,
        width: 180,
        height: 30,
        value: order.city ? `City: ${order.city}` : "City: N/A",
        fontSize: 16,
        fontWeight: "bold",
        fontFamily: "Arial",
        textAlign: "right",
      }
    ];
    setElements(newElements);
  };

  const handleSearchOrderByNumber = async (orderNum: string) => {
    const trimmed = orderNum.trim();
    if (!trimmed) {
      toast.error("Please enter an Order #");
      return;
    }
    setIsFetchingOrders(true);
    try {
      const { data, error } = await supabase
        .from("online_orders")
        .select("id, order_number, customer_name, customer_phone, shipping_address, city, created_at")
        .or(`order_number.ilike.%${trimmed}%,order_number.eq.${trimmed}`)
        .order("created_at", { ascending: false })
        .limit(1);

      if (error) throw error;
      if (data && data.length > 0) {
        handleOnlineOrderSelect(data[0]);
        toast.success(`Loaded details for Order #${data[0].order_number}`);
        setOpenOrderPopover(false);
      } else {
        toast.error(`Order #${trimmed} not found`);
      }
    } catch (err: any) {
      console.error("Error searching order:", err);
      toast.error(err.message || "Failed to fetch order");
    } finally {
      setIsFetchingOrders(false);
    }
  };

  const handleCustomerSelect = (customer: Customer) => {
    setSelectedCustomer(customer);
    if (!customer || customer.id === "walk-in") return;

    setLabelMode("preset");
    setLabelSize("4x2");
    
    // Auto-generate layout for 4x2 (400x200 canvas)
    const newElements: LabelElement[] = [
      {
        id: crypto.randomUUID(),
        type: "text",
        x: 20,
        y: 20,
        width: 360,
        height: 35,
        value: customer.name,
        fontSize: 24,
        fontWeight: "bold",
        fontFamily: "Arial",
        textAlign: "left",
      },
      {
        id: crypto.randomUUID(),
        type: "text",
        x: 20,
        y: 60,
        width: 360,
        height: 60,
        value: customer.address || "Address not provided",
        fontSize: 16,
        fontWeight: "normal",
        fontFamily: "Arial",
        textAlign: "left",
      },
      {
        id: crypto.randomUUID(),
        type: "text",
        x: 20,
        y: 130,
        width: 170,
        height: 30,
        value: customer.phone ? `Ph: ${customer.phone}` : "Ph: N/A",
        fontSize: 16,
        fontWeight: "bold",
        fontFamily: "Arial",
        textAlign: "left",
      },
      {
        id: crypto.randomUUID(),
        type: "text",
        x: 200,
        y: 130,
        width: 180,
        height: 30,
        value: customer.city ? `City: ${customer.city}` : "City: N/A",
        fontSize: 16,
        fontWeight: "bold",
        fontFamily: "Arial",
        textAlign: "right",
      }
    ];
    setElements(newElements);
  };

  const handleGeneratePriceTag = async () => {
    const randomBarcode = Math.floor(1000000000 + Math.random() * 9000000000).toString();
    setLabelSize("2x1");
    
    // Generate barcode image
    const barcodeCanvas = document.createElement("canvas");
    let barcodeImgData = "";
    try {
      JsBarcode(barcodeCanvas, randomBarcode, {
        format: "CODE128", displayValue: false, margin: 0, width: 2, height: 40, fontSize: 16
      });
      barcodeImgData = barcodeCanvas.toDataURL("image/png");
    } catch (e) { /* ignore */ }

    // 2x1 canvas = 200px wide x 100px tall
    const newElements: LabelElement[] = [
      {
        id: crypto.randomUUID(),
        type: "text",
        x: 10,
        y: 6,
        width: 180,
        height: 22,
        value: priceTagName || "Item Name",
        fontSize: 14,
        fontWeight: "bold",
        fontFamily: "Arial",
        textAlign: "center",
      },
      {
        id: crypto.randomUUID(),
        type: "barcode",
        x: 20,
        y: 28,
        width: 160,
        height: 38,
        value: randomBarcode,
        imgData: barcodeImgData,
      },
      {
        id: crypto.randomUUID(),
        type: "text",
        x: 10,
        y: 72,
        width: 180,
        height: 22,
        value: `Rs ${priceTagPrice || "0"}`,
        fontSize: 14,
        fontWeight: "bold",
        fontFamily: "Arial",
        textAlign: "center",
      },
    ];
    setElements(newElements);
  };

  // --- PRINT LOGIC ---
  const handlePrint = () => {
    const preset = LABEL_PRESETS[labelSize];
    const labelWidthIn = preset.width;
    const labelHeightIn = preset.height;
    const labelsPerRow = preset.labelsPerRow;
    const pageWidthIn = 4;
    
    // Scale from px to inches for absolute positioning
    const scale = 1 / PX_PER_INCH;

    const printWindow = window.open("", "_blank", "width=800,height=600");
    if (!printWindow) return;

    const elementsHtml = elements.map(el => {
      const style = `position: absolute; left: ${el.x * scale}in; top: ${el.y * scale}in; width: ${el.width * scale}in; height: ${el.height * scale}in;`;
      
      if (el.type === "text") {
        return `<div style="${style} font-size: ${el.fontSize}px; font-weight: ${el.fontWeight}; font-family: ${el.fontFamily || 'Arial'}, sans-serif; display: flex; align-items: center; justify-content: ${el.textAlign === 'left' ? 'flex-start' : el.textAlign === 'right' ? 'flex-end' : 'center'}; text-align: ${el.textAlign || 'center'}; overflow: hidden; white-space: pre-wrap; word-break: break-word;">${el.value}</div>`;
      }
      if (el.type === "barcode" || el.type === "qrcode") {
        return `<div style="${style} display: flex; flex-direction: column; align-items: center; justify-content: center;">
                  <img src="${el.imgData}" style="max-width: 100%; max-height: 100%; object-fit: contain;" />
                </div>`;
      }
      if (el.type === "rect") {
        return `<div style="${style} border: ${el.borderWidth}px solid black; box-sizing: border-box;"></div>`;
      }
      if (el.type === "circle") {
        return `<div style="${style} border: ${el.borderWidth}px solid black; border-radius: 50%; box-sizing: border-box;"></div>`;
      }
      return "";
    }).join("");

    // Create an array of identical labels
    const allLabels = Array(printQuantity).fill(elementsHtml);
    
    const rows: string[][] = [];
    for (let i = 0; i < allLabels.length; i += labelsPerRow) {
      rows.push(allLabels.slice(i, i + labelsPerRow));
    }

    const tableRowsHtml = rows.map((row) => {
      const cells = row.map((labelHtml) => {
        return `<td style="width: ${labelWidthIn}in; height: ${labelHeightIn}in; position: relative; overflow: hidden; padding: 0;">
                  ${labelHtml}
                </td>`;
      }).join('');
      return `<tr>${cells}</tr>`;
    }).join('');

    const pageOrientation = labelsPerRow > 1 ? 'landscape' : 'portrait';
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Print Label</title>
        <style>
          @page {
            size: ${pageWidthIn}in auto ${pageOrientation};
            margin: 0 !important;
            padding: 0 !important;
          }
          * { box-sizing: border-box; }
          body, html {
            font-family: Arial, sans-serif;
            margin: 0 !important; 
            padding: 0 !important;
            width: ${pageWidthIn}in;
          }
          table {
            width: ${pageWidthIn}in;
            table-layout: fixed;
            border-collapse: collapse;
          }
          td {
            overflow: hidden;
          }
        </style>
      </head>
      <body>
        <table cellpadding="0" cellspacing="0">${tableRowsHtml}</table>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  };


  return (
    <div className="h-[calc(100vh-theme(spacing.16))] flex flex-col gap-4 p-4 lg:p-6 overflow-hidden">
      <div className="shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Custom Labels</h1>
          <p className="text-sm text-muted-foreground">Design and print fully customizable labels</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center">
            <button
              onClick={() => setPrintQuantity(q => Math.max(1, q - 1))}
              className="w-10 h-10 rounded-md bg-muted border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <Minus className="w-4 h-4" />
            </button>
            <Input 
              type="number" 
              min={1} 
              max={1000} 
              value={printQuantity || ""} 
              onChange={(e) => {
                const val = parseInt(e.target.value);
                if (isNaN(val)) { setPrintQuantity(0 as any); return; }
                setPrintQuantity(Math.max(1, Math.min(1000, val)));
              }}
              onBlur={() => {
                if (!printQuantity || printQuantity < 1) setPrintQuantity(1);
              }}
              className="w-16 h-10 text-center px-1 mx-2 text-base font-medium [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none rounded-md border-border bg-card shadow-sm"
            />
            <button
              onClick={() => setPrintQuantity(q => Math.min(1000, (q || 0) + 1))}
              className="w-10 h-10 rounded-md bg-muted border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <Button onClick={() => setShowPreviewModal(true)} size="lg" className="shadow-sm">
            <Printer className="w-4 h-4 mr-2" />
            Print
          </Button>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0">
        
        {/* LEFT TOOLBAR */}
        <div className="w-full lg:w-64 shrink-0 flex flex-col gap-4 overflow-y-auto pb-6">
          {/* Label Type Selector */}
          <div className="bg-card rounded-2xl border border-border shadow-sm p-4 space-y-4">
            <h3 className="font-semibold flex items-center gap-2 text-sm border-b pb-2">
              <Tag className="w-4 h-4 text-primary" />
              Label Type
            </h3>
            <RadioGroup value={labelMode} onValueChange={(v) => setLabelMode(v as "custom" | "preset")}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="custom" id="type-custom" />
                <Label htmlFor="type-custom" className="cursor-pointer">Custom Label</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="preset" id="type-preset" />
                <Label htmlFor="type-preset" className="cursor-pointer">Preset Label</Label>
              </div>
            </RadioGroup>

            {labelMode === "preset" && (
              <div className="pt-2 space-y-4 animate-in fade-in slide-in-from-top-2">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Preset Template</Label>
                  <Select value={presetTemplate} onValueChange={setPresetTemplate}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select template" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="address">Address Label (4"x2")</SelectItem>
                      <SelectItem value="online-address">Online Order Address Label (4"x2")</SelectItem>
                      <SelectItem value="price-tag">Price Tag (2"x1")</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {presetTemplate === "address" && (
                  <div className="pt-2 border-t space-y-3">
                    <Label className="text-xs font-semibold text-primary block mt-2">Select Customer</Label>
                    <CustomerDetails 
                      selectedCustomer={selectedCustomer || { id: "", name: "" }} 
                      onCustomerChange={handleCustomerSelect} 
                    />
                  </div>
                )}

                {presetTemplate === "online-address" && (
                  <div className="pt-2 border-t space-y-3">
                    <Label className="text-xs font-semibold text-primary block mt-2">Enter Order #</Label>

                    <div className="flex gap-1.5">
                      <div className="relative flex-1">
                        <Input
                          placeholder="Order # (e.g. 1001)"
                          value={orderSearchQuery}
                          onChange={(e) => setOrderSearchQuery(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleSearchOrderByNumber(orderSearchQuery);
                            }
                          }}
                          className="h-9 text-sm pr-8"
                        />
                        {isFetchingOrders && (
                          <Loader2 className="w-4 h-4 animate-spin absolute right-2.5 top-2.5 text-muted-foreground" />
                        )}
                      </div>
                      <Button
                        size="sm"
                        className="h-9 px-3"
                        onClick={() => handleSearchOrderByNumber(orderSearchQuery)}
                        disabled={isFetchingOrders || !orderSearchQuery.trim()}
                      >
                        <Search className="w-4 h-4" />
                      </Button>
                    </div>

                    <div className="space-y-1.5 pt-1">
                      <Label className="text-xs text-muted-foreground">Or pick from recent online orders</Label>
                      <Popover open={openOrderPopover} onOpenChange={setOpenOrderPopover}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={openOrderPopover}
                            className="w-full justify-between h-auto py-2 text-left font-normal"
                          >
                            {selectedOnlineOrder ? (
                              <div className="flex flex-col truncate">
                                <span className="font-semibold text-xs text-primary">
                                  Order #{selectedOnlineOrder.order_number}
                                </span>
                                <span className="text-xs truncate font-medium">{selectedOnlineOrder.customer_name}</span>
                                <span className="text-[11px] text-muted-foreground truncate">
                                  {selectedOnlineOrder.city ? `${selectedOnlineOrder.city} • ` : ""}{selectedOnlineOrder.shipping_address || "No address"}
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                                <ShoppingBag className="w-3.5 h-3.5" /> Select recent order...
                              </span>
                            )}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[280px] p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Search Order # or Name..." />
                            <CommandList>
                              <CommandEmpty>No online orders found.</CommandEmpty>
                              <CommandGroup heading="Recent Online Orders">
                                {onlineOrders.map((order) => (
                                  <CommandItem
                                    key={order.id}
                                    value={`${order.order_number} ${order.customer_name} ${order.customer_phone || ''}`}
                                    onSelect={() => {
                                      handleOnlineOrderSelect(order);
                                      setOrderSearchQuery(order.order_number);
                                      setOpenOrderPopover(false);
                                    }}
                                    className="cursor-pointer flex flex-col items-start py-2"
                                  >
                                    <div className="flex items-center justify-between w-full">
                                      <span className="font-bold text-xs">#{order.order_number}</span>
                                      <span className="text-[10px] text-muted-foreground">{order.city || ''}</span>
                                    </div>
                                    <span className="text-xs font-medium">{order.customer_name}</span>
                                    {order.shipping_address && (
                                      <span className="text-[11px] text-muted-foreground truncate w-full">
                                        {order.shipping_address}
                                      </span>
                                    )}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>

                    {selectedOnlineOrder && (
                      <div className="bg-muted/50 rounded-lg p-2.5 text-xs space-y-1 border mt-2">
                        <div className="font-semibold text-primary">Selected Order Details</div>
                        <div><span className="font-medium text-muted-foreground">Order #:</span> {selectedOnlineOrder.order_number}</div>
                        <div><span className="font-medium text-muted-foreground">Name:</span> {selectedOnlineOrder.customer_name}</div>
                        <div><span className="font-medium text-muted-foreground">Phone:</span> {selectedOnlineOrder.customer_phone || 'N/A'}</div>
                        <div><span className="font-medium text-muted-foreground">City:</span> {selectedOnlineOrder.city || 'N/A'}</div>
                        <div className="truncate"><span className="font-medium text-muted-foreground">Address:</span> {selectedOnlineOrder.shipping_address || 'N/A'}</div>
                      </div>
                    )}
                  </div>
                )}

                {presetTemplate === "price-tag" && (
                  <div className="pt-2 border-t space-y-3">
                    <Label className="text-xs font-semibold text-primary block mt-2">Item Details</Label>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Item Name</Label>
                      <Input
                        placeholder="e.g. Premium Fabric"
                        value={priceTagName}
                        onChange={(e) => setPriceTagName(e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Price</Label>
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-bold text-muted-foreground bg-muted border border-border rounded-md px-2 h-8 flex items-center">Rs</span>
                        <Input
                          type="number"
                          placeholder="0.00"
                          value={priceTagPrice}
                          onChange={(e) => setPriceTagPrice(e.target.value)}
                          className="h-8 text-sm flex-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </div>
                    </div>
                    <Button size="sm" className="w-full mt-1" onClick={handleGeneratePriceTag}>
                      <Tag className="w-3 h-3 mr-2" /> Generate Label
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          {labelMode === "custom" && <div className="bg-card rounded-2xl border border-border shadow-sm p-4 space-y-4">
            <h3 className="font-semibold flex items-center gap-2 text-sm border-b pb-2">
              <Settings2 className="w-4 h-4 text-primary" />
              Label Settings
            </h3>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Label Size</Label>
              <Select value={labelSize} onValueChange={(v) => { setLabelSize(v as LabelSize); setElements([]); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select size" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(LABEL_PRESETS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>}

          {labelMode === "custom" && <div className="bg-card rounded-2xl border border-border shadow-sm p-4 space-y-4">
            <h3 className="font-semibold flex items-center gap-2 text-sm border-b pb-2">
              <Plus className="w-4 h-4 text-primary" />
              Add Elements
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <Button variant={activeTool === "text" ? "default" : "outline"} size="sm" className="w-full justify-start text-xs" onClick={() => setActiveTool(t => t === "text" ? null : "text")}>
                <Type className="w-3 h-3 mr-2" /> Text
              </Button>
              <Button variant={activeTool === "barcode" ? "default" : "outline"} size="sm" className="w-full justify-start text-xs" onClick={() => setActiveTool(t => t === "barcode" ? null : "barcode")}>
                <BarcodeIcon className="w-3 h-3 mr-2" /> Barcode
              </Button>
              <Button variant={activeTool === "qrcode" ? "default" : "outline"} size="sm" className="w-full justify-start text-xs" onClick={() => setActiveTool(t => t === "qrcode" ? null : "qrcode")}>
                <QrCode className="w-3 h-3 mr-2" /> QR Code
              </Button>
              <Button variant={activeTool === "rect" ? "default" : "outline"} size="sm" className="w-full justify-start text-xs" onClick={() => setActiveTool(t => t === "rect" ? null : "rect")}>
                <Square className="w-3 h-3 mr-2" /> Rectangle
              </Button>
              <Button variant={activeTool === "circle" ? "default" : "outline"} size="sm" className="w-full justify-start text-xs" onClick={() => setActiveTool(t => t === "circle" ? null : "circle")}>
                <Circle className="w-3 h-3 mr-2" /> Circle
              </Button>
            </div>
          </div>}

          {labelMode === "custom" && selectedElement && (
            <div className="bg-card rounded-2xl border border-primary/20 shadow-sm p-4 space-y-4 animate-in slide-in-from-left-2">
              <div className="flex items-center justify-between border-b pb-2">
                <h3 className="font-semibold flex items-center gap-2 text-sm">
                  <Move className="w-4 h-4 text-primary" />
                  Properties
                </h3>
                <Badge variant="secondary" className="capitalize text-[10px]">{selectedElement.type}</Badge>
              </div>

              <div className="space-y-4">
                {/* Value field for text/barcode/qrcode */}
                {(selectedElement.type === "text" || selectedElement.type === "barcode" || selectedElement.type === "qrcode") && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Value</Label>
                    {selectedElement.type === "text" ? (
                      <Textarea 
                        value={selectedElement.value || ""} 
                        onChange={(e) => updateSelected({ value: e.target.value })} 
                        className="text-sm min-h-[80px]"
                      />
                    ) : (
                      <Input 
                        value={selectedElement.value || ""} 
                        onChange={(e) => updateSelected({ value: e.target.value })} 
                        className="h-8 text-sm"
                      />
                    )}
                  </div>
                )}



                {/* Text specifics */}
                {selectedElement.type === "text" && (
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Font Family</Label>
                      <Select value={selectedElement.fontFamily || "Arial"} onValueChange={(v) => updateSelected({ fontFamily: v })}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Arial">Arial</SelectItem>
                          <SelectItem value="Helvetica">Helvetica</SelectItem>
                          <SelectItem value="Times New Roman">Times New Roman</SelectItem>
                          <SelectItem value="Georgia">Georgia</SelectItem>
                          <SelectItem value="Courier New">Courier New</SelectItem>
                          <SelectItem value="Verdana">Verdana</SelectItem>
                          <SelectItem value="Tahoma">Tahoma</SelectItem>
                          <SelectItem value="Trebuchet MS">Trebuchet MS</SelectItem>
                          <SelectItem value="Impact">Impact</SelectItem>
                          <SelectItem value="Comic Sans MS">Comic Sans MS</SelectItem>
                          <SelectItem value="Inter">Inter</SelectItem>
                          <SelectItem value="Roboto">Roboto</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <Label className="text-xs">Font Size</Label>
                        <span className="text-xs text-muted-foreground">{selectedElement.fontSize}px</span>
                      </div>
                      <Slider 
                        value={[selectedElement.fontSize || 14]} 
                        min={8} max={72} step={1}
                        onValueChange={([v]) => updateSelected({ fontSize: v })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Bold Text</Label>
                      <Switch 
                        checked={selectedElement.fontWeight === "bold"}
                        onCheckedChange={(c) => updateSelected({ fontWeight: c ? "bold" : "normal" })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Alignment</Label>
                      <div className="flex bg-muted/50 p-1 rounded-md">
                        <Button variant={selectedElement.textAlign === "left" ? "secondary" : "ghost"} size="sm" className="flex-1 h-7" onClick={() => updateSelected({ textAlign: "left" })}>
                          <AlignLeft className="w-4 h-4" />
                        </Button>
                        <Button variant={selectedElement.textAlign === "center" || !selectedElement.textAlign ? "secondary" : "ghost"} size="sm" className="flex-1 h-7" onClick={() => updateSelected({ textAlign: "center" })}>
                          <AlignCenter className="w-4 h-4" />
                        </Button>
                        <Button variant={selectedElement.textAlign === "right" ? "secondary" : "ghost"} size="sm" className="flex-1 h-7" onClick={() => updateSelected({ textAlign: "right" })}>
                          <AlignRight className="w-4 h-4" />
                        </Button>
                        <Button variant={selectedElement.textAlign === "justify" ? "secondary" : "ghost"} size="sm" className="flex-1 h-7" onClick={() => updateSelected({ textAlign: "justify" })}>
                          <AlignJustify className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </>
                )}

                {/* Barcode specifics */}
                {selectedElement.type === "barcode" && (
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Show Value</Label>
                    <Switch 
                      checked={!!selectedElement.displayValue}
                      onCheckedChange={(c) => updateSelected({ displayValue: c })}
                    />
                  </div>
                )}

                {/* Shape specifics */}
                {(selectedElement.type === "rect" || selectedElement.type === "circle") && (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <Label className="text-xs">Border Width</Label>
                      <span className="text-xs text-muted-foreground">{selectedElement.borderWidth}px</span>
                    </div>
                    <Slider 
                      value={[selectedElement.borderWidth || 0]} 
                      min={0} max={10} step={1}
                      onValueChange={([v]) => updateSelected({ borderWidth: v })}
                    />
                  </div>
                )}

                <Button variant="destructive" size="sm" className="w-full mt-4" onClick={deleteSelected}>
                  <Trash2 className="w-4 h-4 mr-2" /> Delete Element
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* MAIN CANVAS */}
        <div 
          className={cn(
            "flex-1 border-2 border-dashed border-border rounded-2xl flex flex-col items-center justify-center p-8 overflow-auto relative",
            activeTool && "cursor-crosshair"
          )}
          onPointerDown={(e) => { 
            if (activeTool) {
              handleCanvasPointerDown(e);
            } else if (e.target === e.currentTarget) {
              setSelectedId(null); 
              setEditingElementId(null);
            } else {
              setEditingElementId(null);
            }
          }}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          style={{
            backgroundImage: 'radial-gradient(#e5e7eb 1px, transparent 1px)',
            backgroundSize: '10px 10px',
            backgroundColor: 'hsl(var(--muted) / 0.2)'
          }}
        >
          
          {/* Canvas Wrapper */}
          <div 
            ref={canvasRef}
            className="bg-white relative shadow-xl border border-gray-200 transition-transform duration-300 mx-auto origin-center rounded-xl overflow-hidden"
            style={{ 
              width: canvasWidth, 
              height: canvasHeight,
              transform: `scale(${zoom})`,
            }}
          >
            {elements.map(el => {
              const isSelected = el.id === selectedId;
              return (
                <div
                  key={el.id}
                  onPointerDown={(e) => handlePointerDown(e, el.id)}
                  onDoubleClick={(e) => {
                    if (el.type === "text") {
                      e.stopPropagation();
                      setEditingElementId(el.id);
                    }
                  }}
                  className={cn(
                    "absolute cursor-move select-none touch-none",
                    isSelected ? "ring-2 ring-primary z-10" : "hover:ring-1 hover:ring-primary/50 z-0"
                  )}
                  style={{
                    left: el.x,
                    top: el.y,
                    width: el.width,
                    height: el.height,
                  }}
                >
                  {/* Element Renderers */}
                  {el.type === "text" && (
                    editingElementId === el.id ? (
                      <textarea
                        autoFocus
                        className="w-full h-full bg-transparent border-none outline-none resize-none p-0 m-0 overflow-hidden font-sans whitespace-pre-wrap break-words"
                        style={{ 
                          fontSize: el.fontSize, 
                          fontWeight: el.fontWeight, 
                          fontFamily: el.fontFamily || 'Arial',
                          textAlign: el.textAlign || 'center',
                        }}
                        value={el.value || ""}
                        onChange={(e) => {
                          setElements(prev => prev.map(item => item.id === el.id ? { ...item, value: e.target.value } : item));
                        }}
                        onBlur={() => setEditingElementId(null)}
                        onPointerDown={(e) => e.stopPropagation()}
                        onFocus={(e) => e.target.select()}
                      />
                    ) : (
                      <div 
                        className="w-full h-full flex items-center overflow-hidden font-sans whitespace-pre-wrap break-words"
                        style={{ 
                          fontSize: el.fontSize, 
                          fontWeight: el.fontWeight, 
                          fontFamily: el.fontFamily || 'Arial',
                          textAlign: el.textAlign || 'center',
                          justifyContent: el.textAlign === 'left' ? 'flex-start' : el.textAlign === 'right' ? 'flex-end' : 'center'
                        }}
                      >
                        {el.value}
                      </div>
                    )
                  )}
                  {(el.type === "barcode" || el.type === "qrcode") && (
                    <div className="w-full h-full flex items-center justify-center pointer-events-none p-1">
                      {el.imgData ? (
                        <img src={el.imgData} alt={el.type} className="max-w-full max-h-full object-contain pointer-events-none" draggable={false} />
                      ) : (
                        <div className="w-full h-full bg-muted animate-pulse rounded" />
                      )}
                    </div>
                  )}
                  {el.type === "rect" && (
                    <div className="w-full h-full box-border" style={{ border: `${el.borderWidth}px solid black` }} />
                  )}
                  {el.type === "circle" && (
                    <div className="w-full h-full box-border rounded-full" style={{ border: `${el.borderWidth}px solid black` }} />
                  )}
                  
                  {/* Resize Handles */}
                  {isSelected && (
                    <>
                      <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border border-primary rounded-sm cursor-nwse-resize" onPointerDown={(e) => handleResizeStart(e, 'top-left')} />
                      <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border border-primary rounded-sm cursor-nesw-resize" onPointerDown={(e) => handleResizeStart(e, 'top-right')} />
                      <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border border-primary rounded-sm cursor-nesw-resize" onPointerDown={(e) => handleResizeStart(e, 'bottom-left')} />
                      <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border border-primary rounded-sm cursor-nwse-resize" onPointerDown={(e) => handleResizeStart(e, 'bottom-right')} />
                    </>
                  )}
                </div>
              );
            })}

            {/* Snap Lines Overlay */}
            {isDragging && snapLines.map((line, i) => (
              <div 
                key={`${line.id}-${i}`}
                className="absolute bg-blue-500/80 pointer-events-none z-20"
                style={line.axis === 'x' 
                  ? { left: line.pos, top: 0, bottom: 0, width: 1 } 
                  : { top: line.pos, left: 0, right: 0, height: 1 }
                }
              />
            ))}
          </div>

          {/* Zoom Controls (Absolute Bottom Right) */}
          <div className="absolute bottom-4 right-4 flex items-center gap-3 bg-white/80 backdrop-blur-sm px-4 py-2 rounded-full border border-border shadow-sm z-10">
            <span className="text-xs font-medium text-muted-foreground w-12 text-right">{Math.round(zoom * 100)}%</span>
            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}><ZoomOut className="w-3 h-3" /></Button>
            <Slider value={[zoom]} min={0.5} max={3} step={0.25} onValueChange={([v]) => setZoom(v)} className="w-24" />
            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setZoom(z => Math.min(3, z + 0.25))}><ZoomIn className="w-3 h-3" /></Button>
          </div>
        </div>

      </div>

      {/* Full Preview Modal */}
      <Dialog open={showPreviewModal} onOpenChange={setShowPreviewModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col bg-background/95 backdrop-blur-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Print Preview
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-auto py-4">
            <div className="mb-4 text-center text-sm text-muted-foreground">Scale: 100px = 1 inch | Roll Width: 4 inches</div>
            <div className="mx-auto bg-muted/50 border-2 border-dashed border-muted-foreground/30 rounded-lg p-2 overflow-hidden flex flex-col" style={{ width: '416px' }}>
              {(() => {
                const preset = LABEL_PRESETS[labelSize];
                const labelsPerRow = preset.labelsPerRow;
                const labelWidthPx = preset.width * 100;
                const labelHeightPx = preset.height * 100;
                
                // Create rows array
                const allLabels = Array(printQuantity).fill(null);
                const rows: any[][] = [];
                for (let i = 0; i < allLabels.length; i += labelsPerRow) {
                  rows.push(allLabels.slice(i, i + labelsPerRow));
                }

                return rows.map((row, rowIndex) => (
                  <div key={rowIndex} className="relative">
                    <div className="absolute -left-8 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-mono">R{rowIndex + 1}</div>
                    <div className="flex" style={{ gap: '0px' }}>
                      {row.map((_, labelIndex) => (
                        <div key={labelIndex} className="bg-white border border-gray-200 overflow-hidden relative shadow-sm" style={{ width: `${labelWidthPx}px`, height: `${labelHeightPx}px` }}>
                          {elements.map(el => (
                            <div key={el.id} style={{ position: 'absolute', left: el.x, top: el.y, width: el.width, height: el.height }}>
                              {el.type === "text" && (
                                <div className="w-full h-full flex items-center overflow-hidden font-sans whitespace-pre-wrap break-words"
                                  style={{ fontSize: el.fontSize, fontWeight: el.fontWeight, fontFamily: el.fontFamily || 'Arial', textAlign: el.textAlign || 'center', justifyContent: el.textAlign === 'left' ? 'flex-start' : el.textAlign === 'right' ? 'flex-end' : 'center' }}
                                >
                                  {el.value}
                                </div>
                              )}
                              {(el.type === "barcode" || el.type === "qrcode") && (
                                <div className="w-full h-full flex items-center justify-center p-1 pointer-events-none">
                                  {el.imgData && <img src={el.imgData} alt={el.type} className="max-w-full max-h-full object-contain pointer-events-none" />}
                                </div>
                              )}
                              {el.type === "rect" && <div className="w-full h-full box-border" style={{ border: `${el.borderWidth}px solid black` }} />}
                              {el.type === "circle" && <div className="w-full h-full box-border rounded-full" style={{ border: `${el.borderWidth}px solid black` }} />}
                            </div>
                          ))}
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

export default CustomLabels;
