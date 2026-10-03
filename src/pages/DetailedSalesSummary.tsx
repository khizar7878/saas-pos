import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Search, Filter, Calendar as CalendarIcon, ArrowUpRight, ArrowDownLeft, Eye, Printer, Receipt, Loader2, MessageCircle, TrendingUp, TrendingDown, DollarSign, CalendarDays, Send, Gift, Edit, Package, Truck, Store, ShoppingCart, Check } from "lucide-react";
import { buildFBRInvoicePayload, submitToFBR } from "@/services/fbrService";
import QRCode from 'qrcode';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useSales, useSaleWithItems, useSalesByDateRange, useUpdateSaleType, useSalesRealtime } from "@/hooks/useSales";
import { useReturnsByDateRange } from "@/hooks/useReturns";


import { format, subDays, startOfWeek, startOfMonth, endOfMonth, subMonths, isAfter, startOfDay, isToday } from "date-fns";
import PrintBillDialog from "@/components/sales/PrintBillDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useStoreSettings } from "@/hooks/useStoreSettings";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DateRange } from "react-day-picker";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EditPaymentDialog } from "@/components/sales/EditPaymentDialog";
import { printDetailedSalesSummaryReport } from "@/utils/printDetailedSalesSummaryReport";

const statusStyles = {
  completed: "bg-success/10 text-success border-success/20",
  held: "bg-warning/10 text-warning border-warning/20",
  cancelled: "bg-destructive/10 text-destructive border-destructive/20",
  returned: "bg-muted text-muted-foreground border-muted",
  approved: "bg-success/10 text-success border-success/20",
  pending: "bg-warning/10 text-warning border-warning/20",
};

