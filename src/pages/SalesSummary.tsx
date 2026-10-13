import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Search, Filter, Calendar as CalendarIcon, ArrowUpRight, ArrowDownLeft, Eye, Printer, Receipt, Loader2, MessageCircle, TrendingUp, TrendingDown, DollarSign, CalendarDays, Send, Gift, Edit, Package } from "lucide-react";
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
import { useSales, useSaleWithItems, useSalesByDateRange, useSalesRealtime } from "@/hooks/useSales";
import { useReturnsByDateRange } from "@/hooks/useReturns";


import { format, subDays, startOfWeek, startOfMonth, endOfMonth, subMonths, isAfter, startOfDay, isToday } from "date-fns";
import PrintBillDialog from "@/components/sales/PrintBillDialog";
import PrintGiftReceiptDialog from "@/components/sales/PrintGiftReceiptDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { generateBillMessage, openWhatsApp, getWhatsAppUrl } from "@/utils/whatsapp";
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

import { EditPaymentDialog } from "@/components/sales/EditPaymentDialog";
import { printSalesSummaryReport } from "@/utils/printSalesSummaryReport";

const statusStyles = {
  completed: "bg-success/10 text-success border-success/20",
  held: "bg-warning/10 text-warning border-warning/20",
  cancelled: "bg-destructive/10 text-destructive border-destructive/20",
  returned: "bg-muted text-muted-foreground border-muted",
  approved: "bg-success/10 text-success border-success/20",
  pending: "bg-warning/10 text-warning border-warning/20",
};

