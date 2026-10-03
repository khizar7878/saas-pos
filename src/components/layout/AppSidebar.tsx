import { useState, useEffect } from "react";
import {
  ChevronDown,
  LogOut,
  LucideIcon,
  ShoppingCart,
  Receipt,
  Warehouse,
  BookOpen,
  Landmark,
  Settings,
  Wrench,
  Globe,
  Store,
  Scale,
  Crown
} from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/contexts/PermissionsContext";
import { useTenant } from "@/contexts/TenantContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { navigationConfig, NavSection, NavItem } from "@/config/navigation";
import { useRouteSync } from "@/hooks/useRouteSync";
import NotificationCenter from "../notifications/NotificationCenter";
import { IntercomCallWidget } from "../intercom/IntercomCallWidget";

export function AppSidebar() {
  // Trigger Auto-Sync for Admins
  useRouteSync();

  const [collapsed, setCollapsed] = useState(false);
  // Flatten sections state: { "Point of Sale": true, "Reports": false }
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    "Point of Sale": false,
    "Online Store": false,
    "Reports": false,
    "Reconciliation": false,
    "Inventory": false,
    "Accounts": false,
    "Setup": false,
  });

  const [signOutOpen, setSignOutOpen] = useState(false);
  const location = useLocation();
  const { signOut, user } = useAuth();
  const { isAdmin, hasRouteAccess, loading: permissionsLoading } = usePermissions();
  const [pendingDevicesCount, setPendingDevicesCount] = useState(0);

  const toggleSection = (title: string) => {
    setExpandedSections(prev => {
      const isExpanded = prev[title];

      if (isExpanded) {
        // If already expanded, just collapse it
        return { ...prev, [title]: false };
      }

      // If opening, close all others first
      const newState = Object.keys(prev).reduce((acc, key) => {
        acc[key] = false;
        return acc;
      }, {} as Record<string, boolean>);

      newState[title] = true;
      return newState;
    });
  };

  // Auto-expand section containing active route on load or navigation
  useEffect(() => {
    const currentSection = navigationConfig.find(section =>
      section.title && section.title !== "Main" &&
      section.items.some(item =>
        location.pathname === item.path || (item.path !== "/" && location.pathname.startsWith(`${item.path}/`))
      )
    );

    if (currentSection?.title) {
      setExpandedSections(prev => {
        if (prev[currentSection.title!]) return prev;
        const newState = Object.keys(prev).reduce((acc, key) => {
          acc[key] = false;
          return acc;
        }, {} as Record<string, boolean>);
        newState[currentSection.title!] = true;
        return newState;
      });
    }
  }, [location.pathname]);

  const handleSignOut = async () => {
    await signOut();
    setSignOutOpen(false);
  };

  const { currentStore, isSuperAdmin, fbrEnvironment, isModuleEnabled } = useTenant();
  const navigate = useNavigate();

  // Filter items based on permissions and module flags
  const getFilteredSection = (section: NavSection) => {
    if (permissionsLoading) return { ...section, items: [] };

    // Section-level module gating
    if (section.title === "Online Store" && !isModuleEnabled("online_store")) {
      return { ...section, items: [] };
    }
    if (section.title === "Order Book" && !isModuleEnabled("online_store")) {
      return { ...section, items: [] };
    }
    if (section.title === "Reconciliation" && !isModuleEnabled("daily_reconciliation")) {
      return { ...section, items: [] };
    }

    const filteredItems = section.items.filter(item => {
      if (item.path === "/setup/fbr" && !isModuleEnabled("fbr_integration")) return false;
      if ((item.path === "/barcodes" || item.path === "/utilities/custom-labels") && !isModuleEnabled("barcode_printing")) return false;
      if (item.path === "/pos/pending-payments" && !isModuleEnabled("credit_sales")) return false;

      return hasRouteAccess(item.path);
    });

    return { ...section, items: filteredItems };
  };


  return (
    <TooltipProvider>
      <aside
        className={cn(
          "h-full bg-sidebar md:rounded-xl md:border border-sidebar-border md:shadow-sm flex flex-col transition-all duration-300 ease-in-out print:hidden overflow-hidden",
          collapsed ? "w-20" : "w-64"
        )}
      >
        {/* Logo Area with Collapse Toggle */}
        <div className="pl-2 pr-2 py-3 border-b border-sidebar-border">
          <div className="flex items-center justify-between">
            {collapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setCollapsed(false)}
                    className="w-10 h-10 mx-auto rounded-lg flex items-center justify-center hover:bg-sidebar-accent transition-colors active:scale-95"
                  >
                    <img
                      src="/favicon.png"
                      alt="Logo"
                      className="w-8 h-8 object-contain"
                    />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>Expand Sidebar</p>
                </TooltipContent>
              </Tooltip>
            ) : (
              <>
                <div className="flex items-center gap-2 animate-fade-in min-w-0 flex-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setCollapsed(true)}
                        className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-sidebar-accent transition-colors active:scale-95 flex-shrink-0"
                      >
                        <img
                          src="/favicon.png"
                          alt="Logo"
                          className="w-7 h-7 object-contain"
                        />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p>Minimize Sidebar</p>
                    </TooltipContent>
                  </Tooltip>

                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-xs font-bold text-foreground truncate">
                      {currentStore?.name || "Retail POS"}
                    </span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] text-muted-foreground font-mono truncate">
                        /{currentStore?.slug || 'teststore'}
                      </span>
                      <span className={`text-[9px] font-semibold px-1 rounded ${
                        fbrEnvironment === 'sandbox'
                          ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                          : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                      }`}>
                        {fbrEnvironment === 'sandbox' ? '🧪 Sandbox' : '🟢 Live'}
                      </span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {/* Superadmin Quick Access */}
          {isSuperAdmin && (
            <div className="mb-2 pb-2 border-b border-sidebar-border">
              <NavLink
                to="/superadmin"
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all",
                    isActive
                      ? "bg-amber-500 text-white shadow-sm"
                      : "bg-amber-500/10 text-amber-900 dark:text-amber-300 hover:bg-amber-500/20"
                  )
                }
              >
                <Crown className="w-4 h-4 text-amber-500" />
                <span>Superadmin Hub</span>
              </NavLink>
            </div>
          )}

          {navigationConfig.map((section, index) => {
            const filteredSection = getFilteredSection(section);
            if (filteredSection.items.length === 0) return null;

            // Render Main Section (No collapsible header, just items)
            if (section.title === "Main") {
              return (
                <div key={section.title || index} className="space-y-1 mb-2">
                  {filteredSection.items.map((item) => {
                    const isActive = location.pathname === item.path;
                    return (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group",
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : "text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        )}
                      >
                        <item.icon className={cn(
                          "w-5 h-5 flex-shrink-0 transition-transform duration-200",
                          !isActive && "group-hover:scale-110"
                        )} />
                        {!collapsed && (
                          <span className="text-sm font-medium animate-slide-down">
                            {item.title}
                          </span>
                        )}
                      </NavLink>
                    );
                  })}
                </div>
              );
            }

            // Render Collapsible Section
            const isExpanded = expandedSections[section.title!] || false;
            // Check if any child is active to highlight section header
            const isSectionActive = filteredSection.items.some(
              item => location.pathname.startsWith(item.path)
            );

            return (
              <Collapsible
                key={section.title || index}
                open={!collapsed && isExpanded}
                onOpenChange={() => !collapsed && toggleSection(section.title!)}
                className="pt-2"
              >
                <CollapsibleTrigger asChild>
                  <button
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group Select-none",
                      isSectionActive
                        ? "bg-primary/10 text-primary"
                        : "text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    )}
                  >
                    {/* Icons */}
                    {section.title === "Point of Sale" && <ShoppingCart className="w-5 h-5 flex-shrink-0" />}
                    {section.title === "Reconciliation" && <Scale className="w-5 h-5 flex-shrink-0" />}
                    {section.title === "Online Store" && <Globe className="w-5 h-5 flex-shrink-0" />}
                    {section.title === "Order Book" && <BookOpen className="w-5 h-5 flex-shrink-0" />}
                    {section.title === "Reports" && <Receipt className="w-5 h-5 flex-shrink-0" />}
                    {section.title === "Inventory" && <Warehouse className="w-5 h-5 flex-shrink-0" />}
                    {section.title === "Accounts" && <BookOpen className="w-5 h-5 flex-shrink-0" />}

                    {section.title === "Setup" && <Settings className="w-5 h-5 flex-shrink-0" />}
                    {section.title === "Utilities" && <Wrench className="w-5 h-5 flex-shrink-0" />}

                    {!collapsed && (
                      <>
                        <span className="text-sm font-medium flex-1 text-left animate-slide-down">
                          {section.title}
                        </span>
                        {section.title === "Setup" && pendingDevicesCount > 0 && (
                          <span className="flex h-2 w-2 rounded-full bg-destructive animate-pulse mr-2" />
                        )}
                        <ChevronDown className={cn(
                          "w-4 h-4 transition-transform duration-200",
                          isExpanded && "rotate-180"
                        )} />
                      </>
                    )}
                  </button>
                </CollapsibleTrigger>

                <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
                  <div className="ml-4 mt-1 space-y-1 border-l-2 border-sidebar-border pl-3">
                    {filteredSection.items.map((item) => {
                      const isActive = location.pathname === item.path || (item.path !== "/" && location.pathname.startsWith(`${item.path}/`));
                      return (
                        <NavLink
                          key={item.path}
                          to={item.path}
                          className={cn(
                            "flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-200 group text-sm",
                            isActive
                              ? "bg-primary text-primary-foreground"
                              : "text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                          )}
                        >
                          <item.icon className="w-4 h-4 flex-shrink-0" />
                          <span className="font-medium">{item.title}</span>
                        </NavLink>
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </nav>


        {/* User Info & Actions */}
        <div className="p-3 border-t border-sidebar-border space-y-3">
          {!collapsed && user && (
            <div className="px-3 py-2 text-xs text-sidebar-muted truncate animate-fade-in">
              <div className="flex items-center gap-1">
                {isAdmin && <span className="text-primary font-medium">Admin:</span>}
                {user.email}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className={cn(
            "flex gap-2 items-center",
            collapsed ? "flex-col items-center" : "justify-center"
          )}>
            {isAdmin && (
              <>
                <NotificationCenter className={collapsed ? "w-10 h-10" : "flex-1 h-10"} />
                <IntercomCallWidget collapsed={collapsed} />
              </>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setSignOutOpen(true)}
                  className={cn(
                    "flex items-center justify-center rounded-lg text-sidebar-muted hover:bg-destructive/10 hover:text-destructive transition-all active:scale-95",
                    collapsed ? "w-10 h-10" : "flex-1 h-10"
                  )}
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side={collapsed ? "right" : "top"}>
                <p>Sign Out</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Sign Out Confirmation Dialog */}
        <Dialog open={signOutOpen} onOpenChange={setSignOutOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Sign Out</DialogTitle>
              <DialogDescription>
                Are you sure you want to sign out? You will need to log in again to access your account.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSignOutOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleSignOut}>
                Sign Out
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </aside>
    </TooltipProvider>
  );
}
