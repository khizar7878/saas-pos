import { DailyReconciliationRecord, DailyExpense } from "@/types/reconciliation";

interface PrintData {
    record: Partial<DailyReconciliationRecord>;
    expenses?: DailyExpense[];
    storeName?: string;
    storeAddress?: string;
    storePhone?: string;
}

export const printReconciliationReport = (data: PrintData, format: '80mm' | 'a5' | 'a4' = '80mm') => {
    const { record, expenses = [], storeName = "AK RETAIL POS", storeAddress = "", storePhone = "" } = data;
    const isGrouped = !!record.is_grouped;
    const startDate = record.start_date || record.reconciliation_date || new Date().toISOString().split('T')[0];
    const endDate = record.end_date || record.reconciliation_date || new Date().toISOString().split('T')[0];
    const dateFormatted = isGrouped && startDate !== endDate
        ? `${startDate} to ${endDate} (${record.grouped_dates?.length || 2} Days)`
        : (record.reconciliation_date || new Date().toISOString().split('T')[0]);

    // Normalize format ('a4' falls back to 'a5' seamlessly)
    const reportFormat: '80mm' | 'a5' = format === '80mm' ? '80mm' : 'a5';

    const printWindow = window.open('', '_blank', 'width=850,height=950');
    if (!printWindow) {
        alert("Please allow popups to print reconciliation report.");
        return;
    }

    const denoms = record.denominations || {
        notes_5000: 0,
        notes_1000: 0,
        notes_500: 0,
        notes_100: 0,
        notes_50: 0,
        notes_20: 0,
        notes_10: 0,
        coins: 0,
    };

    const saleAdjustments = Number(record.sale_adjustments) || 0;
    const totalPhysical = (record.actual_cash || 0) + (record.cash_in_reserve || 0);
    const netCashFromSales = totalPhysical - (record.opening_cash || 0) + (record.cash_expenses || 0);
    const totalCollections = netCashFromSales + (record.manual_ibft_total || 0) + (record.manual_card_total || 0);
    const netRecordedSales = (record.system_counter_sales_total || 0) - (record.system_cash_returns || 0) + saleAdjustments;
    const grandVariance = totalCollections - netRecordedSales;
    const calculatedExpectedCash = (record.opening_cash || 0) + (record.system_cash_sales || 0) + saleAdjustments - (record.system_cash_returns || 0) - (record.cash_expenses || 0);
    const expectedCashVal = record.expected_cash ?? calculatedExpectedCash;
    const cashVariance = record.cash_variance ?? (totalPhysical - expectedCashVal);

    // Denomination calculated totals (Single Column 8-Item Sequence)
    const denomDetails = [
        { label: "Rs. 5,000", count: denoms.notes_5000 || 0, total: (denoms.notes_5000 || 0) * 5000 },
        { label: "Rs. 1,000", count: denoms.notes_1000 || 0, total: (denoms.notes_1000 || 0) * 1000 },
        { label: "Rs. 500", count: denoms.notes_500 || 0, total: (denoms.notes_500 || 0) * 500 },
        { label: "Rs. 100", count: denoms.notes_100 || 0, total: (denoms.notes_100 || 0) * 100 },
        { label: "Rs. 50", count: denoms.notes_50 || 0, total: (denoms.notes_50 || 0) * 50 },
        { label: "Rs. 20", count: denoms.notes_20 || 0, total: (denoms.notes_20 || 0) * 20 },
        { label: "Rs. 10", count: denoms.notes_10 || 0, total: (denoms.notes_10 || 0) * 10 },
        { label: "Coins / Loose", count: "-", total: denoms.coins || 0 },
    ];

    // Format expenses string: "Roti-350, Jimmy-350, Mazdoori-150..."
    const expenseList = expenses && expenses.length > 0
        ? expenses.map(e => `${e.description || 'Expense'}-${Number(e.amount || 0).toLocaleString()}`).join(', ')
        : (record.total_expenses && record.total_expenses > 0
            ? `Cash Outflows: Rs. ${(record.cash_expenses || 0).toLocaleString()}${record.card_expenses ? `, Card: Rs. ${record.card_expenses.toLocaleString()}` : ''}${record.ibft_expenses ? `, IBFT: Rs. ${record.ibft_expenses.toLocaleString()}` : ''}`
            : 'No daily expenses recorded');

    let html = "";

    if (reportFormat === 'a5') {
        // =========================================================================
        // A5 EXECUTIVE REPORT TEMPLATE (148mm x 210mm Portrait, 1-Page Full Spread)
        // =========================================================================
        html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Daily Reconciliation - ${dateFormatted} (A5)</title>
            <style>
                @page {
                    size: A5 portrait;
                    margin: 6mm 12mm;
                }
                * {
                    box-sizing: border-box;
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }
                html, body {
                    height: 100%;
                    margin: 0;
                    padding: 0;
                    background: #ffffff;
                }
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                    font-size: 9.8px;
                    line-height: 1.32;
                    color: #0f172a;
                }
                .page-container {
                    box-sizing: border-box;
                    width: 100%;
                    max-width: 124mm;
                    margin: 0 auto;
                    height: 198mm;
                    min-height: 198mm;
                    max-height: 198mm;
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                    page-break-inside: avoid;
                    break-inside: avoid;
                    overflow: hidden;
                }
                .main-content {
                    display: flex;
                    flex-direction: column;
                }
                .header {
                    border-bottom: 2px solid #0f172a;
                    padding-bottom: 3.5px;
                    margin-bottom: 5px;
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-end;
                }
                .store-title {
                    font-size: 16px;
                    font-weight: 900;
                    color: #0f172a;
                    text-transform: uppercase;
                    letter-spacing: 0.3px;
                    margin: 0;
                    line-height: 1.1;
                }
                .store-sub {
                    font-size: 8.5px;
                    color: #334155;
                    margin-top: 1.5px;
                }
                .doc-badge {
                    text-align: right;
                }
                .doc-name {
                    font-size: 12px;
                    font-weight: 900;
                    color: #0f172a;
                    letter-spacing: 0.3px;
                    line-height: 1.1;
                }
                .doc-meta {
                    font-size: 8.5px;
                    color: #334155;
                    margin-top: 1.5px;
                }

                /* Executive KPI Ribbon: Cash Sales, IBFT, Card Payments, Daily Expenses */
                .kpi-ribbon {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 5px;
                    margin-bottom: 5px;
                }
                .kpi-card {
                    border: 1.5px solid #1e293b;
                    border-radius: 4px;
                    padding: 3.5px 4px;
                    background: #ffffff;
                    text-align: center;
                }
                .kpi-label {
                    font-size: 8px;
                    font-weight: 800;
                    text-transform: uppercase;
                    color: #334155;
                    margin-bottom: 1.5px;
                    letter-spacing: 0.2px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .kpi-value {
                    font-size: 13.5px;
                    font-weight: 900;
                    color: #0f172a;
                    line-height: 1.15;
                }

                /* 2-Column Balanced Audit Grid (Horizontally Locked Bottom Edges) */
                .audit-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 6px;
                    margin-bottom: 5px;
                    align-items: stretch;
                }
                .left-col {
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                    height: 100%;
                }
                .right-col {
                    height: 100%;
                    display: flex;
                    flex-direction: column;
                }
                .audit-box {
                    border: 1.5px solid #1e293b;
                    border-radius: 4px;
                    padding: 5px 6px;
                    background: #ffffff;
                }
                .right-box {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                }
                .box-title {
                    font-size: 9.5px;
                    font-weight: 900;
                    text-transform: uppercase;
                    color: #0f172a;
                    border-bottom: 1.5px solid #0f172a;
                    padding-bottom: 2px;
                    margin-bottom: 3.5px;
                    letter-spacing: 0.2px;
                    display: flex;
                    justify-content: space-between;
                }
                .box-subtitle {
                    font-size: 9.5px;
                    font-weight: 900;
                    text-transform: uppercase;
                    color: #0f172a;
                    border-top: 1.5px solid #0f172a;
                    border-bottom: 1.5px solid #0f172a;
                    padding: 2.5px 0;
                    margin: 4px 0 3px 0;
                    letter-spacing: 0.2px;
                }
                .data-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 2px 0;
                    font-size: 9.5px;
                    white-space: nowrap;
                }
                .data-row.total-row {
                    border-top: 1.5px solid #0f172a;
                    margin-top: 1.5px;
                    padding-top: 2px;
                    font-weight: 800;
                    font-size: 9.8px;
                }
                .data-row.subtotal-row {
                    border-top: 1px dashed #64748b;
                    margin-top: 1.5px;
                    padding-top: 2px;
                    font-weight: 700;
                    font-size: 9.5px;
                }
                .highlight-row {
                    background: #f8fafc;
                    border: 1px solid #0f172a;
                    border-radius: 3px;
                    padding: 2px 4px;
                    margin: 2px 0;
                    font-weight: 800;
                    font-size: 9.8px;
                }
                .val-balanced { color: #15803d; }
                .val-shortage { color: #b91c1c; }
                .val-surplus { color: #1d4ed8; }

                /* Expenses Item Text Box */
                .expense-text-box {
                    font-size: 9.5px;
                    line-height: 1.35;
                    color: #0f172a;
                    padding: 2.5px 0;
                    word-break: break-word;
                }

                /* Single-Column Denominations Table */
                .denom-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 9.5px;
                    margin-top: 1px;
                    margin-bottom: 2px;
                }
                .denom-table th {
                    border-bottom: 1.5px solid #0f172a;
                    padding: 2px 2px;
                    font-weight: 800;
                    color: #0f172a;
                    font-size: 8.5px;
                }
                .denom-table td {
                    padding: 1.8px 2px;
                    border-bottom: 1px dotted #cbd5e1;
                }

                /* Clean 3-Card Grand Audit Totals Grid */
                .grand-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr 1fr;
                    gap: 5px;
                    margin-bottom: 4px;
                }
                .grand-card {
                    border: 1.5px solid #1e293b;
                    border-radius: 4px;
                    padding: 3.5px 4px;
                    background: #ffffff;
                    text-align: center;
                }
                .grand-card.grand-balanced {
                    border: 2px solid #15803d;
                    background: #f0fdf4;
                }
                .grand-card.grand-variance {
                    border: 2px solid #b91c1c;
                    background: #fef2f2;
                }
                .grand-label {
                    font-size: 8px;
                    font-weight: 800;
                    text-transform: uppercase;
                    color: #334155;
                    letter-spacing: 0.2px;
                    margin-bottom: 1.5px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .grand-val {
                    font-size: 13.5px;
                    font-weight: 900;
                    color: #0f172a;
                    line-height: 1.15;
                }
                .grand-card.grand-balanced .grand-val {
                    color: #15803d;
                }
                .grand-card.grand-variance .grand-val {
                    color: #b91c1c;
                }

                /* Closing Notes Box */
                .notes-box {
                    border: 1.5px dashed #475569;
                    border-radius: 3px;
                    padding: 3px 6px;
                    font-size: 8.8px;
                    margin-bottom: 3px;
                    background: #ffffff;
                }

                /* Sign-off Footer Pinned at Bottom */
                .footer-signatures {
                    margin-top: auto;
                    padding-top: 8px;
                    padding-bottom: 1mm;
                }
                .sign-block {
                    display: flex;
                    justify-content: space-between;
                }
                .sign-col {
                    width: 45%;
                }
                .sign-space {
                    height: 20px;
                }
                .sign-line {
                    border-top: 1.5px solid #0f172a;
                    margin-bottom: 3px;
                }
                .sign-meta {
                    display: flex;
                    justify-content: space-between;
                    font-size: 8.8px;
                    font-weight: 700;
                    color: #0f172a;
                }
                .sign-role {
                    font-weight: 800;
                }
                .sign-date {
                    color: #334155;
                }

                @media print {
                    @page {
                        size: A5 portrait;
                        margin: 6mm 12mm;
                    }
                    html, body {
                        height: 100% !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        overflow: hidden !important;
                    }
                    .page-container {
                        box-sizing: border-box !important;
                        width: 100% !important;
                        max-width: 124mm !important;
                        margin: 0 auto !important;
                        height: 198mm !important;
                        min-height: 198mm !important;
                        max-height: 198mm !important;
                        display: flex !important;
                        flex-direction: column !important;
                        justify-content: space-between !important;
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                        page-break-after: avoid !important;
                        break-after: avoid !important;
                        overflow: hidden !important;
                    }
                    .footer-signatures {
                        margin-top: auto !important;
                        padding-bottom: 1mm !important;
                    }
                }
            </style>
        </head>
        <body>
            <div class="page-container">
                <div class="main-content">
                    <!-- Store Header -->
                    <div class="header">
                        <div>
                            <h1 class="store-title">${storeName}</h1>
                            <div class="store-sub">${storeAddress ? storeAddress + ' | ' : ''}${storePhone ? 'Tel: ' + storePhone : ''}</div>
                        </div>
                        <div class="doc-badge">
                            <div class="doc-name">${isGrouped ? 'GROUPED RECONCILIATION AUDIT' : 'DAILY RECONCILIATION AUDIT'}</div>
                            <div class="doc-meta">${isGrouped ? 'Period: ' : 'Date: '}<strong>${dateFormatted}</strong> | Printed: ${new Date().toLocaleTimeString()}</div>
                        </div>
                    </div>

                    <!-- Executive KPI Ribbon: Cash Sales, IBFT, Card Payments, Daily Expenses -->
                    <div class="kpi-ribbon">
                        <div class="kpi-card">
                            <div class="kpi-label">Cash Sales</div>
                            <div class="kpi-value">Rs. ${(record.system_cash_sales || 0).toLocaleString()}</div>
                        </div>
                        <div class="kpi-card">
                            <div class="kpi-label">IBFT</div>
                            <div class="kpi-value">Rs. ${(record.system_ibft_sales || 0).toLocaleString()}</div>
                        </div>
                        <div class="kpi-card">
                            <div class="kpi-label">Card Payments</div>
                            <div class="kpi-value">Rs. ${(record.system_card_sales || 0).toLocaleString()}</div>
                        </div>
                        <div class="kpi-card">
                            <div class="kpi-label">Daily Expenses</div>
                            <div class="kpi-value">Rs. ${(record.total_expenses || 0).toLocaleString()}</div>
                        </div>
                    </div>

                    <!-- 2-Column Balanced Audit Grid (Left and Right Bottom Edges Horizontally Locked) -->
                    <div class="audit-grid">
                        <!-- LEFT COLUMN: Sales, Expenses, Digital Channels -->
                        <div class="left-col">
                            <!-- SYSTEM RECORDED SALES (No Numbering) -->
                            <div class="audit-box" style="margin-bottom: 4px;">
                                <div class="box-title">
                                    <span>System Recorded Sales</span>
                                </div>
                                <div class="data-row"><span>Cash Sales:</span><span>Rs. ${(record.system_cash_sales || 0).toLocaleString()}</span></div>
                                <div class="data-row"><span>Card Sales:</span><span>Rs. ${(record.system_card_sales || 0).toLocaleString()}</span></div>
                                <div class="data-row"><span>IBFT Sales:</span><span>Rs. ${(record.system_ibft_sales || 0).toLocaleString()}</span></div>
                                <div class="data-row total-row"><span>Gross Sales Total:</span><span>Rs. ${(record.system_counter_sales_total || 0).toLocaleString()}</span></div>
                                ${(record.system_cash_returns || 0) > 0 ? `
                                <div class="data-row" style="color: #b91c1c;"><span>(-) Returns:</span><span>-Rs. ${(record.system_cash_returns || 0).toLocaleString()}</span></div>
                                ` : ''}
                                ${saleAdjustments !== 0 ? `
                                <div class="data-row" style="color: ${saleAdjustments >= 0 ? '#15803d' : '#b91c1c'};">
                                    <span>(+/-) Sale Adjustments:</span>
                                    <span class="font-bold">${saleAdjustments >= 0 ? '+' : '-'}Rs. ${Math.abs(saleAdjustments).toLocaleString()}</span>
                                </div>
                                ` : ''}
                                <div class="data-row highlight-row"><span>Net Recorded Sales:</span><span>Rs. ${netRecordedSales.toLocaleString()}</span></div>
                            </div>

                            <!-- EXPENSES (No Numbering, Actual Expense Items Listed) -->
                            <div class="audit-box" style="margin-bottom: 4px; flex: 1; display: flex; flex-direction: column; justify-content: space-between;">
                                <div>
                                    <div class="box-title">
                                        <span>Expenses</span>
                                    </div>
                                    <div class="expense-text-box">
                                        ${expenseList}
                                    </div>
                                </div>
                                <div class="data-row total-row">
                                    <span>Total Expenses:</span>
                                    <span class="font-bold">Rs. ${(record.total_expenses || 0).toLocaleString()}</span>
                                </div>
                            </div>

                            <!-- DIGITAL CHANNELS AUDIT (No Numbering) -->
                            <div class="audit-box">
                                <div class="box-title">
                                    <span>Digital Channels Audit</span>
                                </div>
                                <div class="data-row"><span>IBFT Target / Slips:</span><span>Rs. ${(record.system_ibft_sales || 0).toLocaleString()} / ${(record.manual_ibft_total || 0).toLocaleString()}</span></div>
                                <div class="data-row subtotal-row">
                                    <span>IBFT Variance:</span>
                                    <span class="${(record.ibft_variance || 0) === 0 ? 'val-balanced' : 'val-shortage'} font-bold">
                                        ${(record.ibft_variance || 0) === 0 ? 'Rs. 0 [MATCHED]' : (((record.ibft_variance || 0) > 0 ? '+' : '-') + 'Rs. ' + Math.abs(record.ibft_variance || 0).toLocaleString() + ((record.ibft_variance || 0) < 0 ? ' [SHORT]' : ' [SURPLUS]'))}
                                    </span>
                                </div>
                                <div class="data-row" style="margin-top: 2px;"><span>Card Target / Slips:</span><span>Rs. ${(record.system_card_sales || 0).toLocaleString()} / ${(record.manual_card_total || 0).toLocaleString()}</span></div>
                                <div class="data-row subtotal-row">
                                    <span>Card Variance:</span>
                                    <span class="${(record.card_variance || 0) === 0 ? 'val-balanced' : 'val-shortage'} font-bold">
                                        ${(record.card_variance || 0) === 0 ? 'Rs. 0 [MATCHED]' : (((record.card_variance || 0) > 0 ? '+' : '-') + 'Rs. ' + Math.abs(record.card_variance || 0).toLocaleString() + ((record.card_variance || 0) < 0 ? ' [SHORT]' : ' [SURPLUS]'))}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <!-- RIGHT COLUMN: Single-Column Denominations ABOVE Drawer Reconciliation -->
                        <div class="right-col">
                            <div class="audit-box right-box">
                                <!-- Upper Section: Physical Currency Denominations (1 Single Column) -->
                                <div>
                                    <div class="box-title">
                                        <span>Physical Currency Denominations</span>
                                    </div>
                                    <table class="denom-table">
                                        <thead>
                                            <tr>
                                                <th style="text-align: left; width: 44%;">Denomination</th>
                                                <th style="text-align: center; width: 22%;">Qty</th>
                                                <th style="text-align: right; width: 34%;">Subtotal</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${denomDetails.map(d => `
                                            <tr>
                                                <td style="text-align: left;">${d.label}</td>
                                                <td style="text-align: center;">${d.count}</td>
                                                <td style="text-align: right; font-weight: 700;">Rs. ${d.total.toLocaleString()}</td>
                                            </tr>
                                            `).join('')}
                                        </tbody>
                                    </table>

                                    <!-- Lower Section: Cash Drawer Reconciliation (Directly Below Denominations) -->
                                    <div class="box-subtitle">
                                        Cash Drawer Reconciliation
                                    </div>
                                    <div class="data-row"><span>(+) Opening Balance:</span><span>Rs. ${(record.opening_cash || 0).toLocaleString()}</span></div>
                                    <div class="data-row"><span>(+) Cash Sales:</span><span>Rs. ${(record.system_cash_sales || 0).toLocaleString()}</span></div>
                                    ${saleAdjustments !== 0 ? `
                                    <div class="data-row" style="color: ${saleAdjustments >= 0 ? '#15803d' : '#b91c1c'};">
                                        <span>(+/-) Sale Adjustments:</span>
                                        <span class="font-bold">${saleAdjustments >= 0 ? '+' : '-'}Rs. ${Math.abs(saleAdjustments).toLocaleString()}</span>
                                    </div>
                                    ` : ''}
                                    ${(record.system_cash_returns || 0) > 0 ? `
                                    <div class="data-row" style="color: #b91c1c;"><span>(-) Returns:</span><span>-Rs. ${(record.system_cash_returns || 0).toLocaleString()}</span></div>
                                    ` : ''}
                                    <div class="data-row"><span>(-) Expenses:</span><span>-Rs. ${(record.cash_expenses || 0).toLocaleString()}</span></div>
                                    <div class="data-row total-row"><span>(=) Expected Cash:</span><span>Rs. ${expectedCashVal.toLocaleString()}</span></div>
                                    <div class="data-row"><span>Cash in Reserve:</span><span>Rs. ${(record.cash_in_reserve || 0).toLocaleString()}</span></div>
                                    <div class="data-row"><span>Cash in Drawer:</span><span>Rs. ${(record.actual_cash || 0).toLocaleString()}</span></div>
                                    <div class="data-row subtotal-row"><span>Total Physical Cash:</span><span>Rs. ${totalPhysical.toLocaleString()}</span></div>
                                    <div class="data-row highlight-row">
                                        <span>Drawer Variance:</span>
                                        <span class="${cashVariance === 0 ? 'val-balanced' : cashVariance < 0 ? 'val-shortage' : 'val-surplus'}">
                                            ${cashVariance === 0 ? 'Rs. 0 [BALANCED]' : ((cashVariance > 0 ? '+' : '-') + 'Rs. ' + Math.abs(cashVariance).toLocaleString() + (cashVariance < 0 ? ' [SHORT]' : ' [SURPLUS]'))}
                                        </span>
                                    </div>
                                </div>

                                ${(record.move_to_reserve || 0) > 0 || (record.closing_balance || 0) > 0 ? `
                                <div style="border-top: 1px dashed #94a3b8; padding-top: 2px; margin-top: 2px;">
                                    <div class="data-row"><span>(-) Move to Reserve:</span><span>Rs. ${(record.move_to_reserve || 0).toLocaleString()}</span></div>
                                    <div class="data-row total-row"><span>Closing Balance:</span><span class="font-bold">Rs. ${(record.closing_balance || 0).toLocaleString()}</span></div>
                                </div>
                                ` : ''}
                            </div>
                        </div>
                    </div>

                    <!-- Clean 3-Card Grand Audit Totals Grid -->
                    <div class="grand-grid">
                        <div class="grand-card">
                            <div class="grand-label">Total Collections</div>
                            <div class="grand-val">Rs. ${totalCollections.toLocaleString()}</div>
                        </div>
                        <div class="grand-card">
                            <div class="grand-label">Net Recorded Sales</div>
                            <div class="grand-val">Rs. ${netRecordedSales.toLocaleString()}</div>
                        </div>
                        <div class="grand-card ${grandVariance === 0 ? 'grand-balanced' : 'grand-variance'}">
                            <div class="grand-label">Grand Variance</div>
                            <div class="grand-val" style="font-size: ${Math.abs(grandVariance) > 99999 ? '11.5px' : '12.8px'};">
                                ${grandVariance === 0 ? 'Rs. 0 [MATCHED]' : ((grandVariance > 0 ? '+' : '-') + 'Rs. ' + Math.abs(grandVariance).toLocaleString() + (grandVariance < 0 ? ' [SHORT]' : ' [SURPLUS]'))}
                            </div>
                        </div>
                    </div>

                    <!-- Closing Notes -->
                    ${record.closing_notes ? `
                    <div class="notes-box">
                        <strong>Audit Notes / Remarks:</strong> ${record.closing_notes}
                    </div>
                    ` : ''}
                </div>

                <!-- Formal Signatures Footer (Pinned to Very Bottom of Page) -->
                <div class="footer-signatures">
                    <div class="sign-block">
                        <div class="sign-col">
                            <div class="sign-space"></div>
                            <div class="sign-line"></div>
                            <div class="sign-meta">
                                <span class="sign-role">Store Manager / Cashier</span>
                                <span class="sign-date">Date: ____________</span>
                            </div>
                        </div>
                        <div class="sign-col">
                            <div class="sign-space"></div>
                            <div class="sign-line"></div>
                            <div class="sign-meta">
                                <span class="sign-role">Auditor / Reviewer</span>
                                <span class="sign-date">Date: ____________</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <script>
                window.onload = function() {
                    window.print();
                };
            </script>
        </body>
        </html>
        `;
    } else {
        // =========================================================================
        // 80mm THERMAL RECEIPT TEMPLATE (100% SOLID BLACK INK - ZERO DITHERING)
        // =========================================================================
        html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Daily Reconciliation - ${dateFormatted} (80mm)</title>
            <style>
                @page {
                    size: 80mm auto;
                    margin: 2mm 3mm;
                }
                * {
                    box-sizing: border-box;
                    color: #000000 !important;
                    background: transparent;
                }
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Courier New', monospace;
                    font-size: 11px;
                    line-height: 1.35;
                    font-weight: 600;
                    margin: 0;
                    padding: 0;
                    width: 72mm;
                }
                .text-center { text-align: center; }
                .text-right { text-align: right; }
                .font-bold { font-weight: 800; }
                .text-large { font-size: 12.5px; font-weight: 800; }
                .text-xl { font-size: 14px; font-weight: 900; }

                /* Crisp Black Separators */
                .sep-solid { border-bottom: 1.5px solid #000000; margin: 4px 0; }
                .sep-double { border-bottom: 2.5px double #000000; margin: 4px 0; }
                .sep-dashed { border-bottom: 1px dashed #000000; margin: 4px 0; }

                .row {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 2px;
                }
                .section-header {
                    border-top: 1.5px solid #000000;
                    border-bottom: 1.5px solid #000000;
                    padding: 2px 0;
                    margin: 6px 0 3px 0;
                    font-weight: 900;
                    font-size: 11px;
                    text-transform: uppercase;
                    text-align: center;
                    letter-spacing: 0.5px;
                }
                .box-highlight {
                    border: 1.5px solid #000000;
                    padding: 3px 4px;
                    margin: 4px 0;
                    font-weight: 800;
                }
                .denom-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 2px;
                    font-size: 10px;
                }
                .expense-list-thermal {
                    font-size: 10px;
                    line-height: 1.35;
                    padding: 2px 0;
                    word-break: break-word;
                }
            </style>
        </head>
        <body>
            <!-- Store Header -->
            <div class="text-center">
                <div class="text-xl font-bold" style="letter-spacing: 0.5px;">${storeName}</div>
                ${storeAddress ? `<div style="font-size: 9.5px;">${storeAddress}</div>` : ''}
                ${storePhone ? `<div style="font-size: 9.5px;">Tel: ${storePhone}</div>` : ''}
                <div class="sep-solid"></div>
                <div class="text-large font-bold">${isGrouped ? 'GROUPED RECONCILIATION' : 'DAILY RECONCILIATION'}</div>
                <div>${isGrouped ? 'Period: ' : 'Date: '}${dateFormatted}</div>
                <div style="font-size: 9.5px;">Printed: ${new Date().toLocaleTimeString()}</div>
            </div>

            <!-- SYSTEM RECORDED SALES (No Numbering) -->
            <div class="section-header">System Recorded Sales</div>
            <div class="row"><span>Cash Sales:</span><span class="font-bold">Rs. ${(record.system_cash_sales || 0).toLocaleString()}</span></div>
            <div class="row"><span>Card Sales:</span><span class="font-bold">Rs. ${(record.system_card_sales || 0).toLocaleString()}</span></div>
            <div class="row"><span>IBFT Sales:</span><span class="font-bold">Rs. ${(record.system_ibft_sales || 0).toLocaleString()}</span></div>
            <div class="sep-dashed"></div>
            <div class="row font-bold"><span>Gross Sales Total:</span><span>Rs. ${(record.system_counter_sales_total || 0).toLocaleString()}</span></div>
            ${(record.system_cash_returns || 0) > 0 ? `
            <div class="row"><span>(-) Customer Returns:</span><span class="font-bold">-Rs. ${(record.system_cash_returns || 0).toLocaleString()}</span></div>
            ` : ''}
            ${saleAdjustments !== 0 ? `
            <div class="row font-bold"><span>(+/-) Sale Adjustments:</span><span>${saleAdjustments >= 0 ? '+' : '-'}Rs. ${Math.abs(saleAdjustments).toLocaleString()}</span></div>
            ` : ''}
            <div class="sep-solid"></div>
            <div class="row text-large font-bold"><span>Net Recorded Sales:</span><span>Rs. ${netRecordedSales.toLocaleString()}</span></div>

            <!-- EXPENSES (No Numbering, Actual Expense Items Listed) -->
            <div class="section-header">Expenses</div>
            <div class="expense-list-thermal">${expenseList}</div>
            <div class="sep-dashed"></div>
            <div class="row font-bold"><span>Total Expenses:</span><span>Rs. ${(record.total_expenses || 0).toLocaleString()}</span></div>

            <!-- DIGITAL CHANNELS AUDIT (No Numbering) -->
            <div class="section-header">Digital Channels Audit</div>
            <div class="row"><span>IBFT Target / Rec:</span><span>${(record.system_ibft_sales || 0).toLocaleString()} / ${(record.manual_ibft_total || 0).toLocaleString()}</span></div>
            <div class="row font-bold">
                <span>IBFT Variance:</span>
                <span>${(record.ibft_variance || 0) === 0 ? 'Rs. 0 [MATCHED]' : ((record.ibft_variance || 0) > 0 ? '+' : '') + 'Rs. ' + (record.ibft_variance || 0).toLocaleString()}</span>
            </div>
            <div class="sep-dashed"></div>
            <div class="row"><span>Card Target / Slips:</span><span>${(record.system_card_sales || 0).toLocaleString()} / ${(record.manual_card_total || 0).toLocaleString()}</span></div>
            <div class="row font-bold">
                <span>Card Variance:</span>
                <span>${(record.card_variance || 0) === 0 ? 'Rs. 0 [MATCHED]' : ((record.card_variance || 0) > 0 ? '+' : '') + 'Rs. ' + (record.card_variance || 0).toLocaleString()}</span>
            </div>

            <!-- PHYSICAL CURRENCY DENOMINATIONS (Placed Above Cash Drawer) -->
            <div class="section-header">Physical Currency Denominations</div>
            <div class="denom-grid">
                <div>5000 &times; ${denoms.notes_5000 || 0} = ${((denoms.notes_5000 || 0) * 5000).toLocaleString()}</div>
                <div>50 &times; ${denoms.notes_50 || 0} = ${((denoms.notes_50 || 0) * 50).toLocaleString()}</div>
                <div>1000 &times; ${denoms.notes_1000 || 0} = ${((denoms.notes_1000 || 0) * 1000).toLocaleString()}</div>
                <div>20 &times; ${denoms.notes_20 || 0} = ${((denoms.notes_20 || 0) * 20).toLocaleString()}</div>
                <div>500 &times; ${denoms.notes_500 || 0} = ${((denoms.notes_500 || 0) * 500).toLocaleString()}</div>
                <div>10 &times; ${denoms.notes_10 || 0} = ${((denoms.notes_10 || 0) * 10).toLocaleString()}</div>
                <div>100 &times; ${denoms.notes_100 || 0} = ${((denoms.notes_100 || 0) * 100).toLocaleString()}</div>
                <div>Coins = ${(denoms.coins || 0).toLocaleString()}</div>
            </div>

            <!-- CASH DRAWER RECONCILIATION -->
            <div class="section-header">Cash Drawer Reconciliation</div>
            <div class="row"><span>(+) Opening Balance:</span><span>Rs. ${(record.opening_cash || 0).toLocaleString()}</span></div>
            <div class="row"><span>(+) Cash Sales:</span><span>Rs. ${(record.system_cash_sales || 0).toLocaleString()}</span></div>
            ${saleAdjustments !== 0 ? `
            <div class="row"><span>(+/-) Sale Adjustments:</span><span>${saleAdjustments >= 0 ? '+' : '-'}Rs. ${Math.abs(saleAdjustments).toLocaleString()}</span></div>
            ` : ''}
            ${(record.system_cash_returns || 0) > 0 ? `
            <div class="row"><span>(-) Cash Returns:</span><span>-Rs. ${(record.system_cash_returns || 0).toLocaleString()}</span></div>
            ` : ''}
            <div class="row"><span>(-) Cash Expenses:</span><span>-Rs. ${(record.cash_expenses || 0).toLocaleString()}</span></div>
            <div class="sep-dashed"></div>
            <div class="row font-bold"><span>(=) Expected Drawer:</span><span>Rs. ${expectedCashVal.toLocaleString()}</span></div>
            <div class="row"><span>Cash in Reserve:</span><span>Rs. ${(record.cash_in_reserve || 0).toLocaleString()}</span></div>
            <div class="row font-bold"><span>Cash in Drawer:</span><span>Rs. ${(record.actual_cash || 0).toLocaleString()}</span></div>
            <div class="sep-dashed"></div>
            <div class="row font-bold"><span>Total Physical Cash:</span><span>Rs. ${totalPhysical.toLocaleString()}</span></div>
            <div class="box-highlight text-center">
                ${cashVariance === 0 ? `
                <div class="text-large font-bold">DRAWER VARIANCE: Rs. 0</div>
                <div style="font-size: 9.5px;">[PHYSICAL CASH BALANCED]</div>
                ` : cashVariance < 0 ? `
                <div class="text-large font-bold">*** CASH SHORTAGE ***</div>
                <div class="text-large font-bold">-Rs. ${Math.abs(cashVariance).toLocaleString()}</div>
                ` : `
                <div class="text-large font-bold">*** CASH SURPLUS ***</div>
                <div class="text-large font-bold">+Rs. ${cashVariance.toLocaleString()}</div>
                `}
            </div>
            ${(record.move_to_reserve || 0) > 0 ? `
            <div class="row"><span>(-) Move to Reserve Safe:</span><span class="font-bold">Rs. ${(record.move_to_reserve || 0).toLocaleString()}</span></div>
            ` : ''}
            <div class="row font-bold"><span>Closing Balance:</span><span>Rs. ${(record.closing_balance || 0).toLocaleString()}</span></div>

            <!-- GRAND COLLECTIONS VS SALES -->
            <div class="section-header">Grand Collections vs Sales</div>
            <div class="row"><span>Net Cash from Sales:</span><span class="font-bold">Rs. ${netCashFromSales.toLocaleString()}</span></div>
            <div class="row"><span>Recorded IBFT:</span><span class="font-bold">Rs. ${(record.manual_ibft_total || 0).toLocaleString()}</span></div>
            <div class="row"><span>Recorded Card Slips:</span><span class="font-bold">Rs. ${(record.manual_card_total || 0).toLocaleString()}</span></div>
            <div class="sep-dashed"></div>
            <div class="row font-bold"><span>Total Collections:</span><span>Rs. ${totalCollections.toLocaleString()}</span></div>
            <div class="row font-bold"><span>Net System Sales:</span><span>Rs. ${netRecordedSales.toLocaleString()}</span></div>
            <div class="box-highlight text-center">
                ${grandVariance === 0 ? `
                <div class="text-large font-bold">GRAND VARIANCE: Rs. 0</div>
                <div style="font-size: 9.5px;">[COLLECTIONS MATCH SYSTEM SALES]</div>
                ` : grandVariance < 0 ? `
                <div class="text-large font-bold">*** GRAND SHORTAGE ***</div>
                <div class="text-large font-bold">-Rs. ${Math.abs(grandVariance).toLocaleString()}</div>
                ` : `
                <div class="text-large font-bold">*** GRAND SURPLUS ***</div>
                <div class="text-large font-bold">+Rs. ${grandVariance.toLocaleString()}</div>
                `}
            </div>

            <!-- Notes -->
            ${record.closing_notes ? `
            <div class="sep-dashed"></div>
            <div style="font-size: 10px; margin: 4px 0;"><strong>Notes:</strong> ${record.closing_notes}</div>
            ` : ''}

            <!-- Signatures -->
            <div class="sep-solid" style="margin-top: 15px;"></div>
            <div style="font-size: 10px; margin-top: 10px;">
                <div style="margin-bottom: 12px;">Manager Sign: ____________________</div>
                <div>Audited By: ____________________</div>
            </div>

            <div class="sep-double" style="margin-top: 10px;"></div>
            <div class="text-center" style="font-size: 9px; margin-top: 4px;">*** END OF RECONCILIATION REPORT ***</div>

            <script>
                window.onload = function() {
                    window.print();
                };
            </script>
        </body>
        </html>
        `;
    }

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
};
