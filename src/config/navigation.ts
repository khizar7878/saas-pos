import {
    LayoutDashboard,
    ShoppingCart,
    RotateCcw,
    Package,
    Barcode,
    Warehouse,
    BookOpen,
    Receipt,
    Store,
    Users,
    TrendingUp,
    TrendingDown,
    Wallet,
    Vault,
    PackagePlus,
    Layers,
    Shield,
    CalendarDays,
    Send,
    Building2,
    FileText,
    UserCog,
    CreditCard,
    LucideIcon,
    Tags,
    ClipboardList,
    Truck,
    FileSignature,
    Table2,
    Link,
    Inbox,
    ClipboardCheck,
    Globe,
    Scale,
    History
} from "lucide-react";

export interface NavItem {
    title: string;
    icon: LucideIcon;
    iconName: string; // For DB storage
    path: string;
}

export interface NavSection {
    title: string | null; // null for main/root items
    items: NavItem[];
}

export const navigationConfig: NavSection[] = [
    {
        title: "Main",
        items: [
            { title: "Dashboard", icon: LayoutDashboard, iconName: "LayoutDashboard", path: "/" },
        ]
    },
    {
        title: "Point of Sale",
        items: [
            { title: "Sales", icon: ShoppingCart, iconName: "ShoppingCart", path: "/pos/sales" },
            { title: "Returns", icon: RotateCcw, iconName: "RotateCcw", path: "/pos/returns" },
            { title: "Customers", icon: Users, iconName: "Users", path: "/customers" },
            { title: "Pending Payments", icon: FileText, iconName: "FileText", path: "/pos/pending-payments" },
        ]
    },
    {
        title: "Online Store",
        items: [
            { title: "Online Orders", icon: Globe, iconName: "Globe", path: "/online-store/orders" },
            { title: "Web Catalog", icon: Store, iconName: "Store", path: "/online-store/products" },
            { title: "Online Customers", icon: Users, iconName: "Users", path: "/online-store/customers" },
            { title: "Online Store Settings", icon: Building2, iconName: "Building2", path: "/online-store/settings" },
        ]
    },
    {
        title: "Order Book",
        items: [
            { title: "Book Order", icon: BookOpen, iconName: "BookOpen", path: "/order-book/book" },
            { title: "Pending Orders", icon: Inbox, iconName: "Inbox", path: "/order-book/pending" },
            { title: "Processed Orders", icon: ClipboardCheck, iconName: "ClipboardCheck", path: "/order-book/processed" },
            { title: "Packed Orders", icon: Package, iconName: "Package", path: "/order-book/packed" },
            { title: "Dispatched Orders", icon: Truck, iconName: "Truck", path: "/order-book/dispatched" },
        ]
    },
    {
        title: "Reports",
        items: [
            { title: "Sales Summary", icon: Receipt, iconName: "Receipt", path: "/reports/sales-summary" },
            { title: "Detailed Sales Summary", icon: Receipt, iconName: "Receipt", path: "/reports/detailed-sales-summary" },
            { title: "Sales Report", icon: CalendarDays, iconName: "CalendarDays", path: "/reports/daily-sales" },

            { title: "Profit & Loss", icon: TrendingUp, iconName: "TrendingUp", path: "/reports/profit-loss" },
            { title: "Product Sales", icon: Package, iconName: "Package", path: "/reports/product-sales" },
            { title: "Customer Sales", icon: Users, iconName: "Users", path: "/reports/customer-sales" },
            { title: "Stock Summary", icon: ClipboardList, iconName: "ClipboardList", path: "/reports/stock-summary" },
            { title: "Stock Report", icon: Warehouse, iconName: "Warehouse", path: "/reports/stock-report" },
            { title: "Received Stock", icon: PackagePlus, iconName: "PackagePlus", path: "/reports/received-stock" },
            { title: "Delivered Bills", icon: Truck, iconName: "Truck", path: "/reports/delivered-bills" },
        ]
    },
    {
        title: "Reconciliation",
        items: [
            { title: "Daily Reconciliation", icon: Scale, iconName: "Scale", path: "/reconciliation" },
            { title: "Closing History", icon: History, iconName: "History", path: "/reconciliation/history" },
        ]
    },
    {
        title: "Inventory",
        items: [
            { title: "Products", icon: Package, iconName: "Package", path: "/products" },
            { title: "Categories", icon: Tags, iconName: "Tags", path: "/categories" },
            { title: "Stock Receiving", icon: PackagePlus, iconName: "PackagePlus", path: "/inventory/receiving" },
            { title: "Stock Levels", icon: Layers, iconName: "Layers", path: "/inventory" },
            { title: "Label Printing", icon: Barcode, iconName: "Barcode", path: "/barcodes" },
            { title: "Warehouse Linking", icon: Link, iconName: "Link", path: "/inventory/warehouse-links" },
        ]
    },
    {
        title: "Utilities",
        items: [
            { title: "Custom Labels", icon: FileSignature, iconName: "FileSignature", path: "/utilities/custom-labels" },
            { title: "Spreadsheets", icon: Table2, iconName: "Table2", path: "/utilities/spreadsheets" },
        ]
    },

    {
        title: "Setup",
        items: [
            { title: "Store Settings", icon: Store, iconName: "Store", path: "/setup/store" },
            { title: "Users", icon: UserCog, iconName: "UserCog", path: "/setup/users" },
            { title: "FBR Integration", icon: Send, iconName: "Send", path: "/setup/fbr" },
        ]
    },
];

// Helper to flatten routes for checks
export const allRoutes = navigationConfig.flatMap(section => section.items);
