import { useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, MessageCircle, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { generateBillMessage, openWhatsApp } from "@/utils/whatsapp";
import { useStoreSettings } from "@/hooks/useStoreSettings";
import { useBillPrinter } from "@/hooks/useBillPrinter";
import { printA4Invoice } from "@/utils/printA4Invoice";
import { FileText } from "lucide-react";

interface SaleItem {
  productName: string;
  quantity: number;
  metersPerUnit: number;
  pricePerMeter: number;
  totalPrice: number;
  taxRate: number;    // GST %
  taxAmount: number;  // GST Amount per unit
}

interface PrintBillProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saleNumber: string;
  customerName: string;
  customerPhone?: string;
  customerBalance?: number;
  items: SaleItem[];
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: string;
  amountReceived: number;
  change: number;
  date: Date;
  autoPrint?: boolean;
  saleType?: "counter" | "delivery";
  fbrInvoiceNumber?: string;
  fbrQrCode?: string;
  fbrPosId?: string;
  paymentSplits?: any[];
  documentType?: "invoice" | "quotation";
}

const PrintBillDialog = ({
  open,
  onOpenChange,
  saleNumber,
  customerName,
  customerPhone,
  customerBalance,
  items,
  subtotal,
  discount,
  total,
  paymentMethod,
  amountReceived,
  change,
  date,
  autoPrint = false,
  saleType = "counter",
  fbrInvoiceNumber,
  fbrQrCode,
  fbrPosId,
  paymentSplits,
  documentType = "invoice",
}: PrintBillProps) => {
  const printRef = useRef<HTMLDivElement>(null);
  const { data: storeSettings, isLoading } = useStoreSettings();

  // POS Service Charge (Fixed)
  const POS_FEE = 1;

  // Helper to group items by product name and price
  const groupItems = (items: SaleItem[]) => {
    const grouped: {
      productName: string;
      pricePerMeter: number;
      quantity: number;
      totalPrice: number;
      taxRate: number;
      taxAmount: number;
      // Derived fields for new layout
      priceExclTax: number;
      totalTaxAmount: number;
      // ...
    }[] = [];

    items.forEach(item => {
      const existing = grouped.find(
        g => g.productName === item.productName && g.pricePerMeter === item.pricePerMeter
      );

      // Price exclusive of tax = Unit Price - Tax Amount per unit
      // If pricePerMeter is the gross price, we subtract taxAmount.
      // If taxAmount is 0, then priceExclTax = pricePerMeter.
      const priceExclTax = item.pricePerMeter - item.taxAmount;

      if (existing) {
        existing.quantity += item.quantity;
        existing.totalPrice += item.totalPrice;
        existing.totalTaxAmount += (item.taxAmount * item.quantity);
      } else {
        grouped.push({
          productName: item.productName,
          pricePerMeter: item.pricePerMeter,
          quantity: item.quantity,
          totalPrice: item.totalPrice,
          taxRate: item.taxRate,
          taxAmount: item.taxAmount,
          priceExclTax: priceExclTax,
          totalTaxAmount: item.taxAmount * item.quantity
        });
      }
    });

    return grouped;
  };

  /* Thermal Printer Config */
  const { printBill } = useBillPrinter();
  const isQuotation = documentType === "quotation";

  const handlePrint80mm = () => {
    printBill({
      saleNumber,
      customerName,
      customerPhone,
      customerBalance,
      items,
      subtotal,
      discount,
      total,
      paymentMethod,
      amountReceived,
      change,
      date,
      saleType,
      fbrInvoiceNumber,
      fbrQrCode,
      fbrPosId,
      paymentSplits,
      isQuotation,
      documentType,
    });
  };

  const handlePrintA4 = () => {
    printA4Invoice({
      saleNumber,
      customerName,
      customerPhone,
      customerBalance,
      items,
      subtotal,
      discount,
      total,
      paymentMethod,
      amountReceived,
      change,
      date,
      fbrInvoiceNumber,
      fbrQrCode,
      fbrPosId,
      paymentSplits,
      isQuotation,
      documentType,
    }, storeSettings);
  };


  const handleWhatsApp = () => {
    const message = generateBillMessage(
      saleNumber,
      customerName,
      items,
      total,
      discount,
      customerBalance || 0,
      storeSettings,
      isQuotation
    );
    openWhatsApp(customerPhone, message);
  };

  const previewItems = groupItems(items);
  const totalItems = previewItems.reduce((acc, item) => acc + item.quantity, 0);
  const totalTax = previewItems.reduce((acc, item) => acc + item.totalTaxAmount, 0);
  const subtotalExclTax = subtotal - totalTax;
  const grandTotal = total + POS_FEE;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isQuotation ? (
              <>
                <FileText className="w-5 h-5 text-primary" />
                Quotation Preview
              </>
            ) : (
              <>
                <Printer className="w-5 h-5 text-primary" />
                Print Invoice (Thermal)
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Bill Preview */}
        <div
          ref={printRef}
          className="bg-white text-black p-4 rounded-lg border font-mono text-sm max-h-[60vh] overflow-auto"
        >
          {/* Header */}
          <div className="header text-center mb-3 pb-2 border-b border-dashed border-gray-400">
            {isLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {isQuotation && (
                  <div className="text-[11px] font-bold tracking-wider text-center text-primary uppercase mb-1">
                    Quotation / Estimate
                  </div>
                )}
                {(storeSettings?.fbr_environment === 'sandbox' || fbrInvoiceNumber?.startsWith('SANDBOX-')) && (
                  <div className="text-[10px] font-bold tracking-wider text-center bg-black text-white px-2 py-0.5 rounded my-1 uppercase">
                    *** TRAINING / TEST INVOICE (SANDBOX) ***
                  </div>
                )}
                {storeSettings?.logo_url ? (
                  <img
                    src={storeSettings.logo_url}
                    alt="Store Logo"
                    className="w-40 mx-auto mb-2 filter grayscale contrast-125"
                  />
                ) : (
                  <h1 className="text-lg font-bold uppercase">{storeSettings?.store_name || "Retail POS"}</h1>
                )}
                {storeSettings?.address && <p className="text-sm text-gray-600">{storeSettings.address}</p>}
                {storeSettings?.phone && <p className="text-sm text-gray-600">Tel: {storeSettings.phone}</p>}
              </>
            )}
          </div>

          <div className="flex justify-between text-xs mb-2">
            <span>{isQuotation ? "Quote" : "Inv"}: <b>{saleNumber}</b></span>
            <span>{format(date, 'dd-MMM HH:mm')}</span>
          </div>
          <div className="text-xs mb-2">Cust: <b>{customerName}</b></div>

          <div className="divider border-t border-dashed border-gray-400 my-2" />

          {/* Items Header */}
          <div className="grid grid-cols-12 gap-1 text-[10px] font-bold border-b border-dashed border-gray-400 pb-1 mb-1">
            <div className="col-span-3">Price</div>
            <div className="col-span-2 text-center">GST%</div>
            <div className="col-span-2 text-center">Qty</div>
            <div className="col-span-2 text-right">GST</div>
            <div className="col-span-3 text-right">Total</div>
          </div>

          {/* Items */}
          <div className="space-y-2">
            {previewItems.map((item, idx) => (
              <div key={idx} className="text-xs border-b border-gray-100 pb-1">
                <div className="font-bold mb-1">{item.productName}</div>
                <div className="grid grid-cols-12 gap-1 text-[10px]">
                  <div className="col-span-3">{Math.round(item.priceExclTax)}</div>
                  <div className="col-span-2 text-center">{item.taxRate}%</div>
                  <div className="col-span-2 text-center">{item.quantity}</div>
                  <div className="col-span-2 text-right">{Math.round(item.totalTaxAmount)}</div>
                  <div className="col-span-3 text-right font-bold">{item.totalPrice.toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center font-bold text-xs my-2 border-b border-dashed border-gray-400 pb-2">
            Total Items: {totalItems}
          </div>

          {/* Totals */}
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span>Subtotal (Excl)</span>
              <span>{Math.round(subtotalExclTax).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>Sales Tax</span>
              <span>{Math.round(totalTax).toLocaleString()}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Discount</span>
                <span>-{discount.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>POS Fee</span>
              <span>1</span>
            </div>
            <div className="flex justify-between text-base font-bold mt-2 pt-2 border-t border-gray-800">
              <span>Grand Total</span>
              <span>{grandTotal.toLocaleString()}</span>
            </div>
          </div>

          <div className="divider border-t border-dashed border-gray-400 my-2" />

          {/* Footer */}
          <div className="text-center text-xs text-gray-500">
            <p>{isQuotation ? "Thank you! (Estimate valid for current day)" : "Thank you!"}</p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2 text-[#25D366] border-[#25D366] hover:bg-[#25D366] hover:text-white" onClick={handleWhatsApp}>
              <MessageCircle className="w-4 h-4" />
              WhatsApp
            </Button>
            <Button onClick={handlePrint80mm} className="gap-2" variant="outline" title="Print Thermal Receipt">
              <Printer className="w-4 h-4" />
              80mm
            </Button>
            <Button onClick={handlePrintA4} className="gap-2" title="Print A4 Invoice">
              <FileText className="w-4 h-4" />
              A4
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PrintBillDialog;
