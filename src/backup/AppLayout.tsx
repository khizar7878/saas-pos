import { AppSidebar } from "./AppSidebar";
import { MobileNav } from "./MobileNav";
import { Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";

import DeviceApproval from "../../pages/DeviceApproval";
import { useDeviceSecurity } from "@/hooks/useDeviceSecurity";
import { Loader2 } from "lucide-react";

export function AppLayout() {
  const { status, loading } = useDeviceSecurity();
  const location = useLocation();
  const [animateKey, setAnimateKey] = useState(0);

  // Trigger animation on route change
  useEffect(() => {
    setAnimateKey(prev => prev + 1);
  }, [location.pathname]);

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-muted/20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (status === 'pending' || status === 'rejected') {
    return <DeviceApproval />;
  }

  return (
    <div className="flex h-screen w-full bg-muted/30 overflow-hidden">
      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <AppSidebar />
      </div>

      {/* Mobile Navigation */}
      <MobileNav />

      {/* Main Content */}
      <main className="flex-1 overflow-hidden pt-14 md:pt-0 md:pb-0">
        <div
          key={animateKey}
          className="h-full md:rounded-xl md:border md:border-border bg-card md:shadow-sm overflow-y-auto md:m-4 animate-slide-down"
        >
          <Outlet />
        </div>
      </main>
    </div>
  );
}
