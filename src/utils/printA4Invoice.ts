import { format } from "date-fns";

export interface A4InvoiceData {
  saleNumber: string;
  customerName: string;
  customerPhone?: string;
  customerBalance?: number;
  items: any[];
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: string;
  amountReceived: number;
  change: number;
  date: Date;
  fbrInvoiceNumber?: string;
  fbrQrCode?: string;
  fbrPosId?: string;
  paymentSplits?: any[];
  isQuotation?: boolean;
  documentType?: "invoice" | "quotation";
}

export const printA4Invoice = (data: A4InvoiceData, storeSettings: any) => {
  const isQuotation = data.isQuotation || data.documentType === 'quotation';

  const printWindow = window.open("", `_blank_${Date.now()}`, "width=800,height=600");
  if (!printWindow) {
    alert(`Pop-up blocked! Please allow pop-ups for this site to print the ${isQuotation ? 'Quotation' : 'Invoice'}.`);
    return;
  }

  // Calculate totals for summary
  const totalItems = data.items.reduce((acc, item) => acc + item.quantity, 0);
  const totalTax = data.items.reduce((acc, item) => acc + (item.taxAmount * item.quantity), 0);
  const subtotalExclTax = data.subtotal - totalTax;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${isQuotation ? 'Quotation' : 'Invoice'} - ${data.saleNumber}</title>
      <style>
        @media print {
          @page { size: A4; margin: 15mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .footer { position: fixed; bottom: 0; left: 0; right: 0; }
        }
        body { 
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; 
            font-size: 11px; /* Base font size matching screenshot's dense look */
            color: #333; 
            margin: 0; 
            padding: 0; 
        }
        
        .header-container { 
            display: flex; 
            justify-content: space-between; 
            border-bottom: 2px solid #295975; 
            padding-bottom: 10px; 
            margin-bottom: 20px; 
            align-items: flex-end; 
        }
        .logo-section { width: 40%; }
        .logo-section img { max-width: 100%; max-height: 80px; display: block; }
        .company-info { width: 60%; text-align: right; }
        .company-name { 
            font-size: 26px; 
            font-weight: bold; 
            color: #295975; 
            text-transform: uppercase; 
            margin: 0; 
            letter-spacing: 1px;
        }
        .company-details { 
            font-size: 10px; 
            margin-top: 5px; 
            color: #333; 
            font-weight: bold;
            line-height: 1.4;
        }
        
        .invoice-details-grid { 
            display: flex; 
            justify-content: space-between; 
            margin-bottom: 25px; 
            gap: 15px; 
        }
        .bill-to { width: 33%; }
        .invoice-meta { width: 33%; } 
        .fbr-details-section { width: 33%; text-align: right; }
        
        h3 { 
            font-size: 13px; 
            color: #295975; 
            border-bottom: 2px solid #295975; /* Blue line matching screenshot */
            padding-bottom: 4px; 
            margin-bottom: 10px; 
            text-transform: uppercase; 
            margin-top: 0; 
        }
        
        .info-row { 
            display: flex; 
            justify-content: space-between; 
            margin-bottom: 4px; 
            font-size: 11px;
        }
        .info-label { font-weight: bold; color: #333; }
        
        table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-bottom: 20px; 
        }
        th { 
            background-color: #295975; 
            color: white; 
            padding: 8px 6px; 
            text-align: left; 
            font-size: 11px; 
            font-weight: bold; 
        }
        td { 
            padding: 8px 6px; 
            border-bottom: 1px solid #eee; 
            font-size: 11px; 
        }
        tr:nth-child(even) { background-color: #fcfcfc; }
        tr:nth-child(odd) { background-color: #ffffff; }
        
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        
        .summary-section { 
            display: flex; 
            justify-content: flex-end; 
            margin-bottom: 40px; 
            margin-top: 20px;
        }
        .summary-table { width: 40%; border-collapse: collapse; }
        .summary-table td { 
            padding: 8px 12px; 
            font-size: 11px;
        }
        .summary-table tr { background: #ffffff; }
        .summary-table tr:nth-child(even) { background: #f9f9f9; }
        
        /* Specific borders for summary */
        .summary-table .subtotal-row td { border-bottom: 1px solid #eee; }
        .summary-table .tax-row td { border-bottom: 3px solid #295975; }
        
        .summary-total td { 
            font-weight: bold; 
            font-size: 14px; 
            color: #295975; 
            padding-top: 10px; 
            padding-bottom: 10px;
        }
        
        .fbr-qr { 
            width: 60px; 
            height: 60px; 
            display: inline-block; 
            margin-top: 5px; 
        }
        
        .exchange-policy-section {
            font-size: 10px;
            color: #333;
            white-space: pre-line;
            text-align: left;
            line-height: 1.4;
            max-width: 90%;
        }

        .footer { font-size: 10px; color: #aaa; text-align: center; margin-top: 30px; }
      </style>
    </head>
    <body>
    
      <div class="header-container">
        <div class="logo-section">
          ${storeSettings?.logo_url ? `<img src="${storeSettings.logo_url}" alt="Logo" />` : ''}
        </div>
        <div class="company-info">
          <h1 class="company-name">TEHZEEB TEXTILE</h1>
          <div class="company-details">
            ${storeSettings?.address || "P-70, Gole Cloth, Kachehri Bazar, Faisalabad."}<br>
            Phone: ${storeSettings?.phone || "0412616020"}<br>
            NTN: 6298013-2 | STRN: 32-77-8761-721
          </div>
        </div>
      </div>

      <div class="invoice-details-grid">
        <div class="bill-to">
          <h3>BILL TO</h3>
          <div class="info-row"><span class="info-label">Customer:</span> <span>${data.customerName}</span></div>
          ${data.customerPhone ? `<div class="info-row"><span class="info-label">Phone:</span> <span>${data.customerPhone}</span></div>` : ''}
        </div>
        
        <div class="invoice-meta">
          <h3>${isQuotation ? 'QUOTATION DETAILS' : 'INVOICE DETAILS'}</h3>
          <div class="info-row"><span class="info-label">${isQuotation ? 'Quote #:' : 'Invoice #:'}</span> <span>${data.saleNumber}</span></div>
          <div class="info-row"><span class="info-label">Date:</span> <span>${format(new Date(data.date), "dd MMM yyyy HH:mm")}</span></div>
          ${!isQuotation ? `
          <div class="info-row"><span class="info-label">Payment Mode:</span> <span>${data.paymentMethod === 'mixed' && data.paymentSplits && data.paymentSplits.length > 0
      ? data.paymentSplits.map((s: any) => `${(s.method || '').charAt(0).toUpperCase() + (s.method || '').slice(1)}`).join(', ')
      : (data.paymentMethod || '').charAt(0).toUpperCase() + (data.paymentMethod || '').slice(1)
    }</span></div>
          ` : ''}
        </div>

        <div class="fbr-details-section">
            <h3>${isQuotation ? 'QUOTATION' : 'FBR DETAILS'}</h3>
             <div style="text-align: right;">
                ${isQuotation ? `
                    <div style="font-weight: bold; font-size: 11px; color: #333; margin-top: 5px;">ESTIMATE / QUOTATION</div>
                    <div style="font-size: 10px; color: #666; margin-top: 4px;">Valid for current day</div>
                ` : (data.fbrInvoiceNumber || storeSettings?.fbr_integration_enabled) ? `
                    <div style="font-weight: bold; font-size: 10px; margin-bottom: 2px;">FBR Inv # ${data.fbrInvoiceNumber || 'Pending'}</div>
                    ${data.fbrQrCode ? `<img src="${data.fbrQrCode}" class="fbr-qr" alt="QR" />` : '<div style="border: 2px dashed #ccc; padding: 10px; font-size: 11px; margin-left: auto; width: 60px; text-align: center; margin-top: 5px;">No QR</div>'}
                ` : '<div style="font-size: 11px; color: #666; padding: 5px;">FBR Integration Not Active</div>'}
            </div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 4%">#</th>
            <th style="width: 36%">Description</th>
            <th class="text-right" style="width: 12%">Price</th>
            <th class="text-center" style="width: 8%">GST%</th>
            <th class="text-center" style="width: 8%">Qty</th>
             <th class="text-right" style="width: 14%">Tax Amount</th>
            <th class="text-right" style="width: 18%">Total</th>
          </tr>
        </thead>
        <tbody>
          ${data.items.map((item, index) => {
      const priceExclTax = item.pricePerMeter - (item.taxAmount || 0);
      return `
            <tr>
              <td>${index + 1}</td>
              <td>${item.productName}</td>
              <td class="text-right">${Math.round(priceExclTax).toLocaleString()}</td>
              <td class="text-center">${item.taxRate}%</td>
              <td class="text-center">${item.quantity}</td>
              <td class="text-right">${Math.round(item.taxAmount * item.quantity).toLocaleString()}</td>
              <td class="text-right">${Math.round(item.totalPrice).toLocaleString()}</td>
            </tr>
            `;
    }).join('')}
          <tr style="background-color: #f7f7f7;">
            <td colspan="7" style="text-align: center; font-weight: bold; padding: 10px 0; border-top: 1px solid #ddd; border-bottom: 1px solid #ddd;">
              Total Items: ${totalItems}
            </td>
          </tr>
        </tbody>
      </table>

      <div class="summary-section">
        <table class="summary-table">
          <tr class="subtotal-row">
            <td>Subtotal (Excl. Tax)</td>
            <td class="text-right">${Math.round(subtotalExclTax).toLocaleString()}</td>
          </tr>
           <tr class="tax-row">
            <td>Total Tax</td>
            <td class="text-right">${Math.round(totalTax).toLocaleString()}</td>
          </tr>
          ${data.discount > 0 ? `
          <tr>
            <td style="color: green;">Discount</td>
            <td class="text-right" style="color: green;">-${data.discount.toLocaleString()}</td>
          </tr>
          ` : ''}
          <tr class="summary-total">
            <td>Grand Total</td>
            <td class="text-right">Rs. ${data.total.toLocaleString()}</td>
          </tr>
           ${!isQuotation ? `
           <tr>
            <td style="color: #555;">Paid Amount</td>
            <td class="text-right" style="color: #555;">${data.amountReceived.toLocaleString()}</td>
          </tr>
           ${data.change > 0 ? `
          <tr style="background-color: #f9f9f9;">
            <td style="color: #555;">Change Returned</td>
            <td class="text-right" style="color: #555;">${data.change.toLocaleString()}</td>
          </tr>` : ''}
          ${data.customerBalance !== undefined && data.customerBalance !== 0 ? `
           <tr style="background-color: #fff;">
            <td style="color: #555;">Balance</td>
            <td class="text-right" style="color: #555;">${data.customerBalance.toLocaleString()}</td>
          </tr>` : ''}
          ` : ''}
        </table>
      </div>

      ${storeSettings?.exchange_policy ?
      `<div class="exchange-policy-section">
            <strong>Exchange Policy:</strong><br/><br/>
            ${storeSettings.exchange_policy}
        </div>`
      : ''}

      <script>
        window.onload = function() {
          setTimeout(function() { window.print(); }, 500);
        }
      </script>
    </body>
    </html>
  `;

  printWindow.document.write(htmlContent);
  printWindow.document.close();
};
