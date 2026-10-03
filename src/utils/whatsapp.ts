
import { StoreSettings } from '@/types/database';

interface SaleItem {
    productName: string;
    quantity: number;
    metersPerUnit: number;
    pricePerMeter: number;
    totalPrice: number;
}

// Unicode Icons to ensure compatibility (avoiding encoding issues)
const ICONS = {
    THREAD: '🧵',
    PIN: '📍',
    PHONE: '📞',
    INVOICE: '📄',
    CALENDAR: '📅',
    USER: '👤',
    BOX: '📦',
    MONEY_BAG: '💰',
    BILL: '💵',
    LABEL: '🏷️',
    CHART_DOWN: '📉',
    CARD: '💳',
    RECEIPT: '🧾',
    NUMBERS: '🔢',
    PRAY: '🙏'
};

export const generateBillMessage = (
    saleNumber: string,
    customerName: string,
    items: SaleItem[],
    total: number,
    discount: number,
    customerBalance: number = 0,
    storeSettings?: StoreSettings,
    isQuotation: boolean = false
) => {
    // Default Fallbacks
    const storeName = storeSettings?.store_name || 'ABR E KARAM FABRICS';
    const storeAddress = storeSettings?.address || 'Main Market, Lahore';
    const storePhone = storeSettings?.phone || '0300-1234567';


    const date = new Date().toLocaleDateString();

    let message = `*${storeName.toUpperCase()}* ${ICONS.THREAD}\n`;
    if (storeSettings?.header_text) {
        message += `_${storeSettings.header_text}_\n`;
    }
    message += `${ICONS.PIN} ${storeAddress}\n`;
    message += `${ICONS.PHONE} ${storePhone}\n\n`;

    message += `${ICONS.INVOICE} *${isQuotation ? 'QUOTATION' : 'INVOICE'} ${saleNumber}*\n`;
    message += `${ICONS.CALENDAR} ${date}\n`;
    message += `${ICONS.USER} Customer: *${customerName}*\n\n`;

    message += `${ICONS.BOX} *ITEMS*\n`;
    message += `━━━━━━━━━━━━━━━━\n\n`;

    items.forEach((item, index) => {
        // Add numbering 1️⃣ 2️⃣ etc.
        const num = index + 1;
        const emojiNum = num <= 9 ? num + '\uFE0F\u20E3' : `*${num}.*`;

        message += `${emojiNum} *${item.productName}*\n`;
        message += `   Qty: ${item.quantity} | ${item.metersPerUnit}m @ Rs. ${item.pricePerMeter}/m\n`;
        message += `   ${ICONS.MONEY_BAG} _Rs. ${item.totalPrice.toLocaleString()}_\n\n`;
    });

    const subtotal = total + discount;

    message += `━━━━━━━━━━━━━━━━\n`;
    message += `${ICONS.BILL} Subtotal:  Rs. ${subtotal.toLocaleString()}\n`;
    if (discount > 0) {
        message += `${ICONS.LABEL} Discount:  Rs. ${discount.toLocaleString()}\n`;
    }
    message += `━━━━━━━━━━━━━━━━\n`;
    message += `${ICONS.MONEY_BAG} *TOTAL:    Rs. ${total.toLocaleString()}*\n`;
    message += `━━━━━━━━━━━━━━━━\n\n`;

    if (isQuotation) {
        message += `_Note: This is a quotation/estimate only._\n\n`;
    } else if (customerBalance > 0) {
        message += `Please settle your previous balance:\n`;
        message += `${ICONS.CHART_DOWN} *Previous Balance: Rs. ${(customerBalance - total).toLocaleString()}*\n`;
        message += `${ICONS.CARD} *Net Payable: Rs. ${customerBalance.toLocaleString()}*\n`;
        message += `━━━━━━━━━━━━━━━━\n\n`;
    }

    if (storeSettings?.footer_text) {
        message += `_${storeSettings.footer_text}_\n`;
    }
    message += `_Thank you for your business!_ ${ICONS.PRAY}`;

    return message;
};

export const generatePaymentMessage = (
    receiptNumber: string,
    amount: number,
    customerName: string,
    type: 'received' | 'paid',
    paymentMode: string,
    customerBalance: number = 0,
    storeSettings?: StoreSettings
) => {
    const date = new Date().toLocaleDateString();
    const action = type === 'received' ? 'Received From' : 'Paid To';

    // Default Fallbacks
    const storeName = storeSettings?.store_name || 'ABR E KARAM FABRICS';
    const storeAddress = storeSettings?.address || 'Main Market, Lahore';

    let message = `*${storeName.toUpperCase()}* ${ICONS.THREAD}\n`;
    message += `${ICONS.PIN} ${storeAddress}\n\n`;

    message += `${ICONS.RECEIPT} *PAYMENT RECEIPT*\n`;
    message += `${ICONS.NUMBERS} Receipt #: ${receiptNumber}\n`;
    message += `${ICONS.CALENDAR} ${date}\n\n`;

    message += `${ICONS.USER} ${action}:\n`;
    message += `*${customerName}*\n\n`;

    message += `${ICONS.MONEY_BAG} *Amount: Rs. ${amount.toLocaleString()}*\n`;
    message += `${ICONS.CARD} Mode: ${paymentMode.toUpperCase()}\n\n`;

    if (customerBalance !== 0) {
        message += `${ICONS.CHART_DOWN} *Remaining Balance: Rs. ${customerBalance.toLocaleString()}*\n\n`;
    }

    message += `_Thank you!_ ${ICONS.PRAY}`;

    return message;
}

export const getWhatsAppUrl = (phone: string | undefined | null, message: string) => {
    const url = new URL('https://api.whatsapp.com/send');

    if (phone) {
        let cleanPhone = phone.replace(/\D/g, '');
        // Handle local Pakistan format 03... -> 923...
        if (cleanPhone.startsWith('03')) {
            cleanPhone = '92' + cleanPhone.substring(1);
        }
        url.searchParams.set('phone', cleanPhone);
    }

    url.searchParams.set('text', message);
    return url.toString();
};

export const openWhatsApp = (phone: string | undefined | null, message: string) => {
    const url = getWhatsAppUrl(phone, message);
    window.open(url, '_blank');
};
