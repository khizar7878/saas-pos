import { useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { format } from "date-fns";
import { useStoreSettings } from "@/hooks/useStoreSettings";
import { CreditSale } from "@/types/database";

interface PrintPendingBillProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bill: CreditSale | null;
}

const PrintPendingBillDialog = ({
  open,
  onOpenChange,
  bill,
}: PrintPendingBillProps) => {
  const { data: storeSettings } = useStoreSettings();

  // Calculate remaining items and total
  const items = (bill?.items as any[]) || [];
  const filteredItems = items.filter((item) => {
    const returned = item.quantity_returned || item.returned || 0;
    const qty = item.quantity || 0;
    return (qty - returned) > 0;
  });

  const remainingGross = filteredItems.reduce((sum, item) => {
    const returned = item.quantity_returned || item.returned || 0;
    const qty = item.quantity || 0;
    const remaining = Math.max(0, qty - returned);
    const unitPrice = item.unit_price || item.price || 0;
    return sum + (remaining * unitPrice);
  }, 0);

  const calculatedTotal = remainingGross === 0 ? 0 : (bill?.total_amount !== undefined && bill?.total_amount !== null ? Number(bill.total_amount) : remainingGross);
  const discount = Math.max(0, remainingGross - calculatedTotal);


  const handlePrint = () => {
    if (!bill) return;

    const printWindow = window.open('', '_blank', 'width=800,height=600');

    if (printWindow) {
      const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
      const themeColor = `hsl(${primaryColor})`;
      const htmlContent = generateInvoiceHTML(bill, filteredItems, storeSettings, calculatedTotal, remainingGross, discount, themeColor);

      printWindow.document.write(`
        <html>
          <head>
            <title>Invoice ${bill.bill_number}</title>
            <style>
              @page {
                size: A5;
                margin: 0;
              }
              body { 
                font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
                margin: 0;
                padding: 15mm;
                color: #333;
                background: white;
                font-size: 10pt;
              }
              .invoice-container {
                width: 100%;
                hight: 100%;
                border: 1px solid #ddd;
                padding: 10mm;
                box-sizing: border-box;
                position: relative;
              }
              .header { 
                text-align: center;
                margin-bottom: 20px;
                border-bottom: 2px solid ${themeColor};
                padding-bottom: 15px;
              }
              .store-name { 
                font-size: 20pt; 
                font-weight: bold; 
                text-transform: uppercase; 
                margin: 0;
                color: ${themeColor};
              }
              .store-logo {
                max-width: 200px;
                max-height: 80px;
                object-fit: contain;
                margin-bottom: 10px;
              }
              .store-details { font-size: 9pt; color: #555; margin-top: 5px; }
              
              .bill-info {
                display: flex;
                justify-content: space-between;
                margin-bottom: 20px;
              }
              .info-group { display: flex; flex-direction: column; }
              .label { font-weight: bold; font-size: 8pt; color: #777; text-transform: uppercase; }
              .value { font-size: 11pt; font-weight: 500; }

              .invoice-title {
                text-align: center;
                font-size: 14pt;
                font-weight: bold;
                text-transform: uppercase;
                margin: 15px 0;
                letter-spacing: 2px;
                margin: 15px 0;
                letter-spacing: 2px;
                border: 1px solid ${themeColor};
                color: ${themeColor};
                padding: 5px;
                display: inline-block;
                width: 100%;
              }

              table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 20px;
              }
              th {
                background: #f5f5f5;
                text-align: left;
                padding: 8px;
                border-bottom: 2px solid #ddd;
                font-weight: bold;
                font-size: 9pt;
                text-transform: uppercase;
              }
              td {
                padding: 8px;
                border-bottom: 1px solid #eee;
                font-size: 10pt;
              }
              .text-right { text-align: right; }
              .text-center { text-align: center; }

              .totals {
                display: flex;
                justify-content: flex-end;
                margin-top: 20px;
              }
              .totals-table {
                width: 50%;
                border-collapse: collapse;
              }
              .totals-table td {
                padding: 5px 10px;
                border: none;
              }
              .totals-table .amount { font-weight: bold; font-size: 12pt; }
              .grand-total {
                border-top: 2px solid ${themeColor} !important;
                border-bottom: 2px solid ${themeColor} !important;
                background: #f9f9f9;
              }

              .footer {
                position: absolute;
                bottom: 15mm;
                left: 10mm;
                right: 10mm;
                text-align: center;
                font-size: 8pt;
                color: #777;
                border-top: 1px solid #eee;
                padding-top: 10px;
              }
              
              .signatures {
                margin-top: 50px;
                display: flex;
                justify-content: space-between;
                padding: 0 20px;
              }
              .sig-line {
                width: 150px;
                border-top: 1px solid #333;
                text-align: center;
                padding-top: 5px;
                font-size: 9pt;
              }

              @media print {
                body { padding: 0; }
                .invoice-container { border: none; padding: 15mm; }
              }
            </style>
          </head>
          <body>
            ${htmlContent}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 500);
    }
  };

  const generateInvoiceHTML = (bill: CreditSale, items: any[], settings: any, total: number, subtotal: number, discount: number, themeColor: string) => {
    const rows = items.map((item, index) => {
      const returned = item.quantity_returned || item.returned || 0;
      const qty = item.quantity || 0;
      const remaining = Math.max(0, qty - returned);
      const unitPrice = item.unit_price || item.price || 0;
      const rowTotal = remaining * unitPrice;

      return `
      <tr>
        <td class="text-center" style="width: 5%;">${index + 1}</td>
        <td>
            <div>${item.product_name || item.productName}</div>
        </td>
        <td class="text-center" style="width: 10%;">${remaining}</td>
        <td class="text-right" style="width: 15%;">${unitPrice.toLocaleString()}</td>
        <td class="text-right" style="width: 15%;">${rowTotal.toLocaleString()}</td>
      </tr>
    `}).join('');

    return `
      <div class="invoice-container">
        <div class="header">
          ${settings?.logo_url 
            ? `<img src="${settings.logo_url}" alt="${settings?.store_name}" class="store-logo" />`
            : `<h1 class="store-name">${settings?.store_name || "ABR E KARAM FABRICS"}</h1>`
          }
          <div class="store-details">
            ${settings?.address || "Main Market, Lahore"} | ${settings?.phone || "0300-1234567"}
          </div>
        </div>

        <div class="invoice-title">Credit Invoice</div>

        <div class="bill-info">
          <div class="info-group">
            <span class="label">Bill To</span>
            <span class="value">${bill.customer_name}</span>
            <span style="font-size: 9pt; color: #666;">${bill.customer_phone || ""}</span>
          </div>
          <div class="info-group" style="text-align: right;">
            <span class="label">Invoice Details</span>
            <span class="value"># ${bill.bill_number}</span>
            <span style="font-size: 9pt;">${format(new Date(bill.created_at), 'dd MMM yyyy')}</span>
            ${bill.received_by ? `<span style="font-size: 9pt; color: #666; margin-top: 5px;">Rcvd By: ${bill.received_by}</span>` : ""}
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th class="text-center">#</th>
              <th>Description</th>
              <th class="text-center">Qty</th>
              <th class="text-right">Rate</th>
              <th class="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>

        <div class="totals">
          <table class="totals-table">
            ${discount > 0 ? `
            <tr class="subtotal-row">
              <td class="text-right">Subtotal:</td>
              <td class="text-right amount">Rs. ${subtotal.toLocaleString()}</td>
            </tr>
            <tr class="discount-row">
              <td class="text-right" style="color: #059669;">Discount:</td>
              <td class="text-right amount" style="color: #059669;">- Rs. ${discount.toLocaleString()}</td>
            </tr>
            ` : ''}
            <tr class="grand-total">
              <td class="text-right">Total Payable:</td>
              <td class="text-right amount">Rs. ${total.toLocaleString()}</td>
            </tr>
          </table>
        </div>

        <div class="signatures">
            <div class="sig-line">Receiver's Signature</div>
            <div class="sig-line">Authorized Signature</div>
        </div>

        <div class="footer">
          <p>${settings?.footer_text || "Thank you for your business!"}</p>
        </div>
      </div>
    `;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-primary" />
            Print Pending Bill
          </DialogTitle>
        </DialogHeader>

        <div className="p-4 border rounded-md bg-muted/20 text-center space-y-2">
          <div className="text-4xl font-bold font-mono">{bill?.bill_number}</div>
          <div className="text-lg font-medium">{bill?.customer_name}</div>
          <div className="text-2xl font-bold text-destructive">Rs. {calculatedTotal.toLocaleString()}</div>
          <p className="text-sm text-muted-foreground mt-2">
            Ready to print on A5 paper.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" />
            Print Bill (A5)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PrintPendingBillDialog;
