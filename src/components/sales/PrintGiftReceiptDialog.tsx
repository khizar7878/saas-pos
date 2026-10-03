import { useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, Gift } from "lucide-react";
import { format } from "date-fns";
import { useStoreSettings } from "@/hooks/useStoreSettings";

interface GiftReceiptItem {
  productName: string;
  quantity: number;
}

interface PrintGiftReceiptProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saleNumber: string;
  items: GiftReceiptItem[];
  date: Date;
  autoPrint?: boolean;
}

const PrintGiftReceiptDialog = ({
  open,
  onOpenChange,
  saleNumber,
  items,
  date,
  autoPrint = false,
}: PrintGiftReceiptProps) => {
  const printRef = useRef<HTMLDivElement>(null);
  const { data: storeSettings, isLoading } = useStoreSettings();

  // Helper to group items by product name
  const groupItems = (items: GiftReceiptItem[]) => {
    const grouped: {
      productName: string;
      quantity: number;
    }[] = [];

    items.forEach(item => {
      const existing = grouped.find(g => g.productName === item.productName);
      if (existing) {
        existing.quantity += item.quantity;
      } else {
        grouped.push({
          productName: item.productName,
          quantity: item.quantity,
        });
      }
    });

    return grouped;
  };

  const groupedItems = groupItems(items);

  const handlePrint = () => {
    if (!storeSettings) return;

    // Use a hidden iframe for printing (same as useBillPrinter)
    const iframeId = 'print-frame-gift';
    let printIframe = document.getElementById(iframeId) as HTMLIFrameElement;

    if (!printIframe) {
      printIframe = document.createElement('iframe');
      printIframe.id = iframeId;
      printIframe.style.position = 'fixed';
      printIframe.style.right = '0';
      printIframe.style.bottom = '0';
      printIframe.style.width = '0';
      printIframe.style.height = '0';
      printIframe.style.border = '0';
      printIframe.style.visibility = 'hidden';
      document.body.appendChild(printIframe);
    }

    const printWindow = printIframe.contentWindow;
    if (!printWindow) return;

    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Gift Receipt - ${saleNumber}</title>
          <style>
              @page {
                size: 72mm auto; 
                margin: 0;
              }
              body {
                font-family: 'Courier New', Courier, monospace;
                background: white;
                color: black;
                margin: 0;
                padding: 0;
                width: 67mm;
              }
              .bill-container {
                width: 67mm !important;
                margin: 0 auto;
                padding: 2mm 0; 
                display: flex; 
                flex-direction: column; 
                font-family: 'Courier New', monospace; 
                color: #000 !important; 
                font-weight: bold !important;
                font-size: 10pt;
              }
              .header {
                text-align: center; 
                margin-bottom: 10px; 
                padding-bottom: 5px; 
                border-bottom: 2px solid #000;
              }
              .store-logo {
                width: 60mm; 
                max-width: 100%; 
                display: block; 
                margin: 0 auto; 
                image-rendering: pixelated; 
                filter: url(#bw-threshold);
              }
              .info-grid {
                margin-bottom: 10px; 
                font-size: 9pt; 
                font-weight: bold; 
                border-bottom: 2px solid #000; 
                padding-bottom: 10px;
              }
              .info-line {
                display: flex; 
                justify-content: space-between; 
                margin-bottom: 5px;
              }
              .items-table {
                width: 100%; 
                border-collapse: collapse; 
                margin-bottom: 10px;
              }
              .items-table th {
                text-align: left; 
                border-bottom: 1px dashed #000; 
                font-weight: 900; 
                text-transform: uppercase; 
                font-size: 9pt; 
                padding: 5px 0; 
                color: #000;
              }
              .items-table td {
                padding: 5px 0 2px 0; 
                font-size: 10pt; 
                font-weight: bold; 
                color: #000;
              }
              .footer {
                text-align: center; 
                margin-top: 12px; 
                padding-top: 8px; 
                border-top: 2px solid #000; 
                font-size: 10pt;
                font-weight: bold;
              }
          </style>
          <script>
            window.onload = function() {
                const logo = document.getElementById('store-logo');
                if (logo && !logo.complete) {
                   logo.onload = function() {
                       setTimeout(() => { window.print(); }, 100); 
                   }
                } else {
                   setTimeout(() => { window.print(); }, 100);
                }
            }
          </script>
        </head>
        <body>
          <!-- SVG Filter Definition for Solid Black -->
          <svg style="display: none;">
            <defs>
              <filter id="bw-threshold">
                <feColorMatrix type="matrix" values="0.33 0.33 0.33 0 0
                                                     0.33 0.33 0.33 0 0
                                                     0.33 0.33 0.33 0 0
                                                     0    0    0    1 0"/>
                <feComponentTransfer>
                  <feFuncR type="discrete" tableValues="0 1"/>
                  <feFuncG type="discrete" tableValues="0 1"/>
                  <feFuncB type="discrete" tableValues="0 1"/>
                </feComponentTransfer>
              </filter>
            </defs>
          </svg>

          <div class="bill-container">
            <div class="header">
               <div style="margin: 10px 0;">
                <img id="store-logo" src="${storeSettings.logo_url || '/logo.png'}" class="store-logo" alt="Store Logo" />
               </div>
               
               <p style="margin: 0; font-size: 9pt; font-weight: bold;">${storeSettings.address || ""}</p>
               <p style="margin: 5px 0 0 0; font-size: 9pt; font-weight: bold;">Tel: ${storeSettings.phone || ""}</p>
               <div style="font-size: 14px; font-weight: bold; margin: 10px 0 5px 0; text-transform: uppercase;">
                 🎁 GIFT INVOICE 🎁
               </div>
            </div>
            
            <div class="info-grid">
                <div class="info-line">
                    <span>Trans #: <b>${saleNumber}</b></span>
                </div>
                <div class="info-line">
                    <span>Date: <b>${format(date, "dd-MMM-yy HH:mm")}</b></span>
                </div>
            </div>
            
            <table class="items-table">
                <thead>
                    <tr>
                        <th style="width: 70%">Item</th>
                        <th style="width: 30%; text-align: center;">Qty</th>
                    </tr>
                </thead>
                <tbody>
                    ${groupedItems.map(item => `
                        <tr>
                            <td colspan="2" style="padding-bottom: 0;">${item.productName}</td>
                        </tr>
                        <tr>
                            <td style="border-bottom: 1px dashed #000; padding-bottom: 5px;"></td>
                            <td style="text-align: center; border-bottom: 1px dashed #000; padding-bottom: 5px;">${item.quantity}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            
            <div class="footer">
                ${storeSettings.exchange_policy ?
        `<div style="white-space: pre-line; margin-bottom: 10px;">${storeSettings.exchange_policy}</div>`
        : "No Exchange / Return Policy"}
                
                <div style="margin-top: 10px;">Thank you for shopping with us!</div>
            </div>
          </div>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(printContent);
    printWindow.document.close();
  };

  useEffect(() => {
    if (open && autoPrint && !isLoading && storeSettings) {
      // Small delay to ensure dialog is rendered
      const timer = setTimeout(() => {
        handlePrint();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [open, autoPrint, isLoading, storeSettings]);

  if (isLoading) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-primary" />
            Gift Receipt
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Gift receipts show items and quantities without displaying prices. Perfect for gift-giving!
          </div>

          <div className="bg-muted/50 p-4 rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Transaction #:</span>
              <span className="font-mono font-medium">{saleNumber}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Date:</span>
              <span>{format(date, "dd MMM yyyy HH:mm")}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Items:</span>
              <span className="font-medium">{groupedItems.length} product(s)</span>
            </div>
          </div>

          <div className="text-xs text-muted-foreground">
            <strong>Note:</strong> No prices will be shown on the gift receipt. The recipient can use the transaction number for returns or exchanges.
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handlePrint} className="gap-2">
            <Printer className="w-4 h-4" />
            Print Gift Receipt
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PrintGiftReceiptDialog;