const DetailedSalesSummary = () => {
  useSalesRealtime();

  // Filter states - moved up before hook usage
  const [date, setDate] = useState<DateRange | undefined>({
    from: new Date(),
    to: new Date(),
  });

  const [saleTypeFilter, setSaleTypeFilter] = useState<'all' | 'counter' | 'delivery'>('all');
  const { data: sales = [], isLoading: isLoadingSales } = useSalesByDateRange(date?.from, date?.to, saleTypeFilter === 'all' ? undefined : saleTypeFilter);
  const updateSaleType = useUpdateSaleType();
  const { data: storeSettings } = useStoreSettings();
  const queryClient = useQueryClient(); // Added useQueryClient hook call
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [submittingFBR, setSubmittingFBR] = useState<string | null>(null);
  const [deletingFBR, setDeletingFBR] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isBulkSubmitting, setIsBulkSubmitting] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });

  useEffect(() => {
    if (confirmDeleteId) {
      const timer = setTimeout(() => {
        setConfirmDeleteId(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [confirmDeleteId]);



  const [editPaymentOpen, setEditPaymentOpen] = useState(false);
  const [saleToEdit, setSaleToEdit] = useState<any>(null);

  const handleEditPayment = (sale: any) => {
    setSaleToEdit(sale);
    setEditPaymentOpen(true);
  };



  const executeFBRSubmission = async (saleId: string) => {
    // Fetch sale details with items
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .select('*')
      .eq('id', saleId)
      .single();

    if (saleError) throw saleError;

    const { data: items, error: itemsError } = await supabase
      .from('sale_items')
      .select('*')
      .eq('sale_id', saleId);

    if (itemsError) throw itemsError;

    console.log("Fetched sale:", sale);
    console.log("Fetched items:", items);

    // Validate that items have required tax data
    if (!items || items.length === 0) {
      throw new Error("No sale items found");
    }

    // Build FBR payload
    const payload = await buildFBRInvoicePayload({
      cart: items.map(item => ({
        product_id: item.product_id,
        name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.total_price,
        tax_percentage: item.tax_percentage || 0,
        tax_amount: item.tax_amount || 0,
        discount: item.discount || 0,
        pct_code: item.pct_code || "01011000"
      })),
      posId: parseInt(storeSettings?.fbr_pos_id || "189142"),
      usin: sale.sale_number,
      paymentMethod: sale.payment_method === 'cash' ? 1 : 2,
      invoiceDate: new Date(sale.created_at).toISOString(),
      discountAmount: sale.discount_amount || 0,
      customerName: sale.customer_name
    });

    console.log("Sending to FBR:", payload);

    // Submit to FBR
    const fbrResponse = await submitToFBR(
      storeSettings?.fbr_api_url || "http://146.190.202.112:5060/api/fbr/submit-invoice",
      payload
    );

    console.log("FBR Response Received:", fbrResponse);

    // Extract invoice number
    const rawInvoiceNo = fbrResponse.fbrInvoiceNumber || fbrResponse.FBRInvoiceNumber;
    let fbrInvoiceNumber = rawInvoiceNo;

    if (fbrInvoiceNumber && typeof fbrInvoiceNumber === 'string' && fbrInvoiceNumber.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(fbrInvoiceNumber);
        fbrInvoiceNumber = parsed.FBRInvoiceNumber || parsed.fbrInvoiceNumber || fbrInvoiceNumber;
      } catch (e) {
        console.warn("Failed to parse inner JSON of FBR Invoice Number", e);
      }
    }

    // Generate QR Code
    let fbrQrCode = '';
    if (fbrInvoiceNumber && fbrInvoiceNumber.trim()) {
      try {
        fbrQrCode = await QRCode.toDataURL(fbrInvoiceNumber);
      } catch (qrErr) {
        console.error("Failed to generate QR code", qrErr);
      }
    } else {
      console.warn("No valid FBR invoice number to generate QR code");
      throw new Error("FBR did not return a valid invoice number");
    }

    // Update sale record
    const { error: updateError } = await supabase
      .from('sales')
      .update({
        fbr_invoice_number: fbrInvoiceNumber,
        fbr_qr_code: fbrQrCode
      })
      .eq('id', saleId);

    if (updateError) throw updateError;
  };

  const handleSubmitToFBR = async (saleId: string) => {
    try {
      setSubmittingFBR(saleId);
      await executeFBRSubmission(saleId);

      // Invalidate queries to refresh the UI
      await queryClient.invalidateQueries({ queryKey: ['sales'] });

      toast.success('FBR Invoice submitted successfully');
    } catch (error: any) {
      console.error('FBR Submission Error:', error);
      toast.error(`Failed to submit to FBR: ${error.message} `);
    } finally {
      setSubmittingFBR(null);
    }
  };

  const handleBulkSubmitToFBR = async () => {
    const eligibleSales = filteredTransactions
      .filter(t => t.type === 'sale' && !t.fbr_invoice_number && t.status !== 'cancelled')
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    if (eligibleSales.length === 0) {
      toast.info("No eligible sales found for FBR submission.");
      return;
    }

    if (!window.confirm(`Are you sure you want to submit ${eligibleSales.length} invoices to FBR sequentially?`)) {
      return;
    }

    try {
      setIsBulkSubmitting(true);
      setBulkProgress({ current: 0, total: eligibleSales.length });

      for (let i = 0; i < eligibleSales.length; i++) {
        const sale = eligibleSales[i];
        setBulkProgress({ current: i + 1, total: eligibleSales.length });
        setSubmittingFBR(sale.id);

        await executeFBRSubmission(sale.id);

        // Invalidate queries in real-time so each row updates immediately
        await queryClient.invalidateQueries({ queryKey: ['sales'] });
      }

      toast.success(`Successfully submitted ${eligibleSales.length} invoices to FBR.`);
    } catch (error: any) {
      console.error('Bulk FBR Submission Error:', error);
      toast.error(`Bulk submission paused due to error: ${error.message}`);
    } finally {
      setIsBulkSubmitting(false);
      setSubmittingFBR(null);
    }
  };

  const handleDeleteFBR = async (saleId: string) => {
    try {
      setDeletingFBR(saleId);

      const { error } = await supabase
        .from('sales')
        .update({
          fbr_invoice_number: null,
          fbr_qr_code: null
        })
        .eq('id', saleId);

      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ['sales'] });
      toast.success('FBR Invoice Number deleted successfully');
      setConfirmDeleteId(null);
    } catch (error: any) {
      console.error('FBR Deletion Error:', error);
      toast.error(`Failed to delete FBR Invoice Number: ${error.message}`);
    } finally {
      setDeletingFBR(null);
    }
  };


  const applyPreset = (preset: 'today' | 'yesterday' | 'thisWeek' | 'thisMonth' | 'lastMonth') => {
    const today = new Date();
    let from = today;
    let to = today;

    switch (preset) {
      case 'today':
        break; // Default is today
      case 'yesterday':
        from = subDays(today, 1);
        to = subDays(today, 1);
        break;
      case 'thisWeek':
        from = startOfWeek(today, { weekStartsOn: 6 }); // Week starts Saturday
        break;
      case 'thisMonth':
        from = startOfMonth(today);
        break;
      case 'lastMonth':
        from = startOfMonth(subMonths(today, 1));
        to = endOfMonth(subMonths(today, 1));
        break;
    }

    setDate({ from, to });
  };

  const { data: saleDetails } = useSaleWithItems(selectedSaleId);

  const allTransactions = [
    ...sales.map(s => ({ ...s, type: 'sale' as const }))
  ];

  // Sort by date desc
  allTransactions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // Filter mixed list
  const filteredTransactions = allTransactions.filter(item => {
    // Search filter
    const matchesSearch = (item.sale_number || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.customer?.name || "").toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    return true;
  }).map(item => {
    // Add displayedAmount property
    let displayedAmount = item.total_amount;
    return { ...item, displayedAmount };
  });


  // Calculate summary statistics
  const salesTotal = filteredTransactions
    .filter(t => t.status !== 'cancelled' && t.status !== 'returned')
    .reduce((sum, s) => sum + s.displayedAmount, 0);

  const counterSalesTotal = filteredTransactions
    .filter(t => t.status !== 'cancelled' && t.status !== 'returned' && (t as any).sale_type === 'counter')
    .reduce((sum, s) => sum + s.displayedAmount, 0);

  const deliverySalesTotal = filteredTransactions
    .filter(t => t.status !== 'cancelled' && t.status !== 'returned' && (t as any).sale_type === 'delivery')
    .reduce((sum, s) => sum + s.displayedAmount, 0);

  const returnsTotal = 0;

  const netAmount = salesTotal;

  const eligibleSalesCount = filteredTransactions.filter(
    t => t.type === 'sale' && !t.fbr_invoice_number && t.status !== 'cancelled'
  ).length;
  const transactionCount = filteredTransactions.length;

  const totalUnitsSold = filteredTransactions
    .filter(t => t.type === 'sale' && t.status !== 'cancelled' && t.status !== 'returned')
    .reduce((sum, sale) => {
      const items = (sale as any).sale_items || [];
      const saleQty = items.reduce((qSum: number, item: any) => qSum + (item.quantity || 0), 0);
      return sum + saleQty;
    }, 0);

  const totalIbftReceived = filteredTransactions
    .filter(t => t.type === 'sale' && t.status !== 'cancelled' && t.status !== 'returned')
    .reduce((sum, sale) => {
      const s = sale as any;
      let amount = 0;
      if (s.payment_method === 'ibft') {
        amount = s.amount_received && s.amount_received > 0 ? s.amount_received : s.total_amount;
      } else if (s.payment_method === 'mixed' && s.payment_details) {
        const ibftSplit = s.payment_details.find((d: any) => d.method === 'ibft');
        if (ibftSplit) amount = ibftSplit.amount || 0;
      }
      return sum + amount;
    }, 0);

  const handleView = (saleId: string, type: 'sale' | 'return') => {
    if (type === 'return') return; // TODO: Add return view dialog if needed
    setSelectedSaleId(saleId);
    setViewDialogOpen(true);
  };



  // ... (keep unused imports if needed, but standardizing imports to just what is needed for this block is fine, existing imports stay if outside the block)

  const handlePrint = (saleId: string, type: 'sale' | 'return') => {
    if (type === 'return') return; // TODO: Add return print if needed
    setSelectedSaleId(saleId);
    setPrintDialogOpen(true);
  };

  const handlePrintSummary = () => {
    printDetailedSalesSummaryReport(
      filteredTransactions,
      {
        salesTotal,
        counterSalesTotal,
        deliverySalesTotal,
        count: transactionCount,
        unitsSold: totalUnitsSold
      },
      {
        from: date?.from || new Date(),
        to: date?.to || new Date()
      },
      storeSettings
    );
  };


  // Removed global loading check to keep header and date controls interactive during fetch

  const renderPaymentMethod = (item: any) => {
    if (item.type === 'return') return '-';

    if (item.payment_method === 'mixed') {
      const splits = item.payment_details || item.payment_splits || [];
      if (splits.length > 0) {
        return (
          <div className="flex flex-col text-xs space-y-0.5">
            {splits.map((s: any, idx: number) => (
              <span key={idx}>
                {s.method} ({s.amount})
              </span>
            ))}
          </div>
        );
      }
      return 'Mixed';
    }
    return item.payment_method;
  };

  return (
    <div className="p-4 md:p-6 space-y-6 animate-slide-in">
      <div className="flex flex-col gap-4 print:hidden">
        {/* ... Header and Date Filters (Keep same) ... */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Detailed Sales Summary</h1>
            <p className="text-muted-foreground">View counter and delivery sales</p>
          </div>
        </div>

        {/* Filters Row */}
        <div className="flex flex-col xl:flex-row items-end justify-between gap-6">
          <div className="flex flex-col gap-2 w-full sm:w-auto flex-none">
            <div className="w-full sm:w-[360px]">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="date"
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date?.from ? (
                      date.to ? (
                        <>
                          {format(date.from, "LLL dd, y")} -{" "}
                          {format(date.to, "LLL dd, y")}
                        </>
                      ) : (
                        format(date.from, "LLL dd, y")
                      )
                    ) : (
                      <span>Pick a date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={date?.from}
                    selected={date}
                    onSelect={setDate}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Quick Presets - Single Line */}
            <div className="flex gap-1 w-full sm:w-[360px]">
              <Button variant="outline" size="sm" className="h-7 text-[10px] sm:text-xs rounded-md flex-1 px-1" onClick={() => applyPreset('yesterday')}>Yesterday</Button>
              <Button variant="outline" size="sm" className="h-7 text-[10px] sm:text-xs rounded-md flex-1 px-1" onClick={() => applyPreset('thisWeek')}>This Week</Button>
              <Button variant="outline" size="sm" className="h-7 text-[10px] sm:text-xs rounded-md flex-1 px-1" onClick={() => applyPreset('thisMonth')}>This Month</Button>
              <Button variant="outline" size="sm" className="h-7 text-[10px] sm:text-xs rounded-md flex-1 px-1" onClick={() => applyPreset('lastMonth')}>Last Month</Button>
            </div>
          </div>

          <div className="flex flex-col gap-2 items-center flex-1 w-full">
            <span className="text-sm font-medium text-muted-foreground">Sale Types</span>
            <div className="flex flex-wrap justify-center gap-1">
              {(['all', 'counter', 'delivery'] as const).map((method) => (
                <Button
                  key={method}
                  variant={saleTypeFilter === method ? "default" : "outline"}
                  size="sm"
                  className={cn(
                    "h-8 text-xs capitalize min-w-[3rem]",
                    saleTypeFilter === method && "bg-primary text-primary-foreground"
                  )}
                  onClick={() => setSaleTypeFilter(method)}
                >
                  {method === 'all' ? 'All' : method}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2 w-full sm:w-[320px] flex-none items-end">
            <div className="flex gap-2 w-full justify-end">
              {eligibleSalesCount > 0 && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleBulkSubmitToFBR}
                  disabled={isBulkSubmitting}
                  className="text-xs flex-1 sm:flex-initial flex items-center justify-center gap-1.5"
                >
                  {isBulkSubmitting ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin mr-1" />
                      Submitting ({bulkProgress.current}/{bulkProgress.total})
                    </>
                  ) : (
                    <>
                      <Send className="w-3 h-3 mr-1" />
                      Bulk Submit to FBR ({eligibleSalesCount})
                    </>
                  )}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrintSummary}
                className="w-full sm:w-auto"
              >
                <Printer className="w-4 h-4 mr-2" />
                Print Summary
              </Button>
            </div>
            <Input
              placeholder="Search by invoice or customer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full"
            />
          </div>
        </div>

        {/* Summary Stats using displayedAmount */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingUp className="w-4 h-4" />
              <span className="text-sm">Total Sales</span>
            </div>
            {isLoadingSales ? (
              <div className="h-8 flex items-center">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <p className="text-2xl font-bold text-success">Rs. {salesTotal.toLocaleString()}</p>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Store className="w-4 h-4" />
              <span className="text-sm">Counter Sales</span>
            </div>
            {isLoadingSales ? (
              <div className="h-8 flex items-center">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <p className="text-2xl font-bold text-foreground">Rs. {counterSalesTotal.toLocaleString()}</p>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Truck className="w-4 h-4" />
              <span className="text-sm">Delivery Sales</span>
            </div>
            {isLoadingSales ? (
              <div className="h-8 flex items-center">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <p className="text-2xl font-bold text-foreground">Rs. {deliverySalesTotal.toLocaleString()}</p>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Receipt className="w-4 h-4" />
              <span className="text-sm">Transactions</span>
            </div>
            {isLoadingSales ? (
              <div className="h-8 flex items-center">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <p className="text-2xl font-bold text-foreground">{transactionCount}</p>
            )}
          </div>
        </div>
      </div>

      {/* Mobile view */}
      <div className="md:hidden space-y-3 print:hidden">
        {isLoadingSales ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-2" />
            <p>Loading transactions...</p>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
            <Receipt className="w-12 h-12 mx-auto mb-2 opacity-30" />
            <p>No sales found</p>
          </div>
        ) : (
          filteredTransactions.map((item) => (
            <div key={`${item.type} -${item.id} `} className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {item.type === 'return' ? (
                    <ArrowDownLeft className="w-4 h-4 text-destructive" />
                  ) : (
                    <ArrowUpRight className="w-4 h-4 text-success" />
                  )}
                  <span className="font-mono text-sm font-medium">{item.sale_number}</span>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    "capitalize font-medium",
                    statusStyles[item.status as keyof typeof statusStyles]
                  )}
                >
                  {item.status}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {item.customer?.name || "Walk-in"}
                </span>
                <span className={cn(
                  "font-semibold",
                  item.type === 'return' ? "text-destructive" : "text-foreground"
                )}>
                  {item.type === 'return' ? "- " : ""}Rs. {item.displayedAmount.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-xs text-muted-foreground">
                  <span>{format(new Date(item.created_at), 'dd MMM yyyy')}</span>
                  {item.type === 'sale' && (
                    <div className="mt-1">
                      {renderPaymentMethod(item)}
                    </div>
                  )}
                </div>

                {item.type === 'sale' && (
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={() => handleView(item.id, 'sale')}>
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handlePrint(item.id, 'sale')}>
                      <Printer className="w-4 h-4" />
                    </Button>
                    {(item as any).fbr_invoice_number && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirmDeleteId === item.id) {
                            handleDeleteFBR(item.id);
                          } else {
                            setConfirmDeleteId(item.id);
                          }
                        }}
                        disabled={deletingFBR === item.id}
                        title={confirmDeleteId === item.id ? "Click again to confirm delete" : "Delete FBR Invoice Number"}
                        className={cn(
                          "text-destructive hover:bg-destructive/10 hover:text-destructive flex items-center justify-center animate-in fade-in zoom-in duration-200",
                          confirmDeleteId === item.id && "bg-destructive/20 text-red-600"
                        )}
                      >
                        {deletingFBR === item.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : confirmDeleteId === item.id ? (
                          <Check className="w-4 h-4 text-red-600 animate-pulse" />
                        ) : (
                          <span className="relative font-bold text-[10px] tracking-tight select-none px-0.5 leading-none">
                            FBR
                            <span className="absolute left-0 right-0 top-1/2 h-[1.5px] bg-destructive -rotate-[25deg] transform -translate-y-1/2"></span>
                          </span>
                        )}
                      </Button>
                    )}
                    {item.status !== 'cancelled' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditPayment(item)}
                        title="Edit Payment Method"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                    )}
                    {item.status !== 'cancelled' && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Change Sale Type"
                            disabled={updateSaleType.isPending}
                          >
                            {(item as any).sale_type === 'delivery' ? <Truck className="w-4 h-4 text-blue-500" /> : <Store className="w-4 h-4 text-green-500" />}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => updateSaleType.mutate({ saleId: item.id, newType: 'counter' })}>
                            <Store className="w-4 h-4 mr-2 text-green-500" /> Counter
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => updateSaleType.mutate({ saleId: item.id, newType: 'delivery' })}>
                            <Truck className="w-4 h-4 mr-2 text-blue-500" /> Delivery
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop view */}
      <div className="hidden print:block mb-6">
        <h1 className="text-2xl font-bold mb-2">Delivery Sales Summary</h1>
        <div className="flex gap-8 text-sm text-muted-foreground">
          <p>Generated: {format(new Date(), 'dd MMM yyyy HH:mm')}</p>
          {date?.from && (
            <p>
              Period: {format(date.from, 'dd MMM yyyy')} - {date.to ? format(date.to, 'dd MMM yyyy') : '...'}
            </p>
          )}
        </div>
      </div>

      <div className="hidden md:block print:block rounded-xl border border-border bg-card overflow-hidden print:border-none print:shadow-none">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-muted-foreground">Date</TableHead>
              <TableHead className="text-muted-foreground">Invoice / Return #</TableHead>
              <TableHead className="text-muted-foreground">FBR Invoice #</TableHead>
              <TableHead className="text-muted-foreground">Customer</TableHead>
              <TableHead className="text-muted-foreground">Payment</TableHead>
              <TableHead className="text-muted-foreground text-right">Amount</TableHead>
              <TableHead className="text-muted-foreground text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoadingSales ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-2" />
                  <p>Loading transactions...</p>
                </TableCell>
              </TableRow>
            ) : filteredTransactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  <Receipt className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p>No sales found</p>
                </TableCell>
              </TableRow>
            ) : (
              filteredTransactions.map((item) => (
                <TableRow
                  key={`${item.type} -${item.id} `}
                  className={cn(
                    "hover:bg-muted/50",
                    item.type === 'sale' && "cursor-pointer"
                  )}
                  onClick={() => item.type === 'sale' && handleView(item.id, 'sale')}
                >
                  <TableCell className="text-muted-foreground">
                    {format(new Date(item.created_at), 'dd MMM yyyy')}
                  </TableCell>
                  <TableCell className="font-medium text-foreground font-mono">
                    {item.sale_number}
                  </TableCell>
                  <TableCell className="font-mono text-sm" onClick={(e) => e.stopPropagation()}>
                    {item.type === 'sale' ? (
                      (item as any).fbr_invoice_number ? (
                        (item as any).fbr_invoice_number
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => handleSubmitToFBR(item.id)}
                          disabled={submittingFBR === item.id}
                        >
                          {submittingFBR === item.id ? (
                            <Loader2 className="w-3 h-3 animate-spin mr-1" />
                          ) : (
                            <Send className="w-3 h-3 mr-1" />
                          )}
                          Submit to FBR
                        </Button>
                      )
                    ) : (item as any).fbr_return_number ? (
                      <span className="text-muted-foreground">{(item as any).fbr_return_number}</span>
                    ) : '-'}
                  </TableCell>
                  <TableCell className="text-foreground">
                    {item.customer?.name || "Walk-in"}
                  </TableCell>
                  <TableCell className="text-foreground uppercase text-sm">
                    {renderPaymentMethod(item)}
                  </TableCell>
                  <TableCell className={cn(
                    "text-right font-semibold",
                    item.type === 'return' ? "text-destructive" : "text-foreground"
                  )}>
                    {item.type === 'return' ? "- " : ""}Rs. {item.displayedAmount.toLocaleString()}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    {item.type === 'sale' && (
                      <div className="flex justify-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handlePrint(item.id, 'sale')} title="Print Receipt">
                          <Printer className="w-4 h-4" />
                        </Button>
                        {(item as any).fbr_invoice_number && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (confirmDeleteId === item.id) {
                                handleDeleteFBR(item.id);
                              } else {
                                setConfirmDeleteId(item.id);
                              }
                            }}
                            disabled={deletingFBR === item.id}
                            title={confirmDeleteId === item.id ? "Click again to confirm delete" : "Delete FBR Invoice Number"}
                            className={cn(
                              "text-destructive hover:bg-destructive/10 hover:text-destructive flex items-center justify-center animate-in fade-in zoom-in duration-200",
                              confirmDeleteId === item.id && "bg-destructive/20 text-red-600"
                            )}
                          >
                            {deletingFBR === item.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : confirmDeleteId === item.id ? (
                              <Check className="w-4 h-4 text-red-600 animate-pulse" />
                            ) : (
                              <span className="relative font-bold text-[10px] tracking-tight select-none px-0.5 leading-none">
                                FBR
                                <span className="absolute left-0 right-0 top-1/2 h-[1.5px] bg-destructive -rotate-[25deg] transform -translate-y-1/2"></span>
                              </span>
                            )}
                          </Button>
                        )}
                        {item.status !== 'cancelled' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditPayment(item)}
                            title="Edit Payment Method"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        )}
                        {item.status !== 'cancelled' && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Change Sale Type"
                                disabled={updateSaleType.isPending}
                              >
                                {(item as any).sale_type === 'delivery' ? <Truck className="w-4 h-4 text-blue-500" /> : <Store className="w-4 h-4 text-green-500" />}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => updateSaleType.mutate({ saleId: item.id, newType: 'counter' })}>
                                <Store className="w-4 h-4 mr-2 text-green-500" /> Counter
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => updateSaleType.mutate({ saleId: item.id, newType: 'delivery' })}>
                                <Truck className="w-4 h-4 mr-2 text-blue-500" /> Delivery
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* View Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-primary" />
              Invoice Details
            </DialogTitle>
          </DialogHeader>
          {saleDetails ? (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-muted-foreground">Invoice #</div>
                  <div className="font-mono font-medium">{saleDetails.sale.sale_number}</div>

                  {saleDetails.sale.fbr_invoice_number && (
                    <>
                      <div className="text-muted-foreground">FBR Invoice #</div>
                      <div className="font-mono font-medium text-primary">{saleDetails.sale.fbr_invoice_number}</div>
                    </>
                  )}

                  <div className="text-muted-foreground">Date</div>
                  <div>{format(new Date(saleDetails.sale.created_at), 'dd MMM yyyy HH:mm')}</div>
                  <div className="text-muted-foreground">Customer</div>
                  <div>{saleDetails.sale.customer?.name || "Walk-in"}</div>
                  <div className="text-muted-foreground">Payment</div>
                  <div className="uppercase">{saleDetails.sale.payment_method}</div>
                  <div className="text-muted-foreground">Status</div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "capitalize font-medium w-fit",
                      statusStyles[saleDetails.sale.status as keyof typeof statusStyles]
                    )}
                  >
                    {saleDetails.sale.status}
                  </Badge>
                </div>

                <div className="border-t border-border pt-4">
                  <h4 className="font-medium mb-2">Items</h4>
                  <div className="space-y-2">
                    {saleDetails.items.map((item: any) => (
                      <div key={item.id} className="flex justify-between text-sm p-2 rounded bg-muted/50">
                        <div>
                          <p className="font-medium">{item.product_name || item.product?.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.quantity} x m @ Rs.{item.unit_price}/m
                          </p>
                        </div>
                        <span className="font-semibold">Rs. {item.total_price.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t border-border pt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>Rs. {saleDetails.sale.subtotal.toLocaleString()}</span>
                  </div>
                  {saleDetails.sale.discount_amount > 0 && (
                    <div className="flex justify-between text-sm text-success">
                      <span>Discount</span>
                      <span>- Rs. {saleDetails.sale.discount_amount.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-lg border-t pt-2">
                    <span>Total</span>
                    <span>Rs. {saleDetails.sale.total_amount.toLocaleString()}</span>
                  </div>
                </div>
                {saleDetails.sale.fbr_invoice_number && (
                  <div className="border-t border-border pt-4 flex flex-col items-center text-center space-y-2 bg-muted/20 p-4 rounded-b-lg">
                    <div className="text-xs text-muted-foreground uppercase tracking-wider">FBR Invoice Number</div>
                    <div className="font-mono font-bold text-lg tracking-wider text-primary">{saleDetails.sale.fbr_invoice_number}</div>
                    {saleDetails.sale.fbr_qr_code && (
                      <div className="mt-2 bg-white p-2 rounded-lg shadow-sm">
                        <img src={saleDetails.sale.fbr_qr_code} alt="FBR QR Code" className="w-24 h-24 mx-auto" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </ScrollArea>
          ) : (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Print Dialog */}
      {
        saleDetails && (() => {
          console.log("Reprint Debug - Items from DB:", saleDetails.items);
          return (
            <PrintBillDialog
              open={printDialogOpen}
              onOpenChange={setPrintDialogOpen}
              saleNumber={saleDetails.sale.sale_number || ''}
              customerName={saleDetails.sale.customer?.name || 'Walk-in'}
              customerPhone={saleDetails.sale.customer?.phone}
              customerBalance={saleDetails.sale.customer?.current_balance}
              items={saleDetails.items.map((item: any) => ({
                productName: item.product_name || item.product?.name || 'Unknown',
                quantity: item.quantity || item.rolls_count || 1,
                metersPerUnit: (item.quantity_meters || item.quantity) / (item.rolls_count || 1),
                pricePerMeter: item.unit_price || item.price_per_meter || 0,
                totalPrice: item.total_price || 0,
                taxRate: item.tax_percent || item.tax_percentage || 0,
                taxAmount: item.tax_amount || 0,
              }))}
              subtotal={saleDetails.sale.subtotal}
              discount={saleDetails.sale.discount_amount}
              total={saleDetails.sale.total_amount}
              paymentMethod={saleDetails.sale.payment_method}
              amountReceived={saleDetails.sale.amount_received}
              change={saleDetails.sale.change_amount}
              date={new Date(saleDetails.sale.created_at)}
              fbrInvoiceNumber={saleDetails.sale.fbr_invoice_number}
              fbrQrCode={saleDetails.sale.fbr_qr_code}
              fbrPosId={saleDetails.sale.fbr_pos_id}
              paymentSplits={saleDetails.sale.payment_details || saleDetails.sale.payment_splits || []}
            />
          );
        })()
      }


      <EditPaymentDialog
        open={editPaymentOpen}
        onOpenChange={setEditPaymentOpen}
        saleId={saleToEdit?.id}
        currentMethod={saleToEdit?.payment_method || 'cash'}
        saleAmount={saleToEdit?.total_amount || 0}
      />


    </div >
  );
};

export default DetailedSalesSummary;
