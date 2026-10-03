import { format } from "date-fns";

export const printStockHistoryReport = (
  products: any[],
  stats: { totalSuits: number; totalMeters: number; totalValue: number },
  reportDate: Date,
  storeSettings: any
) => {
  console.log("Generating Stock Report...");
  // Create a new window
  const printWindow = window.open("", `_blank_${Date.now()}`, "width=900,height=800");
  if (!printWindow) {
    alert("Pop-up blocked! Please allow pop-ups for this site to print the Professional Report.");
    return;
  }

  // Generate HTML
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Stock Report - ${format(reportDate, "dd MMM yyyy")}</title>
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
          gap: 20px; 
          margin-bottom: 20px; 
          background: #f0f7fa; 
          padding: 10px; 
          border: 1px solid #295975; 
          border-radius: 4px;
        }
        .stat { flex: 1; text-align: center; }
        .stat-label { font-size: 10px; font-weight: bold; text-transform: uppercase; color: #555; }
        .stat-value { font-size: 16px; font-weight: bold; }

        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th { background-color: #295975; color: white; font-weight: bold; padding: 6px; text-align: left; border: 1px solid #295975; font-size: 10px; }
        td { padding: 5px 6px; border: 1px solid #ddd; vertical-align: top; font-size: 10px; }
        tr:nth-child(even) td { background-color: #fafafa; }
        
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .font-bold { font-weight: bold; }
        .text-xs { font-size: 9px; }
        .text-muted { color: #666; }

        .variation-row td { background-color: #f9f9f9; border-top: none; }
        .variation-indent { padding-left: 15px; display: flex; align-items: center; color: #666; }
        
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
        <div class="report-title">Stock History Report</div>
        <div class="timestamp">
            <div>Report Date: ${format(reportDate, "dd MMM yyyy")}</div>
            <div>Printed: ${format(new Date(), "dd MMM yyyy HH:mm a")}</div>
        </div>
      </div>

      <div class="summary-box">
        <div class="stat">
          <div class="stat-label">Total Stock Value</div>
          <div class="stat-value">Rs. ${stats.totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
        </div>
        <div class="stat">
          <div class="stat-label">Total Meters</div>
          <div class="stat-value">${stats.totalMeters.toLocaleString(undefined, { maximumFractionDigits: 2 })} m</div>
        </div>
        <div class="stat">
          <div class="stat-label">Total Suits</div>
          <div class="stat-value">${stats.totalSuits.toLocaleString(undefined, { maximumFractionDigits: 1 })}</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 25%">Product Name</th>
            <th style="width: 15%">SKU</th>
            <th style="width: 15%">Category</th>
            <th class="text-right" style="width: 10%">Suits</th>
            <th class="text-right" style="width: 10%">Meters</th>
            <th class="text-right" style="width: 10%">Cost/Suit</th>
            <th class="text-right" style="width: 15%">Total Value</th>
          </tr>
        </thead>
        <tbody>
          ${products.map(item => {
    const hasVariations = item.variations && item.variations.length > 0;
    const mainRow = `
            <tr>
              <td class="font-bold">${item.name}</td>
              <td class="text-muted">${item.sku || "-"}</td>
              <td>${item.category}</td>
              <td class="text-right">${item.rolls_at_date.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
              <td class="text-right font-bold">${item.stock_at_date.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
              <td class="text-right">Rs. ${item.cost_per_piece.toLocaleString()}</td>
              <td class="text-right font-bold">Rs. ${item.total_value_at_date.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
            </tr>`;

    const variationRows = hasVariations ? item.variations.map((v: any) => `
            <tr class="variation-row">
              <td class="text-muted">
                <div class="variation-indent">
                   ↳ ${v.name}
                </div>
              </td>
              <td class="text-xs text-muted">${v.sku || '-'}</td>
              <td class="text-xs text-muted">-</td>
              <td class="text-right text-muted text-xs">${v.current_stock_qty}</td>
              <td class="text-right text-muted text-xs">${v.current_stock_meters.toFixed(2)}</td>
              <td class="text-right text-muted text-xs">-</td>
              <td class="text-right text-muted text-xs">Rs. ${(v.current_stock_meters * item.cost_per_meter).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
            </tr>
            `).join('') : '';

    return mainRow + variationRows;
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
