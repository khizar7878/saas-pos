import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { TenantProvider } from "@/contexts/TenantContext";
import { PermissionsProvider } from "@/contexts/PermissionsContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { AppLayout } from "./components/layout/AppLayout";
import Auth from "./pages/Auth";
import Superadmin from "./pages/Superadmin";
import Dashboard from "./pages/Dashboard";
import Sales from "./pages/Sales";
import Returns from "./pages/Returns";
import DailyReconciliation from "./pages/DailyReconciliation";
import ReconciliationHistory from "./pages/ReconciliationHistory";
import { useStoreSettings } from "@/hooks/useStoreSettings";

import SalesSummary from "./pages/SalesSummary";
import DetailedSalesSummary from "./pages/DetailedSalesSummary";
import SalesReport from "./pages/SalesReport";
import ReceivedStockReport from "./pages/ReceivedStockReport";

import ProfitLossReport from "./pages/ProfitLossReport";
import ProductSales from "./pages/ProductSales";
import CustomerSales from "./pages/CustomerSales";
import Products from "./pages/Products";
import Categories from "./pages/Categories";
import Barcodes from "./pages/Barcodes";
import Inventory from "./pages/Inventory";
import StockReceiving from "./pages/StockReceiving";
import WarehouseLinks from "./pages/WarehouseLinks";
import Customers from "./pages/Customers";
import CustomerDetails from "./pages/CustomerDetails";
import Users from "./pages/Users";
import StoreSettings from "./pages/StoreSettings";
import FbrDashboard from "./pages/FbrDashboard";


import StockReport from "./pages/StockReport";
import StockSummary from "./pages/StockSummary";
import PendingPayments from "./pages/PendingPayments";
import DeliveredBills from "./pages/DeliveredBills";

import NotFound from "./pages/NotFound";
import ThemeDemo from "./pages/ThemeDemo";
import CustomLabels from "./pages/CustomLabels";
import Spreadsheets from "./pages/Spreadsheets";


import { IntercomProvider } from "@/hooks/useIntercomCall";
import BookOrder from "./pages/BookOrder";
import PendingOrders from "./pages/PendingOrders";
import ProcessedOrders from "./pages/ProcessedOrders";
import PackedOrders from "./pages/PackedOrders";
import DispatchedOrders from "./pages/DispatchedOrders";
import OnlineOrders from "./pages/OnlineOrders";
import OnlineProducts from "./pages/OnlineProducts";
import OnlineCustomers from "./pages/OnlineCustomers";
import OnlineStoreSettings from "./pages/OnlineStoreSettings";

const queryClient = new QueryClient();

// component to prefetch global settings
const GlobalInit = () => {
  useStoreSettings();
  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <GlobalInit />
    <ThemeProvider defaultTheme="light" storageKey="app-theme">
      <AuthProvider>
        <TenantProvider>
          <PermissionsProvider>
            <IntercomProvider>
              <TooltipProvider>
                <Toaster />
                <Sonner />
                <BrowserRouter>
                  <Routes>
                    <Route path="/auth" element={<Auth />} />
                    <Route
                      element={
                        <ProtectedRoute>
                          <AppLayout />
                        </ProtectedRoute>
                      }
                    >
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/superadmin" element={<Superadmin />} />

                      <Route path="/pos/sales" element={<Sales />} />
                    <Route path="/pos/returns" element={<Returns />} />
                    <Route path="/pos/pending-payments" element={<PendingPayments />} />

                    {/* Reconciliation Routes */}
                    <Route path="/reconciliation" element={<DailyReconciliation />} />
                    <Route path="/reconciliation/history" element={<ReconciliationHistory />} />

                    {/* Online Store Admin Routes */}
                    <Route path="/online-store/orders" element={<OnlineOrders />} />
                    <Route path="/online-store/products" element={<OnlineProducts />} />
                    <Route path="/online-store/customers" element={<OnlineCustomers />} />
                    <Route path="/online-store/settings" element={<OnlineStoreSettings />} />

                    {/* Order Book Routes */}
                    <Route path="/order-book/book" element={<BookOrder />} />
                    <Route path="/order-book/pending" element={<PendingOrders />} />
                    <Route path="/order-book/processed" element={<ProcessedOrders />} />
                    <Route path="/order-book/packed" element={<PackedOrders />} />
                    <Route path="/order-book/dispatched" element={<DispatchedOrders />} />

                    <Route path="/reports/sales-summary" element={<SalesSummary />} />
                    <Route path="/reports/detailed-sales-summary" element={<DetailedSalesSummary />} />
                    <Route path="/reports/delivered-bills" element={<DeliveredBills />} />
                    <Route path="/reports/daily-sales" element={<SalesReport />} />
                    <Route path="/reports/received-stock" element={<ReceivedStockReport />} />

                    <Route path="/reports/profit-loss" element={<ProfitLossReport />} />
                    <Route path="/reports/product-sales" element={<ProductSales />} />
                    <Route path="/reports/customer-sales" element={<CustomerSales />} />
                    <Route path="/reports/stock-report" element={<StockReport />} />
                    <Route path="/reports/stock-summary" element={<StockSummary />} />
                    <Route path="/customers" element={<Customers />} />
                    <Route path="/customers/:id" element={<CustomerDetails />} />
                     <Route path="/inventory" element={<Inventory />} />
                    <Route path="/inventory/receiving" element={<StockReceiving />} />
                    <Route path="/inventory/warehouse-links" element={<WarehouseLinks />} />
                    <Route path="/products" element={<Products />} />
                    <Route path="/categories" element={<Categories />} />
                    <Route path="/barcodes" element={<Barcodes />} />

                    <Route path="/setup/users" element={<Users />} />
                    <Route path="/setup/store" element={<StoreSettings />} />
                    <Route path="/setup/fbr" element={<FbrDashboard />} />
                    <Route path="/utilities/custom-labels" element={<CustomLabels />} />
                    <Route path="/utilities/spreadsheets" element={<Spreadsheets />} />
                  </Route>
                  <Route path="/theme-demo" element={<ThemeDemo />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
            </TooltipProvider>
          </IntercomProvider>
          </PermissionsProvider>
        </TenantProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