const SalesSummary = () => {
  useSalesRealtime();

  // Filter states - moved up before hook usage
  const [date, setDate] = useState<DateRange | undefined>({
    from: new Date(),
    to: new Date(),
  });

  const { data: sales = [], isLoading: isLoadingSales } = useSalesByDateRange(date?.from, date?.to);
  const { data: returns = [], isLoading: isLoadingReturns } = useReturnsByDateRange(date?.from, date?.to);
  const { data: storeSettings } = useStoreSettings();
  const queryClient = useQueryClient(); // Added useQueryClient hook call
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [giftReceiptDialogOpen, setGiftReceiptDialogOpen] = useState(false);
  const [selectedGiftSale, setSelectedGiftSale] = useState<any>(null);
  const [submittingFBR, setSubmittingFBR] = useState<string | null>(null);



  const [editPaymentOpen, setEditPaymentOpen] = useState(false);
  const [saleToEdit, setSaleToEdit] = useState<any>(null);

  const handleEditPayment = (sale: any) => {
    setSaleToEdit(sale);
    setEditPaymentOpen(true);
  };



  const handleSubmitToFBR = async (saleId: string) => {
    try {
      setSubmittingFBR(saleId);

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

  const [paymentFilter, setPaymentFilter] = useState<string>('all');

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

  // Combine Sales and Returns into one list
  const allTransactions = [
    ...sales.map(s => ({ ...s, type: 'sale' as const })),
    ...returns.map(r => ({
      id: r.id,
      created_at: r.created_at,
      sale_number: r.return_number,
      invoice_ref: r.sale?.sale_number,
      customer: r.customer,
      payment_method: 'return',
      total_amount: r.total_amount,
      status: r.status,
      return_type: r.return_type,
      fbr_return_number: (r as any).fbr_return_number || null,
      type: 'return' as const
    }))
  ];

  // Sort by date desc
  allTransactions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // Filter mixed list
  const filteredTransactions = allTransactions.filter(item => {
    // Exclude Credit Returns from Sales Summary completely
    if (item.type === 'return' && (item as any).return_type === 'credit') return false;

    // Search filter
    const matchesSearch = (item.sale_number || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.customer?.name || (item as any).customer_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      ((item as any).invoice_ref || "").toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    // Payment method filter
    if (paymentFilter !== 'all') {
      if (item.type === 'return') return false; // Hide returns when filtering by payment method

      const sale = item as any;
      const mainMethod = sale.payment_method?.toLowerCase();

      // If main method matches specific filter
      if (mainMethod === paymentFilter) return true;

      // If Filter is 'Mixed' and payment is Mixed
      if (paymentFilter === 'mixed' && mainMethod === 'mixed') return true;

      // If Mixed payment, check if splits contain the filtered method
      if (mainMethod === 'mixed') {
        const splits = sale.payment_details || []; // Prefer payment_details
        // Fallback to notes if needed (legacy)

        if (Array.isArray(splits) && splits.length > 0) {
          return splits.some((s: any) => s.method === paymentFilter);
        }
      }

      return false;
    }

    return true;
    return true;
  }).map(item => {
    // Add displayedAmount property
    let displayedAmount = item.total_amount;

    if (item.type === 'sale') {
      const sale = item as any;

      // For Mixed payments, show specific split amount if filtered
      if (paymentFilter !== 'all' && paymentFilter !== 'mixed' && sale.payment_method === 'mixed') {
        const splits = sale.payment_details || [];
        const relevantSplit = splits.find((s: any) => s.method === paymentFilter);
        if (relevantSplit) {
          displayedAmount = relevantSplit.amount;
        }
      }
    }

    return { ...item, displayedAmount };
  });


  // Calculate summary statistics
  const salesTotal = filteredTransactions
    .filter(t => t.type === 'sale' && t.status !== 'cancelled' && t.status !== 'returned')
    .reduce((sum, s) => sum + s.displayedAmount, 0);

  const discountsTotal = filteredTransactions
    .filter(t => t.type === 'sale' && t.status !== 'cancelled' && t.status !== 'returned')
    .reduce((sum, s) => sum + (Number((s as any).discount_amount) || Number((s as any).discount) || 0), 0);

  const returnsTotal = filteredTransactions
    .filter(t => t.type === 'return')
    .reduce((sum, s) => sum + s.total_amount, 0);

  const netAmount = salesTotal - returnsTotal;
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
    printSalesSummaryReport(
      filteredTransactions,
      {
        salesTotal,
        discountsTotal,
        returnsTotal,
        netAmount,
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

  // ... (Keep handleDirectWhatsApp and other handlers) ...
  const handleDirectWhatsApp = async (sale: any) => {
    // Open window immediately to bypass popup blocker
    const newWindow = window.open('', '_blank');
    if (newWindow) {
      newWindow.document.write('Please wait, preparing WhatsApp message...');
      newWindow.document.title = 'Preparing Message';
    } else {
      toast.error("Popup blocked. Please allow popups for this site.");
      return;
    }

    try {
      toast.info("Preparing WhatsApp message...");
      const { data: items, error } = await supabase
        .from('sale_items')
        .select('*, product:products(name)')
        .eq('sale_id', sale.id);

      if (error) throw error;

      const formattedItems = items.map((item: any) => ({
        productName: item.product_name || item.product?.name || 'Unknown',
        quantity: item.quantity || item.rolls_count || 1,
        metersPerUnit: (item.quantity_meters || item.quantity) / (item.rolls_count || 1),
        pricePerMeter: item.unit_price || item.price_per_meter || 0,
        totalPrice: item.total_price || 0,
        taxRate: item.tax_percent || 0,
        taxAmount: item.tax_amount || 0
      }));

      const message = generateBillMessage(
        sale.sale_number,
        sale.customer?.name || 'Walk-in',
        formattedItems,
        sale.total_amount,
        sale.discount_amount || 0,
        sale.customer?.current_balance || 0,
        storeSettings
      );

      const url = getWhatsAppUrl(sale.customer?.phone, message);
      if (newWindow) {
        newWindow.location.href = url;
      }
    } catch (error) {
      console.error(error);
      newWindow?.close();
      toast.error("Failed to prepare WhatsApp message");
    }
  };


  // Removed global loading check to keep header and date controls interactive during fetch

  const renderPaymentMethod = (item: any) => {
    if (item.type === 'return') return '-';

    if (item.payment_method === 'mixed') {
      console.log('Mixed Payment Item:', item); // Debugging
      const splits = item.payment_details || item.payment_splits || [];
      if (splits.length > 0) {
        return (
          <div className="flex flex-col text-xs space-y-0.5">
            {splits.map((s: any, idx: number) => (
              <span key={idx} className={paymentFilter === s.method ? "font-bold text-primary" : ""}>
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
            <h1 className="text-2xl font-bold text-foreground">Sales Summary</h1>
            <p className="text-muted-foreground">View filtered sales and returns transactions</p>
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
            <span className="text-sm font-medium text-muted-foreground">Payment Methods</span>
            <div className="flex flex-wrap justify-center gap-1">
              {['all', 'cash', 'ibft', 'card', 'mixed'].map((method) => (
                <Button
                  key={method}
                  variant={paymentFilter === method ? "default" : "outline"}
                  size="sm"
                  className={cn(
                    "h-8 text-xs capitalize min-w-[3rem]",
                    paymentFilter === method && "bg-primary text-primary-foreground"
                  )}
                  onClick={() => setPaymentFilter(method)}
                >
                  {method === 'all' ? 'All' : method === 'ibft' ? 'IBFT' : method}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2 w-full sm:w-[300px] flex-none items-end">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrintSummary}
              className="w-full sm:w-auto"
            >
              <Printer className="w-4 h-4 mr-2" />
              Print Summary
            </Button>
            <Input
              placeholder="Search by invoice or customer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full"
            />
          </div>
        </div>

        {/* Summary Stats using displayedAmount */}
        {/* Summary Stats using displayedAmount */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingUp className="w-4 h-4" />
              <span className="text-sm">Total Sales / Total Discounts</span>
            </div>
            {isLoadingSales || isLoadingReturns ? (
              <div className="h-8 flex items-center">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="flex flex-wrap items-baseline gap-1.5">
                <span className="text-2xl font-bold text-success">Rs. {salesTotal.toLocaleString()}</span>
                <span className="text-muted-foreground text-sm font-normal">/</span>
                <span className="text-lg font-semibold text-destructive">Rs. {discountsTotal.toLocaleString()}</span>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingDown className="w-4 h-4" />
              <span className="text-sm">Total Returns</span>
            </div>
            {isLoadingSales || isLoadingReturns ? (
              <div className="h-8 flex items-center">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <p className="text-2xl font-bold text-destructive">Rs. {returnsTotal.toLocaleString()}</p>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <DollarSign className="w-4 h-4" />
              <span className="text-sm">Net Amount</span>
            </div>
            {isLoadingSales || isLoadingReturns ? (
              <div className="h-8 flex items-center">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <p className="text-2xl font-bold text-foreground">Rs. {netAmount.toLocaleString()}</p>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Receipt className="w-4 h-4" />
              <span className="text-sm">Transactions</span>
            </div>
            {isLoadingSales || isLoadingReturns ? (
              <div className="h-8 flex items-center">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <p className="text-2xl font-bold text-foreground">{transactionCount}</p>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Package className="w-4 h-4" />
              <span className="text-sm">Units Sold</span>
            </div>
            {isLoadingSales || isLoadingReturns ? (
              <div className="h-8 flex items-center">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <p className="text-2xl font-bold text-foreground">{totalUnitsSold}</p>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <ArrowUpRight className="w-4 h-4" />
              <span className="text-sm">IBFT Received</span>
            </div>
            {isLoadingSales || isLoadingReturns ? (
              <div className="h-8 flex items-center">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <p className="text-2xl font-bold text-blue-500">Rs. {totalIbftReceived.toLocaleString()}</p>
            )}
          </div>
        </div>
      </div>

      {/* Mobile view */}
      <div className="md:hidden space-y-3 print:hidden">
        {isLoadingSales || isLoadingReturns ? (
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
                  {item.customer?.name || (item as any).customer_name || "Walk-in"}
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
                    <Button variant="ghost" size="icon" className="text-[#25D366] hover:bg-[#25D366] hover:text-white" onClick={() => handleDirectWhatsApp(item)}>
                      <MessageCircle className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handlePrint(item.id, 'sale')}>
                      <Printer className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop view */}
      <div className="hidden print:block mb-6">
        <h1 className="text-2xl font-bold mb-2">Sales Summary</h1>
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
            {isLoadingSales || isLoadingReturns ? (
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
                    {item.customer?.name || (item as any).customer_name || "Walk-in"}
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
                        <Button variant="ghost" size="icon" className="text-[#25D366] hover:bg-[#25D366] hover:text-white" onClick={() => handleDirectWhatsApp(item)}>
                          <MessageCircle className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handlePrint(item.id, 'sale')} title="Print Receipt">
                          <Printer className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => { setSelectedGiftSale(item); setGiftReceiptDialogOpen(true); }} title="Print Gift Receipt">
                          <Gift className="w-4 h-4" />
                        </Button>
                        {item.status !== 'cancelled' && isToday(new Date(item.created_at)) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditPayment(item)}
                            title="Edit Payment Method"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
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

      {/* Gift Receipt Dialog */}
      {
        selectedGiftSale && (
          <PrintGiftReceiptDialog
            open={giftReceiptDialogOpen}
            onOpenChange={setGiftReceiptDialogOpen}
            saleNumber={selectedGiftSale.sale_number || ''}
            items={(selectedGiftSale.sale_items || []).map((item: any) => ({
              productName: item.product_name || 'Unknown',
              quantity: item.quantity || 0,
            }))}
            date={new Date(selectedGiftSale.created_at)}
          />
        )
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

export default SalesSummary;
