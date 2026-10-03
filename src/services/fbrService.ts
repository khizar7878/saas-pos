import QRCode from 'qrcode';

export interface FBRInvoiceItem {
    ItemCode: string;
    ItemName: string;
    PCTCode: string;
    Quantity: number;
    TaxRate: number;
    SaleValue: number;
    Discount: number;
    TaxCharged: number;
    TotalAmount: number;
    InvoiceType: number; // 1 for New Sale
    RefUSIN?: string | null;
}

export interface FBRInvoicePayload {
    POSID: number;
    USIN: string;
    DateTime: string;
    BuyerName: string;
    BuyerPhoneNumber: string;
    TotalSaleValue: number;
    TotalQuantity: number;
    TotalTaxCharged: number;
    Discount: number;
    TotalBillAmount: number;
    PaymentMode: number; // 1: Cash, 2: Card, etc.
    InvoiceType: number; // 1: New Sale
    RefUSIN: string | null;
    Items: FBRInvoiceItem[];
    QRCode?: string;
}

export const buildFBRInvoicePayload = async ({
    cart,
    posId,
    usin,
    paymentMethod,
    invoiceDate,
    discountAmount,
    customerName,
    isReturn = false,
    originalUsin = null,
}: {
    cart: any[];
    posId: number;
    usin: string;
    paymentMethod: number;
    invoiceDate: string;
    discountAmount: number;
    customerName?: string;
    isReturn?: boolean;
    originalUsin?: string | null;
}): Promise<FBRInvoicePayload> => {
    // Calculate totals based on corrected logic
    let totalSaleValue = 0;
    let totalTaxCharged = 0;
    let totalQuantity = 0;
    let totalInclusiveAmount = 0;

    const items: FBRInvoiceItem[] = cart.map((item: any) => {
        const qty = item.quantity;
        // Use total_price if available, otherwise fallback to unit_price * qty
        const totalLinePriceInclusive = item.total_price ?? (item.unit_price * qty);
        const taxRate = item.tax_percentage ?? 0;
        
        // FBR expects SaleValue to be EXCLUSIVE of tax
        const saleValueExclusive = totalLinePriceInclusive / (1 + (taxRate / 100));
        
        // Tax is the difference between inclusive and exclusive
        const totalLineTax = totalLinePriceInclusive - saleValueExclusive;
        
        const discount = item.discount || 0;

        totalSaleValue += saleValueExclusive;
        totalTaxCharged += totalLineTax;
        totalQuantity += qty;
        totalInclusiveAmount += totalLinePriceInclusive;

        return {
            ItemCode: item.product_id ? item.product_id.toString() : "DELIVERY",
            ItemName: item.name || item.product_name || "Item",
            PCTCode: item.pct_code || "01011000",
            Quantity: qty,
            TaxRate: taxRate,
            SaleValue: Number(saleValueExclusive.toFixed(2)),
            Discount: discount,
            TaxCharged: Number(totalLineTax.toFixed(2)),
            TotalAmount: Number((totalLinePriceInclusive - discount).toFixed(2)),
            InvoiceType: isReturn ? 3 : 1,
            RefUSIN: isReturn ? originalUsin : null,
        };
    });

    // TotalBillAmount remains the final inclusive amount minus any global discount
    const totalBillAmount = totalInclusiveAmount - discountAmount;

    const payload: FBRInvoicePayload = {
        POSID: posId,
        USIN: usin,
        DateTime: invoiceDate,
        BuyerName: customerName || "Walk-in",
        BuyerPhoneNumber: "",
        TotalSaleValue: Number(totalSaleValue.toFixed(2)),
        TotalQuantity: totalQuantity,
        TotalTaxCharged: Number(totalTaxCharged.toFixed(2)),
        Discount: discountAmount,
        TotalBillAmount: Number(totalBillAmount.toFixed(2)),
        PaymentMode: paymentMethod,
        InvoiceType: isReturn ? 3 : 1,
        RefUSIN: isReturn ? originalUsin : null,
        Items: items,
        QRCode: "",
    };

    // We do NOT generate the QR code here anymore, because it creates a huge payload.
    // We will generate a simple QR code (Invoice #) after receiving the response from FBR.
    payload.QRCode = "";

    return payload;
};

export const submitToFBR = async (
    apiUrl: string,
    payload: FBRInvoicePayload,
    environment?: 'sandbox' | 'production'
) => {
    try {
        // Detect environment: explicit param, or localStorage key, or url indicator
        const isSandbox =
            environment === 'sandbox' ||
            apiUrl.includes('sandbox') ||
            (typeof window !== 'undefined' && localStorage.getItem('saas_fbr_environment') === 'sandbox');

        // Sandbox Simulation Mode
        if (isSandbox) {
            console.log(`[submitToFBR] 🧪 FBR Sandbox Active - Generating Sandbox Fiscal Invoice for POSID: ${payload.POSID}`);
            // Brief network simulation delay
            await new Promise((resolve) => setTimeout(resolve, 300));

            const randomSuffix = Math.floor(10000000 + Math.random() * 90000000).toString();
            const sandboxInvoiceNumber = `SANDBOX-${payload.POSID}-${randomSuffix}`;
            const qrCodeDataUrl = await QRCode.toDataURL(sandboxInvoiceNumber, { width: 160, margin: 1 });

            return {
                success: true,
                Code: "100",
                Response: "Sandbox Mock Invoice Processed Successfully",
                fbrInvoiceNumber: sandboxInvoiceNumber,
                invoiceNumber: sandboxInvoiceNumber,
                qrCode: qrCodeDataUrl,
                fbr_qr_code: qrCodeDataUrl,
                environment: "sandbox",
                is_sandbox: true,
            };
        }

        // Live Production Submission Mode
        let targetUrl = apiUrl;
        const isLocalHost =
            typeof window !== 'undefined' &&
            (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

        if (targetUrl.includes('146.190.202.112:5060')) {
            targetUrl = '/api/fbr/submit-invoice';
        } else if (isLocalHost && (targetUrl.includes('localhost:5060') || targetUrl.includes('127.0.0.1:5060'))) {
            targetUrl = '/api/local-fbr/submit-invoice';
        }

        console.log(`[submitToFBR] 🟢 Live Production Submitting to: ${targetUrl}`, payload);

        const response = await fetch(targetUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error(`[submitToFBR] HTTP ${response.status}:`, errText);
            throw new Error(`FBR API responded with status ${response.status}`);
        }

        const data = await response.json();
        console.log(`[submitToFBR] Response received:`, data);

        if (data && data.success === false) {
            throw new Error(data.Response || data.Message || "FBR Gateway reported an error");
        }

        return data; // Expected { fbrInvoiceNumber: "...", Code: "100", ... }
    } catch (error: any) {
        console.error("FBR Submission Error:", error);
        throw error;
    }
};
