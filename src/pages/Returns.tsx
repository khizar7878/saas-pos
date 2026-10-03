import { useState, useEffect } from "react";
import { Search, RotateCcw, ArrowRight, Trash2, User, RefreshCw, ShoppingCart, ArrowLeft, Receipt, Minus, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Sale, SaleItem } from "@/types/database";
import { useQueryClient } from "@tanstack/react-query";
import { useStoreSettings } from "@/hooks/useStoreSettings";
import { buildFBRInvoicePayload, submitToFBR } from "@/services/fbrService";

interface ReturnCartItem {
  id: string; // sale_item_id or unique ID
  product_id: string;
  product_name: string;
  sold_quantity: number;
  returned_previously: number;
  return_quantity: number;
  unit_price: number;
  total_price: number;
  restock: boolean;
  original_item_ref?: any; // Reference to original item for updates
}

interface FoundInvoiceData {
  id: string;
  invoice_number: string;
  customer_name: string;
  customer_id: string | null;
  sale_date: string;
  type: 'paid' | 'credit';
  original_ref: any; // Full original object
  fbr_invoice_number: string | null;
}

const CartQuantityInput = ({ quantity, onUpdate }: { quantity: number, onUpdate: (q: number) => void }) => {
  const [val, setVal] = useState(quantity.toString());

  useEffect(() => {
    setVal(quantity.toString());
  }, [quantity]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVal(e.target.value);
  };

  const handleBlur = () => {
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0) {
      if (num !== quantity) onUpdate(num);
    } else {
      setVal(quantity.toString()); // Reset on invalid
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
      value={val}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className="w-12 h-8 text-center px-1 mx-1 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
    />
  );
};

