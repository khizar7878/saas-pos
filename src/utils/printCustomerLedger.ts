import { format } from "date-fns";

export const printCustomerLedger = (
  customer: any,
  transactions: any[],
  openingBalance: number,
  dateRangeStr: string,
  storeSettings: any
) => {
  // Create a new window
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Please allow popups to print.");
    return;
  }

  // Calculate closing balance
  let currentBalance = openingBalance;
  // Note: transactions passed here should be in chronological order (Oldest -> Newest) for calculation
  // Check the calling code to ensure correct order. 
  // We will assume the caller passes them correctly, or we sort them here?
  // Let's assume the caller passes them in display order.

  // Re-calculate locally to ensure HTML generation is correct
  const rows = transactions.map(tx => {
    // Only credit sales increase the debt balance
    const isDebit = tx.type === 'credit_sale';

    // Payments reduce the debt
    // Returns reduce debt ONLY if they are credited to account (not cash refunds)
    // We assume 'account' or 'store_credit' payment method implies ledger adjustment, or explicit credit return type / refund_method
    const isCredit = tx.type === 'payment' || (tx.type === 'return' && (tx.payment_method === 'account' || tx.payment_method === 'store_credit' || tx.return_type === 'credit' || tx.refund_method === 'credit' || !tx.refund_method));

    // For display, paid sales and cash returns show amounts but don't affect running balance
    const amount = tx.amount || tx.total_amount;

    if (isDebit) currentBalance += amount;
    if (isCredit) currentBalance -= amount;

    return { ...tx, runningBalance: currentBalance, amount, isDebit, isCredit };
  });

  const closingBalance = currentBalance;

  // Generate HTML
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Customer Ledger - ${customer.name}</title>
      <style>
        @media print {
          @page { size: A4; margin: 15mm 15mm 30mm 15mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        body { font-family: sans-serif; font-size: 11px; color: #000; margin: 0; padding: 0; padding-bottom: 30px; }
        
        .header-container { display: flex; justify-content: space-between; border-bottom: 2px solid #295975; padding-bottom: 10px; margin-bottom: 20px; }
        .company-info h1 { font-size: 20px; font-weight: bold; margin: 0; text-transform: uppercase; color: #295975; }
        .company-info p { margin: 2px 0; font-size: 11px; color: #555; }
        
        .report-info { text-align: right; }
        .report-info h2 { font-size: 16px; font-weight: bold; margin: 0; }
        .report-info p { margin: 2px 0; font-size: 10px; color: #555; }

        .client-info { display: flex; justify-content: space-between; margin-bottom: 20px; background: #f0f7fa; padding: 10px; border: 1px solid #295975; }
        .client-card h3 { font-size: 12px; font-weight: bold; margin: 0 0 5px 0; color: #295975; text-transform: uppercase; }
        .client-card p { margin: 2px 0; font-size: 12px; font-weight: bold; }
        
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th { background-color: #295975; color: white; font-weight: bold; padding: 6px; text-align: left; border: 1px solid #295975; font-size: 10px; text-transform: uppercase; }
        td { padding: 6px; border: 1px solid #ddd; vertical-align: top; }
        
        .text-right { text-align: right; }
        .font-bold { font-weight: bold; }
        .text-sm { font-size: 10px; }
        .text-xs { font-size: 9px; color: #666; }
        .bg-gray { background-color: #f5f5f5; }
        
        .type-badge { display: inline-block; padding: 2px 4px; border-radius: 3px; font-size: 8px; font-weight: bold; text-transform: uppercase; border: 1px solid #ccc; }
        
        .footer { margin-top: 40px; border-top: 1px solid #ddd; padding-top: 10px; display: flex; justify-content: space-between; color: #888; font-size: 10px; }
      </style>
    </head>
    <body>
      <div class="header-container">
        <div class="company-info">
          <h1>${storeSettings?.store_name || "Store Name"}</h1>
          <p>${storeSettings?.address || ""}</p>
          <p>${storeSettings?.phone || ""}</p>
        </div>
        <div class="report-info">
          <h2>Customer Ledger</h2>
          <p>Generated: ${format(new Date(), "dd MMM yyyy HH:mm")}</p>
        </div>
      </div>

      <div class="client-info">
        <div class="client-card">
          <h3>Customer</h3>
          <p>${customer.name}</p>
          <p style="font-weight: normal; font-size: 11px;">${customer.phone || ""}</p>
        </div>
        <div class="client-card text-right">
          <h3>Period</h3>
          <p>${dateRangeStr}</p>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 15%">Date</th>
            <th style="width: 10%">Type</th>
            <th style="width: 25%">Description / Items</th>
            <th class="text-right" style="width: 12%">Total</th>
            <th class="text-right" style="width: 12%">Debit</th>
            <th class="text-right" style="width: 12%">Credit</th>
            <th class="text-right" style="width: 14%">Balance</th>
          </tr>
        </thead>
        <tbody>
          <!-- Opening Balance -->
          <tr class="bg-gray">
            <td colspan="3"><strong>Opening Balance</strong></td>
            <td class="text-right">-</td>
            <td class="text-right">-</td>
            <td class="text-right">-</td>
            <td class="text-right font-bold">Rs. ${openingBalance?.toLocaleString()}</td>
          </tr>

          ${rows.map(tx => `
            <tr>
              <td>${format(new Date(tx.date), 'dd-MMM HH:mm')}</td>
              <td><span class="type-badge">${tx.type.replace('_', ' ')}</span></td>
              <td>
                <div class="font-bold">
                  ${tx.type === 'sale' ? `Sale #${tx.sale_number}` : ''}
                  ${tx.type === 'credit_sale' ? `Bill #${tx.bill_number}` : ''}
                  ${tx.type === 'return' ? `Return #${tx.return_number}` : ''}
                  ${tx.type === 'payment' ? (tx.payment_number ? `Payment #${tx.payment_number}` : 'Payment Received') : ''}
                </div>
                ${(tx.type === 'sale' || tx.type === 'credit_sale' || tx.type === 'return') ? `
                  <div class="text-xs">
                    ${(tx.type === 'return' ? tx.return_items : (tx.type === 'sale' ? tx.sale_items : tx.items))?.map((item: any) => `
                      <div>• ${item.product_name} x ${item.quantity}</div>
                    `).join('') || ''}
                  </div>
                ` : ''}
              </td>
              <td class="text-right font-bold">Rs. ${(tx.amount || tx.total_amount).toLocaleString()}</td>
              <td class="text-right">${tx.isDebit ? `Rs. ${tx.amount.toLocaleString()}` : '-'}</td>
              <td class="text-right">${tx.isCredit ? `Rs. ${tx.amount.toLocaleString()}` : '-'}</td>
              <td class="text-right font-bold">Rs. ${tx.runningBalance.toLocaleString()}</td>
            </tr>
          `).join('')}

          <!-- Closing Balance -->
          <tr class="bg-gray" style="border-top: 2px solid #000;">
            <td colspan="3" style="font-size: 13px;"><strong>Closing Balance</strong></td>
            <td class="text-right">-</td>
            <td class="text-right">-</td>
            <td class="text-right">-</td>
            <td class="text-right" style="font-size: 13px; font-weight: bold;">Rs. ${closingBalance.toLocaleString()}</td>
          </tr>
        </tbody>
      </table>

      <div class="footer">
        <div>Authorized Signature: __________________________</div>
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
