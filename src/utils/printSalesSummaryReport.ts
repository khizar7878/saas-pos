import { format } from "date-fns";

export const printSalesSummaryReport = (
  transactions: any[],
  stats: {
    salesTotal: number;
    discountsTotal?: number;
    returnsTotal: number;
    netAmount: number;
    count: number;
    unitsSold: number;
  },
  dateRange: { from: Date | undefined; to: Date | undefined } | undefined,
  storeSettings: any
) => {
  console.log("Generating Sales Summary Report...");

  // Create a new window
  const printWindow = window.open("", `_blank_${Date.now()}`, "width=900,height=800");
  if (!printWindow) {
    alert("Pop-up blocked! Please allow pop-ups for this site to print the Professional Report.");
    return;
  }

  const formatDate = (date: Date | undefined) => date ? format(date, "dd MMM yyyy") : "...";
  const dateRangeStr = dateRange?.from
    ? `${formatDate(dateRange.from)} - ${formatDate(dateRange.to)}`
    : "All Time";

  // Generate HTML
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Sales Summary - ${dateRangeStr}</title>
      <style>
        @media print {
          @page { size: A4; margin: 15mm 15mm 30mm 15mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        body { font-family: sans-serif; font-size: 11px; color: #000; margin: 0; padding: 0; padding-bottom: 30px; }
        .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #295975; padding-bottom: 10px; }
        .header h1 { font-size: 24px; font-weight: bold; margin: 0 0 5px 0; text-transform: uppercase; color: #295975; }
        .header p { margin: 2px 0; font-size: 12px; color: #555; }
        
        .report-info { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 15px; }
        .report-title { font-size: 18px; font-weight: bold; }
        .timestamp { font-size: 10px; color: #555; }

        .summary-box { 
          display: flex; 
          gap: 15px; 
          margin-bottom: 20px; 
          background: #f0f7fa; 
          padding: 10px; 
          border: 1px solid #295975; 
          border-radius: 4px;
        }
        .stat { flex: 1; text-align: center; border-right: 1px solid #ddd; }
        .stat:last-child { border-right: none; }
        .stat-label { font-size: 10px; font-weight: bold; text-transform: uppercase; color: #555; }
        .stat-value { font-size: 14px; font-weight: bold; margin-top: 4px; }
        .text-success { color: green; }
        .text-destructive { color: red; }

        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th { background-color: #295975; color: white; font-weight: bold; padding: 6px; text-align: left; border: 1px solid #295975; font-size: 10px; }
        td { padding: 5px 6px; border: 1px solid #ddd; vertical-align: top; font-size: 10px; }
        tr:nth-child(even) td { background-color: #fafafa; }
        
        .text-right { text-align: right; }
        .font-bold { font-weight: bold; }
        .text-xs { font-size: 9px; }
        
        .footer { position: fixed; bottom: 0; left: 0; right: 0; font-size: 10px; text-align: center; color: #888; border-top: 1px solid #ddd; padding-top: 5px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${storeSettings?.store_name || "Store Name"}</h1>
        <p>${storeSettings?.address || ""}</p>
        <p>${storeSettings?.phone || ""}</p>
      </div>

      <div class="report-info">
        <div class="report-title">Sales Summary Report</div>
        <div class="timestamp">
            <div>Period: ${dateRangeStr}</div>
            <div>Printed: ${format(new Date(), "dd MMM yyyy HH:mm a")}</div>
        </div>
      </div>

      <div class="summary-box">
        <div class="stat">
          <div class="stat-label">Total Sales${stats.discountsTotal !== undefined ? " / Total Discounts" : ""}</div>
          <div class="stat-value text-success">
            Rs. ${stats.salesTotal.toLocaleString()}${stats.discountsTotal !== undefined ? ` / <span class="text-destructive">Rs. ${stats.discountsTotal.toLocaleString()}</span>` : ""}
          </div>
        </div>
        <div class="stat">
          <div class="stat-label">Returns</div>
          <div class="stat-value text-destructive">Rs. ${stats.returnsTotal.toLocaleString()}</div>
        </div>
        <div class="stat">
          <div class="stat-label">Net Amount</div>
          <div class="stat-value">Rs. ${stats.netAmount.toLocaleString()}</div>
        </div>
        <div class="stat">
          <div class="stat-label">Transactions</div>
          <div class="stat-value">${stats.count}</div>
        </div>
        <div class="stat">
          <div class="stat-label">Units Sold</div>
          <div class="stat-value">${stats.unitsSold}</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 15%">Date</th>
            <th style="width: 15%">Invoice #</th>
            <th style="width: 20%">FBR Invoice #</th>
            <th style="width: 35%">Items</th>
            <th class="text-right" style="width: 15%">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${transactions.length === 0 ? '<tr><td colspan="5" class="text-center">No transactions found</td></tr>' : ''}
          ${transactions.map(item => {
    const isReturn = item.type === 'return';

    // Items Logic
    let itemsHtml = '-';
    if (!isReturn && item.sale_items && item.sale_items.length > 0) {
      itemsHtml = item.sale_items.map((i: any) =>
        `<div>${i.product_name || 'Unknown'} <span style="color:#555; font-size:9px;">x ${i.quantity}</span></div>`
      ).join('');
    } else if (isReturn) {
      itemsHtml = '<span class="text-destructive">Return Transaction</span>';
    }

    return `
            <tr>
              <td>${format(new Date(item.created_at), 'dd MMM yyyy')}</td>
              <td class="font-bold">${item.sale_number}</td>
              <td class="text-xs text-muted">${item.fbr_invoice_number || '-'}</td>
              <td class="text-xs">
                ${itemsHtml}
              </td>
              <td class="text-right ${isReturn ? 'text-destructive' : ''}">
                ${isReturn ? '- ' : ''}Rs. ${item.displayedAmount.toLocaleString()}
              </td>
            </tr>`;
  }).join('')}
        </tbody>
      </table>

      <div class="footer">
        Page 1 of 1
      </div>

      <script>
        window.onload = function() {
          window.print();
        }
      </script>
    </body>
    </html>
  `;

  printWindow.document.write(htmlContent);
  printWindow.document.close();
};