const Returns = () => {
  const queryClient = useQueryClient();
  const { data: storeSettings } = useStoreSettings();
  const [invoiceInput, setInvoiceInput] = useState("");
  const [loading, setLoading] = useState(false);

  // Return Session State
  const [foundInvoice, setFoundInvoice] = useState<FoundInvoiceData | null>(null);
  const [cartPoints, setCartPoints] = useState<ReturnCartItem[]>([]);
  const [restockAll, setRestockAll] = useState(true);

  // Search Logic
  const handleSearch = async () => {
    if (!invoiceInput.trim()) {
      toast.error("Please enter an invoice number");
      return;
    }

    setLoading(true);
    setFoundInvoice(null);
    setCartPoints([]);

    try {
      const query = invoiceInput.trim().toUpperCase();
      const hasLetters = /[A-Z]/.test(query);
      // If the user typed letters (e.g. "CS000101"), match the full string exactly.
      // If they typed only digits, fall back to a numeric suffix match.
      const numeric = query.replace(/\D/g, '');
      const coreNumber = numeric.replace(/^0+/, '');

      if (!query) throw new Error("Invalid invoice number format");

      console.log(`Searching for invoice: ${query} (hasLetters: ${hasLetters}, coreNumber: ${coreNumber})`);

      // 1. Try PAID Sales
      const salesQuery = supabase
        .from('sales')
        .select('*, sale_items(*, product:products(name))');

      if (hasLetters) {
        salesQuery.ilike('sale_number', query);
      } else {
        if (!coreNumber) throw new Error("Invalid invoice number format");
        salesQuery.ilike('sale_number', `%${coreNumber}`);
      }

      const { data: sales, error: salesError } = await salesQuery.limit(1);

      if (sales && sales.length > 0) {
        const sale = sales[0];
        console.log("Found Paid Sale:", sale);

        const items: ReturnCartItem[] = sale.sale_items.map((item: any) => {
          const previouslyReturned = item.quantity_returned || 0;
          const remaining = item.quantity - previouslyReturned;

          return {
            id: item.id,
            product_id: item.product_id,
            product_name: item.product?.name || item.product_name,
            sold_quantity: item.quantity,
            returned_previously: previouslyReturned,
            return_quantity: remaining > 0 ? remaining : 0, // Default to max returnable
            unit_price: item.unit_price,
            total_price: item.unit_price * (remaining > 0 ? remaining : 0),
            restock: true,
            original_item_ref: item
          };
        }).filter((i: ReturnCartItem) => i.return_quantity > 0); // Only auto-add items that CAN be returned? Or show all and disable? 
        // User Requirement: "Load... only fetch those items that have not yet been returned".
        // Use filter.

        if (items.length === 0) {
          toast.warning("This invoice exists but all items have already been returned.");
          setLoading(false);
          return;
        }

        setFoundInvoice({
          id: sale.id,
          invoice_number: sale.sale_number,
          customer_name: sale.customer_name,
          customer_id: sale.customer_id,
          sale_date: sale.created_at,
          type: 'paid',
          original_ref: sale,
          fbr_invoice_number: sale.fbr_invoice_number
        });
        setCartPoints(items);
        setLoading(false);
        return;
      }

      // 2. Try CREDIT Sales
      const creditQuery = supabase
        .from('credit_sales')
        .select('*');

      if (hasLetters) {
        creditQuery.ilike('bill_number', query);
      } else {
        creditQuery.ilike('bill_number', `%${coreNumber}`);
      }

      const { data: creditSales, error: creditError } = await creditQuery.limit(1);

      if (creditSales && creditSales.length > 0) {
        const sale = creditSales[0];
        console.log("Found Credit Sale:", sale);

        // Parse JSON items
        const rawItems = sale.items as any[];
        const items: ReturnCartItem[] = rawItems.map((item: any, idx: number) => {
          const qty = item.quantity || 0;
          const previouslyReturned = item.quantity_returned || item.returned || 0; // Check both keys for safety
          const remaining = qty - previouslyReturned;

          return {
            id: `cs-item-${idx}`, // Synthetic ID for credit sale items
            product_id: item.product_id || item.productId,
            product_name: item.product_name || item.productName || "Unknown Item",
            sold_quantity: qty,
            returned_previously: previouslyReturned,
            return_quantity: remaining > 0 ? remaining : 0,
            unit_price: item.unit_price || item.price || 0,
            total_price: (item.unit_price || item.price || 0) * (remaining > 0 ? remaining : 0),
            restock: true,
            original_item_ref: { ...item, originalIndex: idx } // Store index to update array later
          };
        }).filter((i: ReturnCartItem) => i.return_quantity > 0);

        if (items.length === 0) {
          toast.warning("This invoice exists but all items have already been returned.");
          setLoading(false);
          return;
        }

        setFoundInvoice({
          id: sale.id,
          invoice_number: sale.bill_number,
          customer_name: sale.customer_name,
          customer_id: sale.customer_id,
          sale_date: sale.created_at,
          type: 'credit',
          original_ref: sale,
          fbr_invoice_number: null
        });
        setCartPoints(items);
        setLoading(false);
        return;
      }

      toast.error("Invoice not found. Please check the number.");

    } catch (error) {
      console.error(error);
      toast.error("Error searching for invoice.");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveItem = (id: string) => {
    setCartPoints(prev => prev.filter(item => item.id !== id));
  };

  const handleQuantityChange = (id: string, newQty: number) => {
    setCartPoints(prev => prev.map(item => {
      if (item.id === id) {
        const maxReturnable = item.sold_quantity - item.returned_previously;
        const validQty = Math.min(Math.max(0, newQty), maxReturnable);
        return {
          ...item,
          return_quantity: validQty,
          total_price: validQty * item.unit_price
        };
      }
      return item;
    }));
  };

  const handleRestockToggle = (id: string) => {
    setCartPoints(prev => prev.map(item =>
      item.id === id ? { ...item, restock: !item.restock } : item
    ));
  };

  const handeGlobalRestock = (val: boolean) => {
    setRestockAll(val);
    setCartPoints(prev => prev.map(item => ({ ...item, restock: val })));
  };

  const calculateTotal = () => cartPoints.reduce((sum, item) => sum + item.total_price, 0);

  const processReturn = async () => {
    if (!foundInvoice || cartPoints.length === 0) return;

    // Filter out 0 qty items just in case
    const validItems = cartPoints.filter(i => i.return_quantity > 0);
    if (validItems.length === 0) {
      toast.error("No items with valid quantity to return.");
      return;
    }

    setLoading(true);
    const totalAmount = validItems.reduce((sum, i) => sum + i.total_price, 0);

    try {
      // 1. Generate Return Number
      const { data: returnNumData, error: seqError } = await supabase.rpc('get_next_sequence', { seq_id: 'return' });
      if (seqError) throw seqError;
      const returnNumber = `RET-${String(returnNumData).padStart(6, '0')}`;

      // 2. Create Return Record
      const { data: returnRecord, error: returnError } = await supabase
        .from('returns')
        .insert({
          return_number: returnNumber,
          original_sale_id: foundInvoice.type === 'paid' ? foundInvoice.id : null, // Only link FK for paid sales
          // For credit sales, we might store ID in a note or loose reference, as FK enforces 'sales' table
          customer_id: foundInvoice.customer_id,
          customer_name: foundInvoice.customer_name,
          total_amount: totalAmount,
          status: 'completed',
          return_type: foundInvoice.type === 'paid' ? 'cash' : 'credit',
          refund_method: foundInvoice.type === 'paid' ? 'cash' : 'credit',
          reason: foundInvoice.type === 'credit' ? `Credit Note for Bill #${foundInvoice.invoice_number}` : `Return for Invoice #${foundInvoice.invoice_number}`
        })
        .select()
        .single();

      if (returnError) throw returnError;

      // 3. Process Items & Updates
      for (const item of validItems) {
        // A. Insert Return Item
        const { error: itemError } = await supabase.from('return_items').insert({
          return_id: returnRecord.id,
          product_id: item.product_id,
          sale_item_id: foundInvoice.type === 'paid' ? item.id : null, // Link if paid
          quantity: item.return_quantity,
          unit_price: item.unit_price,
          total_price: item.total_price
        });
        if (itemError) throw itemError;

        // B. Restock (Common)
        if (item.restock) {
          // RPC or direct update? Direct update is risky for concurrency but okay for now users
          // "stock_quantity + returned_qty"
          // Get current stock
          const { data: prod } = await supabase.from('products').select('stock_quantity').eq('id', item.product_id).single();
          if (prod) {
            await supabase.from('products').update({
              stock_quantity: prod.stock_quantity + item.return_quantity
            }).eq('id', item.product_id);
          }
        }

        // C. Specific Updates based on Type
        if (foundInvoice.type === 'paid') {
          // PAID: Update sale_item quantity_returned
          const currentReturned = item.returned_previously;
          await supabase.from('sale_items').update({
            quantity_returned: currentReturned + item.return_quantity
          }).eq('id', item.id);
        }
      }

      // D. Credit Sale Specific: Update JSON Items
      if (foundInvoice.type === 'credit') {
        // Fetch the LATEST credit sale record to ensure we have the correct current total amount
        const { data: freshCreditSale, error: freshError } = await supabase
          .from('credit_sales')
          .select('total_amount, items')
          .eq('id', foundInvoice.id)
          .single();

        if (freshError) throw freshError;

        // Recalculate based on fresh data
        const currentTotal = freshCreditSale.total_amount;
        // logic for items update is already based on fetched `updatedItems` which came from `foundInvoice` (which might be stale if another return happened concurrently? - for now assuming single user or low concurrency on same bill returns). 
        // Ideally we should use `freshCreditSale.items` too.
        // Let's use `freshCreditSale.items` to be safe.

        const freshItems = freshCreditSale.items as any[];
        // We need to map our validItems to this fresh array fetched from DB
        const reUpdatedItems = [...freshItems];

        validItems.forEach(cartItem => {
          // We need to find the item in the fresh array.
          // We can use originalIndex if the array order is preserved (it should be).
          const idx = cartItem.original_item_ref.originalIndex;
          if (reUpdatedItems[idx]) {
            const prevRet = reUpdatedItems[idx].quantity_returned || reUpdatedItems[idx].returned || 0;
            reUpdatedItems[idx].quantity_returned = prevRet + cartItem.return_quantity;
            reUpdatedItems[idx].returned = prevRet + cartItem.return_quantity;
          }
        });

        // Check if all items are now fully returned
        const allItemsReturned = reUpdatedItems.every((item: any) => {
          const qty = item.quantity || 0;
          const returned = item.quantity_returned || item.returned || 0;
          return returned >= qty;
        });

        await supabase.from('credit_sales').update({
          items: reUpdatedItems,
          total_amount: Math.max(0, currentTotal - totalAmount), // Decrease total amount from FRESH total
          ...(allItemsReturned ? { status: 'delivered' } : {}) // Auto-close bill if all items returned
        }).eq('id', foundInvoice.id);

        // Also add Ledger Entry for CREDIT Return (Credits the customer account)
        if (foundInvoice.customer_id) {
          // Fetch current balance
          const { data: acc } = await supabase.from('accounts').select('current_balance').eq('id', foundInvoice.customer_id).single();
          if (acc) {
            const newBalance = Math.max(0, acc.current_balance - totalAmount);
            await supabase.from('accounts').update({ current_balance: newBalance }).eq('id', foundInvoice.customer_id);

            await supabase.from('ledger_entries').insert({
              account_id: foundInvoice.customer_id,
              reference_type: 'return',
              reference_id: returnRecord.id,
              description: `Return for Credit Bill #${foundInvoice.invoice_number}`,
              debit: 0,
              credit: totalAmount, // Reduces debt
              balance: newBalance
            });
          }
        }
      } else {
        // PAID Sale: Adjust Cash in Hand
        const { data: cashAcc } = await supabase.from('accounts').select('id, current_balance').eq('name', 'Cash in Hand').single();
        if (cashAcc) {
          const newCash = cashAcc.current_balance - totalAmount;
          await supabase.from('accounts').update({ current_balance: newCash }).eq('id', cashAcc.id);

          await supabase.from('ledger_entries').insert({
            account_id: cashAcc.id,
            reference_type: 'return',
            reference_id: returnRecord.id,
            description: `Cash Refund - Return #${returnNumber}`,
            debit: 0,
            credit: totalAmount, // Cash Out
            balance: newCash
          });
        }
      }

      toast.success(`Return Processed Successfully! (${foundInvoice.type.toUpperCase()})`);

      // FBR Returns Integration
      if (
        foundInvoice.type === 'paid' && 
        storeSettings?.fbr_integration_enabled && 
        foundInvoice.fbr_invoice_number
      ) {
        try {
          const originalSaleUsin = foundInvoice.invoice_number || foundInvoice.original_ref?.sale_number;
          console.log(`[FBR] Submitting Return for Original Sale USIN: ${originalSaleUsin} (FBR Invoice: ${foundInvoice.fbr_invoice_number})`);
          
          const returnCart = validItems.map(item => ({
             ...item.original_item_ref,
             quantity: item.return_quantity,
             name: item.product_name,
             product_id: item.product_id,
             unit_price: item.unit_price,
             total_price: item.return_quantity * item.unit_price,
             tax_percentage: item.original_item_ref?.tax_percentage ?? item.original_item_ref?.tax_percent ?? 0,
             tax_amount: item.original_item_ref?.tax_amount ?? 0,
             pct_code: item.original_item_ref?.pct_code || "01011000",
          }));

          const fbrPayload = await buildFBRInvoicePayload({
            cart: returnCart,
            posId: parseInt(storeSettings.fbr_pos_id || "189142"),
            usin: returnNumber,
            paymentMethod: 1, // Cash mostly for returns
            invoiceDate: new Date().toISOString(),
            discountAmount: 0,
            customerName: foundInvoice.customer_name || "Walk-in",
            isReturn: true,
            originalUsin: originalSaleUsin,
          });

          console.log("[FBR] Return Payload (InvoiceType 3):", fbrPayload);

          const fbrResponse = await submitToFBR(
            storeSettings.fbr_api_url || "http://146.190.202.112:5060/api/fbr/submit-invoice",
            fbrPayload
          );

          console.log("[FBR] Return Response Received:", fbrResponse);

          let fbrReturnInvoiceNumber = fbrResponse.fbrInvoiceNumber || fbrResponse.FBRInvoiceNumber;
          if (fbrReturnInvoiceNumber && typeof fbrReturnInvoiceNumber === 'string' && fbrReturnInvoiceNumber.trim().startsWith('{')) {
             try {
               const parsed = JSON.parse(fbrReturnInvoiceNumber);
               fbrReturnInvoiceNumber = parsed.FBRInvoiceNumber || parsed.fbrInvoiceNumber || fbrReturnInvoiceNumber;
             } catch (e) {
               console.warn("[FBR] Failed to parse inner JSON of FBR Return Invoice Number", e);
             }
          }

          if (fbrReturnInvoiceNumber) {
             if (!returnRecord?.id) {
               console.error('[FBR] returnRecord.id is missing — cannot save FBR return number');
               toast.warning("FBR number received but could not be saved: return record ID missing.");
             } else {
               const { error: fbrSaveError } = await supabase
                 .from('returns')
                 .update({ 
                   fbr_return_number: fbrReturnInvoiceNumber,
                   fbr_invoice_number: fbrReturnInvoiceNumber,
                 })
                 .eq('id', returnRecord.id);

               if (fbrSaveError) {
                 console.error('[FBR] Failed to save FBR return number to DB:', fbrSaveError);
                 toast.warning(`FBR number received (${fbrReturnInvoiceNumber}) but DB save failed: ${fbrSaveError.message}`, { duration: 8000 });
               } else {
                 console.log(`[FBR] Saved FBR Return Invoice Number: ${fbrReturnInvoiceNumber} for return ${returnRecord.id}`);
                 toast.success(`FBR Return Stamped: ${fbrReturnInvoiceNumber}`);
               }
             }
          } else {
             const errorMsg = fbrResponse?.Response || fbrResponse?.Message || "Expected Return Invoice Number but didn't receive one.";
             toast.error(`FBR Integration: ${errorMsg}`, { duration: 6000 });
          }

        } catch (fbrError: any) {
          console.error("[FBR] Return Submission Failed:", fbrError);
          toast.error(`FBR Return Submission Failed: ${fbrError.message || 'Check console'}`, { duration: 6000 });
        }
      }

      // Reset
      setFoundInvoice(null);
      setCartPoints([]);
      setInvoiceInput("");

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['returns'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['credit_sales'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['ledger'] });
      queryClient.invalidateQueries({ queryKey: ['customer-history'] });

    } catch (e: any) {
      console.error(e);
      toast.error(`Return Failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Keyboard shortcut
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="h-full flex flex-col md:flex-row bg-background">
      {/* LEFT PANEL: Search & Input */}
      <div className="w-full md:w-1/3 min-w-[350px] p-6 border-r flex flex-col gap-6 bg-card/50">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <RotateCcw className="w-6 h-6 text-primary" />
            Process Return
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Found an issue? Process a return below.</p>
        </div>

        <Card className="border-primary/20 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium uppercase tracking-wider text-primary">Lookup Invoice</CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Enter Invoice # (e.g. 1045)"
                className="font-mono text-lg"
                value={invoiceInput}
                onChange={e => setInvoiceInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading}
                autoFocus
              />
              <Button size="icon" onClick={handleSearch} disabled={loading}>
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>

        {foundInvoice && (
          <div className="mt-4 p-4 rounded-lg border bg-card animate-in fade-in slide-in-from-left-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-bold text-lg">{foundInvoice.customer_name || "Walk-in Customer"}</h3>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  {foundInvoice.type === 'paid' ? <Receipt className="w-3 h-3" /> : <Receipt className="w-3 h-3 text-orange-500" />}
                  {foundInvoice.type === 'paid' ? 'Paid Invoice' : 'Credit Bill'} #{foundInvoice.invoice_number}
                </p>
              </div>
            </div>
            <Separator />
            <div className="py-2 flex justify-between text-sm text-muted-foreground">
              <span>Date:</span>
              <span>{new Date(foundInvoice.sale_date).toLocaleDateString()}</span>
            </div>
          </div>
        )}
      </div>

      {/* RIGHT PANEL: Cart & Summary */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-muted/10">

        {/* Empty State */}
        {!foundInvoice && (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8">
            <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-4">
              <ShoppingCart className="w-10 h-10 opacity-20" />
            </div>
            <h3 className="text-lg font-medium">Ready to Return</h3>
            <p className="max-w-xs text-center mt-2 opacity-70">Enter an invoice number on the left to load items and process a refund.</p>
          </div>
        )}

        {/* Cart Content */}
        {foundInvoice && (
          <>
            <div className="flex items-center justify-between p-4 border-b bg-card">
              <h2 className="font-semibold flex items-center gap-2">
                <ShoppingCart className="w-4 h-4" />
                Select Items to Return
              </h2>
              <div className="flex items-center gap-2">
                <Label htmlFor="restock-all" className="text-xs">Restock All</Label>
                <Switch id="restock-all" checked={restockAll} onCheckedChange={handeGlobalRestock} className="scale-75" />
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4 space-y-3">
              {cartPoints.map((item) => (
                <div key={item.id} className="group flex items-center gap-4 p-3 bg-card rounded-lg border hover:border-primary/50 transition-colors shadow-sm">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-foreground">{item.product_name}</h4>
                      {item.returned_previously > 0 && (
                        <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full border border-orange-200">
                          {item.returned_previously} prev. returned
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Sold Qty: {item.sold_quantity} | Unit Price: Rs. {item.unit_price}
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Qty Input */}
                    <div className="flex flex-col items-center gap-1">
                      <Label className="text-[10px] uppercase text-muted-foreground">Return Qty</Label>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-8 h-8 rounded bg-muted border border-border"
                          onClick={() => handleQuantityChange(item.id, item.return_quantity - 1)}
                        >
                          <Minus className="w-3 h-3" />
                        </Button>
                        <CartQuantityInput
                          quantity={item.return_quantity}
                          onUpdate={(q) => handleQuantityChange(item.id, q)}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-8 h-8 rounded bg-muted border border-border"
                          onClick={() => handleQuantityChange(item.id, item.return_quantity + 1)}
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>

                    {/* Restock Toggle */}
                    <div className="flex flex-col items-center gap-2">
                      <Label className="text-[10px] uppercase text-muted-foreground">Restock</Label>
                      <Switch checked={item.restock} onCheckedChange={() => handleRestockToggle(item.id)} className="scale-75" />
                    </div>

                    {/* Remove Button */}
                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => handleRemoveItem(item.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {cartPoints.length === 0 && (
                <div className="text-center p-8 border-2 border-dashed rounded-lg text-muted-foreground">
                  <p>All items removed. Search again or add items.</p>
                </div>
              )}
            </div>

            {/* Footer Summary */}
            <div className="p-6 bg-card border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-muted-foreground text-sm">Total Refund Amount</p>
                  <h2 className="text-3xl font-bold text-destructive">Rs. {calculateTotal().toLocaleString()}</h2>
                </div>
                <div className="text-right">
                  <p className="text-muted-foreground text-sm">Items Count</p>
                  <p className="text-xl font-medium">{cartPoints.reduce((s, i) => s + (i.return_quantity > 0 ? 1 : 0), 0)}</p>
                </div>
              </div>

              <Button
                size="lg"
                className="w-full text-lg h-12 gap-2"
                variant="destructive"
                onClick={processReturn}
                disabled={loading || cartPoints.length === 0}
              >
                {loading && <RefreshCw className="w-5 h-5 animate-spin" />}
                {!loading && <ArrowLeft className="w-5 h-5" />}
                Confirm Return & Refund
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Returns;