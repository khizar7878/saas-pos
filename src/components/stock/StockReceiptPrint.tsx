import { format } from 'date-fns';

export interface StockReceiptData {
    receipt_number: string;
    created_at: string;
    notes?: string;
    items: Array<{
        name: string;
        sku: string;
        quantity: number;      // Suits
        metersPerPiece: number;
    }>;
}

export function printStockReceipt(receipt: StockReceiptData, storeName = 'Abr e Karam Fabrics') {
    const totalSuits = receipt.items.reduce((sum, item) => sum + item.quantity, 0);
    const totalMeters = receipt.items.reduce((sum, item) => sum + item.quantity * item.metersPerPiece, 0);

    const rowsHTML = receipt.items.map(item => `
        <tr>
            <td colspan="3" style="padding: 5px 0 2px 0; font-size: 11pt; font-weight: bold; text-align: left; color: #000;">
                ${item.name}
            </td>
        </tr>
        <tr>
            <td style="font-size: 9pt; color: #000; font-weight: bold; padding: 0 0 3px 0;">${item.sku}</td>
            <td style="text-align: center; font-size: 10pt; font-weight: bold; color: #000; padding: 0 0 3px 0;">${item.quantity} pcs</td>
            <td style="text-align: right; font-size: 10pt; font-weight: bold; color: #000; padding: 0 0 3px 0;">${(item.quantity * item.metersPerPiece).toFixed(2)} m</td>
        </tr>
        <tr><td colspan="3" style="border-bottom: 1px dashed #000;"></td></tr>
    `).join('');

    const htmlContent = `
        <div style="width: 67mm; margin: 0 auto; padding: 2mm 0; font-family: 'Courier New', monospace; color: #000; font-weight: bold;">
            <!-- Header -->
            <div style="text-align: center; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 2px solid #000;">
                <h1 style="font-size: 14pt; font-weight: 900; margin: 0 0 3px 0; text-transform: uppercase; letter-spacing: 1px;">${storeName}</h1>
                <h2 style="font-size: 10pt; font-weight: 900; margin: 4px 0 0 0; text-transform: uppercase;">Stock Receiving Receipt</h2>
            </div>

            <!-- Receipt Info -->
            <div style="margin-bottom: 8px; font-size: 9pt; font-weight: bold; border-bottom: 2px solid #000; padding-bottom: 8px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
                    <span>Receipt #:</span>
                    <span>${receipt.receipt_number}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span>Date:</span>
                    <span>${format(new Date(receipt.created_at), 'dd-MMM-yy HH:mm')}</span>
                </div>
            </div>

            <!-- Items Table -->
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 8px;">
                <thead>
                    <tr>
                        <th style="text-align: left; border-bottom: 1px dashed #000; font-weight: 900; font-size: 9pt; padding: 4px 0; color: #000;">Item / SKU</th>
                        <th style="text-align: center; border-bottom: 1px dashed #000; font-weight: 900; font-size: 9pt; padding: 4px 0; color: #000;">Qty</th>
                        <th style="text-align: right; border-bottom: 1px dashed #000; font-weight: 900; font-size: 9pt; padding: 4px 0; color: #000;">Meters</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHTML}
                </tbody>
            </table>

            <!-- Totals -->
            <div style="border-top: 2px solid #000; padding-top: 8px; margin-bottom: 8px;">
                <div style="display: flex; justify-content: space-between; font-size: 10pt; font-weight: 900; margin-bottom: 4px; color: #000;">
                    <span>Total Suits:</span>
                    <span>${totalSuits}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 10pt; font-weight: 900; color: #000;">
                    <span>Total Meters:</span>
                    <span>${totalMeters.toFixed(2)} m</span>
                </div>
            </div>

            ${receipt.notes ? `
            <!-- Notes -->
            <div style="border: 1px solid #000; padding: 5px; font-size: 9pt; margin-bottom: 8px;">
                <span style="font-weight: 900;">Notes: </span>${receipt.notes}
            </div>
            ` : ''}

            <!-- Footer -->
            <div style="margin-top: 12px; border-top: 2px solid #000; padding-top: 8px; text-align: center; font-size: 9pt;">
                <p style="margin: 0 0 12px 0;">Received By: _________________</p>
                <p style="margin: 0; font-size: 8pt;">System Generated Receipt</p>
            </div>
        </div>
    `;

    const iframeId = 'stock-receipt-print-frame';
    let printIframe = document.getElementById(iframeId) as HTMLIFrameElement | null;

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

    printWindow.document.open();
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Stock Receipt ${receipt.receipt_number}</title>
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
            </style>
            <script>
              window.onload = function() {
                setTimeout(function() { window.print(); }, 100);
              }
            <\/script>
          </head>
          <body>
            ${htmlContent}
          </body>
        </html>
    `);
    printWindow.document.close();
}
