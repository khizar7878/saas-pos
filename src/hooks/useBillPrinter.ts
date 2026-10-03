import { useCallback } from 'react';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import { format } from 'date-fns';

export interface SaleItem {
  productName: string;
  quantity: number;
  metersPerUnit: number;
  pricePerMeter: number;
  totalPrice: number;
  taxRate: number;    // GST %
  taxAmount: number;  // GST Amount per unit
}

export interface PrintBillData {
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
  saleType?: "counter" | "delivery";
  fbrInvoiceNumber?: string;
  fbrQrCode?: string;
  fbrPosId?: string;
  paymentSplits?: any[];
  isQuotation?: boolean;
  documentType?: "invoice" | "quotation";
}

export const useBillPrinter = () => {
  // ... (rest of the file until generateReceiptHTML)
  const { data: storeSettings } = useStoreSettings();
  const POS_FEE = 1;

  // Helper to group items by product name and price
  const groupItems = useCallback((items: SaleItem[]) => {
    const grouped: {
      productName: string;
      pricePerMeter: number;
      quantity: number;
      totalPrice: number;
      taxRate: number;
      taxAmount: number;
      priceExclTax: number;
      totalTaxAmount: number;
    }[] = [];

    items.forEach(item => {
      const existing = grouped.find(
        g => g.productName === item.productName && g.pricePerMeter === item.pricePerMeter
      );

      // Price exclusive of tax = Unit Price - Tax Amount per unit
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
  }, []);

  const generateReceiptHTML = useCallback((data: PrintBillData, groupedItems: any[]) => {
    // Calculate Summary Totals
    const totalItems = groupedItems.reduce((acc: number, item: any) => acc + item.quantity, 0);
    const totalTax = groupedItems.reduce((acc: number, item: any) => acc + item.totalTaxAmount, 0);
    const subtotalExclTax = data.subtotal - totalTax;
    const grandTotal = data.total + POS_FEE; // Including service charge

    let rowsHTML = "";
    groupedItems.forEach((item: any) => {
      // ... (rows generation)
      rowsHTML += `
          <tr>
            <td colspan="5" style="padding: 5px 0 2px 0; font-size: 11pt; font-weight: bold; text-align: left; color: #000;">
              ${item.productName}
            </td>
          </tr>
          <tr>
            <td style="width: 20%; text-align: left; padding: 0 0 5px 0; font-size: 10pt; color: #000; font-weight: bold;">${Math.round(item.priceExclTax)}</td>
            <td style="width: 15%; text-align: center; padding: 0 0 5px 0; font-size: 10pt; color: #000; font-weight: bold;">${item.taxRate}%</td>
            <td style="width: 15%; text-align: center; padding: 0 0 5px 0; font-size: 10pt; color: #000; font-weight: bold;">${item.quantity}</td>
            <td style="width: 20%; text-align: right; padding: 0 0 5px 0; font-size: 10pt; color: #000; font-weight: bold;">${Math.round(item.totalTaxAmount)}</td>
            <td style="width: 30%; text-align: right; padding: 0 0 5px 0; font-size: 10pt; font-weight: bold; color: #000;">${item.totalPrice.toLocaleString()}</td>
          </tr>
          <tr><td colspan="5" style="border-bottom: 1px dashed #000; margin-bottom: 5px;"></td></tr>
      `;
    });

    const isQuotation = data.isQuotation || data.documentType === 'quotation';

    return `
      <div class="bill-container" style="width: 67mm; margin: 0 auto; padding: 2mm 0; display: flex; flex-direction: column; font-family: 'Courier New', monospace; color: #000 !important; font-weight: bold !important;">
        
        <div class="header" style="text-align: center; margin-bottom: 10px; padding-bottom: 5px; border-bottom: 2px solid #000;">
          <h2 style="font-size: 10pt; font-weight: 900; margin: 0 0 5px 0; text-transform: uppercase;">${isQuotation ? 'QUOTATION / ESTIMATE' : 'SALES TAX INVOICE'}</h2>

          <h1 style="font-size: 18pt !important; font-weight: 900; margin: 5px 0; text-transform: uppercase; letter-spacing: 1px;">Tehzeeb Textile</h1>
          <div style="font-size: 10pt; font-weight: bold; margin-top: 5px;">STRN: 32-77-8761-721</div>
          <div style="font-size: 10pt; font-weight: bold; margin-top: 2px;">NTN: 6298013-2</div>

          
          <div style="margin: 10px 0;">
            <img src="${storeSettings?.logo_url || '/logo.png'}" style="width: 60mm; max-width: 100%; display: block; margin: 0 auto; image-rendering: pixelated; filter: url(#bw-threshold);" alt="Store Logo" />
          </div>
          <p style="margin: 0; font-size: 9pt; font-weight: bold;">${storeSettings?.address || "Main Market, Lahore"}</p>
          <p style="margin: 5px 0 0 0; font-size: 9pt; font-weight: bold;">Tel: ${storeSettings?.phone || "0300-1234567"}</p>
        </div>


        <div class="info-grid" style="margin-bottom: 10px; font-size: 9pt; font-weight: bold; border-bottom: 2px solid #000; padding-bottom: 10px;">
            <div class="info-line" style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                <span>${isQuotation ? 'Quote #:' : 'Inv #:'} <b>${data.saleNumber}</b></span>
                <span>${format(new Date(data.date), 'dd-MMM-yy HH:mm')}</span>
            </div>
            <div class="info-line" style="display: flex; justify-content: space-between;">
                <span>Cust: <b>${data.customerName}</b></span>
            </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 10px;">
            <thead>
                <tr>
                    <th style="text-align: left; border-bottom: 1px dashed #000; font-weight: 900; text-transform: uppercase; font-size: 9pt; padding: 5px 0; width: 20%; color: #000;">Price</th>
                    <th style="text-align: center; border-bottom: 1px dashed #000; font-weight: 900; text-transform: uppercase; font-size: 9pt; padding: 5px 0; width: 15%; color: #000;">GST%</th>
                    <th style="text-align: center; border-bottom: 1px dashed #000; font-weight: 900; text-transform: uppercase; font-size: 9pt; padding: 5px 0; width: 15%; color: #000;">Qty</th>
                    <th style="text-align: right; border-bottom: 1px dashed #000; font-weight: 900; text-transform: uppercase; font-size: 9pt; padding: 5px 0; width: 20%; color: #000;">GST</th>
                    <th style="text-align: right; border-bottom: 1px dashed #000; font-weight: 900; text-transform: uppercase; font-size: 9pt; padding: 5px 0; width: 30%; color: #000;">Total</th>
                </tr>
            </thead>
            <tbody>
                ${rowsHTML}
            </tbody>
        </table>

        <div class="total-items-row" style="text-align: center; margin: 10px 0; font-size: 10pt; font-weight: 900; border-bottom: 2px solid #000; padding-bottom: 10px; color: #000;">
           Total Items: ${totalItems}
        </div>

        <div class="footer" style="margin-top: 5px;">
            <div class="totals-row" style="display: flex; justify-content: space-between; font-size: 10pt; font-weight: bold; color: #000; margin-bottom: 5px;">
                <span>Subtotal (Excl. Tax)</span>
                <span>${Math.round(subtotalExclTax).toLocaleString()}</span>
            </div>
            
            <div class="totals-row" style="display: flex; justify-content: space-between; font-size: 10pt; font-weight: bold; color: #000; margin-bottom: 5px;">
                <span>Sales Tax</span>
                <span>${Math.round(totalTax).toLocaleString()}</span>
            </div>

            ${data.discount > 0 ? `
            <div class="totals-row" style="display: flex; justify-content: space-between; font-size: 10pt; font-weight: bold; color: #000; margin-bottom: 5px;">
                <span>Discount</span>
                <span>-${data.discount.toLocaleString()}</span>
            </div>` : ''}

             <div class="totals-row" style="display: flex; justify-content: space-between; font-size: 10pt; font-weight: bold; color: #000; margin-bottom: 5px;">
                <span>POS Service Charges</span>
                <span>1</span>
            </div>

            <div class="final-total" style="display: flex; justify-content: space-between; font-weight: 900; font-size: 16pt !important; margin-top: 10px; border-top: 2px solid #000; padding-top: 10px; color: #000;">
                <span>Grand Total</span>
                <span>${grandTotal.toLocaleString()}</span>
            </div>
            
            ${!isQuotation ? `
            <div style="margin-top: 10px; border-top: 2px solid #000; padding-top: 5px;">
                ${data.paymentMethod === 'mixed' && data.paymentSplits && data.paymentSplits.length > 0
        ? data.paymentSplits.map((s: any) => `
                <div class="totals-row" style="display: flex; justify-content: space-between; font-size: 10pt; font-weight: bold; color: #000; margin-bottom: 5px;">
                    <span>Paid (${(s.method || '').toUpperCase()})</span>
                    <span>${Number(s.amount).toLocaleString()}</span>
                </div>
        `).join('')
        : `
                <div class="totals-row" style="display: flex; justify-content: space-between; font-size: 10pt; font-weight: bold; color: #000; margin-bottom: 5px;">
                    <span>Paid (${(data.paymentMethod || '').toUpperCase()})</span>
                    <span>${data.amountReceived.toLocaleString()}</span>
                </div>
        `
      }
                 ${data.customerBalance !== undefined && data.customerBalance !== 0 ? `
                  <div class="totals-row" style="display: flex; justify-content: space-between; font-size: 10pt; font-weight: bold; margin-top: 2px; color: #000; margin-bottom: 5px;">
                    <span>Balance</span>
                    <span>${data.customerBalance.toLocaleString()}</span>
                  </div>` : ''}
                
                ${data.paymentMethod === 'cash' && data.change > 0 ? `
                <div class="totals-row" style="display: flex; justify-content: space-between; font-size: 10pt; font-weight: bold; color: #000; margin-bottom: 5px;">
                    <span>Change</span>
                    <span>${data.change.toLocaleString()}</span>
                </div>` : ''}
            </div>
            ` : `
            <div style="margin-top: 10px; font-weight: bold; text-align: center; border-top: 2px solid #000; padding-top: 8px; font-size: 9pt; color: #000;">
              * QUOTATION / ESTIMATE ONLY *<br/>
              <span style="font-size: 8pt; font-weight: normal;">Valid for today &bull; Subject to stock availability</span>
            </div>
            `}
        </div>

            ${storeSettings?.footer_text ? `<p style="margin: 0 0 10px 0;">${storeSettings.footer_text}</p>` : ''}
            ${storeSettings?.exchange_policy ?
        `<div style="margin-top: 10px; font-weight: bold; text-align: center; border-top: 2px solid #000; padding-top: 10px; display: block; white-space: pre-line; font-size: 10pt; color: #000;">${storeSettings.exchange_policy.replace(/\n/g, '<br/>')}</div>`
        : ''}

            ${(!isQuotation && (data.fbrInvoiceNumber || storeSettings?.fbr_integration_enabled)) ? `
             <div style="margin-top: 10px; border-top: 2px solid #000; padding-top: 10px; text-align: center;">
                <div style="font-size: 11pt; font-weight: 900; margin-bottom: 8px;">
                  FBR Invoice # ${data.fbrInvoiceNumber || 'Not Generated'}
                </div>
                <div style="display: flex; justify-content: center; align-items: flex-end; gap: 10px; margin: 10px 0;">
                    ${data.fbrQrCode ? `
                        <img src="/fbr-logo.jpg" style="width: 80px; height: 80px; display: block; object-fit: contain; image-rendering: pixelated; filter: url(#bw-threshold);" alt="FBR POS Logo" />
                        <img src="${data.fbrQrCode}" style="width: 80px; height: 80px; display: block;" alt="FBR QR Code" />
                    ` : '<div style="border: 1px dashed black; padding: 10px; width: 80px; text-align: center;">FBR QR Unavailable</div>'}
                </div>
                <div style="font-size: 9pt; font-weight: bold; text-align: center; margin-top: 8px; line-height: 1.3;">
                   Verify this invoice though FBR TaxAsaan MobileApp or SMS at 9966 and win exciting prizes in draw
                </div>
            </div>
            ` : ''}
         </div>
      </div>
    `;
  }, [storeSettings, POS_FEE]);


  const printBill = useCallback((data: PrintBillData) => {
    const groupedItems = groupItems(data.items);
    const htmlContent = generateReceiptHTML(data, groupedItems);

    // Hidden iframe for silent/seamless printing
    const iframeId = 'print-frame';
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
      printIframe.style.visibility = 'hidden'; // Hide it
      document.body.appendChild(printIframe);
    }

    const printWindow = printIframe.contentWindow;

    if (printWindow) {
      printWindow.document.open();
      // We inject an SVG filter to force pure black and white (thresholding)
      printWindow.document.write(`
            <!DOCTYPE html>
            <html>
              <head>
                <title>${data.isQuotation || data.documentType === 'quotation' ? 'Quotation' : 'Invoice'} ${data.saleNumber}</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
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
                    width: 67mm; /* Increased to 67mm */
                  }
                  .bill-container {
                    width: 67mm !important; /* Increased to 67mm */
                    margin: 0 auto;
                    padding: 2mm 0; 
                    display: flex; 
                    flex-direction: column; 
                    font-family: 'Courier New', monospace; 
                    color: #000 !important; 
                    font-weight: bold !important;
                  }
                </style>
                <script>
                  window.onload = function() {
                    // Check if logo is loaded
                    const logo = document.getElementById('store-logo');
                    if (logo && !logo.complete) {
                       logo.onload = function() {
                           setTimeout(() => { window.print(); }, 100); 
                       }
                    } else {
                       // Small buffer to ensure rendering
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
                ${htmlContent.replace('<img src=', '<img id="store-logo" src=')}
              </body>
            </html>
          `);
      printWindow.document.close();
      // Removed manual setTimeout, relying on injected script
    }
  }, [generateReceiptHTML, groupItems]);

  return { printBill };
};
