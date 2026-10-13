// Granular Page & Feature Permissions Matrix for SaaS Multi-Tenant POS

export interface GranularPage {
  path: string;
  name: string;
  description: string;
  isCore?: boolean;
}

export interface GranularSection {
  id: string;
  title: string;
  description: string;
  iconName: string;
  pages: GranularPage[];
}

export const GRANULAR_SECTIONS: GranularSection[] = [
  {
    id: "pos",
    title: "Point of Sale",
    description: "Counter sales, cashier checkout, returns, and customer khata",
    iconName: "ShoppingCart",
    pages: [
      { path: "/pos/sales", name: "Counter Sales Checkout", description: "Standard till sale checkout & barcode scanning", isCore: true },
      { path: "/pos/returns", name: "Returns & Exchanges", description: "Counter bill returns and item replacement", isCore: true },
      { path: "/customers", name: "Customers & Khata", description: "Customer accounts, phone directory & balances", isCore: true },
      { path: "/pos/pending-payments", name: "Credit Sales & Pending Bills", description: "Customer credit bill settlements and debt records" },
    ]
  },
  {
    id: "inventory",
    title: "Inventory & Catalog",
    description: "Product catalog, categories, stock levels, and barcode printing",
    iconName: "Package",
    pages: [
      { path: "/products", name: "Products Catalog", description: "Master product list, prices, costs & GST tax rates", isCore: true },
      { path: "/categories", name: "Categories & Brands", description: "Product grouping and taxonomy", isCore: true },
      { path: "/inventory", name: "Stock Levels & Alerts", description: "Live inventory stock levels and low-stock alerts", isCore: true },
      { path: "/inventory/receiving", name: "Stock Receiving", description: "Supplier stock receipts and purchasing batches" },
      { path: "/barcodes", name: "Barcode Label Printing", description: "Direct thermal barcode sticker printer" },
      { path: "/inventory/warehouse-links", name: "Warehouse Linking", description: "Multi-branch stock sync & warehouse mapping" },
    ]
  },
  {
    id: "reports",
    title: "Reports & Financial Analytics",
    description: "Sales summaries, profitability analysis, and audit trails",
    iconName: "BarChart3",
    pages: [
      { path: "/reports/daily-sales", name: "Daily Sales Report", description: "Daily sales register by cashier and terminal", isCore: true },
      { path: "/reports/sales-summary", name: "Sales Summary", description: "Period sales overview with charts", isCore: true },
      { path: "/reports/product-sales", name: "Product Sales Breakdown", description: "Top selling items and volume", isCore: true },
      { path: "/reports/detailed-sales-summary", name: "Detailed Sales Summary", description: "Line-by-line itemized sales ledger" },
      { path: "/reports/profit-loss", name: "Profit & Loss Statement", description: "Gross margin, net profit and expenses" },
      { path: "/reports/customer-sales", name: "Customer Sales Analytics", description: "Sales volume per customer account" },
      { path: "/reports/stock-summary", name: "Stock Summary Report", description: "Current inventory valuation" },
      { path: "/reports/stock-report", name: "Stock Movement Report", description: "Item in/out history and audits" },
      { path: "/reports/received-stock", name: "Received Stock History", description: "Audit of all supplier stock batches" },
      { path: "/reports/delivered-bills", name: "Delivered Bills Tracking", description: "Delivery rider cash settlements" },
    ]
  },
  {
    id: "accounting",
    title: "Till Balancing & Treasury",
    description: "Day-end till reconciliation, cash closings, and bank accounts",
    iconName: "Scale",
    pages: [
      { path: "/reconciliation", name: "Daily Till Reconciliation", description: "End-of-day physical cash balancing and drawer count", isCore: true },
      { path: "/reconciliation/history", name: "Closing Records History", description: "Historical register closing audits and discrepancy logs", isCore: true },
      { path: "/accounts", name: "Treasury & Bank Ledgers", description: "Business bank accounts, petty cash & fund transfers" },
    ]
  },
  {
    id: "fbr",
    title: "Taxation & FBR IMS",
    description: "Tier-1 Fiscalization gateway, mock sandbox, and IRIS compliance",
    iconName: "Building2",
    pages: [
      { path: "/setup/fbr", name: "FBR IMS Dashboard", description: "Real-time FBR gateway monitor, sandbox toggle, and sync" },
    ]
  },
  {
    id: "online_store",
    title: "Online Store & Order Book",
    description: "E-commerce web store, digital order book, and rider dispatch",
    iconName: "Globe",
    pages: [
      { path: "/online-store/orders", name: "Web Orders", description: "Incoming online website orders" },
      { path: "/online-store/products", name: "Web Catalog", description: "Online product visibility and photos" },
      { path: "/online-store/customers", name: "Online Customers", description: "Customer web profiles and addresses" },
      { path: "/online-store/settings", name: "Online Store Settings", description: "Banner, delivery fees and web branding" },
      { path: "/order-book/book", name: "Order Book Desk", description: "Call center & WhatsApp order booking" },
      { path: "/order-book/pending", name: "Pending Orders Queue", description: "Unprocessed phone orders" },
      { path: "/order-book/processed", name: "Processed Orders", description: "Order confirmation and invoicing" },
      { path: "/order-book/packed", name: "Packed Orders", description: "Parcels packed for delivery" },
      { path: "/order-book/dispatched", name: "Dispatched & Delivered", description: "Courier & rider handover tracking" },
    ]
  },
  {
    id: "utilities",
    title: "Utilities & Setup",
    description: "Store settings, staff accounts, custom labels, and spreadsheets",
    iconName: "Settings",
    pages: [
      { path: "/setup/store", name: "Store Settings", description: "Receipt layout, address, phone & logo", isCore: true },
      { path: "/setup/users", name: "Staff User Management", description: "Cashier and manager logins & roles", isCore: true },
      { path: "/utilities/custom-labels", name: "Custom Label Designer", description: "Drag-and-drop thermal label template maker" },
      { path: "/utilities/spreadsheets", name: "Built-in Spreadsheets", description: "Excel-compatible sheets for calculations" },
    ]
  }
];

// Helper to get all page paths
export const ALL_PAGE_PATHS = GRANULAR_SECTIONS.flatMap(s => s.pages.map(p => p.path));

// Presets by Subscription Tier
export const TIER_PRESETS: Record<string, { fbr: boolean; pages: string[] }> = {
  starter: {
    fbr: false,
    pages: [
      "/pos/sales",
      "/pos/returns",
      "/customers",
      "/products",
      "/categories",
      "/inventory",
      "/reports/daily-sales",
      "/reports/sales-summary",
      "/reports/product-sales",
      "/reconciliation",
      "/reconciliation/history",
      "/setup/store",
      "/setup/users",
    ]
  },
  professional: {
    fbr: true,
    pages: [
      "/pos/sales",
      "/pos/returns",
      "/customers",
      "/pos/pending-payments",
      "/products",
      "/categories",
      "/inventory",
      "/inventory/receiving",
      "/barcodes",
      "/reports/daily-sales",
      "/reports/sales-summary",
      "/reports/detailed-sales-summary",
      "/reports/product-sales",
      "/reports/profit-loss",
      "/reports/customer-sales",
      "/reports/stock-summary",
      "/reports/stock-report",
      "/reports/received-stock",
      "/reports/delivered-bills",
      "/reconciliation",
      "/reconciliation/history",
      "/accounts",
      "/setup/fbr",
      "/setup/store",
      "/setup/users",
      "/utilities/custom-labels",
    ]
  },
  enterprise: {
    fbr: true,
    pages: ALL_PAGE_PATHS
  }
};
