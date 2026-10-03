import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  DollarSign,
  ShoppingBag,
  CreditCard,
  Banknote,
  Building2,
  Bell,
  Loader2
} from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";
import { RecentSalesTable } from "@/components/dashboard/RecentSalesTable";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { LowStockAlert } from "@/components/dashboard/LowStockAlert";
import { Button } from "@/components/ui/button";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { WeeklySalesChart, TopProductsChart, TopCategoriesChart } from "@/components/dashboard/DashboardCharts";
import { usePermissions } from "@/contexts/PermissionsContext";

const Dashboard = () => {
  const navigate = useNavigate();
  const { data: stats } = useDashboardStats();
  const { allowedRoutes, isAdmin, loading: permissionsLoading } = usePermissions();

  const hasDashboardAccess = isAdmin || allowedRoutes.some(r => r.path === '/');

  useEffect(() => {
    if (!permissionsLoading && !hasDashboardAccess) {
      if (allowedRoutes.length > 0) {
        navigate(allowedRoutes[0].path);
      } else {
        // If no routes allowed at all, maybe redirect to auth or show unauthorized
        // For now, we'll just let them stare at nothing or go to auth
        // navigate('/auth'); // Careful of loops if auth redirects here
      }
    }
  }, [permissionsLoading, hasDashboardAccess, allowedRoutes, navigate]);

  if (permissionsLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!hasDashboardAccess) {
    return null; // Don't render dashboard while redirecting
  }

  return (
    <div className="h-full overflow-auto p-4 md:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground text-xs md:text-sm">
            Welcome back! Here's what's happening today.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="relative">
            <Bell className="w-4 h-4" />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-destructive rounded-full" />
          </Button>
        </div>
      </div>

      {/* Primary Stats Grid - Financials */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Today's Sales"
          value={`Rs. ${(stats?.salesToday?.value || 0).toLocaleString()}`}
          subtitle={`${stats?.salesToday?.count || 0} transactions`}
          icon={DollarSign}
          variant="primary"
        />
        <StatCard
          title="Cash Sales"
          value={`Rs. ${(stats?.cashSales?.value || 0).toLocaleString()}`}
          subtitle={`${stats?.cashSales?.count || 0} transactions`}
          icon={Banknote}
          variant="default"
        />
        <StatCard
          title="Card Sales"
          value={`Rs. ${(stats?.cardSales?.value || 0).toLocaleString()}`}
          subtitle={`${stats?.cardSales?.count || 0} transactions`}
          icon={CreditCard}
          variant="default"
        />
        <StatCard
          title="IBFT Sales"
          value={`Rs. ${(stats?.ibftSales?.value || 0).toLocaleString()}`}
          subtitle={`${stats?.ibftSales?.count || 0} transactions`}
          icon={Building2}
          variant="default"
        />
      </div>

      {/* Secondary Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Products Sold"
          value={`${stats?.productsSold?.value || 0}`}
          subtitle="Units today"
          icon={ShoppingBag}
        />
      </div>


      {/* Charts Section */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <div className="lg:col-span-4 h-[350px]">
          <WeeklySalesChart data={stats?.weeklySales || []} />
        </div>
        <div className="lg:col-span-3 h-[350px]">
          <TopCategoriesChart data={stats?.topCategories || []} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <div className="lg:col-span-4 h-[400px]">
          <TopProductsChart data={stats?.topProducts || []} />
        </div>
        <div className="lg:col-span-3">
          <RecentSalesTable />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <QuickActions />
        <LowStockAlert />
      </div>
    </div>
  );
};

export default Dashboard;