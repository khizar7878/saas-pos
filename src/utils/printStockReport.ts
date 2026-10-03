import { format } from "date-fns";

export const printStockReport = (
  products: any[],
  stats: { totalSuits: number; totalMeters: number; totalValue: number },
  storeSettings: any
) => {
  console.log("Generating Stock Summary Report...");
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
      <title>Stock Summary Report</title>
      <style>
        @media print {
          @page { size: A4; margin: 15mm 15mm 30mm 15mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        body { font-family: sans-serif; font-size: 12px; color: #000; margin: 0; padding: 0; padding-bottom: 30px; }
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
        th { background-color: #295975; color: white; font-weight: bold; padding: 8px; text-align: left; border: 1px solid #295975; font-size: 11px; }
        td { padding: 6px 8px; border: 1px solid #ddd; vertical-align: top; font-size: 11px; }
        tr:nth-child(even) td { background-color: #fafafa; }
        
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .font-bold { font-weight: bold; }

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
        <div class="report-title">Stock Summary Report</div>
        <div class="timestamp">Printed: ${format(new Date(), "dd MMM yyyy HH:mm a")}</div>
      </div>

      <div class="summary-box">
        <div class="stat">
          <div class="stat-label">Total Items</div>
          <div class="stat-value">${products.length}</div>
        </div>
        <div class="stat">
          <div class="stat-label">Total Suits</div>
          <div class="stat-value">${stats.totalSuits.toLocaleString(undefined, { maximumFractionDigits: 1 })}</div>
        </div>
        <div class="stat">
          <div class="stat-label">Total Meters</div>
          <div class="stat-value">${stats.totalMeters.toLocaleString(undefined, { maximumFractionDigits: 2 })} m</div>
        </div>
        <!-- Value removed as per request, but can be re-added if needed for internal use -->
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 40%">Product Name</th>
            <th style="width: 20%">Category</th>
            <th class="text-right" style="width: 20%">Suits</th>
            <th class="text-right" style="width: 20%">QTY in Meters</th>
          </tr>
        </thead>
        <tbody>
          ${products.map(p => `
            <tr>
              <td class="font-bold">${p.name}</td>
              <td>${Array.isArray(p.product_categories) ? p.product_categories[0]?.name : (p.product_categories as any)?.name || '-'}</td>
              <td class="text-right">${p.stock_quantity}</td>
              <td class="text-right">${(p.stock_quantity * (p.meters_per_piece || 0)).toFixed(2)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="footer">
        Page 1 of 1
      </div>

      <script>
        window.onload = function() {
          window.print();
          // Optional: window.close() after print? Users often prefer to keep it open to verify.
        }
      </script>
    </body>
    </html>
  `;

  printWindow.document.write(htmlContent);
  printWindow.document.close();
};
